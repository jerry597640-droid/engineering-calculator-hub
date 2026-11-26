// Runs in remote CI after installing the pinned, real Supabase SSR SDK.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import worker from './worker-entry.mjs';

test('real SSR SDK creates secure cookies and protects every tool request', async () => {
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
  const jwk={...publicKey.export({format:'jwk'}),kid:'test-key',alg:'ES256',use:'sig'};
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const id='00000000-0000-4000-8000-000000000001', now=Math.floor(Date.now()/1000);
  const prefix=encode({alg:'ES256',typ:'JWT',kid:'test-key'})+'.'+encode({iss:'https://example123.supabase.co/auth/v1',sub:id,aud:'authenticated',role:'authenticated',aal:'aal1',iat:now,exp:now+3600,session_id:'00000000-0000-4000-8000-000000000002'});
  const jwt=prefix+'.'+sign('sha256',Buffer.from(prefix),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const oldFetch=globalThis.fetch;let permit=true,assets=0;
  globalThis.fetch=async (input,init)=>{
    const req=input instanceof Request?input:new Request(input,init);const u=new URL(req.url);
    if(u.pathname==='/auth/v1/token' && u.searchParams.get('grant_type')==='password')return Response.json({access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,refresh_token:'test-refresh',user:{id,aud:'authenticated',email:'test@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}});
    if(u.pathname==='/auth/v1/.well-known/jwks.json')return Response.json({keys:[jwk]});
    if(u.pathname==='/rest/v1/rpc/ech_has_tool_access'){
      assert.equal(req.headers.get('authorization'),'Bearer '+jwt);
      assert.deepEqual(await req.json(),{requested_tool_id:'rc-slab-auto-design'});
      return Response.json(permit);
    }
    throw Error('unexpected SDK request: '+u.pathname);
  };
  const env={SITE_ORIGIN:'https://stage.example',SUPABASE_URL:'https://example123.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',ASSETS:{fetch:async()=>{assets++;return new Response('protected pilot')}}};
  try {
    const login=await worker.fetch(new Request('https://stage.example/auth/login',{method:'POST',headers:{origin:'https://stage.example','content-type':'application/x-www-form-urlencoded'},body:'email=test%40example.invalid&password=examplepass'}),env);
    assert.equal(login.status,303);
    const set=login.headers.getSetCookie();assert.ok(set.length>0);assert.ok(set.every(x=>/HttpOnly/i.test(x)&&/Secure/i.test(x)&&/Path=\//i.test(x)));
    const cookie=set.map(x=>x.split(';')[0]).join('; ');
    const resource=()=>new Request('https://stage.example/tools/rc-slab-auto-design/index.html',{headers:{cookie}});
    const allowed=await worker.fetch(resource(),env);assert.equal(allowed.status,200);assert.equal(await allowed.text(),'protected pilot');assert.equal(assets,1);assert.match(allowed.headers.get('cache-control'),/no-store/);
    permit=false;const denied=await worker.fetch(resource(),env);assert.equal(denied.status,403);assert.equal(assets,1);
    const missing=await worker.fetch(new Request('https://stage.example/tools/rc-slab-auto-design/index.html'),env);assert.equal(missing.status,401);assert.equal(assets,1);
    const wrongHost=await worker.fetch(new Request('https://alternate.example/'),env);assert.equal(wrongHost.status,503);
  } finally { globalThis.fetch=oldFetch; }
});

test('real SSR SDK completes a synthetic PKCE password recovery',async()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'P-256'});
  const jwk={...publicKey.export({format:'jwk'}),kid:'recovery-key',alg:'ES256',use:'sig'};
  const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  const id='00000000-0000-4000-8000-000000000011',now=Math.floor(Date.now()/1000);
  const prefix=encode({alg:'ES256',typ:'JWT',kid:'recovery-key'})+'.'+encode({
    iss:'https://example123.supabase.co/auth/v1',sub:id,aud:'authenticated',role:'authenticated',aal:'aal1',
    iat:now,exp:now+3600,session_id:'00000000-0000-4000-8000-000000000012'});
  const jwt=prefix+'.'+sign('sha256',Buffer.from(prefix),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  const session={access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:now+3600,
    refresh_token:'synthetic-refresh',user:{id,aud:'authenticated',email:'test@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()}};
  const oldFetch=globalThis.fetch;let challenge='',updated=false,signedOut=false;
  globalThis.fetch=async(input,init)=>{
    const req=input instanceof Request?input:new Request(input,init),u=new URL(req.url);
    if(u.pathname==='/auth/v1/recover'){
      const body=await req.json();assert.equal(body.email,'test@example.invalid');
      assert.equal(body.code_challenge_method,'s256');challenge=body.code_challenge;return Response.json({});
    }
    if(u.pathname==='/auth/v1/token' && u.searchParams.get('grant_type')==='pkce'){
      const body=await req.json();assert.equal(body.auth_code,'synthetic-code');
      assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),challenge);
      return Response.json(session);
    }
    if(u.pathname==='/auth/v1/.well-known/jwks.json')return Response.json({keys:[jwk]});
    if(u.pathname==='/auth/v1/user' && req.method==='PUT'){
      const body=await req.json();assert.equal(body.password,'synthetic-password');updated=true;return Response.json(session.user);
    }
    if(u.pathname==='/auth/v1/logout' && req.method==='POST'){signedOut=true;return new Response(null,{status:204})}
    throw Error('unexpected synthetic recovery request: '+u.pathname);
  };
  const env={SITE_ORIGIN:'https://stage.example',SUPABASE_URL:'https://example123.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',ASSETS:{fetch:async()=>new Response('unused')}};
  try{
    const sent=await worker.fetch(new Request('https://stage.example/auth/request-reset',{method:'POST',
      headers:{origin:'https://stage.example','content-type':'application/x-www-form-urlencoded'},body:'email=test%40example.invalid'}),env);
    assert.equal(sent.status,200);assert.ok(challenge);
    const startCookies=sent.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
    assert.match(startCookies,/__Host-ech-recovery=1/);assert.match(startCookies,/code-verifier/);
    const callback=await worker.fetch(new Request('https://stage.example/auth/callback?code=synthetic-code',{headers:{cookie:startCookies}}),env);
    assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/reset-password');
    const sessionCookies=callback.headers.getSetCookie().map(x=>x.split(';')[0]).filter(x=>!x.startsWith('__Host-ech-recovery=')).join('; ');
    const update=await worker.fetch(new Request('https://stage.example/auth/reset-password',{method:'POST',
      headers:{origin:'https://stage.example','content-type':'application/x-www-form-urlencoded',cookie:sessionCookies},
      body:'password=synthetic-password&confirm=synthetic-password'}),env);
    assert.equal(update.status,200);assert.equal(updated,true);assert.equal(signedOut,true);
  }finally{globalThis.fetch=oldFetch}
});
