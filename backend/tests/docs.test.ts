import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { sql, type Kysely } from 'kysely';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Database } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import {
  activitiesResponseSchema,
  bulkResultSchema,
  contactSchema,
  errorSchema,
  healthSchema,
  listResponseSchema,
  tagsResponseSchema,
} from '../src/docs.js';
import type { ZodType } from 'zod';

type Op = { summary?: string; tags?: string[]; responses?: Record<string, unknown> };
type BodySchema = {
  required: string[];
  additionalProperties: boolean;
  properties: Record<string, unknown>;
};
type JsonSchema = {
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
};

/** Every key in a real response is documented, and every documented key is present. */
function expectSameKeys(value: unknown, schema: JsonSchema, at: string): void {
  if (Array.isArray(value)) {
    if (schema.items) value.forEach((v, i) => expectSameKeys(v, schema.items!, `${at}[${i}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (!schema.properties) return; // free-form object (activity details, error details)
  expect(Object.keys(value).sort(), `keys at ${at}`).toEqual(Object.keys(schema.properties).sort());
  for (const [k, v] of Object.entries(value)) {
    if (schema.properties[k]) expectSameKeys(v, schema.properties[k], `${at}.${k}`);
  }
}
type Spec = { openapi: string; paths: Record<string, Record<string, Op>> };

describe('API docs (OpenAPI / Swagger UI)', () => {
  let db: Kysely<Database>;
  let app: FastifyInstance;
  let spec: Spec;
  let contactId: string;
  let otherId: string;
  let tagId: string;
  const MISSING = '00000000-0000-4000-8000-000000000000';

  beforeAll(async () => {
    loadConfig();
    db = createDb(
      process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test',
    );
    await runMigrations(db);
    app = await buildApp({ db });
    spec = (await app.inject('/docs/json')).json();
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });
  beforeEach(async () => {
    await sql`TRUNCATE contacts, tags, contact_tags, contact_activities CASCADE`.execute(db);
    const rows = await db
      .insertInto('contacts')
      .values([
        { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@x.com' },
        { first_name: 'Grace', last_name: 'Hopper', email: 'grace@x.com' },
      ])
      .returning(['id', 'first_name'])
      .execute();
    contactId = rows.find((r) => r.first_name === 'Ada')!.id;
    otherId = rows.find((r) => r.first_name === 'Grace')!.id;
    tagId = (
      await db.insertInto('tags').values({ name: 'vip' }).returning('id').executeTakeFirstOrThrow()
    ).id;
    // Fixture so responses are fully populated: a tagged contact, and every activity type.
    await db.insertInto('contact_tags').values({ contact_id: otherId, tag_id: tagId }).execute();
    await db
      .insertInto('contact_activities')
      .values(
        (['CONTACT_UPDATED', 'TAG_ADDED', 'TAG_REMOVED'] as const).map((type) => ({
          contact_id: contactId,
          type,
          actor: 'Alice',
          details: {},
        })),
      )
      .execute();
  });

  it('serves the OpenAPI document and Swagger UI', async () => {
    expect(spec.openapi).toBe('3.1.0');
    const ui = await app.inject('/docs/');
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
  });

  it('documents exactly the endpoints the API has, each with a summary, tag and responses', () => {
    const ops = Object.entries(spec.paths)
      .flatMap(([path, methods]) => Object.keys(methods).map((m) => `${m.toUpperCase()} ${path}`))
      .sort();
    expect(ops).toEqual(
      [
        'GET /health',
        'GET /contacts',
        'GET /contacts/{id}',
        'PATCH /contacts/{id}',
        'GET /contacts/{id}/activities',
        'GET /tags',
        'POST /contacts/{id}/tags',
        'DELETE /contacts/{id}/tags/{tagId}',
        'POST /tags/bulk-assign',
      ].sort(),
    );
    for (const methods of Object.values(spec.paths)) {
      for (const op of Object.values(methods)) {
        expect(op.summary).toBeTruthy();
        expect(op.tags?.length).toBeGreaterThan(0);
        expect(op.responses?.['200']).toBeTruthy();
      }
    }
  });

  it('documents the request shapes: PATCH body, list query, X-Actor header', () => {
    const patch = spec.paths['/contacts/{id}']!.patch as unknown as {
      requestBody: { content: { 'application/json': { schema: BodySchema } } };
      parameters: { name: string; in: string }[];
    };
    const body = patch.requestBody.content['application/json'].schema;
    expect(body.required).toEqual(['version']);
    expect(body.additionalProperties).toBe(false);
    expect(Object.keys(body.properties)).toEqual([
      'version',
      'firstName',
      'lastName',
      'email',
      'phone',
      'company',
    ]);
    expect(patch.parameters).toContainEqual(
      expect.objectContaining({ name: 'x-actor', in: 'header' }),
    );

    const list = spec.paths['/contacts']!.get as unknown as { parameters: { name: string }[] };
    expect(list.parameters.map((p) => p.name)).toEqual(
      expect.arrayContaining([
        'q',
        'tag',
        'company',
        'createdFrom',
        'createdTo',
        'sort',
        'order',
        'limit',
        'cursor',
        'page',
      ]),
    );
    // the long regexes Zod generates next to `format` are stripped
    expect(JSON.stringify(spec)).not.toContain('(?:');
  });

  // Real responses must match the documented schemas and the documented status codes.
  const calls: {
    name: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    template: string;
    url: () => string;
    payload?: () => object;
    status: number;
    schema: ZodType;
  }[] = [
    {
      name: 'health',
      method: 'GET',
      template: '/health',
      url: () => '/health',
      status: 200,
      schema: healthSchema,
    },
    {
      name: 'list',
      method: 'GET',
      template: '/contacts',
      url: () => '/contacts?sort=name&limit=5',
      status: 200,
      schema: listResponseSchema,
    },
    {
      name: 'get',
      method: 'GET',
      template: '/contacts/{id}',
      url: () => `/contacts/${contactId}`,
      status: 200,
      schema: contactSchema,
    },
    {
      name: 'patch',
      method: 'PATCH',
      template: '/contacts/{id}',
      url: () => `/contacts/${contactId}`,
      payload: () => ({ version: 1, company: 'Acme' }),
      status: 200,
      schema: contactSchema,
    },
    {
      name: 'activities',
      method: 'GET',
      template: '/contacts/{id}/activities',
      url: () => `/contacts/${contactId}/activities`,
      status: 200,
      schema: activitiesResponseSchema,
    },
    {
      name: 'tags',
      method: 'GET',
      template: '/tags',
      url: () => '/tags',
      status: 200,
      schema: tagsResponseSchema,
    },
    {
      name: 'add tag',
      method: 'POST',
      template: '/contacts/{id}/tags',
      url: () => `/contacts/${contactId}/tags`,
      payload: () => ({ tagId }),
      status: 200,
      schema: contactSchema,
    },
    {
      name: 'bulk assign',
      method: 'POST',
      template: '/tags/bulk-assign',
      url: () => '/tags/bulk-assign',
      payload: () => ({ contactIds: [contactId, otherId, MISSING], tagId }),
      status: 200,
      schema: bulkResultSchema,
    },
    {
      name: 'list: bad query',
      method: 'GET',
      template: '/contacts',
      url: () => '/contacts?limit=abc',
      status: 400,
      schema: errorSchema,
    },
    {
      name: 'get: malformed id',
      method: 'GET',
      template: '/contacts/{id}',
      url: () => '/contacts/not-a-uuid',
      status: 400,
      schema: errorSchema,
    },
    {
      name: 'get: missing',
      method: 'GET',
      template: '/contacts/{id}',
      url: () => `/contacts/${MISSING}`,
      status: 404,
      schema: errorSchema,
    },
    {
      name: 'patch: invalid body',
      method: 'PATCH',
      template: '/contacts/{id}',
      url: () => `/contacts/${contactId}`,
      payload: () => ({ version: 1, firstName: '' }),
      status: 422,
      schema: errorSchema,
    },
    {
      name: 'patch: stale version',
      method: 'PATCH',
      template: '/contacts/{id}',
      url: () => `/contacts/${contactId}`,
      payload: () => ({ version: 99, company: 'X' }),
      status: 409,
      schema: errorSchema,
    },
    {
      name: 'patch: email taken',
      method: 'PATCH',
      template: '/contacts/{id}',
      url: () => `/contacts/${contactId}`,
      payload: () => ({ version: 1, email: 'GRACE@x.com' }),
      status: 409,
      schema: errorSchema,
    },
    {
      name: 'activities: missing',
      method: 'GET',
      template: '/contacts/{id}/activities',
      url: () => `/contacts/${MISSING}/activities`,
      status: 404,
      schema: errorSchema,
    },
    {
      name: 'add tag: invalid body',
      method: 'POST',
      template: '/contacts/{id}/tags',
      url: () => `/contacts/${contactId}/tags`,
      payload: () => ({}),
      status: 422,
      schema: errorSchema,
    },
    {
      name: 'remove tag: not on contact',
      method: 'DELETE',
      template: '/contacts/{id}/tags/{tagId}',
      url: () => `/contacts/${contactId}/tags/${tagId}`,
      status: 404,
      schema: errorSchema,
    },
    {
      name: 'bulk: unknown tag',
      method: 'POST',
      template: '/tags/bulk-assign',
      url: () => '/tags/bulk-assign',
      payload: () => ({ contactIds: [contactId], tagId: MISSING }),
      status: 404,
      schema: errorSchema,
    },
    {
      name: 'bulk: empty ids',
      method: 'POST',
      template: '/tags/bulk-assign',
      url: () => '/tags/bulk-assign',
      payload: () => ({ contactIds: [], tagId }),
      status: 422,
      schema: errorSchema,
    },
  ];

  it.each(calls)('$name: real $status response matches the docs', async (c) => {
    const res = await app.inject({
      method: c.method,
      url: c.url(),
      ...(c.payload && { payload: c.payload() }),
    });
    expect(res.statusCode).toBe(c.status);
    const parsed = c.schema.safeParse(res.json());
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    // Zod ignores unknown keys, so also compare key-for-key with the generated spec.
    const operation = spec.paths[c.template]![c.method.toLowerCase()] as unknown as {
      responses: Record<string, { content?: { 'application/json': { schema: JsonSchema } } }>;
    };
    const docSchema = operation.responses[String(c.status)]?.content?.['application/json'].schema;
    expect(docSchema, 'response schema is in the spec').toBeTruthy();
    expectSameKeys(res.json(), docSchema!, c.name);
    const documented = spec.paths[c.template]![c.method.toLowerCase()]!.responses!;
    expect(
      Object.keys(documented),
      `${c.method} ${c.template} should document ${c.status}`,
    ).toContain(String(c.status));
  });

  it('turning the docs on did not change error shapes or statuses', async () => {
    // Fastify must not validate on its own: the handler's 400 / 422 split still applies.
    const badQuery = await app.inject('/contacts?limit=abc');
    expect(badQuery.json().error.code).toBe('BAD_REQUEST');
    const badBody = await app.inject({
      method: 'PATCH',
      url: `/contacts/${contactId}`,
      payload: { version: 1, firstName: '' },
    });
    expect(badBody.json().error.code).toBe('VALIDATION_ERROR');
  });
});
