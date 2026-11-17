import type { FastifyError, FastifyInstance } from 'fastify';
import pg from 'pg';
import { ZodError, type ZodType } from 'zod';

/** Every error response has this shape: { error: { code, message, details } } */
export interface ErrorBody {
  error: { code: string; message: string; details: unknown };
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);

// Field-level details. Unknown keys are reported one per key, with the key as the path.
const zodDetails = (err: ZodError) =>
  err.issues.flatMap((i) =>
    i.code === 'unrecognized_keys'
      ? i.keys.map((key) => ({ path: [...i.path, key].join('.'), message: 'Unknown field' }))
      : [{ path: i.path.join('.'), message: i.message }],
  );

/** Parse query/path params. A failure is a malformed request: 400. */
export function parseRequest<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid request parameters', zodDetails(result.error));
  }
  return result.data;
}

/** Parse a JSON body. A field validation failure is 422 with field-level details. */
export function parseBody<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Validation failed', zodDetails(result.error));
  }
  return result.data;
}

const CLIENT_ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'RATE_LIMITED',
};

/**
 * Failures that are the database being busy, not a bug: a deadlock (40P01), a serialization
 * failure (40001), a lock wait that timed out (55P03), a statement cancelled by
 * statement_timeout (57014), or no free pool connection in time. The right answer is
 * "try again", not a 500.
 */
export function isTransientDbError(err: unknown): boolean {
  if (err instanceof pg.DatabaseError) {
    return ['40P01', '40001', '55P03'].includes(err.code ?? '');
  }
  return err instanceof Error && err.message === 'timeout exceeded when trying to connect';
}

/**
 * A query that ran too long: cancelled by statement_timeout (57014), or the client gave up
 * waiting for it ("Query read timeout"). Unlike the transient errors above, retrying at once
 * re-runs the same expensive query, so the answer asks the client to wait longer and narrow it.
 */
export function isQueryTimeout(err: unknown): boolean {
  if (err instanceof pg.DatabaseError) return err.code === '57014';
  return err instanceof Error && err.message === 'Query read timeout';
}

/**
 * Postgres rejected a value the client sent: NUL in text (22021), bad encoding (22P05), an
 * impossible date or time (22007, 22008), a malformed literal (22P02). Validation should have
 * caught it at the boundary; this is the last line of defence so a missed field is a 400,
 * not a 500 that anyone can use to fill the error log.
 */
const BAD_INPUT_CODES = ['22021', '22P05', '22007', '22008', '22P02'];
export function isBadInputDbError(err: unknown): boolean {
  return err instanceof pg.DatabaseError && BAD_INPUT_CODES.includes(err.code ?? '');
}

export function registerErrorHandling(app: FastifyInstance): void {
  const body = (code: string, message: string, details: unknown = null): ErrorBody => ({
    error: { code, message, details },
  });

  app.setNotFoundHandler((req, reply) =>
    reply.code(404).send(body('NOT_FOUND', `Route ${req.method} ${req.url} not found`)),
  );

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(body(err.code, err.message, err.details));
    }
    // Fastify's own 4xx (invalid JSON, unsupported media type, ...) are client errors.
    const status = (err as FastifyError).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply
        .code(status)
        .send(body(CLIENT_ERROR_CODES[status] ?? 'BAD_REQUEST', err.message));
    }
    // The request id is in every log line for this request, so a user who reports it gives
    // us something to search for. Nothing else about the failure is returned.
    const details = { requestId: req.id };
    if (isBadInputDbError(err)) {
      // Warn, not error: it is a client mistake, but worth seeing if a field was missed.
      req.log.warn({ err, actor: req.actor }, 'database rejected a client value');
      return reply.code(400).send(body('BAD_REQUEST', 'Invalid input value', details));
    }
    if (isQueryTimeout(err)) {
      req.log.warn({ err, actor: req.actor }, 'query timed out');
      return reply
        .code(503)
        .header('Retry-After', '10')
        .send(
          body('QUERY_TIMEOUT', 'This took too long. Narrow the search and try again.', details),
        );
    }
    if (isTransientDbError(err)) {
      req.log.warn({ err, actor: req.actor }, 'transient database error');
      return reply
        .code(503)
        .header('Retry-After', '1')
        .send(body('TEMPORARILY_UNAVAILABLE', 'The service is busy. Please try again.', details));
    }
    // Anything else is unexpected: log it, leak nothing.
    req.log.error({ err, actor: req.actor }, 'unhandled error');
    return reply.code(500).send(body('INTERNAL_ERROR', 'Internal server error', details));
  });
}
