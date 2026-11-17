import { z } from 'zod';
import { AppError } from '../errors.js';
import { isUuid } from '../ids.js';
import { noNul } from '../text.js';

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

// Postgres `timestamptz::text`, e.g. "2025-12-31 23:21:35.630123+00"
const TS =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?([+-])(\d{2})(?::(\d{2}))?$/;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysIn = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;

/**
 * Shape AND calendar. A shape check alone lets "2025-13-45 99:99:99+00" through, and
 * Postgres then fails on the cast (22008). JavaScript's Date can't be used to check this:
 * it rolls some impossible dates (Feb 30) over instead of rejecting them.
 */
export function isValidTimestamp(s: string): boolean {
  const m = TS.exec(s);
  if (!m) return false;
  const [y, mo, d, h, mi, sec, , tzh, tzm] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) =>
    Number(m[i] ?? 0),
  );
  return (
    y! >= 1 &&
    mo! >= 1 &&
    mo! <= 12 &&
    d! >= 1 &&
    d! <= daysIn(y!, mo!) &&
    h! <= 23 &&
    mi! <= 59 &&
    sec! <= 59 &&
    tzh! <= 15 &&
    tzm! <= 59
  );
}

const wire = z.object({
  v: z.literal(1),
  s: z.enum(['name', 'createdAt']),
  o: z.enum(['asc', 'desc']),
  d: z.enum(['next', 'prev']),
  k: z.array(z.string().max(500).refine(noNul)).min(2).max(3),
  p: z.number().int().min(1).nullable(),
});

export function encodeCursor(c: CursorPayload): string {
  const body = { v: 1, s: c.sort, o: c.order, d: c.dir, k: c.keys, p: c.page };
  return Buffer.from(JSON.stringify(body)).toString('base64url');
}

const invalid = () => new AppError(400, 'BAD_REQUEST', 'Invalid cursor');

/** Decode and validate a cursor. Keys are validated (shape, calendar, NUL) so a tampered cursor is a 400. */
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
  if (k.length !== expectedKeys || !isUuid(k[k.length - 1]!)) throw invalid();
  if (sort === 'createdAt' && !isValidTimestamp(k[0]!)) throw invalid();
  return { sort: s, order: o, dir: d, keys: k, page: p };
}
