import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import { getContact, type ContactDto, type TagDto } from '../contacts/queries.js';
import type { Database } from '../db/index.js';
import { AppError, notFound } from '../errors.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tagRefFields = {
  tagId: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Must not be empty')
    .max(50, 'Must be at most 50 characters')
    .optional(),
};
const exactlyOneTag = (b: { tagId?: string | undefined; name?: string | undefined }) =>
  (b.tagId === undefined) !== (b.name === undefined);
const exactlyOneTagIssue = { message: 'Provide exactly one of tagId or name', path: ['tagId'] };

/** POST body: a tag by `tagId` or by `name` (created on the fly), exactly one of them. */
export const addTagBodySchema = z
  .strictObject(tagRefFields)
  .refine(exactlyOneTag, exactlyOneTagIssue);

/** Bulk body: up to 1,000 contact ids plus a tag. */
export const MAX_BULK_CONTACTS = 1000;
export const bulkAssignBodySchema = z
  .strictObject({
    contactIds: z.array(z.string()).min(1).max(MAX_BULK_CONTACTS),
    ...tagRefFields,
  })
  .refine(exactlyOneTag, exactlyOneTagIssue);
export type TagRef = z.infer<typeof addTagBodySchema>;

/** A malformed id is a malformed request (400), wherever it appears. */
export function assertUuid(value: string, field: string): void {
  if (!UUID.test(value)) {
    throw new AppError(400, 'BAD_REQUEST', `Malformed ${field}`, [
      { path: field, message: 'Invalid UUID' },
    ]);
  }
}

export async function listTags(db: Kysely<Database>): Promise<TagDto[]> {
  return db
    .selectFrom('tags')
    .select(['id', 'name'])
    .orderBy(sql`lower(name)`)
    .orderBy('id')
    .execute();
}

export async function getTagById(db: Kysely<Database>, id: string): Promise<TagDto> {
  const tag = await db
    .selectFrom('tags')
    .select(['id', 'name'])
    .where('id', '=', id)
    .executeTakeFirst();
  if (!tag) throw notFound('Tag');
  return tag;
}

/**
 * Finds a tag by name, case-insensitively, creating it if needed. The existing spelling wins
 * ("vip" resolves to "VIP"). Safe under concurrent calls: the unique index on lower(name)
 * makes the insert a no-op for the loser, who then reads the winner's row.
 */
export async function findOrCreateTagByName(db: Kysely<Database>, name: string): Promise<TagDto> {
  await db
    .insertInto('tags')
    .values({ name })
    .onConflict((oc) => oc.expression(sql`lower(name)`).doNothing())
    .execute();
  return db
    .selectFrom('tags')
    .select(['id', 'name'])
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .executeTakeFirstOrThrow();
}

export async function resolveTag(db: Kysely<Database>, ref: TagRef): Promise<TagDto> {
  if (ref.tagId !== undefined) {
    assertUuid(ref.tagId, 'tagId');
    return getTagById(db, ref.tagId);
  }
  return findOrCreateTagByName(db, ref.name!);
}

async function assertContactExists(db: Kysely<Database>, id: string): Promise<void> {
  const row = await db.selectFrom('contacts').select('id').where('id', '=', id).executeTakeFirst();
  if (!row) throw notFound('Contact');
}

/**
 * Adds a tag to a contact. Adding one the contact already has is a quiet no-op (no error,
 * no activity). A real change touches updated_at only: `version` is never bumped.
 */
export async function addTagToContact(
  db: Kysely<Database>,
  contactId: string,
  ref: TagRef,
): Promise<ContactDto> {
  return db.transaction().execute(async (trx) => {
    if (ref.tagId !== undefined) assertUuid(ref.tagId, 'tagId');
    // Check the contact before resolving the tag so a 404 never leaves a new tag behind.
    await assertContactExists(trx, contactId);
    const tag = await resolveTag(trx, ref);

    const inserted = await trx
      .insertInto('contact_tags')
      .values({ contact_id: contactId, tag_id: tag.id })
      .onConflict((oc) => oc.columns(['contact_id', 'tag_id']).doNothing())
      .returning('tag_id')
      .executeTakeFirst();

    if (inserted) {
      await trx
        .updateTable('contacts')
        .set({ updated_at: sql`now()` })
        .where('id', '=', contactId)
        .execute();
      await trx
        .insertInto('contact_activities')
        .values({
          contact_id: contactId,
          type: 'TAG_ADDED',
          details: { tagId: tag.id, tagName: tag.name },
        })
        .execute();
    }
    return (await getContact(trx, contactId))!;
  });
}

/** Removes a tag from a contact. 404 if the contact doesn't have it. Never bumps `version`. */
export async function removeTagFromContact(
  db: Kysely<Database>,
  contactId: string,
  tagId: string,
): Promise<ContactDto> {
  return db.transaction().execute(async (trx) => {
    await assertContactExists(trx, contactId);
    const tag = await getTagById(trx, tagId);

    const removed = await trx
      .deleteFrom('contact_tags')
      .where('contact_id', '=', contactId)
      .where('tag_id', '=', tagId)
      .returning('tag_id')
      .executeTakeFirst();
    if (!removed) throw notFound('Tag on this contact');

    await trx
      .updateTable('contacts')
      .set({ updated_at: sql`now()` })
      .where('id', '=', contactId)
      .execute();
    await trx
      .insertInto('contact_activities')
      .values({
        contact_id: contactId,
        type: 'TAG_REMOVED',
        // The name is stored so history still reads correctly after a rename.
        details: { tagId: tag.id, tagName: tag.name },
      })
      .execute();
    return (await getContact(trx, contactId))!;
  });
}
