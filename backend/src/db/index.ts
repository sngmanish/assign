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
  details: JSONColumnType<Record<string, unknown>, Record<string, unknown> | undefined>;
}

export interface Database {
  contacts: ContactsTable;
  tags: TagsTable;
  contact_tags: ContactTagsTable;
  contact_activities: ContactActivitiesTable;
}

export function createDb(
  connectionString: string,
  opts: { ssl?: boolean; log?: (event: LogEvent) => void } = {},
): Kysely<Database> {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    ssl: opts.ssl ? { rejectUnauthorized: false } : undefined,
  });
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
    ...(opts.log && { log: opts.log }),
  });
}
