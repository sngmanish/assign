import { sql, type Kysely, type Selectable } from 'kysely';
import type { ContactsTable, Database } from '../db/index.js';

export interface TagDto {
  id: string;
  name: string;
}

export interface ContactDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  tags: TagDto[];
}

const iso = (d: Date | string) => new Date(d).toISOString();

export function toContactDto(row: Selectable<ContactsTable>, tags: TagDto[]): ContactDto {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    version: row.version,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    tags,
  };
}

/** Tags for many contacts in one query (no N+1), sorted by name. */
export async function tagsByContact(
  db: Kysely<Database>,
  contactIds: string[],
): Promise<Map<string, TagDto[]>> {
  const map = new Map<string, TagDto[]>();
  if (contactIds.length === 0) return map;
  const rows = await db
    .selectFrom('contact_tags')
    .innerJoin('tags', 'tags.id', 'contact_tags.tag_id')
    .select(['contact_tags.contact_id', 'tags.id', 'tags.name'])
    .where('contact_tags.contact_id', 'in', contactIds)
    .orderBy(sql`lower(tags.name)`)
    .execute();
  for (const r of rows) {
    const list = map.get(r.contact_id) ?? [];
    list.push({ id: r.id, name: r.name });
    map.set(r.contact_id, list);
  }
  return map;
}

export async function getContact(db: Kysely<Database>, id: string): Promise<ContactDto | null> {
  const row = await db.selectFrom('contacts').selectAll().where('id', '=', id).executeTakeFirst();
  if (!row) return null;
  const tags = await tagsByContact(db, [id]);
  return toContactDto(row, tags.get(id) ?? []);
}

/** Basic list: newest first. Search, filters, sorting and keyset paging arrive in Task 7. */
export async function listContacts(db: Kysely<Database>, limit: number): Promise<ContactDto[]> {
  const rows = await db
    .selectFrom('contacts')
    .selectAll()
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute();
  const tags = await tagsByContact(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toContactDto(r, tags.get(r.id) ?? []));
}
