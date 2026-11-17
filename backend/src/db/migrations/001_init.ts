import { sql, type Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Trigram search (ILIKE '%q%') on name/email/phone.
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

  // ---- contacts ----
  await sql`
    CREATE TABLE contacts (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name  text NOT NULL CHECK (length(btrim(first_name)) > 0),
      last_name   text NOT NULL CHECK (length(btrim(last_name)) > 0),
      email       text,
      phone       text,
      company     text,
      version     integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )`.execute(db);

  // Email unique case-insensitively, only when present.
  await sql`CREATE UNIQUE INDEX contacts_email_lower_uniq ON contacts (lower(email)) WHERE email IS NOT NULL`.execute(
    db,
  );
  // Search
  await sql`CREATE INDEX contacts_first_name_trgm ON contacts USING gin (first_name gin_trgm_ops)`.execute(
    db,
  );
  await sql`CREATE INDEX contacts_last_name_trgm ON contacts USING gin (last_name gin_trgm_ops)`.execute(
    db,
  );
  await sql`CREATE INDEX contacts_email_trgm ON contacts USING gin (email gin_trgm_ops)`.execute(
    db,
  );
  await sql`CREATE INDEX contacts_phone_trgm ON contacts USING gin (phone gin_trgm_ops)`.execute(
    db,
  );
  // Sorting + keyset pagination
  await sql`CREATE INDEX contacts_created_at_id_idx ON contacts (created_at, id)`.execute(db);
  await sql`CREATE INDEX contacts_name_id_idx ON contacts (last_name, first_name, id)`.execute(db);
  // Filtering
  await sql`CREATE INDEX contacts_company_idx ON contacts (company)`.execute(db);

  // ---- tags ----
  await sql`
    CREATE TABLE tags (
      id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name  text NOT NULL CHECK (length(btrim(name)) > 0)
    )`.execute(db);
  await sql`CREATE UNIQUE INDEX tags_name_lower_uniq ON tags (lower(name))`.execute(db);

  // ---- contact_tags ----
  await sql`
    CREATE TABLE contact_tags (
      contact_id  uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
      tag_id      uuid NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
      PRIMARY KEY (contact_id, tag_id)
    )`.execute(db);
  // Filter contacts by tag
  await sql`CREATE INDEX contact_tags_tag_contact_idx ON contact_tags (tag_id, contact_id)`.execute(
    db,
  );

  // ---- contact_activities ----
  await sql`
    CREATE TABLE contact_activities (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id  uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
      type        text NOT NULL CHECK (type IN ('CONTACT_UPDATED', 'TAG_ADDED', 'TAG_REMOVED')),
      created_at  timestamptz NOT NULL DEFAULT now(),
      details     jsonb NOT NULL DEFAULT '{}'::jsonb
    )`.execute(db);
  await sql`CREATE INDEX contact_activities_contact_created_idx ON contact_activities (contact_id, created_at DESC)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS contact_activities`.execute(db);
  await sql`DROP TABLE IF EXISTS contact_tags`.execute(db);
  await sql`DROP TABLE IF EXISTS tags`.execute(db);
  await sql`DROP TABLE IF EXISTS contacts`.execute(db);
  // pg_trgm is left installed; extensions may be shared with other schemas.
}
