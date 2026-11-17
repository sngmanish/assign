import { z } from 'zod';
import { AppError } from '../errors.js';

export type SortField = 'name' | 'createdAt';
export type Order = 'asc' | 'desc';
export type Direction = 'next' | 'prev';

export interface CursorPayload {
  sort: SortField;
  order: Order;
  dir: Direction;
  /** Sort-key values of the boundary row: name -> [last, first, id]; createdAt -> [created_at, id]. */
  keys: string[];
  /** Page number this cursor leads to, when known (null once past the count cap). */
  page: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Postgres `timestamptz::text`, e.g. "2025-12-31 23:21:35.630123+00"
const TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:\d{2})?)$/;

const wire = z.object({
  v: z.literal(1),
  s: z.enum(['name', 'createdAt']),
  o: z.enum(['asc', 'desc']),
  d: z.enum(['next', 'prev']),
  k: z.array(z.string().max(500)).min(2).max(3),
  p: z.number().int().min(1).nullable(),
});

export function encodeCursor(c: CursorPayload): string {
  const body = { v: 1, s: c.sort, o: c.order, d: c.dir, k: c.keys, p: c.page };
  return Buffer.from(JSON.stringify(body)).toString('base64url');
}

const invalid = () => new AppError(400, 'BAD_REQUEST', 'Invalid cursor');

/** Decode and validate a cursor. Keys are validated so a tampered cursor can't cause a DB error. */
export function decodeCursor(raw: string, sort: SortField, order: Order): CursorPayload {
  let parsed;
  try {
    parsed = wire.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  } catch {
    throw invalid();
  }
  if (!parsed.success) throw invalid();
  const { s, o, d, k, p } = parsed.data;
  // A cursor only makes sense for the sort it was issued under.
  if (s !== sort || o !== order) throw invalid();
  const expectedKeys = sort === 'name' ? 3 : 2;
  if (k.length !== expectedKeys || !UUID.test(k[k.length - 1]!)) throw invalid();
  if (sort === 'createdAt' && !TS.test(k[0]!)) throw invalid();
  return { sort: s, order: o, dir: d, keys: k, page: p };
}
