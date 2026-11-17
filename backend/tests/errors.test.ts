import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import pg from 'pg';
import { registerActor } from '../src/actor.js';
import {
  AppError,
  isBadInputDbError,
  isQueryTimeout,
  isTransientDbError,
  registerErrorHandling,
} from '../src/errors.js';

const dbError = (code: string) =>
  Object.assign(new pg.DatabaseError(`pg error ${code}`, 0, 'error'), { code });

async function appThrowing(err: unknown) {
  const app = Fastify();
  registerErrorHandling(app);
  registerActor(app);
  app.get('/boom', async () => {
    throw err;
  });
  return app;
}

describe('error responses for database trouble', () => {
  it.each([
    ['deadlock', '40P01'],
    ['serialization failure', '40001'],
    ['lock timeout', '55P03'],
  ])('%s becomes a retryable 503, not a 500', async (_name, code) => {
    const app = await appThrowing(dbError(code));
    const res = await app.inject('/boom');
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('1');
    const { error } = res.json();
    expect(error.code).toBe('TEMPORARILY_UNAVAILABLE');
    expect(error.message).not.toContain(code); // nothing internal leaks
    expect(error.details.requestId).toEqual(expect.any(String));
  });

  it.each([
    ['cancelled by statement_timeout', dbError('57014')],
    ['the client gave up waiting', new Error('Query read timeout')],
  ])(
    'a query that ran too long (%s) is a 503 QUERY_TIMEOUT telling the client to wait longer',
    async (_n, err) => {
      const res = await (await appThrowing(err)).inject('/boom');
      expect(res.statusCode).toBe(503);
      expect(res.headers['retry-after']).toBe('10'); // not 1: retrying at once re-runs the costly query
      expect(res.json().error.code).toBe('QUERY_TIMEOUT');
      expect(res.json().error.details.requestId).toEqual(expect.any(String));
      expect(isTransientDbError(err)).toBe(false);
      expect(isQueryTimeout(err)).toBe(true);
    },
  );

  it.each(['22021', '22P05', '22007', '22008', '22P02'])(
    'database error %s (a value Postgres rejects) is a 400, never a 500',
    async (code) => {
      const res = await (await appThrowing(dbError(code))).inject('/boom');
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Invalid input value',
      });
      expect(JSON.stringify(res.json())).not.toContain(code);
      expect(isBadInputDbError(dbError(code))).toBe(true);
    },
  );

  it('a pool that cannot hand out a connection in time is a 503', async () => {
    const app = await appThrowing(new Error('timeout exceeded when trying to connect'));
    expect((await app.inject('/boom')).statusCode).toBe(503);
  });

  it('an unexpected error is a 500 that leaks nothing but carries a request id', async () => {
    const app = await appThrowing(new Error('secret table name users_internal'));
    const res = await app.inject('/boom');
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.json())).not.toContain('secret');
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
    expect(res.json().error.details.requestId).toEqual(expect.any(String));
  });

  it('a different database error (a constraint violation) is still a 500', async () => {
    const res = await (await appThrowing(dbError('23505'))).inject('/boom');
    expect(res.statusCode).toBe(500);
  });

  it('request ids differ per request', async () => {
    const app = await appThrowing(new Error('x'));
    const a = (await app.inject('/boom')).json().error.details.requestId;
    const b = (await app.inject('/boom')).json().error.details.requestId;
    expect(a).not.toBe(b);
  });

  it('application errors keep their own status and shape', async () => {
    const res = await (await appThrowing(new AppError(409, 'X', 'm', { a: 1 }))).inject('/boom');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'X', message: 'm', details: { a: 1 } } });
  });

  it('isTransientDbError', () => {
    expect(isTransientDbError(dbError('40P01'))).toBe(true);
    expect(isTransientDbError(dbError('23505'))).toBe(false);
    expect(isTransientDbError(new Error('boom'))).toBe(false);
    expect(isTransientDbError('40P01')).toBe(false);
  });
});
