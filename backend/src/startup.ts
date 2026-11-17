import { sql, type Kysely } from 'kysely';
import type { Database } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedIfEmpty, type SeedOptions } from './db/seed.js';

// Arbitrary constant naming "migrate and seed" for pg_advisory_lock.
export const STARTUP_LOCK = 7_246_101;

export interface StartupOptions {
  /** Seed demo data when the contacts table is empty (default true). */
  seed?: boolean;
  seedOptions?: SeedOptions;
  /** How long to wait for another instance's startup to finish (default 60 s). */
  lockTimeoutMs?: number;
}

export interface StartupResult {
  migrations: string[];
  seeded: boolean;
}

/**
 * What the server does before it listens: apply pending migrations, then seed the demo
 * contacts if (and only if) the table is empty. A restart therefore never adds to or
 * overwrites existing data. The whole thing runs under a Postgres advisory lock, so two
 * instances starting together (a rolling deploy) cannot both see an empty table and seed
 * twice; the second waits, then finds the data and skips. The lock is released when the
 * connection closes, even if the process dies.
 */
export async function prepareDatabase(
  db: Kysely<Database>,
  { seed = true, seedOptions, lockTimeoutMs = 60_000 }: StartupOptions = {},
): Promise<StartupResult> {
  return db.connection().execute(async (conn) => {
    // If another instance holds the lock for too long (hung migration), fail with 55P03
    // instead of waiting forever with nothing in the logs.
    await sql.raw(`SET lock_timeout = ${Math.trunc(lockTimeoutMs)}`).execute(conn);
    await sql`SELECT pg_advisory_lock(${STARTUP_LOCK})`.execute(conn);
    await sql`SET lock_timeout = 0`.execute(conn);
    try {
      const migrations = await runMigrations(db);
      const seeded = seed ? await seedIfEmpty(db, seedOptions) : false;
      return { migrations, seeded };
    } finally {
      await sql`SELECT pg_advisory_unlock(${STARTUP_LOCK})`.execute(conn);
    }
  });
}
