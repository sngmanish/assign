import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

describe('schema', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    loadConfig(); // loads root .env
    db = createDb(
      process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test',
    );
    await runMigrations(db);
  });

  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
  });

  afterAll(async () => {
    await db.destroy();
  });

  const newContact = (over: Partial<{ email: string | null; first_name: string }> = {}) =>
    db
      .insertInto('contacts')
      .values({ first_name: 'Ada', last_name: 'Lovelace', email: null, ...over })
      .returning(['id', 'version'])
      .executeTakeFirstOrThrow();

  it('enables pg_trgm and creates the expected indexes', async () => {
    const ext = await sql<{
      extname: string;
    }>`select extname from pg_extension where extname = 'pg_trgm'`.execute(db);
    expect(ext.rows).toHaveLength(1);

    const { rows } = await sql<{ indexname: string }>`
      select indexname from pg_indexes where schemaname = 'public'`.execute(db);
    const names = rows.map((r) => r.indexname);
    for (const n of [
      'contacts_email_lower_uniq',
      'contacts_first_name_trgm',
      'contacts_last_name_trgm',
      'contacts_email_trgm',
      'contacts_phone_trgm',
      'contacts_created_at_id_idx',
      'contacts_name_id_idx',
      'contacts_company_idx',
      'tags_name_lower_uniq',
      'contact_tags_pkey',
      'contact_tags_tag_contact_idx',
      'contact_activities_contact_created_idx',
    ]) {
      expect(names).toContain(n);
    }
  });

  it('applies defaults: version 1 and timestamps', async () => {
    const c = await newContact();
    expect(c.version).toBe(1);
    const row = await db
      .selectFrom('contacts')
      .select(['created_at', 'updated_at'])
      .where('id', '=', c.id)
      .executeTakeFirstOrThrow();
    expect(row.created_at).toBeInstanceOf(Date);
    expect(row.updated_at).toBeInstanceOf(Date);
  });

  it('rejects duplicate emails case-insensitively but allows many NULL emails', async () => {
    await newContact({ email: 'a@x.com' });
    await expect(newContact({ email: 'A@X.com' })).rejects.toMatchObject({ code: '23505' });
    await newContact({ email: null });
    await newContact({ email: null });
  });

  it('rejects blank names', async () => {
    await expect(newContact({ first_name: '   ' })).rejects.toMatchObject({ code: '23514' });
  });

  it('enforces case-insensitive unique tag names', async () => {
    await db.insertInto('tags').values({ name: 'VIP' }).execute();
    await expect(db.insertInto('tags').values({ name: 'vip' }).execute()).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('blocks duplicate contact_tags and cascades on delete', async () => {
    const c = await newContact();
    const t = await db
      .insertInto('tags')
      .values({ name: 'Lead' })
      .returning('id')
      .executeTakeFirstOrThrow();
    await db.insertInto('contact_tags').values({ contact_id: c.id, tag_id: t.id }).execute();
    await expect(
      db.insertInto('contact_tags').values({ contact_id: c.id, tag_id: t.id }).execute(),
    ).rejects.toMatchObject({ code: '23505' });

    await db.deleteFrom('contacts').where('id', '=', c.id).execute();
    const left = await db.selectFrom('contact_tags').selectAll().execute();
    expect(left).toHaveLength(0);
  });

  it('only allows known activity types and stores jsonb details', async () => {
    const c = await newContact();
    await db
      .insertInto('contact_activities')
      .values({
        contact_id: c.id,
        type: 'TAG_ADDED',
        details: JSON.stringify({ tagName: 'VIP' }) as never,
      })
      .execute();
    const row = await db
      .selectFrom('contact_activities')
      .select('details')
      .executeTakeFirstOrThrow();
    expect(row.details).toEqual({ tagName: 'VIP' });

    await expect(
      db
        .insertInto('contact_activities')
        .values({ contact_id: c.id, type: 'BOGUS' as never, details: '{}' as never })
        .execute(),
    ).rejects.toMatchObject({ code: '23514' });
  });
});
