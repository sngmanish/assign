import type { FastifyError, FastifyInstance } from 'fastify';
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

const zodDetails = (err: ZodError) =>
  err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));

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
};

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
    // Anything else is unexpected: log it, leak nothing.
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send(body('INTERNAL_ERROR', 'Internal server error'));
  });
}
