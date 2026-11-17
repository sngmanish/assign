import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { registerActor } from './actor.js';
import { healthSchema, registerDocs } from './docs.js';
import type { Database } from './db/index.js';
import { registerErrorHandling } from './errors.js';
import { contactRoutes } from './routes/contacts.js';
import { tagRoutes } from './routes/tags.js';

/** "https://a.app, https://b.app" -> two origins. Spaces and empty entries are ignored. */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export interface AppOptions {
  db: Kysely<Database>;
  corsOrigin?: string;
  /** true for the default logger, or a stream to capture log lines. */
  logger?: boolean | { stream: NodeJS.WritableStream };
  /** Requests per minute per client. Off when omitted. `bulkMax` is the tighter cap for bulk assign. */
  rateLimit?: { max: number; bulkMax: number };
  /**
   * Number of proxies in front of the API. The client address is the one the nearest proxy
   * appended to X-Forwarded-For, so anything a client writes in front of it is ignored.
   * (Fastify ignores a bare number and `true` trusts a client-written address, so this is
   * expressed as a function.)
   */
  trustProxyHops?: number;
  /** Serve /docs and /docs/json (default true). */
  docs?: boolean;
}

export async function buildApp({
  db,
  corsOrigin,
  logger = false,
  rateLimit: limits,
  trustProxyHops = 0,
  docs = true,
}: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    trustProxy: trustProxyHops > 0 ? (_addr: string, hop: number) => hop < trustProxyHops : false,
  });
  registerErrorHandling(app);
  registerActor(app);
  await registerDocs(app, { serve: docs }); // before the routes, so it sees them all

  if (trustProxyHops > 0) {
    // Once, on the first request that carries X-Forwarded-For (a health probe does not, and
    // would tell us nothing): so the hop count can be checked after deploying. `ip` must be
    // the visitor's address; if it is the proxy's, the count is too low, and if it is whatever
    // the visitor wrote, it is too high.
    let logged = false;
    app.addHook('onRequest', async (req) => {
      if (logged || !req.headers['x-forwarded-for']) return;
      logged = true;
      req.log.info(
        { ip: req.ip, xForwardedFor: req.headers['x-forwarded-for'], hops: trustProxyHops },
        'client address resolved from X-Forwarded-For',
      );
    });
  }

  // Everything is public (no auth), so this is the only brake on a script hammering the API
  // or creating tags in a loop. In memory, so it is per instance. Probes and docs are exempt.
  if (limits) {
    await app.register(rateLimit, {
      max: limits.max,
      timeWindow: '1 minute',
      // Match the route, not the raw URL, so /health?x=1 (a cache-buster) is exempt too.
      allowList: (req) => {
        const route = req.routeOptions.url ?? '';
        return route === '/health' || route.startsWith('/docs');
      },
    });
  }

  const origins = parseOrigins(corsOrigin);
  if (origins.length > 0)
    await app.register(cors, {
      origin: origins,
      // @fastify/cors allows only GET, HEAD and POST by default; the frontend also sends
      // PATCH (edit a contact) and DELETE (remove a tag), and browsers preflight both.
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'],
      // X-Actor is a custom header, so it is preflighted too and must be allowed.
      allowedHeaders: ['Content-Type', 'X-Actor'],
      maxAge: 600,
    });

  // Health: 200 only if Postgres answers.
  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        description: '200 when Postgres answers, 503 otherwise.',
        response: { 200: healthSchema, 503: healthSchema },
      },
    },
    async (_req, reply) => {
      try {
        await sql`select 1`.execute(db);
        return { status: 'ok', db: 'up' };
      } catch {
        return reply.code(503).send({ status: 'error', db: 'down' });
      }
    },
  );

  contactRoutes(app, db);
  tagRoutes(app, db, limits);

  return app;
}
