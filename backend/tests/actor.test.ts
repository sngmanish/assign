import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

interface Activity {
  type: string;
  actor: string | null;
}

describe('X-Actor demo label', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let ids: string[];
  let tagId: string;

  beforeAll(async () => {
    loadConfig();
    db = createDb(
      process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test',
    );
    await runMigrations(db);
    app = await buildApp({ db, corsOrigin: 'https://crm.example.com' });
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
    ids = (
      await db
        .insertInto('contacts')
        .values([
          { first_name: 'Ada', last_name: 'Lovelace' },
          { first_name: 'Grace', last_name: 'Hopper' },
          { first_name: 'Alan', last_name: 'Turing' },
        ])
        .returning('id')
        .execute()
    ).map((r) => r.id);
    tagId = (
      await db.insertInto('tags').values({ name: 'vip' }).returning('id').executeTakeFirstOrThrow()
    ).id;
  });

  const send = async (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    headers: Record<string, string | string[]>,
    payload?: object,
  ) => {
    const res = await app.inject({ method, url, headers, payload });
    return { status: res.statusCode, body: res.json() };
  };
  const activities = async (id: string): Promise<Activity[]> =>
    (await send('GET', `/contacts/${id}/activities`, {})).body.items;

  it('stores the actor on CONTACT_UPDATED', async () => {
    const r = await send(
      'PATCH',
      `/contacts/${ids[0]}`,
      { 'x-actor': 'Alice' },
      { version: 1, company: 'Acme' },
    );
    expect(r.status).toBe(200);
    expect(await activities(ids[0]!)).toMatchObject([{ type: 'CONTACT_UPDATED', actor: 'Alice' }]);
  });

  it('stores the actor on TAG_ADDED and TAG_REMOVED', async () => {
    const add = await send('POST', `/contacts/${ids[0]}/tags`, { 'x-actor': 'Bob' }, { tagId });
    expect(add.status).toBe(200);
    const del = await send('DELETE', `/contacts/${ids[0]}/tags/${tagId}`, { 'x-actor': 'Priya' });
    expect(del.status).toBe(200);
    // newest first
    expect(await activities(ids[0]!)).toMatchObject([
      { type: 'TAG_REMOVED', actor: 'Priya' },
      { type: 'TAG_ADDED', actor: 'Bob' },
    ]);
  });

  it('stores the actor on every row of a bulk assign', async () => {
    const r = await send(
      'POST',
      '/tags/bulk-assign',
      { 'x-actor': 'Alice' },
      { contactIds: ids, tagId },
    );
    expect(r.body.added).toBe(3);
    for (const id of ids) {
      expect(await activities(id)).toMatchObject([{ type: 'TAG_ADDED', actor: 'Alice' }]);
    }
  });

  it('trims the header', async () => {
    await send(
      'PATCH',
      `/contacts/${ids[0]}`,
      { 'x-actor': '  Alice  ' },
      { version: 1, company: 'Acme' },
    );
    expect((await activities(ids[0]!))[0]!.actor).toBe('Alice');
  });

  it('accepts a 50-character name', async () => {
    const name = 'a'.repeat(50);
    await send(
      'PATCH',
      `/contacts/${ids[0]}`,
      { 'x-actor': name },
      { version: 1, company: 'Acme' },
    );
    expect((await activities(ids[0]!))[0]!.actor).toBe(name);
  });

  it.each([
    ['missing', {}],
    ['empty', { 'x-actor': '' }],
    ['blank', { 'x-actor': '   ' }],
    ['sent twice (Node joins it into "Alice, Bob")', { 'x-actor': 'Alice, Bob' }],
    ['too long (51 chars)', { 'x-actor': 'a'.repeat(51) }],
    [
      'too long once trimmed is fine, but 51 after trim is not',
      { 'x-actor': ` ${'b'.repeat(51)} ` },
    ],
  ])(
    'uses "Anonymous" when the header is %s, and does not reject the request',
    async (_n, headers) => {
      const r = await send('PATCH', `/contacts/${ids[0]}`, headers, {
        version: 1,
        company: 'Acme',
      });
      expect(r.status).toBe(200);
      expect((await activities(ids[0]!))[0]!.actor).toBe('Anonymous');
    },
  );

  it('does not change the 409 conflict response', async () => {
    await send(
      'PATCH',
      `/contacts/${ids[0]}`,
      { 'x-actor': 'Bob' },
      { version: 1, company: 'Bobs' },
    );
    const r = await send(
      'PATCH',
      `/contacts/${ids[0]}`,
      { 'x-actor': 'Alice' },
      { version: 1, company: 'Alices' },
    );
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('VERSION_CONFLICT');
    expect(r.body.error.details.latest).toMatchObject({ company: 'Bobs', version: 2 });
    expect(Object.keys(r.body.error.details)).toEqual(['latest']);
  });

  it('returns null for activity rows written before the column existed', async () => {
    await db
      .insertInto('contact_activities')
      .values({ contact_id: ids[0]!, type: 'TAG_ADDED', details: {} })
      .execute();
    expect((await activities(ids[0]!))[0]!.actor).toBeNull();
  });

  it('lets browsers send X-Actor cross-origin (CORS preflight)', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: `/contacts/${ids[0]}`,
      headers: {
        origin: 'https://crm.example.com',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type,x-actor',
      },
    });
    expect(res.statusCode).toBe(204);
    expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain('x-actor');
  });
});
