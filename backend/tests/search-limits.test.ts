import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { MAX_SEARCH_TERMS } from '../src/contacts/list.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

describe('search input limits', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    loadConfig();
    db = createDb(
      process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test',
    );
    await runMigrations(db);
    app = await buildApp({ db });
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
    await db
      .insertInto('contacts')
      .values([
        { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@analytical.com' },
        { first_name: 'Alan', last_name: 'Turing', email: 'alan@bletchley.org' },
      ])
      .execute();
  });

  const search = async (q: string) => {
    const res = await app.inject({ url: `/contacts?q=${encodeURIComponent(q)}` });
    return { status: res.statusCode, body: res.json() };
  };

  it(`allows up to ${MAX_SEARCH_TERMS} words, short ones included`, async () => {
    const r = await search('alan @ b l a');
    expect(r.status).toBe(200);
    expect(r.body.items.map((c: { firstName: string }) => c.firstName)).toEqual(['Alan']);
  });

  it(`rejects more than ${MAX_SEARCH_TERMS} words with a 400 naming the field`, async () => {
    const r = await search('a b c d e f');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('BAD_REQUEST');
    expect(r.body.error.details).toEqual([
      { path: 'q', message: `Use at most ${MAX_SEARCH_TERMS} search words` },
    ]);
  });

  it('rejects the worst case: 100 characters of single letters', async () => {
    const q = Array.from({ length: 50 }, (_, i) => String.fromCharCode(97 + (i % 26))).join(' ');
    expect(q.length).toBe(99);
    expect((await search(q)).status).toBe(400);
  });

  it('counts words, not spaces: runs of whitespace and edges do not matter', async () => {
    expect((await search('   ada      lovelace   ')).status).toBe(200);
    expect((await search('a    b    c    d    e')).status).toBe(200);
  });

  it('a blank search is no search, not an error', async () => {
    expect((await search('     ')).status).toBe(200);
  });
});
