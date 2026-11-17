import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

const testUrl =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test';

describe('smoke', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    loadConfig(); // also loads the root .env
    db = createDb(process.env.TEST_DATABASE_URL ?? testUrl);
    await runMigrations(db);
    app = await buildApp({ db });
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('starts the API and reaches Postgres via /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'up' });
  });

  it('migration runner is idempotent and tracks state in the DB', async () => {
    expect(await runMigrations(db)).toEqual([]);
    const { rows } = await sql<{
      n: string;
    }>`select count(*)::text as n from kysely_migration`.execute(db);
    expect(rows).toHaveLength(1);
  });
});
