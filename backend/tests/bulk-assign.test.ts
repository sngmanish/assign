import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

const MISSING = '00000000-0000-4000-8000-000000000000';
const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test';

describe('POST /tags/bulk-assign', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  const statements: string[] = [];
  let ids: string[]; // five seeded contacts

  beforeAll(async () => {
    loadConfig();
    db = createDb(process.env.TEST_DATABASE_URL ?? TEST_URL, {
      log: (e) => {
        if (e.level === 'query') statements.push(e.query.sql);
      },
    });
    await runMigrations(db);
    app = await buildApp({ db });
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
        .values(
          ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret'].map((n) => ({
            first_name: n,
            last_name: 'T',
            email: `${n.toLowerCase()}@x.com`,
          })),
        )
        .returning('id')
        .execute()
    ).map((r) => r.id);
  });

  const bulk = async (body: object) => {
    const res = await app.inject({ method: 'POST', url: '/tags/bulk-assign', payload: body });
    return { status: res.statusCode, body: res.json() };
  };
  const row = (id: string) =>
    db.selectFrom('contacts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  const links = (tagId?: string) => {
    let q = db.selectFrom('contact_tags').selectAll();
    if (tagId) q = q.where('tag_id', '=', tagId);
    return q.execute();
  };
  const acts = (contactId?: string) => {
    let q = db.selectFrom('contact_activities').selectAll().orderBy('created_at');
    if (contactId) q = q.where('contact_id', '=', contactId);
    return q.execute();
  };
  const allTags = () => db.selectFrom('tags').selectAll().execute();

  // ---------- core behaviour ----------

  it('tags many contacts, logs one TAG_ADDED per contact, and returns the counts', async () => {
    const r = await bulk({ contactIds: ids.slice(0, 3), name: 'Campaign' });
    expect(r).toEqual({ status: 200, body: { added: 3, alreadyTagged: 0, notFound: 0 } });

    const tag = (await allTags())[0]!;
    expect(tag.name).toBe('Campaign');
    expect((await links(tag.id)).map((l) => l.contact_id).sort()).toEqual(
      [...ids.slice(0, 3)].sort(),
    );

    const events = await acts();
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.type === 'TAG_ADDED')).toBe(true);
    expect(events.map((e) => e.contact_id).sort()).toEqual([...ids.slice(0, 3)].sort());
    for (const e of events) expect(e.details).toEqual({ tagId: tag.id, tagName: 'Campaign' });
    // contacts that were not selected are untouched
    expect(await acts(ids[3])).toEqual([]);
  });

  it('is idempotent: repeating the request changes nothing', async () => {
    await bulk({ contactIds: ids, name: 'Campaign' });
    const linksBefore = await links();
    const actsBefore = await acts();
    const rowsBefore = await Promise.all(ids.map(row));

    const again = await bulk({ contactIds: ids, name: 'Campaign' });
    expect(again.body).toEqual({ added: 0, alreadyTagged: 5, notFound: 0 });
    expect(await links()).toEqual(linksBefore);
    expect(await acts()).toEqual(actsBefore);
    expect(await Promise.all(ids.map(row))).toEqual(rowsBefore); // not even updated_at moved
    expect(await allTags()).toHaveLength(1);
  });

  it('mixed batch: skips already-tagged, counts unknown ids, logs only the newly tagged', async () => {
    const tag = await db
      .insertInto('tags')
      .values({ name: 'VIP' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db.insertInto('contact_tags').values({ contact_id: ids[0]!, tag_id: tag.id }).execute();
    const before0 = await row(ids[0]!);

    const r = await bulk({ contactIds: [ids[0], ids[1], ids[2], MISSING], tagId: tag.id });
    expect(r.body).toEqual({ added: 2, alreadyTagged: 1, notFound: 1 });

    expect((await acts()).map((e) => e.contact_id).sort()).toEqual([ids[1], ids[2]].sort());
    expect(await acts(ids[0])).toEqual([]); // already tagged: no event
    expect(await row(ids[0]!)).toEqual(before0); // and untouched
    expect(await links(tag.id)).toHaveLength(3);
  });

  it('counts always add up to the number of distinct ids', async () => {
    const r = await bulk({
      contactIds: [...ids, MISSING, '00000000-0000-4000-8000-000000000001'],
      name: 'X',
    });
    const { added, alreadyTagged, notFound } = r.body;
    expect(added + alreadyTagged + notFound).toBe(7);
    expect(notFound).toBe(2);
  });

  it('duplicate ids in the request are counted once', async () => {
    const r = await bulk({
      contactIds: [ids[0], ids[0], ids[0]!.toUpperCase(), ids[1], MISSING, MISSING],
      name: 'Dup',
    });
    expect(r.body).toEqual({ added: 2, alreadyTagged: 0, notFound: 1 });
    expect(await acts()).toHaveLength(2);
  });

  it('does not bump version (only updated_at), so open edits still save', async () => {
    const before = await row(ids[0]!);
    await bulk({ contactIds: [ids[0]], name: 'VIP' });
    const after = await row(ids[0]!);
    expect(after.version).toBe(before.version);
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime(),
    );

    const patch = await app.inject({
      method: 'PATCH',
      url: `/contacts/${ids[0]}`,
      payload: { version: before.version, company: 'Analytical' },
    });
    expect(patch.statusCode).toBe(200);
  });

  it('works with a tagId, and an unknown tagId is 404 with nothing changed', async () => {
    const tag = await db
      .insertInto('tags')
      .values({ name: 'Lead' })
      .returning('id')
      .executeTakeFirstOrThrow();
    expect((await bulk({ contactIds: ids, tagId: tag.id })).body.added).toBe(5);

    const r = await bulk({ contactIds: ids, tagId: MISSING });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
    // unknown tag is a 404 even when none of the contacts exist
    expect((await bulk({ contactIds: [MISSING], tagId: MISSING })).status).toBe(404);
  });

  it('tag names are case-insensitive and reuse the existing tag', async () => {
    await bulk({ contactIds: [ids[0]], name: 'VIP' });
    const r = await bulk({ contactIds: [ids[1]], name: '  vip ' });
    expect(r.body.added).toBe(1);
    const tags = await allTags();
    expect(tags).toHaveLength(1);
    expect(tags[0]!.name).toBe('VIP');
    expect(await links(tags[0]!.id)).toHaveLength(2);
  });

  it('when no contact exists, reports notFound and does not create the tag', async () => {
    const r = await bulk({ contactIds: [MISSING], name: 'Orphan' });
    expect(r).toEqual({ status: 200, body: { added: 0, alreadyTagged: 0, notFound: 1 } });
    expect(await allTags()).toEqual([]);
  });

  it('tagged contacts appear in the tag filter of the list endpoint', async () => {
    await bulk({ contactIds: ids.slice(0, 4), name: 'Wave' });
    const tag = (await allTags())[0]!;
    const res = await app.inject({ method: 'GET', url: `/contacts?tag=${tag.id}` });
    expect(res.json().total).toBe(4);
  });

  // ---------- validation ----------

  describe('validation', () => {
    const none = async () => {
      expect(await allTags()).toEqual([]);
      expect(await links()).toEqual([]);
      expect(await acts()).toEqual([]);
    };

    it.each([
      ['no contactIds', { name: 'X' }],
      ['empty contactIds', { contactIds: [], name: 'X' }],
      ['contactIds not an array', { contactIds: 'abc', name: 'X' }],
      ['no tag', { contactIds: [MISSING] }],
      ['both tagId and name', { contactIds: [MISSING], tagId: MISSING, name: 'X' }],
      ['blank name', { contactIds: [MISSING], name: '  ' }],
      ['name too long', { contactIds: [MISSING], name: 'x'.repeat(51) }],
      ['unknown field', { contactIds: [MISSING], name: 'X', force: true }],
    ])('422: %s', async (_label, body) => {
      const r = await bulk(body);
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      await none();
    });

    it('422 above the 1,000 cap; exactly 1,000 is accepted', async () => {
      const mk = (n: number) =>
        Array.from(
          { length: n },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        );
      const over = await bulk({ contactIds: mk(1001), name: 'X' });
      expect(over.status).toBe(422);
      expect(over.body.error.details[0].path).toBe('contactIds');
      await none();

      const ok = await bulk({ contactIds: mk(1000), name: 'X' });
      expect(ok).toEqual({ status: 200, body: { added: 0, alreadyTagged: 0, notFound: 1000 } });
    });

    it('400 for a malformed contact id or tagId, with nothing changed', async () => {
      const r = await bulk({ contactIds: [ids[0], 'nope', ids[1]], name: 'X' });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('BAD_REQUEST');
      expect(r.body.error.details).toEqual([{ path: 'contactIds.1', message: 'Invalid UUID' }]);
      expect((await bulk({ contactIds: ids, tagId: 'nope' })).status).toBe(400);
      await none();
    });

    it('400 for malformed JSON', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/tags/bulk-assign',
        headers: { 'content-type': 'application/json' },
        payload: '{oops',
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ---------- one transaction ----------

  describe('single transaction', () => {
    it('a failure midway rolls everything back: no tag, no links, no activity', async () => {
      // A trigger makes the activity insert fail for one tag name, after the tag and links exist.
      await sql`
        CREATE OR REPLACE FUNCTION fail_boom() RETURNS trigger AS $$
        BEGIN
          IF NEW.details->>'tagName' = 'Boom' THEN RAISE EXCEPTION 'boom'; END IF;
          RETURN NEW;
        END $$ LANGUAGE plpgsql`.execute(db);
      await sql`CREATE TRIGGER fail_boom BEFORE INSERT ON contact_activities
                FOR EACH ROW EXECUTE FUNCTION fail_boom()`.execute(db);
      try {
        const r = await bulk({ contactIds: ids, name: 'Boom' });
        expect(r.status).toBe(500);
        expect(r.body.error).toEqual({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: null,
        });
        expect(await allTags()).toEqual([]);
        expect(await links()).toEqual([]);
        expect(await acts()).toEqual([]);
        const rows = await Promise.all(ids.map(row));
        expect(rows.every((x) => x.version === 1)).toBe(true);
      } finally {
        await sql`DROP TRIGGER IF EXISTS fail_boom ON contact_activities`.execute(db);
        await sql`DROP FUNCTION IF EXISTS fail_boom()`.execute(db);
      }
      // and the same request works once the failure is gone
      expect((await bulk({ contactIds: ids, name: 'Boom' })).body.added).toBe(5);
    });

    it('uses a constant number of statements and one multi-row activity insert, however many contacts', async () => {
      const seedMany = async (n: number) => {
        await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
        return (
          await sql<{ id: string }>`
            INSERT INTO contacts (first_name, last_name) SELECT 'F' || g, 'L' FROM generate_series(1, ${n}) g
            RETURNING id`.execute(db)
        ).rows.map((r) => r.id);
      };
      const run = async (n: number) => {
        const many = await seedMany(n);
        statements.length = 0;
        const r = await bulk({ contactIds: many, name: 'Bulk' });
        expect(r.body.added).toBe(n);
        expect(await acts()).toHaveLength(n);
        return [...statements];
      };
      const small = await run(5);
      const large = await run(500);
      const activityInserts = (s: string[]) =>
        s.filter((q) => /insert into "contact_activities"/i.test(q));
      expect(activityInserts(small)).toHaveLength(1);
      expect(activityInserts(large)).toHaveLength(1);
      expect(large.length).toBe(small.length); // no per-contact queries
      expect(large.length).toBeLessThan(15);
    });
  });

  // ---------- concurrency ----------

  describe('concurrency', () => {
    it('overlapping requests in opposite orders neither deadlock nor double-log', async () => {
      const many = (
        await sql<{ id: string }>`
          INSERT INTO contacts (first_name, last_name) SELECT 'F' || g, 'L' FROM generate_series(1, 300) g
          RETURNING id`.execute(db)
      ).rows.map((r) => r.id);
      const reversed = [...many].reverse();

      const results = await Promise.all([
        bulk({ contactIds: many, name: 'Race' }),
        bulk({ contactIds: reversed, name: 'race' }),
        bulk({ contactIds: many.slice(100, 200), name: 'RACE' }),
      ]);
      for (const r of results) expect(r.status).toBe(200);
      // every contact was newly tagged by exactly one of the requests
      expect(
        results.slice(0, 2).reduce((n, r) => n + r.body.added, 0) + results[2]!.body.added,
      ).toBe(300);
      expect(await allTags()).toHaveLength(1);
      expect(await links()).toHaveLength(300);
      const events = await acts();
      expect(events).toHaveLength(300);
      expect(new Set(events.map((e) => e.contact_id)).size).toBe(300);
    });

    it('a bulk request racing a single tag add logs each contact once', async () => {
      const tag = await db
        .insertInto('tags')
        .values({ name: 'Mix' })
        .returning('id')
        .executeTakeFirstOrThrow();
      const [b, s] = await Promise.all([
        bulk({ contactIds: ids, tagId: tag.id }),
        app.inject({ method: 'POST', url: `/contacts/${ids[2]}/tags`, payload: { tagId: tag.id } }),
      ]);
      expect(b.status).toBe(200);
      expect(s.statusCode).toBe(200);
      expect(await links(tag.id)).toHaveLength(5);
      expect(await acts()).toHaveLength(5);
    });

    it('a bulk request racing a contact edit still ends consistent', async () => {
      const [b, p] = await Promise.all([
        bulk({ contactIds: ids, name: 'Edit' }),
        app.inject({
          method: 'PATCH',
          url: `/contacts/${ids[0]}`,
          payload: { version: 1, company: 'New' },
        }),
      ]);
      expect(b.status).toBe(200);
      expect(p.statusCode).toBe(200); // tag changes never cause a false 409
      const c = await row(ids[0]!);
      expect(c).toMatchObject({ company: 'New', version: 2 });
      expect(await links()).toHaveLength(5);
    });
  });
});
