import {
  Kysely,
  PostgresDialect,
  type ColumnType,
  type Generated,
  type JSONColumnType,
  type LogEvent,
} from 'kysely';
import pg from 'pg';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface ContactsTable {
  id: Generated<string>;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  version: Generated<number>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TagsTable {
  id: Generated<string>;
  name: string;
}

export interface ContactTagsTable {
  contact_id: string;
  tag_id: string;
}

export type ActivityType = 'CONTACT_UPDATED' | 'TAG_ADDED' | 'TAG_REMOVED';

export interface ContactActivitiesTable {
  id: Generated<string>;
  contact_id: string;
  type: ActivityType;
  created_at: Timestamp;
  actor: string | null;
  details: JSONColumnType<Record<string, unknown>, Record<string, unknown> | undefined>;
}

export interface Database {
  contacts: ContactsTable;
  tags: TagsTable;
  contact_tags: ContactTagsTable;
  contact_activities: ContactActivitiesTable;
}

export interface CreateDbOptions {
  /** Connect with TLS. */
  ssl?: boolean;
  /**
   * PEM of the CA that signed the database's certificate. With it the certificate is
   * verified; without it the connection is encrypted but the certificate is not checked.
   */
  caCert?: string;
  log?: (event: LogEvent) => void;
  /** Give up waiting for a free pool connection after this long (default: wait forever). */
  connectionTimeoutMs?: number;
  /** Close pool connections idle for this long. */
  idleTimeoutMs?: number;
  /** Server-side cap on one statement (Postgres cancels it with 57014). Default: none. */
  statementTimeoutMs?: number;
  /** Called when an idle connection dies (database restart, network drop). Default: log it. */
  onPoolError?: (err: Error) => void;
}

/** TLS settings for pg. Verification needs the CA; see CreateDbOptions.caCert. */
export function sslOptions(ssl: boolean | undefined, caCert?: string): pg.PoolConfig['ssl'] {
  if (!ssl) return undefined;
  return caCert ? { ca: caCert, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

const logPoolError = (err: Error) =>
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'database connection error on an idle client (it is dropped from the pool)',
      code: (err as { code?: string }).code,
      err: err.message,
    }),
  );

export function createDb(connectionString: string, opts: CreateDbOptions = {}): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    ssl: sslOptions(opts.ssl, opts.caCert),
    ...(opts.connectionTimeoutMs !== undefined && {
      connectionTimeoutMillis: opts.connectionTimeoutMs,
    }),
    ...(opts.idleTimeoutMs !== undefined && { idleTimeoutMillis: opts.idleTimeoutMs }),
    ...(opts.statementTimeoutMs !== undefined && {
      statement_timeout: opts.statementTimeoutMs,
      // client-side backstop in case the server never answers
      query_timeout: opts.statementTimeoutMs + 2_000,
    }),
  });
  // An idle client whose connection dies emits 'error' on the pool. With no listener Node
  // treats that as an uncaught exception and the whole API exits. The pool has already
  // removed the client; log it and keep serving.
  pool.on('error', opts.onPoolError ?? logPoolError);
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    ...(opts.log && { log: opts.log }),
  });
}
