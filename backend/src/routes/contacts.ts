import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { searchContacts, listQuerySchema } from '../contacts/list.js';
import { getContact } from '../contacts/queries.js';
import { updateBodySchema, updateContact } from '../contacts/update.js';
import type { Database } from '../db/index.js';
import { notFound, parseBody, parseRequest } from '../errors.js';

const idParams = z.object({ id: z.uuid() });

export function contactRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get('/contacts', async (req) => searchContacts(db, parseRequest(listQuerySchema, req.query)));

  app.get('/contacts/:id', async (req) => {
    const { id } = parseRequest(idParams, req.params);
    const contact = await getContact(db, id);
    if (!contact) throw notFound('Contact');
    return contact;
  });

  app.patch('/contacts/:id', async (req) => {
    const { id } = parseRequest(idParams, req.params);
    const body = parseBody(updateBodySchema, req.body);
    return updateContact(db, id, body);
  });
}
