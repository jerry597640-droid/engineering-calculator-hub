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

