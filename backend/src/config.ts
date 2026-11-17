import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the repo-root .env for local development (hosted envs inject real variables).
const rootEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(rootEnv)) loadDotenv({ path: rootEnv, quiet: true });

const LOCAL_DB = 'postgres://postgres:postgres@localhost:5432/crm';

export interface Config {
  databaseUrl: string;
  port: number;
  corsOrigin: string | undefined;
  ssl: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const databaseUrl = env.DATABASE_URL ?? (production ? undefined : LOCAL_DB);
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  return {
    databaseUrl,
    port: Number(env.PORT ?? 3000),
    corsOrigin: env.CORS_ORIGIN,
    // Connect with SSL when deployed (spec Task 13); off for local Docker Postgres.
    ssl: production,
  };
}
