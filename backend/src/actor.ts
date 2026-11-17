import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

/**
 * "Acting as" demo label. There is no auth, so each browser tab sends a display name in
 * `X-Actor` and activity rows record it. It is NOT authentication and is never used for
 * permissions. A missing or invalid header (blank, over 50 chars, or containing a comma,
 * which is what a repeated header looks like) is not an error: the request is treated as coming from "Anonymous".
 */
export const ANONYMOUS = 'Anonymous';

// Node joins a repeated header into one string ("Alice, Bob"), so a comma means the header
// was sent more than once (or is ambiguous). Reject it rather than record a made-up name.
const actorSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .refine((v) => !v.includes(','));

export function parseActor(header: unknown): string {
  const parsed = actorSchema.safeParse(header);
  return parsed.success ? parsed.data : ANONYMOUS;
}

declare module 'fastify' {
  interface FastifyRequest {
    actor: string;
  }
}

/** The one place the header is read. Handlers use `req.actor`. */
export function registerActor(app: FastifyInstance): void {
  app.decorateRequest('actor', ANONYMOUS);
  app.addHook('onRequest', async (req) => {
    req.actor = parseActor(req.headers['x-actor']);
  });
}
