import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { ActivityType, Database } from '../db/index.js';
import { notFound } from '../errors.js';

export const activitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface ActivityDto {
  id: string;
  contactId: string;
  type: ActivityType;
  createdAt: string;
  /** CONTACT_UPDATED: { changes: { field: { old, new } } }. TAG_ADDED / TAG_REMOVED: { tagId, tagName }. */
  details: Record<string, unknown>;
}

/** Recent activity for a contact, newest first. 404 if the contact doesn't exist. */
export async function listActivities(
  db: Kysely<Database>,
  contactId: string,
  limit: number,
): Promise<ActivityDto[]> {
  const contact = await db
    .selectFrom('contacts')
    .select('id')
    .where('id', '=', contactId)
    .executeTakeFirst();
  if (!contact) throw notFound('Contact');

  const rows = await db
    .selectFrom('contact_activities')
    .selectAll()
    .where('contact_id', '=', contactId)
    // id breaks ties so events with the same timestamp always come back in the same order
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(limit)
    .execute();

  return rows.map((r) => ({
    id: r.id,
    contactId: r.contact_id,
    type: r.type,
    createdAt: new Date(r.created_at).toISOString(),
    details: r.details,
  }));
}
