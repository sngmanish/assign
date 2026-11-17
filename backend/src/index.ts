import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';

const cfg = loadConfig();
const db = createDb(cfg.databaseUrl, { ssl: cfg.ssl });

await runMigrations(db);
const app = await buildApp({ db, corsOrigin: cfg.corsOrigin, logger: true });

const shutdown = async () => {
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: cfg.port, host: '0.0.0.0' });
