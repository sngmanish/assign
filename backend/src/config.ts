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
  /** Seed 20,000 demo contacts on start when the contacts table is empty. */
  seedOnStart: boolean;
  /** PEM of the database's CA. When set, the TLS certificate is verified. */
  databaseCaCert: string | undefined;
  /** Server-side cap on one request's query, in ms. */
  statementTimeoutMs: number;
  /** Requests per minute per client, and the tighter cap for bulk assign. */
  rateLimit: { max: number; bulkMax: number };
  /**
   * How many proxies sit in front of the API (0 = none, the default). Used to work out the
   * real client address from X-Forwarded-For for the rate limiter. Never "trust everything":
   * that lets a client choose its own address by writing the header.
   */
  trustProxyHops: number;
  /** Serve Swagger UI at /docs and the OpenAPI document at /docs/json. */
  enableDocs: boolean;
}

function parsePositiveInt(name: string, value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} must be a positive integer`);
  return n;
}

function parseTrustProxyHops(env: NodeJS.ProcessEnv): number {
  if (env.TRUST_PROXY !== undefined && env.TRUST_PROXY !== '') {
    // The old boolean setting trusted every X-Forwarded-For hop, which lets any client
    // pick its own address and bypass the rate limit. Fail loudly rather than ignore it.
    throw new Error(
      'TRUST_PROXY is no longer supported; set TRUST_PROXY_HOPS to the number of proxies in front of the API (1 on Railway)',
    );
  }
  const hops = env.TRUST_PROXY_HOPS;
  if (hops === undefined || hops === '') return 0;
  const n = Number(hops);
  if (!Number.isInteger(n) || n < 0 || n > 5) {
    throw new Error('TRUST_PROXY_HOPS must be a whole number from 0 to 5');
  }
  return n;
}

function parseBool(name: string, value: string | undefined): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false", got "${value}"`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const databaseUrl = env.DATABASE_URL ?? (production ? undefined : LOCAL_DB);
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  // Without it every browser request from the frontend is blocked, so fail loudly at start
  // instead of deploying an API that looks healthy but cannot be used.
  if (production && !env.CORS_ORIGIN?.trim()) {
    throw new Error('CORS_ORIGIN is required when NODE_ENV=production (the frontend origin)');
  }
  return {
    databaseUrl,
    port: Number(env.PORT ?? 3000),
    corsOrigin: env.CORS_ORIGIN,
    // SSL when deployed, off for local Docker Postgres. DATABASE_SSL=true|false overrides
    // that, so a host that doesn't set NODE_ENV (or a local SSL database) still works.
    ssl: parseBool('DATABASE_SSL', env.DATABASE_SSL) ?? production,
    seedOnStart: parseBool('SEED_ON_START', env.SEED_ON_START) ?? true,
    // Dashboards often store a multi-line PEM with literal \n; accept both.
    databaseCaCert: env.DATABASE_CA_CERT?.replace(/\\n/g, '\n') || undefined,
    rateLimit: {
      max: parsePositiveInt('RATE_LIMIT_MAX', env.RATE_LIMIT_MAX) ?? 300,
      bulkMax: parsePositiveInt('RATE_LIMIT_BULK_MAX', env.RATE_LIMIT_BULK_MAX) ?? 20,
    },
    trustProxyHops: parseTrustProxyHops(env),
    enableDocs: parseBool('ENABLE_DOCS', env.ENABLE_DOCS) ?? true,
    statementTimeoutMs:
      parsePositiveInt('STATEMENT_TIMEOUT_MS', env.STATEMENT_TIMEOUT_MS) ?? 10_000,
  };
}
