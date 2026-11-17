import { sql, type Expression, type ExpressionBuilder, type Kysely, type SqlBool } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/index.js';
import { AppError } from '../errors.js';
import {
  decodeCursor,
  encodeCursor,
  type CursorPayload,
  type Direction,
  type Order,
  type SortField,
} from './cursor.js';
import { tagsByContact, toContactDto, type ContactDto } from './queries.js';

/** Counts stop here: past this we report "10000+" and only allow Next/Previous. */
export const COUNT_CAP = 10_000;

const emptyToUndefined = (v: string | undefined) => (v === '' ? undefined : v);
const dateOrDateTime = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const listQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional().transform(emptyToUndefined),
    tag: z.uuid().optional(),
    company: z.string().trim().max(200).optional().transform(emptyToUndefined),
    createdFrom: dateOrDateTime.optional(),
    createdTo: dateOrDateTime.optional(),
    sort: z.enum(['name', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().max(2000).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
  })
  .refine((v) => !(v.cursor && v.page), { message: 'Use either cursor or page, not both' })
  .refine((v) => !(v.createdFrom && v.createdTo && start(v.createdFrom) > start(v.createdTo)), {
    message: 'createdFrom must not be after createdTo',
    path: ['createdFrom'],
  });

export type ListQuery = z.infer<typeof listQuerySchema>;

const isDateOnly = (s: string) => s.length === 10;
const start = (s: string) => new Date(isDateOnly(s) ? `${s}T00:00:00Z` : s);

interface Filters {
  tokens: string[];
  company?: string;
  tag?: string;
  from?: Date;
  to?: Date;
  toExclusive: boolean;
}

function toFilters(q: ListQuery): Filters {
  const f: Filters = { tokens: q.q ? q.q.split(/\s+/) : [], toExclusive: false };
  if (q.company) f.company = q.company;
  if (q.tag) f.tag = q.tag;
  if (q.createdFrom) f.from = start(q.createdFrom);
  if (q.createdTo) {
    const t = start(q.createdTo);
    // A bare date as the upper bound means "through the end of that day".
    f.to = isDateOnly(q.createdTo) ? new Date(t.getTime() + 24 * 3600 * 1000) : t;
    f.toExclusive = isDateOnly(q.createdTo);
  }
  return f;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

/** Search tokens are ANDed; each token may match name, email or phone (case-insensitive substring). */
function filterExpr(eb: ExpressionBuilder<Database, 'contacts'>, f: Filters): Expression<SqlBool> {
  const conds: Expression<SqlBool>[] = [];
  for (const token of f.tokens) {
    const p = `%${escapeLike(token)}%`;
    conds.push(
      eb.or([
        eb('first_name', 'ilike', p),
        eb('last_name', 'ilike', p),
        eb('email', 'ilike', p),
        eb('phone', 'ilike', p),
      ]),
    );
  }
  if (f.company) conds.push(eb('company', '=', f.company));
  if (f.tag) {
    conds.push(
      eb(
        'contacts.id',
        'in',
        eb.selectFrom('contact_tags').select('contact_id').where('tag_id', '=', f.tag),
      ),
    );
  }
  if (f.from) conds.push(eb('created_at', '>=', f.from));
  if (f.to) conds.push(eb('created_at', f.toExclusive ? '<' : '<=', f.to));
  return eb.and(conds);
}

/** Matching rows, counted only up to COUNT_CAP + 1 so cost stays bounded. */
async function cappedCount(db: Kysely<Database>, f: Filters): Promise<number> {
  const row = await db
    .selectFrom(
      db
        .selectFrom('contacts')
        .select(sql`1`.as('x'))
        .where((eb) => filterExpr(eb, f))
        .limit(COUNT_CAP + 1)
        .as('m'),
    )
    .select(sql<string>`count(*)`.as('n'))
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

export interface ListResponse {
  items: ContactDto[];
  nextCursor: string | null;
  prevCursor: string | null;
  total: number | '10000+';
  totalPages: number | null;
  capped: boolean;
  page: number | null;
}

export async function searchContacts(db: Kysely<Database>, q: ListQuery): Promise<ListResponse> {
  const f = toFilters(q);
  const sort: SortField = q.sort;
  const order: Order = q.order ?? (sort === 'name' ? 'asc' : 'desc');
  const { limit } = q;
  const cursor = q.cursor ? decodeCursor(q.cursor, sort, order) : undefined;

  // Page mode needs the count first; cursor mode can run it alongside the page query.
  const countPromise = cappedCount(db, f);
  let counted: number | undefined;
  if (q.page) {
    counted = await countPromise;
    if (counted > COUNT_CAP) {
      throw new AppError(
        400,
        'PAGE_NOT_ALLOWED',
        `Page numbers are only available up to ${COUNT_CAP} matches; use cursor navigation`,
      );
    }
  }

  // Walking backwards (Previous) reverses the SQL order and the comparison, then flips the rows back.
  const dir: Direction = cursor?.dir ?? 'next';
  const sqlAsc = (order === 'asc') === (dir === 'next');
  const cmp = sql.raw(sqlAsc ? '>' : '<');
  const dirSql = sqlAsc ? 'asc' : 'desc';

  let qb = db
    .selectFrom('contacts')
    .selectAll()
    // Text form keeps full microsecond precision for the cursor (JS Dates only hold ms).
    .select(sql<string>`created_at::text`.as('ck'))
    .where((eb) => filterExpr(eb, f));

  if (cursor) {
    const k = cursor.keys;
    qb = qb.where(
      sort === 'name'
        ? sql<boolean>`(last_name, first_name, id) ${cmp} (${k[0]}::text, ${k[1]}::text, ${k[2]}::uuid)`
        : sql<boolean>`(created_at, id) ${cmp} (${k[0]}::timestamptz, ${k[1]}::uuid)`,
    );
  }
  qb =
    sort === 'name'
      ? qb.orderBy('last_name', dirSql).orderBy('first_name', dirSql).orderBy('id', dirSql)
      : qb.orderBy('created_at', dirSql).orderBy('id', dirSql);
  qb = qb.limit(limit + 1);
  if (q.page) qb = qb.offset((q.page - 1) * limit);

  const [rows, total] = await Promise.all([qb.execute(), counted ?? countPromise]);
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  if (dir === 'prev') pageRows.reverse();

  const capped = total > COUNT_CAP;
  const currentPage = q.page ?? (cursor ? cursor.page : 1);
  const keysOf = (r: (typeof pageRows)[number]) =>
    sort === 'name' ? [r.last_name, r.first_name, r.id] : [r.ck, r.id];
  const make = (r: (typeof pageRows)[number] | undefined, d: Direction, page: number | null) =>
    r ? encodeCursor({ sort, order, dir: d, keys: keysOf(r), page }) : null;

  // Is there anything beyond each edge of this page?
  let hasNext: boolean;
  let hasPrev: boolean;
  if (q.page) {
    hasNext = hasMore;
    hasPrev = q.page > 1 && pageRows.length > 0;
  } else if (!cursor) {
    hasNext = hasMore;
    hasPrev = false;
  } else if (dir === 'next') {
    hasNext = hasMore;
    hasPrev = true; // we arrived from a page that lies before this boundary
  } else {
    hasNext = true;
    hasPrev = hasMore;
  }

  const tags = await tagsByContact(
    db,
    pageRows.map((r) => r.id),
  );

  return {
    items: pageRows.map((r) => toContactDto(r, tags.get(r.id) ?? [])),
    nextCursor: hasNext
      ? make(pageRows.at(-1), 'next', currentPage ? currentPage + 1 : null)
      : null,
    prevCursor: hasPrev
      ? make(pageRows[0], 'prev', currentPage && currentPage > 1 ? currentPage - 1 : null)
      : null,
    total: capped ? '10000+' : total,
    totalPages: capped ? null : Math.ceil(total / limit),
    capped,
    page: capped ? null : currentPage,
  };
}

export type { CursorPayload };
