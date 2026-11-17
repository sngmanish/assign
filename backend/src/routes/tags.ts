import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/index.js';
import { parseBody, parseRequest } from '../errors.js';
import {
  addTagBodySchema,
  addTagToContact,
  assertUuid,
  listTags,
  removeTagFromContact,
} from '../tags/service.js';

const contactParams = z.object({ id: z.uuid() });
// tagId is checked by hand so a malformed one is a 400 whichever route it comes from.
const contactTagParams = z.object({ id: z.uuid(), tagId: z.string() });

export function tagRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get('/tags', async () => ({ items: await listTags(db) }));

  app.post('/contacts/:id/tags', async (req) => {
    const { id } = parseRequest(contactParams, req.params);
    const body = parseBody(addTagBodySchema, req.body);
    return addTagToContact(db, id, body);
  });

  app.delete('/contacts/:id/tags/:tagId', async (req) => {
    const { id, tagId } = parseRequest(contactTagParams, req.params);
    assertUuid(tagId, 'tagId');
    return removeTagFromContact(db, id, tagId);
  });
}
