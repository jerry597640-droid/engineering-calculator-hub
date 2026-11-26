import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseAuthorizer } from './supabase-authorizer.mjs';
import { createProtectedGateway } from './gateway.mjs';

const url = 'https://example123.supabase.co';
const publishableKey = 'sb_publishable_example';
const request = (cookie = '') => new Request('https://site.example/tools/rc-beam/app.js', {headers:{cookie}});
const cookie = '__Host-ech-access=aaa.bbb.ccc';

test('rejects unsafe or missing backend configuration', () => {
  for (const bad of ['http://example123.supabase.co','https://example.com','https://example123.supabase.co/path']) {
    assert.throws(() => createSupabaseAuthorizer({url:bad,publishableKey}));
  }
  assert.throws(() => createSupabaseAuthorizer({url,publishableKey:'secret-key'}));
});

test('missing, invalid and duplicate session cookies are unauthenticated', async () => {
  const auth = createSupabaseAuthorizer({url,publishableKey,fetchImpl:()=>{throw Error('must not call')}});
  for (const value of ['', '__Host-ech-access=bad', `${cookie}; ${cookie}`]) {
    assert.equal(await auth(request(value), 'rc-beam'), 'login');
  }
});

test('sends only requested tool and JWT to configured Supabase RPC', async () => {
  let called = 0;
  const auth = createSupabaseAuthorizer({url,publishableKey,fetchImpl:async (dest,init) => {
    called++; assert.equal(dest, `${url}/rest/v1/rpc/ech_has_tool_access`);
    assert.equal(init.headers.authorization, 'Bearer aaa.bbb.ccc');
    assert.deepEqual(JSON.parse(init.body), {requested_tool_id:'rc-beam'});
    assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error');
    return Response.json(true);
  }});
  assert.equal(await auth(request(cookie), 'rc-beam'), 'allow'); assert.equal(called,1);
});

test('denials and expired sessions do not reach asset binding', async () => {
  for (const [status,body,expected] of [[200,false,403],[401,{},401],[403,{},403],[500,{},503]]) {
    let assetsFetched = 0;
    const auth = createSupabaseAuthorizer({url,publishableKey,fetchImpl:async()=>Response.json(body,{status})});
    const handle = createProtectedGateway({authorize:auth,assets:{fetch:async()=>{assetsFetched++;return new Response('secret')}}});
    assert.equal((await handle(request(cookie))).status,expected); assert.equal(assetsFetched,0);
  }
});

test('unexpected responses fail closed', async () => {
  const auth = createSupabaseAuthorizer({url,publishableKey,fetchImpl:async()=>Response.json({allowed:true})});
  await assert.rejects(() => auth(request(cookie),'rc-beam'));
});
