import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import { getContact, listContacts } from '../contacts/queries.js';
import type { Database } from '../db/index.js';
import { notFound, parseRequest } from '../errors.js';

const idParams = z.object({ id: z.uuid() });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function contactRoutes(app: FastifyInstance, db: Kysely<Database>): void {
  app.get('/contacts', async (req) => {
    const { limit } = parseRequest(listQuery, req.query);
    return { items: await listContacts(db, limit) };
  });

  app.get('/contacts/:id', async (req) => {
    const { id } = parseRequest(idParams, req.params);
    const contact = await getContact(db, id);
    if (!contact) throw notFound('Contact');
    return contact;
  });
}
