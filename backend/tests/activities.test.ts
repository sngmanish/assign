import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

const MISSING = '00000000-0000-4000-8000-000000000000';

interface Activity {
  id: string;
  contactId: string;
  type: string;
  createdAt: string;
  details: Record<string, unknown>;
}

describe('GET /contacts/:id/activities', () => {
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
        { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com', company: 'Analytical' },
        { first_name: 'Grace', last_name: 'Hopper', email: 'grace@x.com' },
      ])
      .returning(['id', 'first_name'])
      .execute();
    adaId = rows.find((r) => r.first_name === 'Ada')!.id;
    graceId = rows.find((r) => r.first_name === 'Grace')!.id;
  });

  const call = async (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
  ) => {
    const res = await app.inject({ method, url, payload });
    return { status: res.statusCode, body: res.json() };
  };
  const activities = async (id: string, qs = ''): Promise<Activity[]> => {
    const r = await call('GET', `/contacts/${id}/activities${qs}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body.items;
  };
  /** Inserts activity rows directly, with chosen timestamps. */
  const insertActivities = (rows: { contactId: string; createdAt: string; tag?: string }[]) =>
    db
      .insertInto('contact_activities')
      .values(
        rows.map((r) => ({
          contact_id: r.contactId,
          type: 'TAG_ADDED' as const,
          created_at: r.createdAt,
          details: { tagId: MISSING, tagName: r.tag ?? 'T' },
        })),
      )
      .execute();

  it('returns newest first across all three event types, from real operations', async () => {
    await call('PATCH', `/contacts/${adaId}`, { version: 1, company: 'Babbage & Co' }); // CONTACT_UPDATED
    const added = await call('POST', `/contacts/${adaId}/tags`, { name: 'VIP' }); // TAG_ADDED
    await call('DELETE', `/contacts/${adaId}/tags/${added.body.tags[0].id}`); // TAG_REMOVED
    await call('POST', '/tags/bulk-assign', { contactIds: [adaId], name: 'Wave' }); // TAG_ADDED

    const items = await activities(adaId);
    expect(items.map((a) => a.type)).toEqual([
      'TAG_ADDED',
      'TAG_REMOVED',
      'TAG_ADDED',
      'CONTACT_UPDATED',
    ]);
    expect(items.map((a) => (a.details as { tagName?: string }).tagName)).toEqual([
      'Wave',
      'VIP',
      'VIP',
      undefined,
    ]);
    const times = items.map((a) => Date.parse(a.createdAt));
    expect([...times].sort((x, y) => y - x)).toEqual(times); // newest first
  });

  it('every activity has id, contactId, type, createdAt and details', async () => {
    await call('PATCH', `/contacts/${adaId}`, { version: 1, firstName: 'Augusta' });
    await call('POST', `/contacts/${adaId}/tags`, { name: 'VIP' });
    const items = await activities(adaId);
    expect(items).toHaveLength(2);
    for (const a of items) {
      expect(a).toEqual({
        id: expect.any(String),
        contactId: adaId,
        type: expect.stringMatching(/^(CONTACT_UPDATED|TAG_ADDED|TAG_REMOVED)$/),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        details: expect.any(Object),
      });
    }
  });

  it('details show what changed', async () => {
    await call('PATCH', `/contacts/${adaId}`, { version: 1, firstName: 'Augusta', company: null });
    const tag = await call('POST', `/contacts/${adaId}/tags`, { name: 'VIP' });
    const [added, updated] = await activities(adaId);
    expect(updated!.details).toEqual({
      changes: {
        firstName: { old: 'Ada', new: 'Augusta' },
        company: { old: 'Analytical', new: null },
      },
    });
    expect(added!.details).toEqual({ tagId: tag.body.tags[0].id, tagName: 'VIP' });
  });

  it('shows only the requested contact’s activity', async () => {
    await call('POST', `/contacts/${adaId}/tags`, { name: 'VIP' });
    await call('POST', `/contacts/${graceId}/tags`, { name: 'Lead' });
    await call('POST', `/contacts/${graceId}/tags`, { name: 'Other' });
    expect(await activities(adaId)).toHaveLength(1);
    const grace = await activities(graceId);
    expect(grace).toHaveLength(2);
    expect(grace.every((a) => a.contactId === graceId)).toBe(true);
  });

  it('is an empty list, not an error, for a contact with no activity', async () => {
    expect(await call('GET', `/contacts/${adaId}/activities`)).toEqual({
      status: 200,
      body: { items: [] },
    });
  });

  it('orders by timestamp regardless of insert order', async () => {
    await insertActivities([
      { contactId: adaId, createdAt: '2024-03-01T00:00:00Z', tag: 'middle' },
      { contactId: adaId, createdAt: '2024-05-01T00:00:00Z', tag: 'newest' },
      { contactId: adaId, createdAt: '2024-01-01T00:00:00Z', tag: 'oldest' },
    ]);
    const names = (await activities(adaId)).map((a) => (a.details as { tagName: string }).tagName);
    expect(names).toEqual(['newest', 'middle', 'oldest']);
  });

  it('events with identical timestamps come back in a stable order', async () => {
    await insertActivities(
      Array.from({ length: 12 }, (_, i) => ({
        contactId: adaId,
        createdAt: '2024-01-01T00:00:00Z',
        tag: `t${i}`,
      })),
    );
    const first = (await activities(adaId)).map((a) => a.id);
    const second = (await activities(adaId)).map((a) => a.id);
    expect(first).toHaveLength(12);
    expect(second).toEqual(first);
    // and a smaller limit returns a prefix of that same order
    expect((await activities(adaId, '?limit=5')).map((a) => a.id)).toEqual(first.slice(0, 5));
  });

  describe('limit', () => {
    beforeEach(async () => {
      await insertActivities(
        Array.from({ length: 130 }, (_, i) => ({
          contactId: adaId,
          createdAt: new Date(Date.UTC(2024, 0, 1) + i * 60_000).toISOString(),
          tag: `t${i}`,
        })),
      );
    });

    it('defaults to 20', async () => {
      expect(await activities(adaId)).toHaveLength(20);
    });

    it('returns the newest N', async () => {
      const items = await activities(adaId, '?limit=3');
      expect(items.map((a) => (a.details as { tagName: string }).tagName)).toEqual([
        't129',
        't128',
        't127',
      ]);
    });

    it('allows up to 100', async () => {
      expect(await activities(adaId, '?limit=100')).toHaveLength(100);
      expect(await activities(adaId, '?limit=1')).toHaveLength(1);
    });

    it.each(['limit=0', 'limit=101', 'limit=-1', 'limit=abc', 'limit=1.5', 'limit='])(
      '400 for %s',
      async (qs) => {
        const r = await call('GET', `/contacts/${adaId}/activities?${qs}`);
        expect(r.status).toBe(400);
        expect(r.body.error.code).toBe('BAD_REQUEST');
      },
    );
  });

  it('404 for an unknown contact and 400 for a malformed id', async () => {
    const missing = await call('GET', `/contacts/${MISSING}/activities`);
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual({
      code: 'NOT_FOUND',
      message: 'Contact not found',
      details: null,
    });
    const bad = await call('GET', '/contacts/nope/activities');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_REQUEST');
  });

  it('a failed or no-op change adds nothing to the history', async () => {
    await call('PATCH', `/contacts/${adaId}`, { version: 1, firstName: 'Ada' }); // no change
    await call('PATCH', `/contacts/${adaId}`, { version: 9, firstName: 'X' }); // stale: 409
    await call('PATCH', `/contacts/${adaId}`, { version: 1, email: 'grace@x.com' }); // duplicate email: 409
    const tag = await call('POST', `/contacts/${adaId}/tags`, { name: 'VIP' });
    await call('POST', `/contacts/${adaId}/tags`, { name: 'vip' }); // already tagged
    expect((await activities(adaId)).map((a) => a.type)).toEqual(['TAG_ADDED']);
    await call('DELETE', `/contacts/${adaId}/tags/${tag.body.tags[0].id}`);
    await call('DELETE', `/contacts/${adaId}/tags/${tag.body.tags[0].id}`); // 404
    expect((await activities(adaId)).map((a) => a.type)).toEqual(['TAG_REMOVED', 'TAG_ADDED']);
  });

  it('history survives a tag rename and keeps the name from the time of the event', async () => {
    const tag = await call('POST', `/contacts/${adaId}/tags`, { name: 'Prospect' });
    await db
      .updateTable('tags')
      .set({ name: 'Customer' })
      .where('id', '=', tag.body.tags[0].id)
      .execute();
    const [event] = await activities(adaId);
    expect(event!.details).toEqual({ tagId: tag.body.tags[0].id, tagName: 'Prospect' });
  });
});
