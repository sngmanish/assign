import { afterEach, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, sslOptions, type Database } from '../src/db/index.js';
import { isQueryTimeout, isTransientDbError } from '../src/errors.js';

loadConfig();
const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test';

describe('database pool resilience', () => {
  const open: Kysely<Database>[] = [];
  const make = (opts: Parameters<typeof createDb>[1] = {}) => {
    const d = createDb(URL, opts);
    open.push(d);
    return d;
  };
  afterEach(async () => {
    await Promise.all(open.splice(0).map((d) => d.destroy()));
  });

  it('survives an idle connection being killed, and the pool recovers', async () => {
    const errors: Error[] = [];
    const db = make({ onPoolError: (e) => errors.push(e) });
    const killer = make();
    await sql`select 1`.execute(db); // leaves one idle connection in the pool
    const { pid } = (await sql<{ pid: number }>`select pg_backend_pid() as pid`.execute(db))
      .rows[0]!;
    await sql`select pg_terminate_backend(${pid})`.execute(killer);
    await new Promise((r) => setTimeout(r, 500));
    // Without a pool 'error' listener the process would already have crashed here.
    expect(errors).toHaveLength(1);
    expect((await sql<{ ok: number }>`select 1 as ok`.execute(db)).rows[0]!.ok).toBe(1);
  });

  it('a full pool fails fast: the query errors as transient, and /health answers 503', async () => {
    const db = make({ connectionTimeoutMs: 300 });
    // max is 10: occupy every connection
    const hogs = Array.from({ length: 10 }, () => sql`select pg_sleep(2)`.execute(db));
    await new Promise((r) => setTimeout(r, 200));

    const started = Date.now();
    const err = await sql`select 1`.execute(db).catch((e: unknown) => e);
    expect(Date.now() - started).toBeLessThan(1500);
    expect(isTransientDbError(err)).toBe(true);

    const app = await buildApp({ db });
    const health = await app.inject('/health');
    expect(health.statusCode).toBe(503);
    expect(health.json()).toEqual({ status: 'error', db: 'down' });
    await app.close();
    await Promise.allSettled(hogs);
  });

  it('a runaway statement is cancelled by the statement timeout', async () => {
    const db = make({ statementTimeoutMs: 300 });
    const started = Date.now();
    const err = await sql`select pg_sleep(5)`.execute(db).catch((e: unknown) => e);
    expect(Date.now() - started).toBeLessThan(2000);
    expect((err as { code?: string }).code).toBe('57014');
    expect(isQueryTimeout(err)).toBe(true);
  });

  it('without a timeout configured nothing is cancelled', async () => {
    const db = make();
    await sql`select pg_sleep(0.5)`.execute(db);
  });
});

describe('TLS options', () => {
  it('off means no TLS', () => {
    expect(sslOptions(false)).toBeUndefined();
    expect(sslOptions(undefined, 'PEM')).toBeUndefined();
  });
  it('on without a CA encrypts but does not verify', () => {
    expect(sslOptions(true)).toEqual({ rejectUnauthorized: false });
  });
  it('on with a CA verifies the certificate against it', () => {
    expect(sslOptions(true, 'PEM')).toEqual({ ca: 'PEM', rejectUnauthorized: true });
  });
});

describe('config: CA certificate and statement timeout', () => {
  const base = { DATABASE_URL: 'postgres://x/y' };
  it('reads DATABASE_CA_CERT, turning literal \\n into newlines', () => {
    expect(loadConfig({ ...base, DATABASE_CA_CERT: 'A\\nB' }).databaseCaCert).toBe('A\nB');
    expect(loadConfig(base).databaseCaCert).toBeUndefined();
    expect(loadConfig({ ...base, DATABASE_CA_CERT: '' }).databaseCaCert).toBeUndefined();
  });
  it('STATEMENT_TIMEOUT_MS defaults to 10 s and must be a positive integer', () => {
    expect(loadConfig(base).statementTimeoutMs).toBe(10_000);
    expect(loadConfig({ ...base, STATEMENT_TIMEOUT_MS: '2500' }).statementTimeoutMs).toBe(2500);
    expect(() => loadConfig({ ...base, STATEMENT_TIMEOUT_MS: '0' })).toThrow(
      /STATEMENT_TIMEOUT_MS/,
    );
    expect(() => loadConfig({ ...base, STATEMENT_TIMEOUT_MS: 'fast' })).toThrow(
      /STATEMENT_TIMEOUT_MS/,
    );
  });
});
