import test from 'node:test';
import assert from 'node:assert/strict';
import { route } from './web-app.mjs';

const id='00000000-0000-4000-8000-000000000001';
function fake({claims={sub:id,aal:'aal1'},userProfile={user_id:id,role:'user',status:'approved',expires_at:null},permission=false,tools=[]}={}){
  let assetCalls=0,rpcCalls=[];
  const client={auth:{getClaims:async()=>({data:{claims},error:null}),signInWithPassword:async()=>({error:null}),signOut:async()=>({error:null})},
    from(name){
      if(name==='ech_user_profiles')return {select:()=>({eq:()=>({maybeSingle:async()=>({data:userProfile,error:null})})})};
      if(name==='ech_tools')return {select:()=>({order:async()=>({data:tools,error:null})})};
      throw Error('unexpected table');
    },
    async rpc(name,args){rpcCalls.push({name,args});if(name==='ech_has_tool_access')return {data:permission,error:null};return {data:[],error:null}}};
  return {client,assets:{fetch:async()=>{assetCalls++;return new Response('protected',{headers:{'cache-control':'public'}})}},count:()=>assetCalls,rpcs:()=>rpcCalls};
}
const req=(path,init)=>new Request('https://stage.example'+path,init);
const form=(body,origin='https://stage.example')=>({method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body});

test('missing identity is redirected to login',async()=>{
  const x=fake({claims:null}),r=await route(req('/'),x);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login');
});
test('pending and expired accounts cannot open the hub',async()=>{
  for(const p of [{user_id:id,role:'user',status:'pending'}, {user_id:id,role:'user',status:'approved',expires_at:'2020-01-01T00:00:00Z'}]){
    const x=fake({userProfile:p}),r=await route(req('/'),x);assert.equal(r.status,403);
  }
});
test('tool assets are read only after server RPC allows that tool',async()=>{
  for(const permit of [true,false]){const x=fake({permission:permit}),r=await route(req('/tools/rc-beam/app.js'),x);
    assert.equal(r.status,permit?200:403);assert.equal(x.count(),permit?1:0);
    assert.equal(x.rpcs()[0].args.requested_tool_id,'rc-beam');assert.match(r.headers.get('cache-control'),/no-store/);
  }
});
test('unmapped or malformed paths cannot fetch assets',async()=>{
  const x=fake({permission:true});for(const p of ['/assets/app.js','/tools/rc-beam/%252e%252e/x'])assert.equal((await route(req(p),x)).status,404);assert.equal(x.count(),0);
});
test('forms reject cross-origin and duplicate values',async()=>{
  const x=fake();assert.equal((await route(req('/auth/login',form('email=a%40b.com&password=abcdefgh','https://evil.example')),x)).status,400);
  assert.equal((await route(req('/auth/login',form('email=a%40b.com&email=b%40c.com&password=abcdefgh')),x)).status,400);
});
test('login forms retain same-origin CSRF checks and a usable browser referrer policy',async()=>{
  const x=fake();
  for(const path of ['/login','/signup'])assert.equal((await route(req(path),x)).headers.get('referrer-policy'),'same-origin');
  const valid=await route(req('/auth/login',form('email=qa%40example.invalid&password=x')),x);
  assert.equal(valid.status,400);assert.match(await valid.text(),/請檢查帳號及密碼格式/);
  const anonymousOrigin=await route(req('/auth/login',form('email=qa%40example.invalid&password=x','null')),x);
  assert.equal(anonymousOrigin.status,400);assert.match(await anonymousOrigin.text(),/請求格式無效/);
});
test('tool names are HTML escaped',async()=>{
  const x=fake({tools:[{tool_id:'rc-beam',name:'<img src=x onerror=alert(1)>'}]});const html=await (await route(req('/'),x)).text();
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
});
test('users and admins without MFA cannot use admin endpoints',async()=>{
  const user=fake();assert.equal((await route(req('/admin'),user)).status,403);assert.equal(user.rpcs().length,0);
  const admin=fake({userProfile:{user_id:id,role:'admin',status:'approved'}});assert.equal((await route(req('/admin'),admin)).status,403);assert.equal(admin.rpcs().length,0);
});
test('admin changes reject CSRF before making a mutation',async()=>{
  const x=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}});
  const r=await route(req('/admin/status',form('target='+id+'&status=approved','https://evil.example')),x);assert.equal(r.status,400);assert.equal(x.rpcs().length,0);
});
test('admin expiry is interpreted as Taipei time and invalid dates are rejected',async()=>{
  const x=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}});
  const ok=await route(req('/admin/status',form('target='+id+'&status=approved&expiry=2027-01-01T12%3A30')),x);
  assert.equal(ok.status,303);assert.equal(x.rpcs()[0].args.new_expiry,'2027-01-01T04:30:00.000Z');
  const bad=await route(req('/admin/status',form('target='+id+'&status=approved&expiry=2027-02-30T12%3A30')),x);
  assert.equal(bad.status,400);assert.equal(x.rpcs().length,1);
});
test('an existing grant can be extended without revoking it',async()=>{
  const x=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}});
  x.client.rpc=async(name,args)=>name==='ech_admin_users'?{data:[{user_id:id,email:'owner@example.invalid',role:'owner',status:'approved',expires_at:'2027-01-01T04:30:00Z'}],error:null}:
    name==='ech_admin_permissions'?{data:[{tool_id:'rc-beam',name:'RC beam',enabled:true,allowed:true,valid_until:'2027-01-01T04:30:00Z'}],error:null}:({data:[],error:null});
  const html=await (await route(req('/admin?target='+id),x)).text();
  assert.match(html,/value="2027-01-01T12:30"/);assert.match(html,/name="allowed" value="true">更新期限/);assert.match(html,/name="allowed" value="false">取消授權/);
});
test('account search is bounded, escaped, and sent to the server',async()=>{
  const x=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}});
  const r=await route(req('/admin?q=%3Cowner%3E'),x),html=await r.text();
  assert.equal(r.status,200);assert.match(html,/value="&lt;owner&gt;"/);
  assert.equal(x.rpcs()[0].name,'ech_admin_search_users');assert.equal(x.rpcs()[0].args.search_text,'<owner>');
  assert.equal((await route(req('/admin?q='+('x'.repeat(255))),x)).status,400);
});
test('batch preview lists only selected existing tools and performs no mutation',async()=>{
  const x=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}}),calls=[];
  x.client.rpc=async(name,args)=>{calls.push({name,args});return name==='ech_admin_permissions'?
    {data:[{tool_id:'rc-beam',name:'RC 梁',enabled:true},{tool_id:'wind',name:'風力',enabled:false}],error:null}:{data:null,error:null}};
  const r=await route(req('/admin/permission-batch/preview',form('target='+id+'&operation=grant-enabled&q=owner&valid_until=')),x);
  const html=await r.text();assert.equal(r.status,200);assert.match(html,/RC 梁/);assert.doesNotMatch(html,/風力/);
  assert.deepEqual(calls.map(c=>c.name),['ech_admin_permissions']);assert.match(html,/name="tools" value="rc-beam"/);
  const bad=await route(req('/admin/permission-batch/preview',form('target='+id+'&operation=grant-selected&tools=unknown')),x);
  assert.equal(bad.status,400);
});
test('batch confirmation sends explicit unique tool IDs and keeps CSRF checks',async()=>{
  const x=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}});
  const body='target='+id+'&allowed=true&tools=rc-beam&tools=wind&valid_until=2027-01-01T12%3A30';
  const r=await route(req('/admin/permission-batch',form(body)),x);assert.equal(r.status,303);
  assert.equal(x.rpcs()[0].name,'ech_admin_set_permissions');
  assert.deepEqual(x.rpcs()[0].args.requested_tools,['rc-beam','wind']);
  assert.equal(x.rpcs()[0].args.new_valid_until,'2027-01-01T04:30:00.000Z');
  const dup=await route(req('/admin/permission-batch',form(body+'&tools=wind')),x);assert.equal(dup.status,400);
  const csrf=await route(req('/admin/permission-batch',form(body,'https://evil.example')),x);assert.equal(csrf.status,400);
  assert.equal(x.rpcs().length,1);
});
test('only a verified owner can view the administrative audit',async()=>{
  const admin=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'admin',status:'approved'}});
  assert.equal((await route(req('/admin/audit'),admin)).status,403);assert.equal(admin.rpcs().length,0);
  const owner=fake({claims:{sub:id,aal:'aal2'},userProfile:{user_id:id,role:'owner',status:'approved'}});
  assert.equal((await route(req('/admin/audit'),owner)).status,200);assert.equal(owner.rpcs()[0].name,'ech_admin_audit');
});
test('password recovery uses the fixed callback and a secure short-lived marker',async()=>{
  const x=fake(),calls=[];
  x.client.auth.resetPasswordForEmail=async(email,options)=>{calls.push({email,options});return {error:null}};
  x.client.auth.exchangeCodeForSession=async(code)=>{calls.push({code});return {error:null}};
  const sent=await route(req('/auth/request-reset',form('email=test%40example.invalid')),x);
  assert.equal(sent.status,200);assert.equal(calls[0].options.redirectTo,'https://stage.example/auth/callback');
  assert.match(sent.headers.get('set-cookie'),/__Host-ech-recovery=1;.*HttpOnly; Secure; SameSite=Lax/);
  const callback=await route(req('/auth/callback?code=example',{headers:{cookie:'__Host-ech-recovery=1'}}),x);
  assert.equal(callback.status,303);assert.equal(callback.headers.get('location'),'/reset-password');
  assert.match(callback.headers.get('set-cookie'),/Max-Age=0/);
  const ordinary=await route(req('/auth/callback?code=example'),x);
  assert.equal(ordinary.headers.get('location'),'/');
  const missing=await route(req('/auth/callback'),x);
  assert.equal(missing.status,400);assert.match(await missing.text(),/同一台裝置及瀏覽器/);
  assert.match(missing.headers.get('set-cookie'),/Max-Age=0/);
  x.client.auth.exchangeCodeForSession=async()=>({error:{message:'private upstream error'}});
  const expired=await route(req('/auth/callback?code=expired'),x);
  assert.equal(expired.status,400);const message=await expired.text();
  assert.match(message,/最新的郵件/);assert.doesNotMatch(message,/private upstream error/);
  assert.equal((await route(req('/auth/request-reset',form('email=test%40example.invalid','https://evil.example')),x)).status,400);
});
test('password change requires identity, matching inputs and signs out other sessions',async()=>{
  const x=fake(),calls=[];
  x.client.auth.updateUser=async arg=>{calls.push({method:'update',arg});return {error:null}};
  x.client.auth.signOut=async arg=>{calls.push({method:'signout',arg});return {error:null}};
  assert.match(await (await route(req('/login'),x)).text(),/忘記密碼/);
  assert.equal((await route(req('/auth/reset-password',form('password=1234567890&confirm=wrong')),x)).status,400);
  assert.equal(calls.length,0);
  x.client.auth.updateUser=async()=>({error:{code:'same_password'}});
  const reused=await route(req('/auth/reset-password',form('password=1234567890&confirm=1234567890')),x);
  assert.equal(reused.status,400);assert.match(await reused.text(),/與原密碼不同/);assert.equal(calls.length,0);
  x.client.auth.updateUser=async arg=>{calls.push({method:'update',arg});return {error:null}};
  const done=await route(req('/auth/reset-password',form('password=1234567890&confirm=1234567890')),x);
  assert.equal(done.status,200);assert.match(await done.text(),/密碼已更新/);
  assert.deepEqual(calls.map(c=>c.method),['update','signout']);assert.equal(calls[1].arg.scope,'global');
  const anonymous=fake({claims:null});assert.equal((await route(req('/reset-password'),anonymous)).status,303);
  assert.equal((await route(req('/auth/reset-password',form('password=1234567890&confirm=1234567890')),anonymous)).status,401);
});
