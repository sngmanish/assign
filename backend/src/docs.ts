import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ActivityDto } from './contacts/activities.js';
import type { ListResponse } from './contacts/list.js';
import type { ContactDto, TagDto } from './contacts/queries.js';
import type { ErrorBody } from './errors.js';
import type { BulkAssignResult } from './tags/bulk.js';

/**
 * API documentation (OpenAPI 3.1, served as Swagger UI at /docs and JSON at /docs/json).
 *
 * The schemas attached to routes are for documentation ONLY. Requests are still parsed
 * and validated by the handlers (parseRequest / parseBody) so the 400 vs 422 error shapes
 * are unchanged: Fastify's own validation and response serialization are switched off in
 * registerDocs. Request docs reuse the real Zod schemas; response docs are written here
 * and type-checked against the DTO interfaces, so a changed DTO fails the build until the
 * docs follow. tests/docs.test.ts also checks real responses against them.
 */

const tag: z.ZodType<TagDto> = z.object({ id: z.uuid(), name: z.string() });

export const contactSchema: z.ZodType<ContactDto> = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  version: z.number().int().describe('Send this back on PATCH. It changes on every edit.'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  tags: z.array(tag),
});

export const listResponseSchema: z.ZodType<ListResponse> = z.object({
  items: z.array(contactSchema),
  nextCursor: z
    .string()
    .nullable()
    .describe('Pass as `cursor` for the next page. Null on the last page.'),
  prevCursor: z
    .string()
    .nullable()
    .describe('Pass as `cursor` for the previous page. Null on the first page.'),
  total: z
    .union([z.number().int(), z.literal('10000+')])
    .describe('Exact up to 10,000 matches, otherwise the string "10000+".'),
  totalPages: z.number().int().nullable().describe('Null when the count is capped.'),
  capped: z.boolean().describe('True when there are more than 10,000 matches.'),
  page: z.number().int().nullable().describe('Current page number when `page` was requested.'),
});

export const activitySchema: z.ZodType<ActivityDto> = z.object({
  id: z.uuid(),
  contactId: z.uuid(),
  type: z.enum(['CONTACT_UPDATED', 'TAG_ADDED', 'TAG_REMOVED']),
  createdAt: z.iso.datetime(),
  actor: z
    .string()
    .nullable()
    .describe(
      'Demo "acting as" name from the X-Actor header. Null for events recorded before it existed.',
    ),
  details: z
    .record(z.string(), z.unknown())
    .describe(
      'CONTACT_UPDATED: { changes: { field: { old, new } } }. TAG_ADDED / TAG_REMOVED: { tagId, tagName }.',
    ),
});
export const activitiesResponseSchema = z.object({ items: z.array(activitySchema) });

export const tagsResponseSchema = z.object({
  items: z.array(tag),
  hasMore: z.boolean().describe('True when there are more tags than `limit`.'),
});

export const bulkResultSchema: z.ZodType<BulkAssignResult> = z.object({
  added: z.number().int().describe('Contacts that received the tag now.'),
  alreadyTagged: z
    .number()
    .int()
    .describe('Contacts that already had it (no change, no activity).'),
  notFound: z.number().int().describe('Ids that match no contact.'),
});

export const errorSchema: z.ZodType<ErrorBody> = z.object({
  error: z.object({
    code: z
      .string()
      .describe(
        'BAD_REQUEST, VALIDATION_ERROR, NOT_FOUND, VERSION_CONFLICT, EMAIL_TAKEN, TEMPORARILY_UNAVAILABLE, QUERY_TIMEOUT or INTERNAL_ERROR',
      ),
    message: z.string(),
    details: z
      .unknown()
      .describe(
        'Field errors [{ path, message }] for 400/422. VERSION_CONFLICT: { latest: Contact }. EMAIL_TAKEN: { field: "email" }. 500 and 503: { requestId } for matching server logs. Otherwise null.',
      ),
  }),
});

export const healthSchema = z.object({
  status: z.enum(['ok', 'error']),
  db: z.enum(['up', 'down']),
});

/** Zod schemas for the error statuses a route can return. */
export const errors = (...statuses: (400 | 404 | 409 | 422 | 429 | 503)[]) =>
  Object.fromEntries(statuses.map((s) => [s, errorSchema]));

/** Optional header shared by every write route. */
export const actorHeader = z.object({
  'x-actor': z
    .string()
    .optional()
    .describe(
      'Demo "acting as" name (1 to 50 characters, trimmed), recorded on activity entries. Not authentication. Missing or invalid becomes "Anonymous".',
    ),
});

/** Turn the Zod schemas on a route into JSON Schema for the OpenAPI document. */
const toJson = (schema: unknown, io: 'input' | 'output') => {
  if (!(schema instanceof z.ZodType)) return schema;
  const json = z.toJSONSchema(schema, {
    target: 'draft-7',
    io,
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  delete json.$schema;
  return stripFormatPatterns(json);
};

/** Zod adds a long regex next to `format: uuid | date | date-time`; the format says enough. */
function stripFormatPatterns(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripFormatPatterns);
  if (node === null || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  const dropPattern = typeof obj.format === 'string';
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !(dropPattern && k === 'pattern'))
      .map(([k, v]) => [k, stripFormatPatterns(v)]),
  );
}

export async function registerDocs(
  app: FastifyInstance,
  { serve = true }: { serve?: boolean } = {},
): Promise<void> {
  // Documentation only: keep validation and serialization in the handlers.
  app.setValidatorCompiler(() => (data) => ({ value: data }));
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));

  // The route schemas stay attached either way; only the /docs endpoints are optional.
  if (!serve) return;

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'CRM Contact Workspace API',
        version: '1.0.0',
        description:
          'No authentication: every endpoint is public. Errors always look like `{ error: { code, message, details } }`.',
      },
      tags: [{ name: 'System' }, { name: 'Contacts' }, { name: 'Tags' }, { name: 'Activity' }],
    },
    transform: ({ schema, url }) => {
      if (!schema) return { schema, url };
      const s = { ...schema } as Record<string, unknown>;
      for (const part of ['params', 'querystring', 'headers'] as const) {
        if (s[part]) s[part] = toJson(s[part], 'input');
      }
      if (s.body) s.body = toJson(s.body, 'input');
      if (s.response) {
        s.response = Object.fromEntries(
          Object.entries(s.response as Record<string, unknown>).map(([code, r]) => [
            code,
            toJson(r, 'output'),
          ]),
        );
      }
      return { schema: s as typeof schema, url };
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
}
