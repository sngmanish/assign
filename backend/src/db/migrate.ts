import type { Kysely } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.js';
import { createDb, type Database } from './index.js';

const migrationFolder = join(import.meta.dirname, 'migrations');

// Loads migrations from ./migrations, sorted by file name (e.g. 001_init.ts).
// Works for both .ts (tsx) and compiled .js (dist).
const provider: MigrationProvider = {
  async getMigrations() {
    const migrations: Record<string, Migration> = {};
    const files = await readdir(migrationFolder).catch((e) => {
      if (e.code === 'ENOENT') return [] as string[]; // no migrations yet
      throw e;
    });
    for (const file of files) {
      if (!/\.(ts|js)$/.test(file) || file.endsWith('.d.ts')) continue;
      const mod = await import(pathToFileURL(join(migrationFolder, file)).href);
      migrations[file.replace(/\.(ts|js)$/, '')] = mod;
    }
    return migrations;
  },
};

export async function runMigrations(db: Kysely<Database>): Promise<string[]> {
  const { error, results } = await new Migrator({ db, provider }).migrateToLatest();
  for (const r of results ?? []) {
    if (r.status === 'Error') console.error(`migration ${r.migrationName} failed`);
  }
  if (error) throw error;
  return (results ?? []).filter((r) => r.status === 'Success').map((r) => r.migrationName);
}

// CLI entry: `npm run migrate`
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const cfg = loadConfig();
  const db = createDb(cfg.databaseUrl, { ssl: cfg.ssl });
  try {
    const applied = await runMigrations(db);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'No pending migrations');
  } finally {
    await db.destroy();
  }
}
