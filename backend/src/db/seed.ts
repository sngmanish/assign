import { sql, type Kysely } from 'kysely';
import { loadConfig } from '../config.js';
import { createDb, type Database } from './index.js';
import { runMigrations } from './migrate.js';

export const DEFAULT_COUNT = 20_000;
export const DEFAULT_SEED = 42;
const BATCH_SIZE = 5_000;

const FIRST_NAMES = [
  'Liam',
  'Olivia',
  'Noah',
  'Emma',
  'Oliver',
  'Ava',
  'Elijah',
  'Sophia',
  'James',
  'Isabella',
  'William',
  'Mia',
  'Benjamin',
  'Charlotte',
  'Lucas',
  'Amelia',
  'Henry',
  'Harper',
  'Theodore',
  'Evelyn',
  'Jack',
  'Abigail',
  'Levi',
  'Emily',
  'Alexander',
  'Ella',
  'Daniel',
  'Scarlett',
  'Michael',
  'Grace',
  'Owen',
  'Chloe',
  'Samuel',
  'Victoria',
  'Aiden',
  'Riley',
  'Ethan',
  'Aria',
  'Leo',
  'Lily',
  'Aarav',
  'Priya',
  'Arjun',
  'Ananya',
  'Rohan',
  'Diya',
  'Wei',
  'Mei',
  'Hiroshi',
  'Yuki',
  'Mateo',
  'Sofia',
  'Diego',
  'Camila',
  'Omar',
  'Layla',
  'Kwame',
  'Amara',
  'Sven',
  'Ingrid',
];
const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Perez',
  'Thompson',
  'White',
  'Harris',
  'Sanchez',
  'Clark',
  'Ramirez',
  'Lewis',
  'Robinson',
  'Walker',
  'Young',
  'Allen',
  'King',
  'Wright',
  'Scott',
  'Torres',
  'Nguyen',
  'Hill',
  'Flores',
  'Patel',
  'Sharma',
  'Singh',
  'Kumar',
  'Gupta',
  'Chen',
  'Wang',
  'Tanaka',
  'Kim',
  'Park',
  'Okafor',
  'Mensah',
  'Haddad',
  'Rossi',
  'Muller',
  'Novak',
  'Larsen',
  'Dubois',
  'Silva',
  'Costa',
];
const COMPANY_PREFIXES = [
  'Acme',
  'Globex',
  'Initech',
  'Umbrella',
  'Stark',
  'Wayne',
  'Hooli',
  'Vandelay',
  'Soylent',
  'Wonka',
  'Cyberdyne',
  'Tyrell',
  'Aperture',
  'Massive',
  'Pied',
  'Dunder',
  'Sterling',
  'Oscorp',
  'Gringotts',
  'Monarch',
];
const COMPANY_SUFFIXES = [
  'Industries',
  'Labs',
  'Systems',
  'Group',
  'Partners',
  'Technologies',
  'Holdings',
  'Solutions',
];
const COMPANIES = COMPANY_PREFIXES.flatMap((p) => COMPANY_SUFFIXES.map((s) => `${p} ${s}`)); // 160
const PERSONAL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com'];

export const SEED_TAGS = [
  'VIP',
  'Lead',
  'Customer',
  'Prospect',
  'Partner',
  'Newsletter',
  'Churned',
  'Enterprise',
  'SMB',
  'Referral',
  'Event',
  'Support',
];

// Small, fast, deterministic PRNG so a fixed seed gives identical data.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedOptions {
  count?: number;
  seed?: number;
  log?: (msg: string) => void;
}

export async function contactsCount(db: Kysely<Database>): Promise<number> {
  const row = await db
    .selectFrom('contacts')
    .select(sql<string>`count(*)`.as('n'))
    .executeTakeFirstOrThrow();
  return Number(row.n);
}

/** Inserts `count` generated contacts plus tags. Fully repeatable for a given seed. */
export async function seedContacts(db: Kysely<Database>, opts: SeedOptions = {}): Promise<number> {
  const count = opts.count ?? DEFAULT_COUNT;
  const rand = mulberry32(opts.seed ?? DEFAULT_SEED);
  const log = opts.log ?? (() => {});
  const int = (n: number) => Math.floor(rand() * n);
  const pick = <T>(arr: readonly T[]): T => arr[int(arr.length)] as T;
  const digits = (n: number) => Array.from({ length: n }, () => int(10)).join('');
  const uuid = () => {
    const h = Array.from({ length: 32 }, () => int(16).toString(16));
    h[12] = '4';
    h[16] = '89ab'[int(4)]!;
    return `${h.slice(0, 8).join('')}-${h.slice(8, 12).join('')}-${h.slice(12, 16).join('')}-${h.slice(16, 20).join('')}-${h.slice(20).join('')}`;
  };

  // Fixed reference date keeps dates repeatable: spread over the two years before it.
  const END = Date.UTC(2026, 0, 1);
  const SPAN_MS = 2 * 365 * 24 * 3600 * 1000;

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('tags')
      .values(SEED_TAGS.map((name) => ({ name })))
      .onConflict((oc) => oc.doNothing())
      .execute();
    const tagIds = (
      await trx
        .selectFrom('tags')
        .select('id')
        .where(sql<boolean>`name in (${sql.join(SEED_TAGS)})`)
        .execute()
    ).map((t) => t.id);

    for (let start = 0; start < count; start += BATCH_SIZE) {
      const n = Math.min(BATCH_SIZE, count - start);
      const contacts = [];
      const links: { contact_id: string; tag_id: string }[] = [];

      for (let i = start; i < start + n; i++) {
        const first = pick(FIRST_NAMES);
        const last = pick(LAST_NAMES);
        const company = rand() < 0.1 ? null : pick(COMPANIES);
        const id = uuid();
        // Index in the address keeps emails unique; ~15% of contacts have none.
        let email: string | null = null;
        if (rand() >= 0.15) {
          const domain =
            company && rand() < 0.6
              ? `${company.toLowerCase().replace(/ /g, '')}.com`
              : pick(PERSONAL_DOMAINS);
          email = `${first}.${last}.${i}@${domain}`.toLowerCase();
        }
        const phone = rand() < 0.2 ? null : `+1-${200 + int(800)}-555-${digits(4)}`;
        const created = new Date(END - Math.floor(rand() * SPAN_MS));
        contacts.push({
          id,
          first_name: first,
          last_name: last,
          email,
          phone,
          company,
          created_at: created,
          updated_at: created,
        });

        // 0-3 distinct tags per contact: ~30% none, 35% one, 25% two, 10% three.
        const r = rand();
        const tagCount = r < 0.3 ? 0 : r < 0.65 ? 1 : r < 0.9 ? 2 : 3;
        const chosen = new Set<string>();
        while (chosen.size < tagCount) chosen.add(pick(tagIds));
        for (const tag_id of chosen) links.push({ contact_id: id, tag_id });
      }

      await trx.insertInto('contacts').values(contacts).execute();
      if (links.length) await trx.insertInto('contact_tags').values(links).execute();
      log(`  inserted ${start + n} / ${count}`);
    }
  });

  await sql`ANALYZE contacts`.execute(db);
  await sql`ANALYZE contact_tags`.execute(db);
  return count;
}

/** Seeds only if the contacts table is empty. Returns true if it seeded. Used on startup (Task 13). */
export async function seedIfEmpty(db: Kysely<Database>, opts: SeedOptions = {}): Promise<boolean> {
  if ((await contactsCount(db)) > 0) return false;
  await seedContacts(db, opts);
  return true;
}

function parseArgs(argv: string[]) {
  const out = { count: DEFAULT_COUNT, seed: DEFAULT_SEED, reset: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--count') out.count = Number(argv[++i]);
    else if (a === '--seed') out.seed = Number(argv[++i]);
    else if (a === '--reset') out.reset = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!Number.isInteger(out.count) || out.count < 1)
    throw new Error('--count must be a positive integer');
  if (!Number.isInteger(out.seed)) throw new Error('--seed must be an integer');
  return out;
}

// CLI entry: `npm run seed -- --count 1000000 --reset`
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  const db = createDb(cfg.databaseUrl, { ssl: cfg.ssl });
  try {
    await runMigrations(db);
    const existing = await contactsCount(db);
    if (existing > 0 && !args.reset) {
      console.error(
        `contacts already has ${existing} rows. Re-run with --reset to wipe and reseed.`,
      );
      process.exitCode = 1;
    } else {
      if (args.reset)
        await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
      const t0 = Date.now();
      console.log(`Seeding ${args.count} contacts (seed ${args.seed})...`);
      await seedContacts(db, { count: args.count, seed: args.seed, log: console.log });
      console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  } finally {
    await db.destroy();
  }
}
