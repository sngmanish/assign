import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { contactsCount } from '../src/db/seed.js';
import { prepareDatabase, STARTUP_LOCK } from '../src/startup.js';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test';
const N = 300; // small seed so the tests stay fast

describe('startup: migrate then seed if empty', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    loadConfig();
    db = createDb(URL);
    await runMigrations(db);
  });
  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
  });
  afterAll(async () => {
    await db.destroy();
  });

  const start = (d = db, seed = true) => prepareDatabase(d, { seed, seedOptions: { count: N } });

  it('seeds an empty table', async () => {
    const r = await start();
    expect(r.seeded).toBe(true);
    expect(await contactsCount(db)).toBe(N);
  });

  it('a restart adds nothing and overwrites nothing', async () => {
    await start();
    const row = await db
      .selectFrom('contacts')
      .select(['id', 'version'])
      .orderBy('id')
      .executeTakeFirstOrThrow();
    await db
      .updateTable('contacts')
      .set({ company: 'Edited By Hand', version: row.version + 1 })
      .where('id', '=', row.id)
      .execute();
    const before = await db.selectFrom('contacts').selectAll().orderBy('id').execute();

    const r = await start();

    expect(r.seeded).toBe(false);
    expect(await contactsCount(db)).toBe(N);
    expect(await db.selectFrom('contacts').selectAll().orderBy('id').execute()).toEqual(before);
  });

  it('does not seed a table that already has even one contact', async () => {
    await db.insertInto('contacts').values({ first_name: 'Only', last_name: 'One' }).execute();
    const r = await start();
    expect(r.seeded).toBe(false);
    expect(await contactsCount(db)).toBe(1);
  });

  it('does not seed when seeding is switched off', async () => {
    const r = await start(db, false);
    expect(r.seeded).toBe(false);
    expect(await contactsCount(db)).toBe(0);
  });

  it('two instances starting at once seed exactly once', async () => {
    const a = createDb(URL);
    const b = createDb(URL);
    try {
      const results = await Promise.all([start(a), start(b)]);
      expect(results.filter((r) => r.seeded)).toHaveLength(1);
      expect(await contactsCount(db)).toBe(N);
    } finally {
      await a.destroy();
      await b.destroy();
    }
  });
});

describe('startup lock timeout', () => {
  it('fails with a lock timeout instead of waiting forever when another instance hangs', async () => {
    const holder = createDb(URL);
    const waiter = createDb(URL);
    try {
      await holder.connection().execute(async (conn) => {
        await sql`SELECT pg_advisory_lock(${STARTUP_LOCK})`.execute(conn); // the "hung" instance
        const started = Date.now();
        const err = await prepareDatabase(waiter, { lockTimeoutMs: 300 }).catch((e: unknown) => e);
        expect((err as { code?: string }).code).toBe('55P03');
        expect(Date.now() - started).toBeLessThan(3000);
        await sql`SELECT pg_advisory_unlock(${STARTUP_LOCK})`.execute(conn);
      });
      // and once the lock is free it works normally
      await expect(prepareDatabase(waiter, { seed: false })).resolves.toMatchObject({
        seeded: false,
      });
    } finally {
      await holder.destroy();
      await waiter.destroy();
    }
  });
});

describe('config: SSL and seed switches', () => {
  const base = { DATABASE_URL: 'postgres://x/y' };
  const PROD = { NODE_ENV: 'production', CORS_ORIGIN: 'https://a.app' };

  it('defaults: SSL only in production, seed on', () => {
    expect(loadConfig({ ...base }).ssl).toBe(false);
    expect(loadConfig({ ...base, ...PROD }).ssl).toBe(true);
    expect(loadConfig({ ...base }).seedOnStart).toBe(true);
  });

  it('DATABASE_SSL overrides the default either way', () => {
    expect(loadConfig({ ...base, ...PROD, DATABASE_SSL: 'false' }).ssl).toBe(false);
    expect(loadConfig({ ...base, DATABASE_SSL: 'true' }).ssl).toBe(true);
  });

  it('SEED_ON_START=false turns the startup seed off', () => {
    expect(loadConfig({ ...base, SEED_ON_START: 'false' }).seedOnStart).toBe(false);
    expect(loadConfig({ ...base, SEED_ON_START: 'true' }).seedOnStart).toBe(true);
  });

  it('rejects values that are not true or false, so typos are not silently ignored', () => {
    expect(() => loadConfig({ ...base, DATABASE_SSL: 'yes' })).toThrow(/DATABASE_SSL/);
    expect(() => loadConfig({ ...base, SEED_ON_START: '0' })).toThrow(/SEED_ON_START/);
  });

  it('requires DATABASE_URL in production and reads PORT and CORS_ORIGIN', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    const c = loadConfig({ ...base, PORT: '8080', CORS_ORIGIN: 'https://a.app' });
    expect(c.port).toBe(8080);
    expect(c.corsOrigin).toBe('https://a.app');
  });
});
