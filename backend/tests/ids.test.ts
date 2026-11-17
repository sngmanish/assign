import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { isUuid } from '../src/ids.js';

// Shaped like a UUID but not a valid one (version 1, variant bits 0001). Whether an id is
// valid must not depend on which endpoint or field receives it.
const ODD = '11111111-1111-1111-1111-111111111111';
const VALID = '00000000-0000-4000-8000-000000000000';

describe('one definition of a valid id', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let contactId: string;

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
    contactId = (
      await db
        .insertInto('contacts')
        .values({ first_name: 'Ada', last_name: 'L' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  it('isUuid accepts real UUIDs of any case and rejects the rest', () => {
    expect(isUuid(VALID)).toBe(true);
    expect(isUuid(VALID.toUpperCase())).toBe(true);
    expect(isUuid(contactId)).toBe(true);
    for (const bad of [ODD, 'nope', '', `${VALID} `, VALID.slice(1)])
      expect(isUuid(bad)).toBe(false);
  });

  const cases: [string, 'GET' | 'POST' | 'DELETE', () => string, (() => object) | undefined][] = [
    ['contact id in the path', 'GET', () => `/contacts/${ODD}`, undefined],
    ['contact id on the tags route', 'POST', () => `/contacts/${ODD}/tags`, () => ({ name: 'x' })],
    ['tagId in the delete path', 'DELETE', () => `/contacts/${contactId}/tags/${ODD}`, undefined],
    [
      'tagId in the add-tag body',
      'POST',
      () => `/contacts/${contactId}/tags`,
      () => ({ tagId: ODD }),
    ],
    [
      'tagId in the bulk body',
      'POST',
      () => '/tags/bulk-assign',
      () => ({ contactIds: [contactId], tagId: ODD }),
    ],
    [
      'contactIds in the bulk body',
      'POST',
      () => '/tags/bulk-assign',
      () => ({ contactIds: [ODD], name: 'x' }),
    ],
    ['tag filter on the list', 'GET', () => `/contacts?tag=${ODD}`, undefined],
    ['activities path', 'GET', () => `/contacts/${ODD}/activities`, undefined],
  ];

  it.each(cases)('%s: an invalid id is a 400 everywhere', async (_n, method, url, payload) => {
    const res = await app.inject({ method, url: url(), ...(payload && { payload: payload() }) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });
});
