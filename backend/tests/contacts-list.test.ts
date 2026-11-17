import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';

interface Item {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  createdAt: string;
  tags: { id: string; name: string }[];
}
interface Page {
  items: Item[];
  nextCursor: string | null;
  prevCursor: string | null;
  total: number | '10000+';
  totalPages: number | null;
  capped: boolean;
  page: number | null;
}

describe('GET /contacts list features', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;

  beforeAll(async () => {
    loadConfig();
    db = createDb(
      process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test',
    );
    await runMigrations(db);
    app = await buildApp({ db });
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
  });

  const get = async (qs: string) => {
    const res = await app.inject({ method: 'GET', url: `/contacts?${qs}` });
    return { status: res.statusCode, body: res.json() };
  };
  const page = async (qs: string): Promise<Page> => {
    const r = await get(qs);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return r.body;
  };
  const names = (p: Page) => p.items.map((i) => `${i.firstName} ${i.lastName}`);

  /** Walk forward through every page using nextCursor. */
  async function walkForward(base: string): Promise<Page[]> {
    const pages: Page[] = [];
    let p = await page(base);
    pages.push(p);
    while (p.nextCursor) {
      p = await page(`${base}&cursor=${p.nextCursor}`);
      pages.push(p);
      expect(pages.length).toBeLessThan(500); // guard against an infinite loop
    }
    return pages;
  }

  // ---------- keyset pagination ----------

  describe('keyset pagination', () => {
    // 57 contacts with heavy ties: only 4 distinct created_at values and 6 distinct names,
    // so the (sort_key, id) tiebreak is what keeps pages stable.
    beforeEach(async () => {
      await sql`
        INSERT INTO contacts (first_name, last_name, email, created_at)
        SELECT (ARRAY['Ann','Bob','Cy'])[1 + g % 3],
               (ARRAY['Lee','Kim'])[1 + g % 2],
               CASE WHEN g % 5 = 0 THEN NULL ELSE 'u' || g || '@x.com' END,
               timestamptz '2024-01-01' + ((g % 4) || ' days')::interval
        FROM generate_series(1, 57) g`.execute(db);
    });

    const expectedOrder = async (sort: 'name' | 'createdAt', order: 'asc' | 'desc') => {
      const d = order.toUpperCase();
      const q =
        sort === 'name'
          ? sql<{
              id: string;
            }>`SELECT id FROM contacts ORDER BY last_name ${sql.raw(d)}, first_name ${sql.raw(d)}, id ${sql.raw(d)}`
          : sql<{
              id: string;
            }>`SELECT id FROM contacts ORDER BY created_at ${sql.raw(d)}, id ${sql.raw(d)}`;
      return (await q.execute(db)).rows.map((r) => r.id);
    };

    describe.each([
      ['name', 'asc'],
      ['name', 'desc'],
      ['createdAt', 'asc'],
      ['createdAt', 'desc'],
    ] as const)('sort=%s order=%s', (sort, order) => {
      it('has no gaps or duplicates walking Next, and matches the SQL order', async () => {
        const pages = await walkForward(`sort=${sort}&order=${order}&limit=10`);
        const ids = pages.flatMap((p) => p.items.map((i) => i.id));
        expect(new Set(ids).size).toBe(ids.length); // no duplicates
        expect(ids).toEqual(await expectedOrder(sort, order)); // no gaps, right order
        expect(pages.map((p) => p.items.length)).toEqual([10, 10, 10, 10, 10, 7]);
        expect(pages[0]!.prevCursor).toBeNull();
        expect(pages.at(-1)!.nextCursor).toBeNull();
      });

      it('walking Previous from the last page returns the same pages', async () => {
        const forward = await walkForward(`sort=${sort}&order=${order}&limit=10`);
        const backward: Page[] = [forward.at(-1)!];
        let p = forward.at(-1)!;
        while (p.prevCursor) {
          p = await page(`sort=${sort}&order=${order}&limit=10&cursor=${p.prevCursor}`);
          backward.push(p);
          expect(backward.length).toBeLessThan(500);
        }
        expect(backward.reverse().map((x) => x.items.map((i) => i.id))).toEqual(
          forward.map((x) => x.items.map((i) => i.id)),
        );
        expect(backward[0]!.prevCursor).toBeNull();
      });
    });

    it('defaults: createdAt desc, and name asc when sorting by name', async () => {
      const a = await page('limit=5');
      const times = a.items.map((i) => i.createdAt);
      expect([...times].sort().reverse()).toEqual(times);
      const b = await page('sort=name&limit=100');
      const lastNames = b.items.map((i) => i.lastName);
      expect([...lastNames].sort((x, y) => x.localeCompare(y))).toEqual(lastNames);
    });

    it('reports exact total, totalPages and page numbers under the cap', async () => {
      const p1 = await page('limit=10');
      expect(p1).toMatchObject({ total: 57, totalPages: 6, capped: false, page: 1 });
      const p2 = await page(`limit=10&cursor=${p1.nextCursor}`);
      expect(p2.page).toBe(2);
      expect((await page(`limit=10&cursor=${p2.prevCursor}`)).page).toBe(1);
    });

    it('page=N jumps straight to that page and matches walking', async () => {
      const walked = await walkForward('sort=name&limit=10');
      for (const n of [1, 3, 6]) {
        const p = await page(`sort=name&limit=10&page=${n}`);
        expect(p.items.map((i) => i.id)).toEqual(walked[n - 1]!.items.map((i) => i.id));
        expect(p.page).toBe(n);
        expect(p.totalPages).toBe(6);
      }
      // cursors from a jumped-to page continue seamlessly
      const p3 = await page('sort=name&limit=10&page=3');
      const next = await page(`sort=name&limit=10&cursor=${p3.nextCursor}`);
      expect(next.items.map((i) => i.id)).toEqual(walked[3]!.items.map((i) => i.id));
      const prev = await page(`sort=name&limit=10&cursor=${p3.prevCursor}`);
      expect(prev.items.map((i) => i.id)).toEqual(walked[1]!.items.map((i) => i.id));
      // past the end: empty, not an error
      const past = await page('limit=10&page=99');
      expect(past.items).toEqual([]);
      expect(past.nextCursor).toBeNull();
    });

    it('limit larger than the data returns one page with no cursors', async () => {
      const p = await page('limit=100');
      expect(p.items).toHaveLength(57);
      expect(p.nextCursor).toBeNull();
      expect(p.prevCursor).toBeNull();
    });
  });

  it('keeps microsecond precision in createdAt cursors (no skipped or repeated rows)', async () => {
    await sql`
      INSERT INTO contacts (first_name, last_name, created_at)
      SELECT 'F' || g, 'L', timestamptz '2024-05-05 10:00:00' + (g || ' microseconds')::interval
      FROM generate_series(1, 25) g`.execute(db);
    // All 25 rows fall within the same millisecond.
    const pages = await walkForward('sort=createdAt&order=asc&limit=4');
    const ids = pages.flatMap((p) => p.items.map((i) => i.firstName));
    expect(ids).toEqual(Array.from({ length: 25 }, (_, i) => `F${i + 1}`));
  });

  // ---------- capped count ----------

  describe('capped count', () => {
    const insert = (n: number) =>
      sql`
        INSERT INTO contacts (first_name, last_name, created_at)
        SELECT 'F' || g, 'L' || (g % 50), now() - (g || ' seconds')::interval
        FROM generate_series(1, ${n}) g`.execute(db);

    it('exactly 10,000 matches is still an exact count', async () => {
      await insert(10_000);
      const p = await page('limit=100');
      expect(p).toMatchObject({ total: 10_000, totalPages: 100, capped: false, page: 1 });
      expect((await page('limit=100&page=100')).items).toHaveLength(100);
    });

    it('over 10,000 reports "10000+", disables page numbers, and still paginates by cursor', async () => {
      await insert(10_050);
      const p = await page('limit=100');
      expect(p).toMatchObject({ total: '10000+', totalPages: null, capped: true, page: null });

      const r = await get('limit=100&page=2');
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('PAGE_NOT_ALLOWED');

      const next = await page(`limit=100&cursor=${p.nextCursor}`);
      expect(next.capped).toBe(true);
      expect(next.items).toHaveLength(100);
      expect(next.prevCursor).not.toBeNull();
    });

    it('a filter that narrows below the cap gets exact counts again', async () => {
      await insert(10_050);
      const p = await page('company=nobody');
      expect(p).toMatchObject({ total: 0, capped: false, items: [] });
    });
  });

  // ---------- search & filters ----------

  describe('search and filters', () => {
    let vip: string;
    let lead: string;

    beforeEach(async () => {
      const rows = await db
        .insertInto('contacts')
        .values([
          {
            first_name: 'Ada',
            last_name: 'Lovelace',
            email: 'ada@analytical.com',
            phone: '+1-555-0100',
            company: 'Analytical',
            created_at: '2024-01-15T12:00:00Z',
          },
          {
            first_name: 'Grace',
            last_name: 'Hopper',
            email: null,
            phone: '+1-555-0199',
            company: 'Navy',
            created_at: '2024-02-10T08:00:00Z',
          },
          {
            first_name: 'Alan',
            last_name: 'Turing',
            email: 'alan@bletchley.org',
            phone: null,
            company: 'Bletchley',
            created_at: '2024-03-01T00:00:00Z',
          },
          {
            first_name: 'Adam',
            last_name: 'Smith',
            email: 'adam.smith@navy.com',
            phone: '+44-20-7946',
            company: 'Navy',
            created_at: '2024-03-20T23:59:59Z',
          },
          {
            first_name: '100%',
            last_name: 'Pure_Name',
            email: null,
            phone: null,
            company: null,
            created_at: '2024-04-01T00:00:00Z',
          },
        ])
        .returning(['id', 'first_name'])
        .execute();
      const id = (n: string) => rows.find((r) => r.first_name === n)!.id;
      const tags = await db
        .insertInto('tags')
        .values([{ name: 'VIP' }, { name: 'Lead' }])
        .returning(['id', 'name'])
        .execute();
      vip = tags.find((t) => t.name === 'VIP')!.id;
      lead = tags.find((t) => t.name === 'Lead')!.id;
      await db
        .insertInto('contact_tags')
        .values([
          { contact_id: id('Ada'), tag_id: vip },
          { contact_id: id('Ada'), tag_id: lead },
          { contact_id: id('Grace'), tag_id: vip },
          { contact_id: id('Adam'), tag_id: lead },
        ])
        .execute();
    });

    it('q matches first name, last name, email and phone, case-insensitively, as substrings', async () => {
      expect(names(await page('q=ada&sort=name'))).toEqual(['Ada Lovelace', 'Adam Smith']); // name + email
      expect(names(await page('q=HOPP'))).toEqual(['Grace Hopper']); // last name, no email
      expect(names(await page('q=bletchley'))).toEqual(['Alan Turing']); // email domain
      expect(names(await page('q=555-0199'))).toEqual(['Grace Hopper']); // phone
      expect(names(await page('q=7946'))).toEqual(['Adam Smith']); // phone substring
    });

    it('q with several words requires every word to match (full-name search)', async () => {
      expect(names(await page('q=ada%20lovelace'))).toEqual(['Ada Lovelace']);
      expect(names(await page('q=lovelace%20ada'))).toEqual(['Ada Lovelace']);
      expect((await page('q=ada%20hopper')).items).toEqual([]);
    });

    it('treats % and _ in q literally', async () => {
      expect(names(await page('q=100%25'))).toEqual(['100% Pure_Name']);
      expect(names(await page('q=e_N'))).toEqual(['100% Pure_Name']);
      expect((await page('q=%25')).total).toBe(1); // not "match everything"
    });

    it('blank q is ignored', async () => {
      expect((await page('q=%20%20')).total).toBe(5);
    });

    it('filters by company (exact)', async () => {
      expect(names(await page('company=Navy&sort=name'))).toEqual(
        ['Grace Hopper', 'Adam Smith'].sort((a, b) =>
          a.split(' ')[1]!.localeCompare(b.split(' ')[1]!),
        ),
      );
      expect((await page('company=nav')).items).toEqual([]);
    });

    it('filters by tag id, and returns all of each contact’s tags', async () => {
      const p = await page(`tag=${vip}&sort=name`);
      expect(names(p)).toEqual(['Grace Hopper', 'Ada Lovelace']);
      const ada = p.items.find((i) => i.firstName === 'Ada')!;
      expect(ada.tags.map((t) => t.name)).toEqual(['Lead', 'VIP']);
      expect(p.total).toBe(2);
    });

    it('filters by created date range; a date-only createdTo includes that whole day', async () => {
      expect(
        names(await page('createdFrom=2024-02-01&createdTo=2024-03-01&sort=createdAt&order=asc')),
      ).toEqual(['Grace Hopper', 'Alan Turing']);
      // Adam was created 2024-03-20T23:59:59Z: included by a date-only bound for that day
      expect(names(await page('createdFrom=2024-03-20&createdTo=2024-03-20'))).toEqual([
        'Adam Smith',
      ]);
      // a datetime bound is exact (inclusive)
      expect(names(await page('createdTo=2024-01-15T12:00:00Z'))).toEqual(['Ada Lovelace']);
      expect((await page('createdFrom=2024-03-21&createdTo=2024-03-31')).items).toEqual([]);
    });

    it('combines q + tag + company + date range (all must hold)', async () => {
      expect(names(await page(`q=ad&tag=${lead}&sort=name`))).toEqual([
        'Ada Lovelace',
        'Adam Smith',
      ]);
      expect(names(await page(`q=ad&tag=${lead}&company=Navy`))).toEqual(['Adam Smith']);
      expect(
        names(
          await page(`q=ad&tag=${lead}&company=Navy&createdFrom=2024-03-01&createdTo=2024-03-31`),
        ),
      ).toEqual(['Adam Smith']);
      expect((await page(`q=ad&tag=${vip}&company=Navy`)).items).toEqual([]);
    });

    it('filtered results paginate consistently and totals reflect the filter', async () => {
      const pages = await walkForward(`q=a&sort=name&limit=2`);
      const walked = pages.flatMap((p) => p.items.map((i) => i.id));
      expect(new Set(walked).size).toBe(walked.length);
      const all = await page('q=a&sort=name&limit=100');
      expect(walked).toEqual(all.items.map((i) => i.id));
      expect(pages[0]!.total).toBe(all.items.length);
    });

    it('no results: empty items, total 0, no cursors', async () => {
      const p = await page('q=zzzzzz');
      expect(p).toMatchObject({
        items: [],
        total: 0,
        totalPages: 0,
        capped: false,
        nextCursor: null,
        prevCursor: null,
      });
    });
  });

  // ---------- validation ----------

  describe('bad query parameters return 400 BAD_REQUEST', () => {
    it.each([
      ['sort=email'],
      ['order=up'],
      ['tag=not-a-uuid'],
      ['createdFrom=yesterday'],
      ['createdTo=2024-13-45'],
      ['createdFrom=2024-05-01&createdTo=2024-04-01'],
      ['page=0'],
      ['page=abc'],
      ['limit=101'],
      ['cursor=garbage'],
      [`cursor=${Buffer.from('{"v":1}').toString('base64url')}`],
      [`q=${'x'.repeat(101)}`],
    ])('%s', async (qs) => {
      const r = await get(qs);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('BAD_REQUEST');
    });

    it('cursor together with page', async () => {
      await sql`INSERT INTO contacts (first_name, last_name) SELECT 'A' || g, 'B' FROM generate_series(1, 5) g`.execute(
        db,
      );
      const p = await page('limit=2');
      expect((await get(`limit=2&page=2&cursor=${p.nextCursor}`)).status).toBe(400);
    });

    it('a cursor from a different sort or order is rejected', async () => {
      await sql`INSERT INTO contacts (first_name, last_name) SELECT 'A' || g, 'B' FROM generate_series(1, 5) g`.execute(
        db,
      );
      const p = await page('sort=name&limit=2');
      expect((await get(`sort=createdAt&limit=2&cursor=${p.nextCursor}`)).status).toBe(400);
      expect((await get(`sort=name&order=desc&limit=2&cursor=${p.nextCursor}`)).status).toBe(400);
    });

    it('a tampered cursor with an invalid key is a 400, never a 500', async () => {
      const bad = Buffer.from(
        JSON.stringify({
          v: 1,
          s: 'createdAt',
          o: 'desc',
          d: 'next',
          k: ["x'; drop table contacts;--", 'nope'],
          p: null,
        }),
      ).toString('base64url');
      expect((await get(`cursor=${bad}`)).status).toBe(400);
    });
  });
});
