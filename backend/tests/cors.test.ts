import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, parseOrigins } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';

const A = 'https://a.app';
const B = 'https://b.app';
const ID = '00000000-0000-4000-8000-000000000000';

describe('CORS preflight', () => {
  let app: FastifyInstance;
  const db = createDb('postgres://postgres:postgres@localhost:5432/crm_test'); // never queried

  beforeAll(async () => {
    // Deliberately written with spaces, the way people type it into a dashboard.
    app = await buildApp({ db, corsOrigin: ` ${A} , ${B} ,` });
  });
  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  const preflight = (origin: string, method: string, url: string) =>
    app.inject({
      method: 'OPTIONS',
      url,
      headers: {
        origin,
        'access-control-request-method': method,
        'access-control-request-headers': 'content-type,x-actor',
      },
    });

  // Every method and path the frontend sends. PATCH and DELETE are not CORS-safelisted, so
  // a browser refuses them unless the preflight lists them in allow-methods.
  const requests = [
    ['GET', '/contacts'],
    ['GET', `/contacts/${ID}`],
    ['PATCH', `/contacts/${ID}`],
    ['POST', `/contacts/${ID}/tags`],
    ['DELETE', `/contacts/${ID}/tags/${ID}`],
    ['POST', '/tags/bulk-assign'],
  ] as const;

  it.each(requests.flatMap(([m, u]) => [A, B].map((o) => [o, m, u] as const)))(
    '%s may send %s %s',
    async (origin, method, url) => {
      const res = await preflight(origin, method, url);
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      const allowed = String(res.headers['access-control-allow-methods']).split(/\s*,\s*/);
      expect(allowed).toContain(method);
      expect(String(res.headers['access-control-allow-headers']).toLowerCase()).toContain(
        'x-actor',
      );
    },
  );

  it('caches the preflight answer', async () => {
    const res = await preflight(A, 'PATCH', `/contacts/${ID}`);
    expect(res.headers['access-control-max-age']).toBe('600');
  });

  it('does not allow other origins', async () => {
    const res = await preflight('https://evil.example', 'PATCH', `/contacts/${ID}`);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers the real request with the allow-origin header too', async () => {
    const res = await app.inject({ url: '/nope', headers: { origin: B } });
    expect(res.headers['access-control-allow-origin']).toBe(B);
  });

  it('parseOrigins trims and ignores empty entries', () => {
    expect(parseOrigins(' https://a.app , ,https://b.app,')).toEqual([A, B]);
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins('  ')).toEqual([]);
  });
});

describe('CORS_ORIGIN in production', () => {
  const prod = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y' };

  it('is required, so a deployment cannot silently block the frontend', () => {
    expect(() => loadConfig(prod)).toThrow(/CORS_ORIGIN/);
    expect(() => loadConfig({ ...prod, CORS_ORIGIN: '   ' })).toThrow(/CORS_ORIGIN/);
    expect(loadConfig({ ...prod, CORS_ORIGIN: 'https://a.app' }).corsOrigin).toBe('https://a.app');
  });

  it('stays optional outside production', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x/y' }).corsOrigin).toBeUndefined();
  });
});
