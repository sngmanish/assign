import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { searchContacts, listQuerySchema } from '../contacts/list.js';
import { getContact } from '../contacts/queries.js';
import type { Database } from '../db/index.js';
import { notFound, parseRequest } from '../errors.js';

const idParams = z.object({ id: z.uuid() });

export function contactRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get('/contacts', async (req) => searchContacts(db, parseRequest(listQuerySchema, req.query)));

  app.get('/contacts/:id', async (req) => {
    const { id } = parseRequest(idParams, req.params);
    const contact = await getContact(db, id);
    if (!contact) throw notFound('Contact');
    return contact;
  });
}
