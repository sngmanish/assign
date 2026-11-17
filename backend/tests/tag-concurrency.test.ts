import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

// Single tag changes and bulk assign take row locks on the same contact. If they took them
// in different orders they would deadlock (Postgres 40P01, surfaced as a 500). These tests
// race them against each other, many times, on the same contact and tag.
const ROUNDS = 50;
const OTHERS = 300; // enough extra contacts that a bulk request takes real time

describe('single tag change vs bulk assign, raced', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let contactId: string;
  let tagId: string;
  let others: string[];

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
    const rows = await db
      .insertInto('contacts')
      .values(
        Array.from({ length: OTHERS + 1 }, (_, i) => ({ first_name: `C${i}`, last_name: 'Z' })),
      )
      .returning('id')
      .execute();
    [contactId, ...others] = rows.map((r) => r.id) as [string, ...string[]];
    tagId = (
      await db.insertInto('tags').values({ name: 'vip' }).returning('id').executeTakeFirstOrThrow()
    ).id;
  });

  const bulk = () =>
    app.inject({
      method: 'POST',
      url: '/tags/bulk-assign',
      payload: { contactIds: [contactId, ...others], tagId },
    });
  const links = async () =>
    (
      await db
        .selectFrom('contact_tags')
        .select('tag_id')
        .where('contact_id', '=', contactId)
        .where('tag_id', '=', tagId)
        .execute()
    ).length;
  const activityCount = async (type: string) =>
    Number(
      (
        await db
          .selectFrom('contact_activities')
          .select(sql<string>`count(*)`.as('n'))
          .where('contact_id', '=', contactId)
          .where('type', '=', type as 'TAG_ADDED')
          .executeTakeFirstOrThrow()
      ).n,
    );

  it(`add (by id) vs bulk: no 500s, one link, one TAG_ADDED (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await sql`TRUNCATE contact_tags, contact_activities`.execute(db);
      const [add, b] = await Promise.all([
        app.inject({ method: 'POST', url: `/contacts/${contactId}/tags`, payload: { tagId } }),
        bulk(),
      ]);
      expect([add.statusCode, b.statusCode], `round ${i}`).toEqual([200, 200]);
      expect(await links(), `round ${i}`).toBe(1);
      expect(await activityCount('TAG_ADDED'), `round ${i}`).toBe(1);
    }
  });

  it(`add (by new name) vs bulk by the same name: no 500s (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await sql`TRUNCATE contact_tags, contact_activities, tags CASCADE`.execute(db);
      const [add, b] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/contacts/${contactId}/tags`,
          payload: { name: 'New' },
        }),
        app.inject({
          method: 'POST',
          url: '/tags/bulk-assign',
          payload: { contactIds: [contactId, ...others], name: 'new' },
        }),
      ]);
      expect([add.statusCode, b.statusCode], `round ${i}`).toEqual([200, 200]);
      expect(await activityCount('TAG_ADDED'), `round ${i}`).toBe(1);
    }
  });

  it(`remove vs bulk: no 500s, and the result matches one of the two orders (${ROUNDS} rounds)`, async () => {
    for (let i = 0; i < ROUNDS; i++) {
      await sql`TRUNCATE contact_tags, contact_activities`.execute(db);
      await db
        .insertInto('contact_tags')
        .values({ contact_id: contactId, tag_id: tagId })
        .execute();
      const [rm, b] = await Promise.all([
        app.inject({ method: 'DELETE', url: `/contacts/${contactId}/tags/${tagId}` }),
        bulk(),
      ]);
      expect([rm.statusCode, b.statusCode], `round ${i}`).toEqual([200, 200]);
      expect(await activityCount('TAG_REMOVED'), `round ${i}`).toBe(1);
      // remove first, then bulk re-adds it; or bulk skips it (already tagged), then remove.
      const added = await activityCount('TAG_ADDED');
      expect([await links(), added], `round ${i}`).toEqual((await links()) === 1 ? [1, 1] : [0, 0]);
    }
  });
});
