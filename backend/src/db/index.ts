import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

// Table types are added as migrations land (Task 4).
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Database {}

export function createDb(connectionString: string, opts: { ssl?: boolean } = {}): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    ssl: opts.ssl ? { rejectUnauthorized: false } : undefined,
  });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}
