// Starts the backend for the Playwright tests (playwright.config.ts runs this as a webServer):
// recreates the `crm_e2e` database, then runs the API on E2E_API_PORT. The API migrates and seeds
// the same 20,000 demo contacts on start (fixed random seed), so every run starts from the same data.
//
// The database server is the one in the repo-root .env (the docker-compose Postgres), unless
// E2E_DATABASE_URL names another database.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const backendDir = resolve(repoRoot, 'backend');
const port = process.env.E2E_API_PORT ?? '3100';
const webOrigin = process.env.E2E_WEB_ORIGIN ?? 'http://localhost:5174';

function rootEnv(name) {
  const file = resolve(repoRoot, '.env');
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line?.slice(name.length + 1).trim();
}

function e2eDatabaseUrl() {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const url = new URL(rootEnv('DATABASE_URL') ?? 'postgres://postgres:postgres@localhost:5432/crm');
  url.pathname = '/crm_e2e';
  return url.toString();
}

// `pg` comes from the backend's dependencies, so the frontend doesn't need its own copy
const pg = createRequire(resolve(backendDir, 'package.json'))('pg');

async function recreateDatabase(url) {
  const target = new URL(url);
  const name = target.pathname.slice(1);
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected e2e database name: ${name}`);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${name}`);
  } finally {
    await client.end();
  }
}

const databaseUrl = e2eDatabaseUrl();
await recreateDatabase(databaseUrl);

const api = spawn('npx', ['tsx', 'src/index.ts'], {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    PORT: port,
    CORS_ORIGIN: webOrigin,
    SEED_ON_START: 'true',
    // every test comes from one address: don't let the limiter get in the way
    RATE_LIMIT_MAX: '100000',
    RATE_LIMIT_BULK_MAX: '100000',
    ENABLE_DOCS: 'false',
  },
});

const stop = () => api.kill('SIGTERM');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', (code) => process.exit(code ?? 0));
