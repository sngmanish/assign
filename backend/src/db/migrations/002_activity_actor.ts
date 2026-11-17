import { sql, type Kysely } from 'kysely';

/** Who made the change (demo "acting as" label). Nullable: rows written before this have none. */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE contact_activities ADD COLUMN actor text`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE contact_activities DROP COLUMN IF EXISTS actor`.execute(db);
}
