import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { Database } from '../db/index.js';
import {
  actorHeader,
  bulkResultSchema,
  contactSchema,
  errors,
  tagsResponseSchema,
} from '../docs.js';
import { parseBody, parseRequest } from '../errors.js';
import { uuidSchema } from '../ids.js';
import { bulkAssignTag } from '../tags/bulk.js';
import {
  addTagBodySchema,
  bulkAssignBodySchema,
  addTagToContact,
  listTags,
  tagsQuerySchema,
  removeTagFromContact,
} from '../tags/service.js';

const contactParams = z.object({ id: uuidSchema });
const contactTagParams = z.object({ id: uuidSchema, tagId: uuidSchema });

export function tagRoutes(
  app: FastifyInstance,
  db: Kysely<Database>,
  limits?: { bulkMax: number },
): void {
  app.get(
    '/tags',
    {
      schema: {
        tags: ['Tags'],
        summary: 'Tags sorted by name (at most `limit`, default 500)',
        querystring: tagsQuerySchema,
        response: { 200: tagsResponseSchema, ...errors(400) },
      },
    },
    async (req) => listTags(db, parseRequest(tagsQuerySchema, req.query).limit),
  );

  app.post(
    '/contacts/:id/tags',
    {
      schema: {
        tags: ['Tags'],
        summary: 'Add a tag to a contact',
        description:
          'Give exactly one of `tagId` (existing tag) or `name` (found case-insensitively, or created). ' +
          'Adding a tag the contact already has is a quiet no-op. A real change never bumps `version`.',
        params: contactParams,
        headers: actorHeader,
        body: addTagBodySchema,
        response: { 200: contactSchema, ...errors(400, 404, 422, 503) },
      },
    },
    async (req) => {
      const { id } = parseRequest(contactParams, req.params);
      const body = parseBody(addTagBodySchema, req.body);
      return addTagToContact(db, id, body, req.actor);
    },
  );

  app.delete(
    '/contacts/:id/tags/:tagId',
    {
      schema: {
        tags: ['Tags'],
        summary: 'Remove a tag from a contact',
        description: '404 if the contact does not have the tag. Never bumps `version`.',
        params: contactTagParams,
        headers: actorHeader,
        response: { 200: contactSchema, ...errors(400, 404, 503) },
      },
    },
    async (req) => {
      const { id, tagId } = parseRequest(contactTagParams, req.params);
      return removeTagFromContact(db, id, tagId, req.actor);
    },
  );

  app.post(
    '/tags/bulk-assign',
    {
      schema: {
        tags: ['Tags'],
        summary: 'Apply one tag to up to 1,000 contacts',
        description:
          'One transaction, safe to repeat. Contacts that already have the tag are counted in ' +
          '`alreadyTagged` and get no activity; unknown ids are counted in `notFound`. ' +
          'Each newly tagged contact gets a TAG_ADDED activity.',
        headers: actorHeader,
        body: bulkAssignBodySchema,
        response: { 200: bulkResultSchema, ...errors(400, 404, 422, 429, 503) },
      },
      // Each call can write 1,000 rows, so it gets a tighter limit than other endpoints.
      ...(limits && { config: { rateLimit: { max: limits.bulkMax, timeWindow: '1 minute' } } }),
    },
    async (req) => {
      const { contactIds, ...ref } = parseBody(bulkAssignBodySchema, req.body);
      return bulkAssignTag(db, contactIds, ref, req.actor);
    },
  );
}
