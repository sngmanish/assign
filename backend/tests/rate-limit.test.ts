import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';

loadConfig(); // loads .env so TEST_DATABASE_URL is set
const db = createDb(
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/crm_test',
);
const MISSING = '00000000-0000-4000-8000-000000000000';

describe('rate limiting', () => {
  const apps: FastifyInstance[] = [];
  const make = async (
    opts: Parameters<typeof buildApp>[0] extends infer O ? Partial<O> : never,
  ) => {
    const app = await buildApp({ db, ...opts });
    apps.push(app);
    return app;
  };
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  const hit = (app: FastifyInstance, url: string, headers: Record<string, string> = {}) =>
    app.inject({ url, headers });
  const bulk = (app: FastifyInstance) =>
    app.inject({
      method: 'POST',
      url: '/tags/bulk-assign',
      payload: { contactIds: [MISSING], tagId: MISSING },
    });

  it('is off unless configured', async () => {
    const app = await make({});
    for (let i = 0; i < 30; i++) expect((await hit(app, '/tags')).statusCode).toBe(200);
  });

  it('answers 429 in the standard error shape once the limit is passed', async () => {
    const app = await make({ rateLimit: { max: 3, bulkMax: 2 } });
    for (let i = 0; i < 3; i++) expect((await hit(app, '/tags')).statusCode).toBe(200);
    const res = await hit(app, '/tags');
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
    expect(Object.keys(res.json().error).sort()).toEqual(['code', 'details', 'message']);
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('never limits the health check or the docs', async () => {
    const app = await make({ rateLimit: { max: 2, bulkMax: 2 } });
    for (let i = 0; i < 10; i++) {
      expect((await hit(app, '/health')).statusCode).not.toBe(429);
      expect((await hit(app, '/docs/json')).statusCode).toBe(200);
    }
  });

  it('bulk assign has its own, tighter limit', async () => {
    const app = await make({ rateLimit: { max: 100, bulkMax: 2 } });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) codes.push((await bulk(app)).statusCode);
    expect(codes.slice(0, 2)).not.toContain(429);
    expect(codes.slice(2)).toEqual([429, 429]);
    expect((await hit(app, '/tags')).statusCode).toBe(200); // everything else still fine
  });

  // The proxy appends the address it saw to X-Forwarded-For; whatever the client wrote comes
  // before it. Only the part the proxy added can be believed.
  const viaProxy = (app: FastifyInstance, clientWrote: string, proxySaw: string) =>
    app.inject({
      url: '/tags',
      remoteAddress: '10.0.0.5', // the proxy
      headers: { 'x-forwarded-for': clientWrote ? `${clientWrote}, ${proxySaw}` : proxySaw },
    });

  it('cannot be bypassed by writing a different X-Forwarded-For on every request', async () => {
    const app = await make({ rateLimit: { max: 3, bulkMax: 3 }, trustProxyHops: 1 });
    const codes: number[] = [];
    for (let i = 0; i < 6; i++)
      codes.push((await viaProxy(app, `6.6.6.${i}`, '203.0.113.9')).statusCode);
    expect(codes).toEqual([200, 200, 200, 429, 429, 429]);
  });

  it('still gives each real client its own budget behind the proxy', async () => {
    const app = await make({ rateLimit: { max: 2, bulkMax: 2 }, trustProxyHops: 1 });
    for (let i = 0; i < 2; i++) await viaProxy(app, '', '1.1.1.1');
    expect((await viaProxy(app, '', '1.1.1.1')).statusCode).toBe(429);
    expect((await viaProxy(app, '', '2.2.2.2')).statusCode).toBe(200);
  });

  it('with no trusted proxy the header is ignored entirely', async () => {
    const app = await make({ rateLimit: { max: 2, bulkMax: 2 } });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++)
      codes.push((await viaProxy(app, `6.6.6.${i}`, `7.7.7.${i}`)).statusCode);
    expect(codes).toEqual([200, 200, 429, 429]);
  });

  it('two trusted hops take the second address from the end', async () => {
    const app = await make({ rateLimit: { max: 2, bulkMax: 2 }, trustProxyHops: 2 });
    const as = (real: string, edge: string) =>
      app.inject({
        url: '/tags',
        remoteAddress: '10.0.0.5',
        headers: { 'x-forwarded-for': `6.6.6.${Math.random()}, ${real}, ${edge}` },
      });
    await as('1.1.1.1', '10.1.1.1');
    await as('1.1.1.1', '10.1.1.2'); // the edge proxy's own address varies; the client is the same
    expect((await as('1.1.1.1', '10.1.1.3')).statusCode).toBe(429);
    expect((await as('2.2.2.2', '10.1.1.3')).statusCode).toBe(200);
  });

  it('logs once which address it resolved, so the hop count can be checked after deploying', async () => {
    const lines: string[] = [];
    const stream = { write: (l: string) => void lines.push(l) } as unknown as NodeJS.WritableStream;
    const app = await make({ trustProxyHops: 1, logger: { stream } });
    await app.inject('/health'); // a probe with no header must not use up the one log line
    await app.inject('/tags');
    await viaProxy(app, '6.6.6.6', '203.0.113.9');
    await viaProxy(app, '6.6.6.6', '203.0.113.9');
    const logged = lines.map((l) => JSON.parse(l)).filter((l) => l.msg?.includes('resolved from'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      ip: '203.0.113.9',
      xForwardedFor: '6.6.6.6, 203.0.113.9',
      hops: 1,
    });
  });

  it('exempts /health even with a query string, but not other routes', async () => {
    const app = await make({ rateLimit: { max: 2, bulkMax: 2 } });
    for (let i = 0; i < 6; i++)
      expect((await hit(app, `/health?cachebust=${i}`)).statusCode).toBe(200);
    for (let i = 0; i < 2; i++) await hit(app, '/tags');
    expect((await hit(app, '/tags?limit=5')).statusCode).toBe(429);
  });
});

describe('docs switch', () => {
  it('serves /docs by default and not when switched off, while the API keeps working', async () => {
    const on = await buildApp({ db });
    expect((await on.inject('/docs/json')).statusCode).toBe(200);
    await on.close();
    const off = await buildApp({ db, docs: false });
    expect((await off.inject('/docs/json')).statusCode).toBe(404);
    expect((await off.inject('/docs/')).statusCode).toBe(404);
    expect((await off.inject('/tags')).statusCode).toBe(200);
    expect((await off.inject({ url: '/contacts?limit=abc' })).json().error.code).toBe(
      'BAD_REQUEST',
    );
    await off.close();
  });
});

describe('config: rate limit and proxy settings', () => {
  const base = { DATABASE_URL: 'postgres://x/y' };
  it('defaults to 300 per minute, 20 for bulk, no trusted proxy, docs on', () => {
    const c = loadConfig(base);
    expect(c.rateLimit).toEqual({ max: 300, bulkMax: 20 });
    expect(c.trustProxyHops).toBe(0);
    expect(c.enableDocs).toBe(true);
  });
  it('can be set, and bad values are rejected', () => {
    const c = loadConfig({
      ...base,
      RATE_LIMIT_MAX: '50',
      RATE_LIMIT_BULK_MAX: '5',
      TRUST_PROXY_HOPS: '1',
      ENABLE_DOCS: 'false',
    });
    expect(c.rateLimit).toEqual({ max: 50, bulkMax: 5 });
    expect(c.trustProxyHops).toBe(1);
    expect(c.enableDocs).toBe(false);
    expect(() => loadConfig({ ...base, RATE_LIMIT_MAX: '0' })).toThrow(/RATE_LIMIT_MAX/);
    for (const bad of ['-1', '1.5', 'many', '6'])
      expect(() => loadConfig({ ...base, TRUST_PROXY_HOPS: bad })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => loadConfig({ ...base, ENABLE_DOCS: 'no' })).toThrow(/ENABLE_DOCS/);
  });
  it('refuses the old TRUST_PROXY setting, which let clients choose their own address', () => {
    for (const v of ['true', 'false', '1'])
      expect(() => loadConfig({ ...base, TRUST_PROXY: v })).toThrow(/TRUST_PROXY_HOPS/);
  });
});
