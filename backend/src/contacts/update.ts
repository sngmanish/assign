import type { Kysely, Updateable } from 'kysely';
import pg from 'pg';
import { z } from 'zod';
import type { ContactsTable, Database } from '../db/index.js';
import { AppError, notFound } from '../errors.js';
import { getContact, type ContactDto } from './queries.js';

/** Trimmed text; an empty string becomes null. */
const optionalText = (max: number) =>
  z
    .union([z.null(), z.string()])
    .transform((v) => (v === null ? null : v.trim() || null))
    .refine((v) => v === null || v.length <= max, `Must be at most ${max} characters`);

const nameField = z
  .string()
  .trim()
  .min(1, 'Must not be empty')
  .max(100, 'Must be at most 100 characters');

/** Emails are trimmed and lowercased before saving; empty becomes null. */
const emailField = z
  .union([z.null(), z.string()])
  .transform((v) => (v === null ? null : v.trim().toLowerCase() || null))
  .refine(
    (v) => v === null || (v.length <= 254 && z.email().safeParse(v).success),
    'Invalid email address',
  );

// Digits plus + ( ) - . and spaces, with at least 7 digits (accepts e.g. +1-555-123-4567).
const phoneField = optionalText(30).refine(
  (v) => v === null || (/^\+?[0-9 ().-]+$/.test(v) && v.replace(/\D/g, '').length >= 7),
  'Invalid phone number',
);

/** PATCH body: only these fields are accepted; anything else is rejected. */
export const updateBodySchema = z.strictObject({
  version: z.number().int().min(1),
  firstName: nameField.optional(),
  lastName: nameField.optional(),
  email: emailField.optional(),
  phone: phoneField.optional(),
  company: optionalText(200).optional(),
});

export type UpdateBody = z.infer<typeof updateBodySchema>;

const FIELD_TO_COLUMN = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  company: 'company',
} as const;

const isEmailTaken = (e: unknown): boolean =>
  e instanceof pg.DatabaseError &&
  e.code === '23505' &&
  e.constraint === 'contacts_email_lower_uniq';

/**
 * Optimistic-locking update. The row is locked, the version checked, the changed fields
 * diffed, and the UPDATE (guarded by `version = $2`) and the activity row are written in
 * one transaction.
 */
export async function updateContact(
  db: Kysely<Database>,
  id: string,
  body: UpdateBody,
): Promise<ContactDto> {
  try {
    return await db.transaction().execute(async (trx) => {
      const current = await trx
        .selectFrom('contacts')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst();
      if (!current) throw notFound('Contact');

      if (current.version !== body.version) throw await conflict(trx, id);

      // Work out which fields actually change.
      const changes: Record<string, { old: string | null; new: string | null }> = {};
      const set: Record<string, string | null> = {};
      for (const [field, column] of Object.entries(FIELD_TO_COLUMN) as [
        keyof typeof FIELD_TO_COLUMN,
        (typeof FIELD_TO_COLUMN)[keyof typeof FIELD_TO_COLUMN],
      ][]) {
        const next = body[field];
        if (next === undefined || next === current[column]) continue;
        changes[field] = { old: current[column], new: next };
        set[column] = next;
      }

      // Nothing really changed: no write, no version bump, no activity.
      if (Object.keys(changes).length === 0) return (await getContact(trx, id))!;

      const updated = await trx
        .updateTable('contacts')
        .set({
          ...(set as Updateable<ContactsTable>),
          version: current.version + 1,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .where('version', '=', body.version)
        .returning('id')
        .executeTakeFirst();
      if (!updated) throw await conflict(trx, id); // lost a race: report what changed

      await trx
        .insertInto('contact_activities')
        .values({ contact_id: id, type: 'CONTACT_UPDATED', details: { changes } })
        .execute();

      return (await getContact(trx, id))!;
    });
  } catch (e) {
    if (isEmailTaken(e)) {
      throw new AppError(409, 'EMAIL_TAKEN', 'Another contact already uses this email', {
        field: 'email',
      });
    }
    throw e;
  }
}

/** 409 carrying the latest contact so the UI can show what changed. */
async function conflict(db: Kysely<Database>, id: string): Promise<AppError> {
  const latest = await getContact(db, id);
  return new AppError(
    409,
    'VERSION_CONFLICT',
    'This contact was changed by someone else. Review the latest version and try again.',
    { latest },
  );
}
