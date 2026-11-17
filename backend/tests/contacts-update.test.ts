import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

describe('PATCH /contacts/:id', () => {
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
        {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'ada@x.com',
          phone: '+1-555-0100',
          company: 'Analytical',
        },
        {
          first_name: 'Grace',
          last_name: 'Hopper',
          email: 'grace@x.com',
          phone: null,
          company: null,
        },
      ])
      .returning(['id', 'first_name'])
      .execute();
    adaId = rows.find((r) => r.first_name === 'Ada')!.id;
    graceId = rows.find((r) => r.first_name === 'Grace')!.id;
  });

  const patch = async (id: string, body: unknown) => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/contacts/${id}`,
      payload: body as object,
    });
    return { status: res.statusCode, body: res.json() };
  };
  const row = (id: string) =>
    db.selectFrom('contacts').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
  const activities = (id: string) =>
    db
      .selectFrom('contact_activities')
      .selectAll()
      .where('contact_id', '=', id)
      .orderBy('created_at')
      .execute();

  // ---------- optimistic locking ----------

  describe('optimistic locking', () => {
    it('stale version: 409 with the latest contact, and stored data is left unchanged', async () => {
      // Another editor saves first.
      expect((await patch(adaId, { version: 1, company: 'Babbage & Co' })).status).toBe(200);
      const before = await row(adaId);
      const activitiesBefore = await activities(adaId);

      // This editor started from version 1 and is now stale.
      const r = await patch(adaId, {
        version: 1,
        firstName: 'Augusta',
        lastName: 'King',
        email: 'new@x.com',
      });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('VERSION_CONFLICT');
      expect(r.body.error.details.latest).toMatchObject({
        id: adaId,
        version: 2,
        company: 'Babbage & Co', // what the other editor saved
        firstName: 'Ada', // not the stale edit
      });

      // Nothing was written: row identical, no new activity.
      expect(await row(adaId)).toEqual(before);
      expect(await activities(adaId)).toEqual(activitiesBefore);
    });

    it('a version that is ahead of the stored one is also rejected', async () => {
      const r = await patch(adaId, { version: 5, firstName: 'X' });
      expect(r.status).toBe(409);
      expect((await row(adaId)).first_name).toBe('Ada');
    });

    it('a successful update bumps the version and updated_at', async () => {
      const before = await row(adaId);
      const r = await patch(adaId, { version: 1, firstName: 'Augusta' });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ id: adaId, firstName: 'Augusta', version: 2 });
      const after = await row(adaId);
      expect(after.version).toBe(2);
      expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
        new Date(before.updated_at).getTime(),
      );
      expect(new Date(after.created_at)).toEqual(new Date(before.created_at));
      // The returned version is usable for the next edit.
      expect((await patch(adaId, { version: 2, lastName: 'King' })).body.version).toBe(3);
    });

    it('two simultaneous updates from the same version: exactly one wins', async () => {
      const [a, b] = await Promise.all([
        patch(adaId, { version: 1, firstName: 'Alpha' }),
        patch(adaId, { version: 1, firstName: 'Beta' }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const winner = a.status === 200 ? 'Alpha' : 'Beta';
      const stored = await row(adaId);
      expect(stored.first_name).toBe(winner);
      expect(stored.version).toBe(2);
      expect(await activities(adaId)).toHaveLength(1);
    });

    it('unknown contact is 404', async () => {
      const r = await patch('00000000-0000-4000-8000-000000000000', { version: 1, firstName: 'X' });
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ---------- email uniqueness ----------

  describe('email uniqueness', () => {
    it.each(['ada@x.com', 'ADA@X.COM', 'Ada@x.Com', '  ada@x.com  '])(
      'rejects a duplicate email (%j) with 409 EMAIL_TAKEN and changes nothing',
      async (dup) => {
        const before = await row(graceId);
        const r = await patch(graceId, { version: 1, firstName: 'Changed', email: dup });
        expect(r.status).toBe(409);
        expect(r.body.error).toMatchObject({ code: 'EMAIL_TAKEN', details: { field: 'email' } });
        expect(await row(graceId)).toEqual(before); // even the other field did not save
        expect(await activities(graceId)).toEqual([]);
      },
    );

    it('after EMAIL_TAKEN the same version can still be used for a corrected edit', async () => {
      expect((await patch(graceId, { version: 1, email: 'ADA@x.com' })).status).toBe(409);
      expect((await patch(graceId, { version: 1, email: 'grace2@x.com' })).status).toBe(200);
    });

    it('trims and lowercases emails before saving', async () => {
      const r = await patch(adaId, { version: 1, email: '  Ada.Lovelace@Example.COM ' });
      expect(r.status).toBe(200);
      expect(r.body.email).toBe('ada.lovelace@example.com');
      expect((await row(adaId)).email).toBe('ada.lovelace@example.com');
    });

    it('re-sending your own email in another case is a no-op, not a conflict', async () => {
      const r = await patch(adaId, { version: 1, email: 'ADA@X.COM' });
      expect(r.status).toBe(200);
      expect(r.body.version).toBe(1);
    });

    it('many contacts may have no email', async () => {
      expect((await patch(adaId, { version: 1, email: null })).status).toBe(200);
      expect((await patch(graceId, { version: 1, email: '' })).status).toBe(200);
      expect((await row(graceId)).email).toBeNull();
    });
  });

  // ---------- activity log ----------

  describe('activity log', () => {
    it('writes one CONTACT_UPDATED with old and new values of only the changed fields', async () => {
      await patch(adaId, {
        version: 1,
        firstName: 'Augusta',
        lastName: 'Lovelace',
        company: null,
        phone: '+1-555-0100',
      });
      const acts = await activities(adaId);
      expect(acts).toHaveLength(1);
      expect(acts[0]).toMatchObject({ type: 'CONTACT_UPDATED', contact_id: adaId });
      expect(acts[0]!.details).toEqual({
        changes: {
          firstName: { old: 'Ada', new: 'Augusta' },
          company: { old: 'Analytical', new: null },
        }, // lastName and phone were sent but unchanged: not logged
      });
    });

    it('logs nothing when no field actually changed, and does not bump the version', async () => {
      const before = await row(adaId);
      const r = await patch(adaId, {
        version: 1,
        firstName: 'Ada',
        company: 'Analytical',
        phone: '+1-555-0100',
      });
      expect(r.status).toBe(200);
      expect(r.body.version).toBe(1);
      expect(await row(adaId)).toEqual(before);
      expect(await activities(adaId)).toEqual([]);

      const onlyVersion = await patch(adaId, { version: 1 });
      expect(onlyVersion.status).toBe(200);
      expect(await activities(adaId)).toEqual([]);
    });

    it('each real update adds its own activity, newest last', async () => {
      await patch(adaId, { version: 1, company: 'A' });
      await patch(adaId, { version: 2, company: 'B' });
      const acts = await activities(adaId);
      expect(acts.map((a) => a.details)).toEqual([
        { changes: { company: { old: 'Analytical', new: 'A' } } },
        { changes: { company: { old: 'A', new: 'B' } } },
      ]);
    });

    it('is written in the same transaction as the change (a failed update leaves neither)', async () => {
      // EMAIL_TAKEN aborts after the row was locked: no half-applied state.
      await patch(graceId, { version: 1, lastName: 'Murray', email: 'ada@x.com' });
      expect((await row(graceId)).last_name).toBe('Hopper');
      expect(await activities(graceId)).toEqual([]);
    });
  });

  // ---------- validation ----------

  describe('validation', () => {
    const expectField = (
      r: { status: number; body: { error: { code: string; details: { path: string }[] } } },
      path: string,
    ) => {
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
      expect(r.body.error.details.map((d: { path: string }) => d.path)).toContain(path);
    };

    it('rejects unknown fields (including id, createdAt, tags)', async () => {
      for (const field of ['id', 'createdAt', 'tags', 'nickname', 'updatedAt']) {
        expectField(await patch(adaId, { version: 1, [field]: 'x' }), field);
      }
      expect((await row(adaId)).version).toBe(1);
    });

    it('rejects empty or blank first and last names', async () => {
      expectField(await patch(adaId, { version: 1, firstName: '' }), 'firstName');
      expectField(await patch(adaId, { version: 1, lastName: '   ' }), 'lastName');
      expectField(await patch(adaId, { version: 1, firstName: null }), 'firstName');
    });

    it('rejects invalid email formats', async () => {
      for (const email of ['nope', 'a@', '@b.com', 'a b@c.com', 123]) {
        expectField(await patch(adaId, { version: 1, email }), 'email');
      }
    });

    it('rejects invalid phone numbers, accepts normal formats', async () => {
      for (const phone of ['abc', '12', '555-CALL-NOW', '1'.repeat(40)]) {
        expectField(await patch(adaId, { version: 1, phone }), 'phone');
      }
      for (const phone of ['+1-555-123-4567', '(415) 555 0123', '020.7946.0018']) {
        expect((await patch(adaId, { version: 1, phone })).status).toBe(200);
        await db.updateTable('contacts').set({ version: 1 }).where('id', '=', adaId).execute();
      }
    });

    it('turns empty strings into null for email, phone and company', async () => {
      const r = await patch(adaId, { version: 1, email: '', phone: '  ', company: '' });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ email: null, phone: null, company: null });
    });

    it('requires an integer version', async () => {
      expectField(await patch(adaId, { firstName: 'X' }), 'version');
      expectField(await patch(adaId, { version: '1', firstName: 'X' }), 'version');
      expectField(await patch(adaId, { version: 1.5 }), 'version');
      expectField(await patch(adaId, { version: 0 }), 'version');
    });

    it('reports every invalid field at once', async () => {
      const r = await patch(adaId, { version: 1, firstName: '', email: 'bad', phone: 'x' });
      expect(r.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual([
        'email',
        'firstName',
        'phone',
      ]);
    });

    it('400 for a malformed id and for malformed JSON', async () => {
      const bad = await patch('not-a-uuid', { version: 1 });
      expect(bad.status).toBe(400);
      const res = await app.inject({
        method: 'PATCH',
        url: `/contacts/${adaId}`,
        headers: { 'content-type': 'application/json' },
        payload: '{oops',
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('BAD_REQUEST');
    });

    it('validation failures never change data', async () => {
      const before = await row(adaId);
      await patch(adaId, { version: 1, firstName: 'Ok', email: 'bad' });
      expect(await row(adaId)).toEqual(before);
    });
  });
});
