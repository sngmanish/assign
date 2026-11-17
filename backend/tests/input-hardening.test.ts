import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { encodeCursor, isValidTimestamp } from '../src/contacts/cursor.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

const NUL = '\u0000';
const UUID = '00000000-0000-4000-8000-000000000000';
const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test';

describe('values Postgres cannot store never cause a 500', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let id: string;

  beforeAll(async () => {
    loadConfig();
    db = createDb(URL);
    await runMigrations(db);
    app = await buildApp({ db });
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
    id = (
      await db
        .insertInto('contacts')
        .values({ first_name: 'Ada', last_name: 'L', email: 'ada@x.com' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  const cursor = (sort: 'name' | 'createdAt', keys: string[]) =>
    encodeURIComponent(
      encodeCursor({
        sort,
        order: sort === 'name' ? 'asc' : 'desc',
        dir: 'next',
        keys,
        page: null,
      }),
    );

  // [name, request, expected status]. 422 for a body field, 400 for query, path or cursor.
  // Requests are functions because `id` only exists once beforeEach has run.
  const patch = (payload: object) => () => ({
    method: 'PATCH' as const,
    url: `/contacts/${id}`,
    payload: { version: 1, ...payload },
  });
  const bad: [string, () => object, number][] = [
    ['PATCH firstName', patch({ firstName: `a${NUL}b` }), 422],
    ['PATCH lastName', patch({ lastName: `a${NUL}` }), 422],
    ['PATCH company', patch({ company: `a${NUL}b` }), 422],
    ['PATCH phone', patch({ phone: `1${NUL}2` }), 422],
    ['PATCH email', patch({ email: `a${NUL}@x.com` }), 422],
    ['search q', () => ({ url: '/contacts?q=a%00b' }), 400],
    ['company filter', () => ({ url: '/contacts?company=a%00b' }), 400],
    [
      'add tag by name',
      () => ({ method: 'POST', url: `/contacts/${id}/tags`, payload: { name: `x${NUL}` } }),
      422,
    ],
    [
      'bulk assign by name',
      () => ({
        method: 'POST',
        url: '/tags/bulk-assign',
        payload: { contactIds: [id], name: `x${NUL}` },
      }),
      422,
    ],
    [
      'cursor name key',
      () => ({ url: `/contacts?sort=name&cursor=${cursor('name', [`a${NUL}`, 'b', UUID])}` }),
      400,
    ],
    [
      'cursor name key (2nd)',
      () => ({ url: `/contacts?sort=name&cursor=${cursor('name', ['a', `b${NUL}`, UUID])}` }),
      400,
    ],
  ];

  it.each(bad)(
    '%s with a NUL character is a client error in the standard shape',
    async (_n, req, status) => {
      const res = await app.inject(req());
      expect(res.statusCode).toBe(status);
      const { error } = res.json();
      expect(error.code).toBe(status === 422 ? 'VALIDATION_ERROR' : 'BAD_REQUEST');
      expect(Object.keys(error).sort()).toEqual(['code', 'details', 'message']);
    },
  );

  it('nothing was written by the rejected requests', async () => {
    for (const [, req] of bad) await app.inject(req());
    const row = await db.selectFrom('contacts').selectAll().executeTakeFirstOrThrow();
    expect([row.first_name, row.last_name, row.company, row.version]).toEqual([
      'Ada',
      'L',
      null,
      1,
    ]);
    expect(await db.selectFrom('tags').selectAll().execute()).toEqual([]);
    expect(await db.selectFrom('contact_activities').selectAll().execute()).toEqual([]);
  });

  describe('cursor timestamps', () => {
    const impossible = [
      '2025-13-45 99:99:99+00',
      '2025-02-30 10:00:00+00', // Feb 30
      '2025-02-29 10:00:00+00', // not a leap year
      '1900-02-29 10:00:00+00', // century, not a leap year
      '2025-04-31 10:00:00+00',
      '2025-00-10 10:00:00+00',
      '2025-06-00 10:00:00+00',
      '2025-06-10 24:00:00+00',
      '2025-06-10 10:60:00+00',
      '2025-06-10 10:00:60+00',
      '0000-06-10 10:00:00+00',
      '2025-06-10 10:00:00+99',
      '2025-06-10 10:00:00+05:99',
      '2025-06-10T10:00:00+00', // wrong shape
    ];
    it.each(impossible)('%s is a 400 invalid cursor, not a 500', async (ts) => {
      const res = await app.inject(`/contacts?cursor=${cursor('createdAt', [ts, UUID])}`);
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatchObject({ code: 'BAD_REQUEST', message: 'Invalid cursor' });
    });

    const possible = [
      '2024-02-29 10:00:00+00', // leap day
      '2000-02-29 10:00:00+00', // divisible by 400
      '2025-12-31 23:59:59.999999+00',
      '2025-06-10 10:00:00.5+05:30',
      '2025-06-10 00:00:00-08',
      '2025-06-10 10:00:00+15',
    ];
    it.each(possible)('%s still works', async (ts) => {
      expect(isValidTimestamp(ts)).toBe(true);
      const res = await app.inject(`/contacts?cursor=${cursor('createdAt', [ts, UUID])}`);
      expect(res.statusCode).toBe(200);
    });
  });
});

describe('a query that runs too long', () => {
  it('is cancelled by the server and answered as a documented 503, not a 500 or a hang', async () => {
    loadConfig();
    const db = createDb(URL, { statementTimeoutMs: 100 });
    const app = await buildApp({ db });
    app.get('/slow', async () => sql`select pg_sleep(3)`.execute(db));
    try {
      const started = Date.now();
      const res = await app.inject('/slow');
      expect(Date.now() - started).toBeLessThan(2500);
      expect(res.statusCode).toBe(503);
      expect(res.headers['retry-after']).toBe('10');
      expect(res.json().error).toMatchObject({
        code: 'QUERY_TIMEOUT',
        details: { requestId: expect.any(String) },
      });
      expect(JSON.stringify(res.json())).not.toMatch(/57014|pg_sleep|statement/i);
    } finally {
      await app.close();
      await db.destroy();
    }
  });
});
