import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sql, type Kysely } from 'kysely';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { contactsCount, seedContacts, seedIfEmpty } from '../src/db/seed.js';

describe('seed', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    loadConfig();
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

  const snapshot = () =>
    db
      .selectFrom('contacts')
      .select(['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'created_at'])
      .orderBy('id')
      .execute();

  it('generates varied data: companies, tags, spread dates, some missing emails', async () => {
    await seedContacts(db, { count: 1200, seed: 1 });
    expect(await contactsCount(db)).toBe(1200);

    const s = await sql<{
      no_email: string;
      emails: string;
      companies: string;
      tagged: string;
      days: string;
    }>`
      select
        count(*) filter (where email is null) as no_email,
        count(distinct lower(email)) as emails,
        count(distinct company) as companies,
        (select count(distinct contact_id) from contact_tags) as tagged,
        extract(day from max(created_at) - min(created_at)) as days
      from contacts`.execute(db);
    const r = s.rows[0]!;
    expect(Number(r.no_email)).toBeGreaterThan(50);
    expect(Number(r.no_email)).toBeLessThan(400);
    expect(Number(r.emails)).toBe(1200 - Number(r.no_email)); // all non-null emails unique
    expect(Number(r.companies)).toBeGreaterThan(20);
    expect(Number(r.tagged)).toBeGreaterThan(500);
    expect(Number(r.days)).toBeGreaterThan(300);

    const tags = await db.selectFrom('tags').select('name').execute();
    expect(tags.length).toBeGreaterThanOrEqual(10);
  });

  it('is repeatable for a fixed seed and differs for another seed', async () => {
    await seedContacts(db, { count: 300, seed: 7 });
    const a = await snapshot();
    await sql`TRUNCATE contacts, tags, contact_tags CASCADE`.execute(db);
    await seedContacts(db, { count: 300, seed: 7 });
    expect(await snapshot()).toEqual(a);

    await sql`TRUNCATE contacts, tags, contact_tags CASCADE`.execute(db);
    await seedContacts(db, { count: 300, seed: 8 });
    expect(await snapshot()).not.toEqual(a);
  });

  it('batches across the batch size boundary', async () => {
    await seedContacts(db, { count: 5003, seed: 3 });
    expect(await contactsCount(db)).toBe(5003);
  });

  it('seedIfEmpty seeds an empty table once and never touches existing data', async () => {
    expect(await seedIfEmpty(db, { count: 50, seed: 1 })).toBe(true);
    const before = await snapshot();
    expect(await seedIfEmpty(db, { count: 50, seed: 2 })).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
});
