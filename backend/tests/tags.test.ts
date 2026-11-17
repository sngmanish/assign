import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

const MISSING = '00000000-0000-4000-8000-000000000000';

describe('tags', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let adaId: string;
  let graceId: string;

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
      .values([
        { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com' },
        { first_name: 'Grace', last_name: 'Hopper', email: 'grace@x.com' },
      ])
      .returning(['id', 'first_name'])
      .execute();
    adaId = rows.find((r) => r.first_name === 'Ada')!.id;
    graceId = rows.find((r) => r.first_name === 'Grace')!.id;
  });

  const call = async (
    method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
    url: string,
    payload?: object,
  ) => {
    const res = await app.inject({ method, url, payload });
    return { status: res.statusCode, body: res.json() };
  };
  const addTag = (contactId: string, body: object) =>
    call('POST', `/contacts/${contactId}/tags`, body);
  const removeTag = (contactId: string, tagId: string) =>
    call('DELETE', `/contacts/${contactId}/tags/${tagId}`);
  const row = (id: string) =>
    db.selectFrom('contacts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  const activities = (id: string) =>
    db
      .selectFrom('contact_activities')
      .selectAll()
      .where('contact_id', '=', id)
      .orderBy('created_at')
      .execute();
  const links = (contactId: string) =>
    db.selectFrom('contact_tags').selectAll().where('contact_id', '=', contactId).execute();
  const allTags = () => db.selectFrom('tags').selectAll().execute();
  const mkTag = async (name: string) =>
    await db
      .insertInto('tags')
      .values({ name })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();

  // ---------- GET /tags ----------

  describe('GET /tags', () => {
    it('is empty when there are no tags', async () => {
      expect(await call('GET', '/tags')).toEqual({ status: 200, body: { items: [] } });
    });

    it('lists all tags sorted by name, ignoring case', async () => {
      await mkTag('vip');
      await mkTag('Lead');
      await mkTag('Archive');
      const { status, body } = await call('GET', '/tags');
      expect(status).toBe(200);
      expect(body.items.map((t: { name: string }) => t.name)).toEqual(['Archive', 'Lead', 'vip']);
      expect(body.items[0]).toEqual({ id: expect.any(String), name: 'Archive' });
    });
  });

  // ---------- add ----------

  describe('POST /contacts/:id/tags', () => {
    it('creates a tag on the fly by name, assigns it, and logs TAG_ADDED', async () => {
      const r = await addTag(adaId, { name: 'VIP' });
      expect(r.status).toBe(200);
      expect(r.body.tags).toEqual([{ id: expect.any(String), name: 'VIP' }]);

      const tag = (await allTags())[0]!;
      expect(tag.name).toBe('VIP');
      expect(await links(adaId)).toEqual([{ contact_id: adaId, tag_id: tag.id }]);

      const acts = await activities(adaId);
      expect(acts).toHaveLength(1);
      expect(acts[0]).toMatchObject({
        type: 'TAG_ADDED',
        contact_id: adaId,
        details: { tagId: tag.id, tagName: 'VIP' },
      });
    });

    it('adds an existing tag by tagId', async () => {
      const t = await mkTag('Lead');
      const r = await addTag(adaId, { tagId: t.id });
      expect(r.status).toBe(200);
      expect(r.body.tags).toEqual([{ id: t.id, name: 'Lead' }]);
      expect((await activities(adaId))[0]!.details).toEqual({ tagId: t.id, tagName: 'Lead' });
    });

    it('names are case-insensitive: "vip" reuses "VIP" and never creates a duplicate', async () => {
      await addTag(adaId, { name: 'VIP' });
      const r = await addTag(graceId, { name: '  vip ' });
      expect(r.status).toBe(200);
      expect(r.body.tags.map((t: { name: string }) => t.name)).toEqual(['VIP']); // original spelling
      expect(await allTags()).toHaveLength(1);
    });

    it('adding a tag the contact already has is a quiet no-op', async () => {
      await addTag(adaId, { name: 'VIP' });
      const before = await row(adaId);
      const r1 = await addTag(adaId, { name: 'VIP' });
      const r2 = await addTag(adaId, { name: 'vip' });
      const r3 = await addTag(adaId, { tagId: (await allTags())[0]!.id });
      for (const r of [r1, r2, r3]) {
        expect(r.status).toBe(200);
        expect(r.body.tags).toHaveLength(1);
      }
      expect(await links(adaId)).toHaveLength(1);
      expect(await activities(adaId)).toHaveLength(1); // only the first add
      expect(await row(adaId)).toEqual(before); // not even updated_at moved
    });

    it('does not bump version, but touches updated_at', async () => {
      const before = await row(adaId);
      await addTag(adaId, { name: 'VIP' });
      const after = await row(adaId);
      expect(after.version).toBe(before.version);
      expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
        new Date(before.updated_at).getTime(),
      );
    });

    it('404 for an unknown contact, and no tag is left behind', async () => {
      const r = await addTag(MISSING, { name: 'Ghost' });
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('NOT_FOUND');
      expect(await allTags()).toEqual([]);
    });

    it('404 for an unknown tagId', async () => {
      const r = await addTag(adaId, { tagId: MISSING });
      expect(r.status).toBe(404);
      expect(await links(adaId)).toEqual([]);
      expect(await activities(adaId)).toEqual([]);
    });

    it('400 for a malformed contact id or tagId', async () => {
      expect((await addTag('nope', { name: 'X' })).status).toBe(400);
      const r = await addTag(adaId, { tagId: 'nope' });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('BAD_REQUEST');
      expect((await addTag(MISSING, { tagId: 'nope' })).status).toBe(400); // checked before lookups
    });

    it('422 for bad bodies: neither, both, blank, too long, unknown field', async () => {
      const t = await mkTag('Lead');
      for (const body of [
        {},
        { tagId: t.id, name: 'Lead' },
        { name: '   ' },
        { name: 'x'.repeat(51) },
        { name: 'ok', colour: 'red' },
        { name: 5 },
      ]) {
        const r = await addTag(adaId, body);
        expect(r.status, JSON.stringify(body)).toBe(422);
        expect(r.body.error.code).toBe('VALIDATION_ERROR');
      }
      expect(await links(adaId)).toEqual([]);
    });

    it('two simultaneous adds of the same tag leave one link and one activity', async () => {
      const [a, b] = await Promise.all([
        addTag(adaId, { name: 'Race' }),
        addTag(adaId, { name: 'race' }),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(await allTags()).toHaveLength(1);
      expect(await links(adaId)).toHaveLength(1);
      expect(await activities(adaId)).toHaveLength(1);
    });

    it('two contacts creating the same new tag at once share one tag row', async () => {
      const [a, b] = await Promise.all([
        addTag(adaId, { name: 'Shared' }),
        addTag(graceId, { name: 'SHARED' }),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(await allTags()).toHaveLength(1);
      expect(a.body.tags[0].id).toBe(b.body.tags[0].id);
    });
  });

  // ---------- remove ----------

  describe('DELETE /contacts/:id/tags/:tagId', () => {
    it('removes the tag, logs TAG_REMOVED with id and name, keeps the tag itself', async () => {
      const added = await addTag(adaId, { name: 'VIP' });
      const tagId = added.body.tags[0].id;
      const r = await removeTag(adaId, tagId);
      expect(r.status).toBe(200);
      expect(r.body.tags).toEqual([]);

      expect(await links(adaId)).toEqual([]);
      expect(await allTags()).toHaveLength(1); // the tag still exists for other contacts
      const acts = await activities(adaId);
      expect(acts.map((a) => a.type)).toEqual(['TAG_ADDED', 'TAG_REMOVED']);
      expect(acts[1]!.details).toEqual({ tagId, tagName: 'VIP' });
    });

    it('only removes from that contact', async () => {
      const t = await mkTag('VIP');
      await addTag(adaId, { tagId: t.id });
      await addTag(graceId, { tagId: t.id });
      await removeTag(adaId, t.id);
      expect(await links(adaId)).toEqual([]);
      expect(await links(graceId)).toHaveLength(1);
    });

    it('404 when the contact does not have the tag, with nothing logged', async () => {
      const t = await mkTag('VIP');
      const r = await removeTag(adaId, t.id);
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('NOT_FOUND');
      expect(await activities(adaId)).toEqual([]);
    });

    it('404 for an unknown contact or unknown tag', async () => {
      const t = await mkTag('VIP');
      expect((await removeTag(MISSING, t.id)).status).toBe(404);
      expect((await removeTag(adaId, MISSING)).status).toBe(404);
    });

    it('400 for malformed ids', async () => {
      const t = await mkTag('VIP');
      expect((await removeTag('nope', t.id)).status).toBe(400);
      expect((await removeTag(adaId, 'nope')).status).toBe(400);
    });

    it('does not bump version, but touches updated_at', async () => {
      const t = await mkTag('VIP');
      await addTag(adaId, { tagId: t.id });
      const before = await row(adaId);
      await removeTag(adaId, t.id);
      const after = await row(adaId);
      expect(after.version).toBe(before.version);
      expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(before.updated_at).getTime(),
      );
    });

    it('removing twice: the second is a 404 and logs nothing more', async () => {
      const t = await mkTag('VIP');
      await addTag(adaId, { tagId: t.id });
      expect((await removeTag(adaId, t.id)).status).toBe(200);
      expect((await removeTag(adaId, t.id)).status).toBe(404);
      expect(await activities(adaId)).toHaveLength(2);
    });
  });

  // ---------- interaction with editing and history ----------

  describe('tags and contact edits', () => {
    it('adding or removing tags leaves version unchanged, so an edit started earlier still saves', async () => {
      const start = (await call('GET', `/contacts/${adaId}`)).body; // an editor opens the form: version 1
      expect(start.version).toBe(1);

      const t = await addTag(adaId, { name: 'VIP' });
      await removeTag(adaId, t.body.tags[0].id);
      await addTag(adaId, { name: 'Lead' });

      const saved = await call('PATCH', `/contacts/${adaId}`, {
        version: start.version,
        company: 'Analytical',
      });
      expect(saved.status).toBe(200); // not a false 409
      expect(saved.body).toMatchObject({ company: 'Analytical', version: 2 });
      expect(saved.body.tags.map((x: { name: string }) => x.name)).toEqual(['Lead']); // tags untouched by the edit
    });

    it('a field edit does not disturb tags', async () => {
      await addTag(adaId, { name: 'VIP' });
      const r = await call('PATCH', `/contacts/${adaId}`, { version: 1, firstName: 'Augusta' });
      expect(r.body.tags).toHaveLength(1);
    });

    it('activity keeps the tag name it had, even after the tag is renamed', async () => {
      const added = await addTag(adaId, { name: 'Prospect' });
      const tagId = added.body.tags[0].id;
      await db
        .updateTable('tags')
        .set({ name: 'Qualified Lead' })
        .where('id', '=', tagId)
        .execute();
      await removeTag(adaId, tagId);
      const acts = await activities(adaId);
      expect(acts.map((a) => a.details)).toEqual([
        { tagId, tagName: 'Prospect' },
        { tagId, tagName: 'Qualified Lead' }, // removal logged under the name at that moment
      ]);
      expect(acts[0]!.details).toMatchObject({ tagName: 'Prospect' }); // the old entry is unchanged
    });

    it('tagged contacts show up in the tag filter, and untagged ones drop out', async () => {
      const added = await addTag(adaId, { name: 'VIP' });
      const tagId = added.body.tags[0].id;
      const hit = await call('GET', `/contacts?tag=${tagId}`);
      expect(hit.body.items.map((c: { id: string }) => c.id)).toEqual([adaId]);
      await removeTag(adaId, tagId);
      expect((await call('GET', `/contacts?tag=${tagId}`)).body.items).toEqual([]);
    });

    it('deleting a contact cascades its tag links but keeps the tags', async () => {
      await addTag(adaId, { name: 'VIP' });
      await db.deleteFrom('contacts').where('id', '=', adaId).execute();
      expect(await allTags()).toHaveLength(1);
      expect(await db.selectFrom('contact_tags').selectAll().execute()).toEqual([]);
    });
  });
});
