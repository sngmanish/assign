import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { activitiesQuerySchema, listActivities } from '../contacts/activities.js';
import { searchContacts, listQuerySchema } from '../contacts/list.js';
import { getContact } from '../contacts/queries.js';
import { updateBodySchema, updateContact } from '../contacts/update.js';
import type { Database } from '../db/index.js';
import {
  actorHeader,
  activitiesResponseSchema,
  contactSchema,
  errors,
  listResponseSchema,
} from '../docs.js';
import { notFound, parseBody, parseRequest } from '../errors.js';
import { uuidSchema } from '../ids.js';

const idParams = z.object({ id: uuidSchema });

export function contactRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get(
    '/contacts',
    {
      schema: {
        tags: ['Contacts'],
        summary: 'Search, filter, sort and page contacts',
        description:
          'Search terms are ANDed; each may match name, email or phone (case-insensitive substring). ' +
          'Page with `cursor` (stable, works at any depth) or `page` (exact, only while there are at most 10,000 matches). ' +
          'Above 10,000 matches `total` is "10000+", `capped` is true and `page` is rejected with 400 PAGE_NOT_ALLOWED.',
        querystring: listQuerySchema,
        response: { 200: listResponseSchema, ...errors(400, 503) },
      },
    },
    async (req) => searchContacts(db, parseRequest(listQuerySchema, req.query)),
  );

  app.get(
    '/contacts/:id',
    {
      schema: {
        tags: ['Contacts'],
        summary: 'Get one contact with its tags and version',
        params: idParams,
        response: { 200: contactSchema, ...errors(400, 404, 503) },
      },
    },
    async (req) => {
      const { id } = parseRequest(idParams, req.params);
      const contact = await getContact(db, id);
      if (!contact) throw notFound('Contact');
      return contact;
    },
  );

  app.patch(
    '/contacts/:id',
    {
      schema: {
        tags: ['Contacts'],
        summary: 'Update a contact (optimistic locking)',
        description:
          'Send the `version` you loaded. If someone else saved first the answer is 409 VERSION_CONFLICT ' +
          'with `details.latest` (the current contact). An email another contact uses is 409 EMAIL_TAKEN. ' +
          'Only fields that really change are written; if none do, the contact is returned unchanged ' +
          'with no version bump and no activity.',
        params: idParams,
        headers: actorHeader,
        body: updateBodySchema,
        response: { 200: contactSchema, ...errors(400, 404, 409, 422, 503) },
      },
    },
    async (req) => {
      const { id } = parseRequest(idParams, req.params);
      const body = parseBody(updateBodySchema, req.body);
      return updateContact(db, id, body, req.actor);
    },
  );

  app.get(
    '/contacts/:id/activities',
    {
      schema: {
        tags: ['Activity'],
        summary: 'Recent activity for a contact, newest first',
        params: idParams,
        querystring: activitiesQuerySchema,
        response: { 200: activitiesResponseSchema, ...errors(400, 404, 503) },
      },
    },
    async (req) => {
      const { id } = parseRequest(idParams, req.params);
      const { limit } = parseRequest(activitiesQuerySchema, req.query);
      return { items: await listActivities(db, id, limit) };
    },
  );
}
