import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeWorker } from './worker.mjs';

const ORIGIN='https://xjtc-r4-test.invalid', AUTH='https://abcdefghijklmnopqrst.supabase.co';
const USER='f5da7a2e-950b-4b12-a39d-ffd41e64fcc4', FACTOR='1ce348ae-bc84-431d-b5ed-1029345e3361', SESS='e17dc46a-6856-4bde-870b-235a3f28c9de';
const ENV={SITE_ORIGIN:ORIGIN,SUPABASE_URL:AUTH,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_nonreal_test_abcdefgh'};
const A='__Host-xj-r4-staging', M='__Host-xj-r4-mfa', DEMO_A='R4-DEMO-A', DEMO_B='R4-DEMO-B';
const tok=(aal,extra={})=>`test.${Buffer.from(JSON.stringify({aal,sub:USER,iss:AUTH+'/auth/v1',aud:'authenticated',role:'authenticated',session_id:SESS,exp:Math.trunc(Date.now()/1000)+1000,...extra})).toString('base64url')}.test`;
const t1=tok('aal1'), t2=tok('aal2');
const ck=(name,token)=>name+'='+token;
const okay=[{project_code:DEMO_A,role:'admin'}];
const U={id:USER,email_confirmed_at:'2026-11-25',factors:[{id:FACTOR,factor_type:'totp',status:'verified'}]};
const RULES='/rest/v1/xj_r4_staging_project_grants';
const expectedAuth=new Set([t1,t2]);
function mock({grants=okay,user=U,blocked=false,ruleStatus=200,authDown=false,allowedTokens=expectedAuth}={}) {
  const calls=[];
  const worker=makeWorker(async(raw,options)=>{
    const url=new URL(raw);
    const body=options.body===undefined?undefined:JSON.parse(options.body);
    const auth=options.headers.get('Authorization')?.slice(7);
    calls.push({path:url.pathname,method:options.method,auth,query:url.search});
    assert.equal(url.origin,AUTH);
    if(url.pathname==='/auth/v1/token') {
      assert.equal(url.searchParams.get('grant_type'),'password');
      assert.deepEqual(Object.keys(body).sort(),['email','password']);
      return body.password==='not-a-real-password'&&!blocked?Response.json({access_token:t1,refresh_token:'never-return-me'}):Response.json({message:'upstream detailed failure'},{status:400});
    }
    if(url.pathname==='/auth/v1/user') {
      return authDown?Response.json({}, {status:503}):allowedTokens.has(auth)?Response.json(user):Response.json({}, {status:401});
    }
    if(url.pathname===`/auth/v1/factors/${FACTOR}/challenge`&&auth===t1) return Response.json({id:SESS});
    if(url.pathname===`/auth/v1/factors/${FACTOR}/verify`&&auth===t1){
      return body.code==='123456'&&body.challenge_id===SESS?Response.json({access_token:t2,refresh_token:'never-return-me'}):Response.json({},{status:400});
    }
    if(url.pathname==='/auth/v1/logout'&&auth===t2) {
      assert.equal(url.search,'?scope=local');
      return new Response(null,{status:204});
    }
    if(url.pathname===RULES&&auth===t2){
      assert.equal(url.searchParams.get('user_id'),'eq.'+USER);
      return Response.json(grants,{status:ruleStatus});
    }
    throw new Error('unexpected upstream endpoint');
  });
  const send=(path,{form,origin=ORIGIN,cookie,method=form===undefined?'GET':'POST',headers={},env=ENV,host=ORIGIN}={})=>worker.fetch(new Request(host+path,{
    method,
    headers:{...headers,...(method==='POST'?{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'}:{}),...(cookie?{Cookie:cookie}:{})},
    body:form===undefined?undefined:new URLSearchParams(form),
  }),env);
  return {send,calls};
}
const password={email:'test@example.invalid',password:'not-a-real-password'};

test('opening R4 shows native account and password form with privacy headers and no test data',async()=>{
  const {send,calls}=mock();const r=await send('/');
  assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store, max-age=0');
  assert.match(r.headers.get('content-security-policy'),/form-action 'self'/);
  assert.match(await r.text(),/type="password"[\s\S]*>顯示</);assert.deepEqual(calls,[]);
});
test('anonymous request cannot retrieve project JSON or access a protected RFI screen',async()=>{
  const {send,calls}=mock();const results=await Promise.all([
    send('/api/projects'),send('/api/projects/'+DEMO_A),send('/workspace/'+DEMO_A),send('/.git/config'),send('/api/projects/R4-DEMO-%41')
  ]);
  assert.deepEqual(results.map(r=>r.status),[401,401,303,404,404]);assert.equal(results[2].headers.get('location'),'/login');assert.deepEqual(calls,[]);
  assert.ok((await results[1].text()).indexOf('DEMO-RFI-01')<0);
});
test('existing password then TOTP issues a host-only cookie and opens only permitted R4 project',async()=>{
  const {send,calls}=mock();
  const start=await send('/auth/login',{form:password});assert.equal(start.status,303);
  assert.equal(start.headers.get('location'),'/auth/mfa');
  assert.equal(start.headers.getSetCookie()[1],M+'='+t1+'; Path=/; Max-Age=180; Secure; HttpOnly; SameSite=Strict');
  assert.ok((await start.text()).indexOf('never-return-me')<0);
  assert.equal((await send('/api/projects',{cookie:ck(M,t1)})).status,401);
  const stage=await send('/auth/mfa',{cookie:ck(M,t1)});assert.match(await stage.text(),/6 位數驗證碼/);
  const verified=await send('/auth/mfa',{form:{code:'123456'},cookie:ck(M,t1)});
  assert.equal(verified.status,303);assert.equal(verified.headers.get('location'),'/workspace');
  assert.equal(verified.headers.getSetCookie()[1],A+'='+t2+'; Path=/; Max-Age=900; Secure; HttpOnly; SameSite=Strict');
  const data=await send('/workspace/'+DEMO_A,{cookie:ck(A,t2)});assert.equal(data.status,200);assert.match(await data.text(),/DEMO-RFI-01/);
  assert.equal((await send('/api/projects/'+DEMO_B,{cookie:ck(A,t2)})).status,403);
  assert.ok(!calls.some(c=>c.path.includes('ech')));
});
test('successful shared login without any R4 rights returns 403 and exposes no project list',async()=>{
  const {send}=mock({grants:[]});
  assert.equal((await send('/auth/login',{form:password})).status,303);
  assert.equal((await send('/auth/mfa',{form:{code:'123456'},cookie:ck(M,t1)})).status,303);
  const r=await send('/workspace',{cookie:ck(A,t2)});
  assert.equal(r.status,403);const body=await r.text();
  assert.match(body,/未開通 R4/);assert.doesNotMatch(body,/協作驗收專案 A/);
});
test('password-only, expired, wrong issuer, and unverified authorization tokens fail closed',async()=>{
  const invalid=[t1,tok('aal2',{iss:'https://other.invalid'}),tok('aal2',{exp:100}),tok('aal2',{sub:FACTOR})];
  const {send,calls}=mock({allowedTokens:new Set(invalid)});
  for(const t of invalid) assert.equal((await send('/api/projects',{cookie:ck(A,t)})).status,401);
  const unsigned=await mock().send('/api/projects',{cookie:ck(A,tok('aal2',{exp:77777777777}))});
  assert.equal(unsigned.status,401);assert.ok(!calls.some(c=>c.path===RULES));
});
test('without OTP enrollment or with a wrong code no completed R4 session is issued',async()=>{
  assert.equal((await mock({user:{...U,factors:[]}}).send('/auth/login',{form:password})).status,403);
  const r=await mock().send('/auth/mfa',{form:{code:'999999'},cookie:ck(M,t1)});
  assert.equal(r.status,401);assert.equal(r.headers.has('set-cookie'),false);
});
test('incorrect password is generic and never echoes provider details',async()=>{
  const r=await mock({blocked:true}).send('/auth/login',{form:password});
  assert.equal(r.status,401);assert.doesNotMatch(await r.text(),/upstream|not-a-real-password/);
});
test('cross-origin mutating requests and foreign host are denied before contacting Supabase',async()=>{
  const {send,calls}=mock();
  assert.equal((await send('/auth/login',{form:password,origin:'https://wrong.invalid'})).status,403);
  assert.equal((await send('/auth/mfa',{form:{code:'123456'},cookie:ck(M,t1),headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await send('/',{host:'https://wrong.invalid'})).status,404);
  assert.deepEqual(calls,[]);
});
test('misconfiguration, grant service error and future revocation do not expose data',async()=>{
  const valid=ck(A,t2);
  assert.equal((await mock({ruleStatus:403}).send('/api/projects',{cookie:valid})).status,503);
  assert.equal((await mock({authDown:true}).send('/api/projects',{cookie:valid})).status,503);
  assert.equal((await mock().send('/api/projects',{cookie:valid,env:{...ENV,SUPABASE_PUBLISHABLE_KEY:''}})).status,503);
  const grants=okay.map(g=>({...g})); const {send}=mock({grants});
  assert.equal((await send('/api/projects/'+DEMO_A,{cookie:valid})).status,200);
  grants.length=0;
  assert.equal((await send('/api/projects/'+DEMO_A,{cookie:valid})).status,403);
});
test('R4 logout clears only its own cookies and revokes only its local Auth session',async()=>{
  const {send,calls}=mock();
  const r=await send('/auth/logout',{form:{},cookie:ck(A,t2)});
  assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');
  assert.deepEqual(r.headers.getSetCookie().map(s=>s.split('=')[0]),[A,M]);
  assert.deepEqual(calls.map(x=>x.query),['?scope=local']);
});
test('Cloudflare rate limiting happens before the password is forwarded',async()=>{
  const {send,calls}=mock(); const r=await send('/auth/login',{form:password,headers:{'CF-Connecting-IP':'192.0.2.1'},env:{...ENV,LOGIN_RATE:{limit:async ({key})=>({success:key!=='192.0.2.1'})}}});assert.equal(r.status,429);assert.deepEqual(calls,[]);
});
