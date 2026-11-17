import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test';

describe('read endpoints', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let ada: string;

  beforeAll(async () => {
    loadConfig();
    db = createDb(process.env.TEST_DATABASE_URL ?? TEST_URL);
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
        {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@x.com',
          phone: null,
          company: 'Analytical',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          first_name: 'Grace',
          last_name: 'Hopper',
          email: null,
          phone: '+1-555-0100',
          company: null,
          created_at: '2024-02-01T00:00:00Z',
        },
        {
          first_name: 'Alan',
          last_name: 'Turing',
          email: 'alan@x.com',
          phone: null,
          company: null,
          created_at: '2024-03-01T00:00:00Z',
        },
      ])
      .returning(['id', 'first_name'])
      .execute();
    ada = rows.find((r) => r.first_name === 'Ada')!.id;
    const tags = await db
      .insertInto('tags')
      .values([{ name: 'VIP' }, { name: 'Lead' }])
      .returning(['id', 'name'])
      .execute();
    await db
      .insertInto('contact_tags')
      .values(tags.map((t) => ({ contact_id: ada, tag_id: t.id })))
      .execute();
  });

  // Shared error shape: exactly { error: { code, message, details } }
  const expectErrorShape = (body: { error: object }) => {
    expect(Object.keys(body)).toEqual(['error']);
    expect(Object.keys(body.error).sort()).toEqual(['code', 'details', 'message']);
  };

  describe('GET /contacts/:id', () => {
    it('returns the contact with version and tags (sorted by name)', async () => {
      const res = await app.inject({ method: 'GET', url: `/contacts/${ada}` });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        id: ada,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@x.com',
        phone: null,
        company: 'Analytical',
        version: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: expect.any(String),
        tags: [
          { id: expect.any(String), name: 'Lead' },
          { id: expect.any(String), name: 'VIP' },
        ],
      });
    });

    it('404 with the shared error shape for an unknown id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/contacts/00000000-0000-4000-8000-000000000000',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'Contact not found', details: null },
      });
    });

    it('400 for a malformed id', async () => {
      const res = await app.inject({ method: 'GET', url: '/contacts/not-a-uuid' });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expectErrorShape(body);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.details[0].path).toBe('id');
    });
  });

  describe('GET /contacts', () => {
    it('lists newest first, with tags and versions', async () => {
      const res = await app.inject({ method: 'GET', url: '/contacts' });
      expect(res.statusCode).toBe(200);
      const { items } = res.json();
      expect(items.map((c: { firstName: string }) => c.firstName)).toEqual([
        'Alan',
        'Grace',
        'Ada',
      ]);
      expect(items[2].tags.map((t: { name: string }) => t.name)).toEqual(['Lead', 'VIP']);
      expect(items[0].tags).toEqual([]);
      expect(items.every((c: { version: number }) => c.version === 1)).toBe(true);
    });

    it('honours limit', async () => {
      const res = await app.inject({ method: 'GET', url: '/contacts?limit=2' });
      expect(res.json().items).toHaveLength(2);
    });

    it.each(['limit=0', 'limit=101', 'limit=abc', 'limit=1.5'])(
      '400 for bad query %s',
      async (q) => {
        const res = await app.inject({ method: 'GET', url: `/contacts?${q}` });
        expect(res.statusCode).toBe(400);
        expectErrorShape(res.json());
        expect(res.json().error.code).toBe('BAD_REQUEST');
      },
    );
  });

  describe('error handling', () => {
    it('404 with the shared shape for unknown routes', async () => {
      const res = await app.inject({ method: 'GET', url: '/nope' });
      expect(res.statusCode).toBe(404);
      expectErrorShape(res.json());
      expect(res.json().error.code).toBe('NOT_FOUND');
    });

    it('500 leaks nothing internal when the database fails', async () => {
      const broken = createDb('postgres://postgres:postgres@127.0.0.1:1/nothing');
      const brokenApp = await buildApp({ db: broken });
      const res = await brokenApp.inject({
        method: 'GET',
        url: `/contacts/${ada}`,
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          details: { requestId: expect.any(String) }, // only an id to find the log line
        },
      });
      expect(res.body).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|postgres/i);
      await brokenApp.close();
      await broken.destroy();
    });
  });
});
