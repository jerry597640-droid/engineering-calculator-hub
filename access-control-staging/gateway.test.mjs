import test from 'node:test';
import assert from 'node:assert/strict';
import { createProtectedGateway, toolIdForPath } from './gateway.mjs';

const req = (url, init) => new Request(`https://test.example${url}`, init);
const fixture = (authorize) => {
  let count = 0;
  const handle = createProtectedGateway({authorize, assets: {fetch: async () => {
    count++; return new Response('protected', {headers:{'cache-control':'public, max-age=3600'}});
  }}});
  return {handle, count:()=>count};
};

test('unknown and ambiguous paths are not classified as protected tool paths', () => {
  for (const p of ['/index.html', '/tools/a', '/tools//a/', '/tools/a/../b',
    '/tools/a/%2e%2e/b', '/tools/a\\b/', '/tools/a/%252e%252e/b']) {
    assert.equal(toolIdForPath(p), null, p);
  }
  assert.equal(toolIdForPath('/tools/rc-beam/index.html'), 'rc-beam');
});

test('missing configuration fails closed without fetching assets', async () => {
  assert.equal((await createProtectedGateway()(req('/tools/a/index.html'))).status, 503);
});

test('unauthenticated and unauthorized requests never fetch assets', async () => {
  for (const decision of ['login','deny', undefined, true]) {
    const f = fixture(async () => decision);
    const response = await f.handle(req('/tools/rc-beam/index.html'));
    assert.equal(response.status, decision === 'login' ? 401 : 403);
    assert.equal(f.count(), 0);
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  }
});

test('checks each tool path independently', async () => {
  const f = fixture(async (_request,id) => id === 'rc-beam' ? 'allow' : 'deny');
  assert.equal((await f.handle(req('/tools/rc-beam/index.html'))).status, 200);
  assert.equal((await f.handle(req('/tools/rc-column/index.html'))).status, 403);
  assert.equal(f.count(), 1);
});

test('backend failure denies access and does not fetch assets', async () => {
  const f = fixture(async () => { throw new Error('backend offline'); });
  assert.equal((await f.handle(req('/tools/a/app.js'))).status, 503);
  assert.equal(f.count(), 0);
});

test('allowed responses disable shared caching', async () => {
  const f = fixture(async () => 'allow');
  const r = await f.handle(req('/tools/a/app.js'));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(await r.text(), 'protected');
});

test('unsupported methods and paths cannot access assets', async () => {
  const f = fixture(async () => 'allow');
  assert.equal((await f.handle(req('/tools/a/app.js', {method:'POST'}))).status,405);
  assert.equal((await f.handle(req('/unmapped/app.js'))).status,404);
  assert.equal(f.count(),0);
});
