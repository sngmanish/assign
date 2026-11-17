import { sql, type Kysely } from 'kysely';
import type { Database } from '../db/index.js';
import { AppError } from '../errors.js';
import { assertUuid, findOrCreateTagByName, getTagById, type TagRef } from './service.js';

export interface BulkAssignResult {
  added: number;
  alreadyTagged: number;
  notFound: number;
}

/** Contact ids must be well-formed (400) and are de-duplicated, keeping the first occurrence. */
export function validateContactIds(ids: string[]): string[] {
  const bad: { path: string; message: string }[] = [];
  ids.forEach((id, i) => {
    try {
      assertUuid(id, 'contactIds');
    } catch {
      if (bad.length < 20) bad.push({ path: `contactIds.${i}`, message: 'Invalid UUID' });
    }
  });
  if (bad.length) throw new AppError(400, 'BAD_REQUEST', 'Malformed contact id in contactIds', bad);
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

/**
 * Applies one tag to many contacts in a single transaction.
 * - Contacts that already have the tag are skipped, so repeating a request is a no-op.
 * - Every newly tagged contact gets a TAG_ADDED event, written with one multi-row insert.
 * - Like single tag changes, it touches updated_at only and never bumps `version`.
 */
export async function bulkAssignTag(
  db: Kysely<Database>,
  contactIds: string[],
  ref: TagRef,
): Promise<BulkAssignResult> {
  const ids = validateContactIds(contactIds);
  if (ref.tagId !== undefined) assertUuid(ref.tagId, 'tagId');

  return db.transaction().execute(async (trx) => {
    // An unknown tagId is a 404 no matter which contacts exist.
    let tag = ref.tagId !== undefined ? await getTagById(trx, ref.tagId) : undefined;

    // Lock the existing contacts in id order so overlapping bulk requests can't deadlock.
    // This lock does not conflict with the foreign-key checks of the inserts below.
    const found = (
      await trx
        .selectFrom('contacts')
        .select('id')
        .where('id', 'in', ids)
        .orderBy('id')
        .forNoKeyUpdate()
        .execute()
    ).map((r) => r.id);
    const notFound = ids.length - found.length;

    // Nothing to tag: don't create a tag just to leave it unused.
    if (found.length === 0) return { added: 0, alreadyTagged: 0, notFound };

    tag ??= await findOrCreateTagByName(trx, ref.name!);
    const tagId = tag.id;

    // ON CONFLICT DO NOTHING + RETURNING yields exactly the newly tagged contacts, even
    // if another request tags some of them concurrently.
    const added = (
      await trx
        .insertInto('contact_tags')
        .values(found.map((contact_id) => ({ contact_id, tag_id: tagId })))
        .onConflict((oc) => oc.columns(['contact_id', 'tag_id']).doNothing())
        .returning('contact_id')
        .execute()
    ).map((r) => r.contact_id);

    if (added.length > 0) {
      await trx
        .updateTable('contacts')
        .set({ updated_at: sql`now()` })
        .where('id', 'in', added)
        .execute();
      await trx
        .insertInto('contact_activities')
        .values(
          added.map((contact_id) => ({
            contact_id,
            type: 'TAG_ADDED' as const,
            details: { tagId, tagName: tag.name },
          })),
        )
        .execute();
    }

    return { added: added.length, alreadyTagged: found.length - added.length, notFound };
  });
}
