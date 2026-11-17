import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import type { Database } from './db/index.js';
import { registerErrorHandling } from './errors.js';
import { contactRoutes } from './routes/contacts.js';
import { tagRoutes } from './routes/tags.js';

export interface AppOptions {
  db: Kysely<Database>;
  corsOrigin?: string;
  logger?: boolean;
}

export async function buildApp({
  db,
  corsOrigin,
  logger = false,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  registerErrorHandling(app);

  if (corsOrigin) await app.register(cors, { origin: corsOrigin.split(',') });

  // Health: 200 only if Postgres answers.
  app.get('/health', async (_req, reply) => {
    try {
      await sql`select 1`.execute(db);
      return { status: 'ok', db: 'up' };
    } catch {
      return reply.code(503).send({ status: 'error', db: 'down' });
    }
  });

  contactRoutes(app, db);
  tagRoutes(app, db);

  return app;
}
