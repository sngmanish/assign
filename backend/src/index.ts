import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { prepareDatabase } from './startup.js';

const cfg = loadConfig();
const tls = { ssl: cfg.ssl, caCert: cfg.databaseCaCert };

// Migrations and the first seed can legitimately take a while, so they use their own pool
// with no statement timeout, closed before the server starts taking requests.
const startupDb = createDb(cfg.databaseUrl, tls);

// Requests use a pool that fails fast instead of hanging: a free connection must turn up
// within 5 s (otherwise /health answers 503 rather than timing out), and no single query
// may run longer than the statement timeout.
const db = createDb(cfg.databaseUrl, {
  ...tls,
  connectionTimeoutMs: 5_000,
  idleTimeoutMs: 30_000,
  statementTimeoutMs: cfg.statementTimeoutMs,
});

const app = await buildApp({
  db,
  corsOrigin: cfg.corsOrigin,
  logger: true,
  rateLimit: cfg.rateLimit,
  trustProxyHops: cfg.trustProxyHops,
  docs: cfg.enableDocs,
});

if (cfg.ssl && !cfg.databaseCaCert) {
  app.log.warn(
    'database TLS is on but the certificate is not verified; set DATABASE_CA_CERT to verify it',
  );
}

try {
  const { migrations, seeded } = await prepareDatabase(startupDb, {
    seed: cfg.seedOnStart,
    seedOptions: { log: (msg) => app.log.info(msg) },
  });
  app.log.info({ migrations, seeded }, 'startup: migrations applied, seed checked');
} finally {
  await startupDb.destroy();
}

const shutdown = async () => {
  await app.close();
  await db.destroy();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: cfg.port, host: '0.0.0.0' });
