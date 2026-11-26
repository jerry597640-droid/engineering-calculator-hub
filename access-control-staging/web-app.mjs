// Staging application core. A verified Supabase SSR client is injected per request.
// No service-role key, browser-side permission decision, or public tool fallback.
import { toolIdForPath } from './gateway.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers = {'cache-control':'private, no-store, max-age=0','content-type':'text/html; charset=utf-8',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const page = (title,body,status=200) => new Response(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f4f6f9;color:#203148}main{max-width:1000px;margin:4vh auto;padding:24px}section,article{background:white;border:1px solid #dbe3ec;border-radius:12px;padding:20px;margin:14px 0}input,select,button{font:inherit;padding:10px;border:1px solid #bdcbd9;border-radius:6px}button{background:#193e5c;color:white;cursor:pointer}a{color:#135d87}label{display:block;margin:12px 0}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:10px;border-bottom:1px solid #dbe3ec}small{color:#657589}.tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}form.inline{display:inline-block;margin:4px}.qr{max-width:220px}</style></head><body><main><h1>${esc(title)}</h1>${body}</main></body></html>`,{status,headers});
const redirect = location => new Response(null,{status:303,headers:{...headers,location}});
const errorPage = (message,status=403) => page('�L�k�����ާ@',`<section><p>${esc(message)}</p><p><a href="/">�^��J�f</a></p></section>`,status);
const sameOrigin = req => req.headers.get('origin') === new URL(req.url).origin;

async function formValues(req) {
  if (!sameOrigin(req) || !(req.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) throw new Error('bad request');
  const reader=req.body?.getReader(); let size=0, parts=[];
  if(reader) for (;;) { const {value,done}=await reader.read(); if(done)break; size+=value.byteLength; if(size>16384){await reader.cancel();throw Error('too large')} parts.push(value); }
  const bytes=new Uint8Array(size);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.byteLength}
  const params=new URLSearchParams(new TextDecoder().decode(bytes));
  for(const key of new Set(params.keys()))if(params.getAll(key).length!==1)throw Error('duplicate field');
  return params;
}

async function identity(client) {
  const {data,error}=await client.auth.getClaims();
  if(error || !data?.claims?.sub || !UUID.test(data.claims.sub)) return null;
  return data.claims;
}
async function profile(client,claims) {
  const {data,error}=await client.from('ech_user_profiles').select('user_id,role,status,expires_at').eq('user_id',claims.sub).maybeSingle();
  if(error)throw Error('profile unavailable');
  return data;
}
const approved = p => p?.status==='approved' && (!p.expires_at || Date.parse(p.expires_at)>Date.now());
const loginPage = message => page('�u�{�p��u�㤤�ߡU�n�J',`<section><p>${esc(message || '�еn�J�A�b�����g�޲z���֭��ϥΡC')}</p><form method="post" action="/auth/login"><label>�q�l�l�� <input required type="email" name="email" autocomplete="username"></label><label>�K�X <input required type="password" name="password" autocomplete="current-password"></label><button>�n�J</button></form><form method="post" action="/auth/google"><button>�ϥ� Google �n�J</button></form><p><a href="/signup">�ӽбb��</a></p><small>�������ҡG�u��|�������}��C</small></section>`);
const signupPage = () => page('�ӽбb��',`<section><p>�ӽЫ�ݥ����ҹq�l�l��A�åѺ޲z���֭�C</p><form method="post" action="/auth/signup"><label>�q�l�l�� <input required type="email" name="email"></label><label>�K�X <input required minlength="10" type="password" name="password" autocomplete="new-password"></label><button>�e�X�ӽ�</button></form><p><a href="/login">�^��n�J</a></p></section>`);
const userToolbar = `<nav class="toolbar"><a href="/">�u��J�f</a><a href="/mfa">�h�]������</a><a href="/admin">�޲z��x</a><form class="inline" method="post" action="/auth/logout"><button>�n�X</button></form></nav>`;

export async function route(request,{client,assets}) {
  const u=new URL(request.url), path=u.pathname;
  if(request.method==='GET' && path==='/login') return loginPage();
  if(request.method==='GET' && path==='/signup') return signupPage();
  if(request.method==='GET' && path==='/auth/callback') {
    const code=u.searchParams.get('code'); if(!code || code.length>512)return errorPage('�n�J�s���L�ġC',400);
    const {error}=await client.auth.exchangeCodeForSession(code);
    return error ? errorPage('�n�J�����ҥ��ѡA�Э��s�ާ@�C',400) : redirect('/');
  }
  if(request.method==='POST' && path.startsWith('/auth/')) {
    let form;try{form=await formValues(request)}catch{return errorPage('�ШD�榡�L�ġC',400)}
    if(path==='/auth/logout'){await client.auth.signOut({scope:'local'});return redirect('/login')}
    if(path==='/auth/google') {
      const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:u.origin+'/auth/callback'}});
      if(error || !data?.url)return errorPage('Google �n�J�|���]�w�μȮɵL�k�ϥΡC',503);
      const dest=new URL(data.url); if(dest.protocol!=='https:' || !dest.hostname.endsWith('.supabase.co'))return errorPage('�n�J�A�ȳ]�w���~�C',503);
      return redirect(dest.href);
    }
    if(path==='/auth/login'||path==='/auth/signup') {
      const email=form.get('email')||'',password=form.get('password')||'';
      if(email.length>254 || password.length>256 || !email.includes('@') || password.length<(path==='/auth/signup'?10:8))return errorPage('���ˬd�b���αK�X�榡�C',400);
      if(path==='/auth/signup'){
        const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:u.origin+'/auth/callback'}});
        return error ? errorPage('�L�k�e�X�ӽСA�еy�᭫�աC',400) : page('�ӽФw�e�X','<section><p>�p�b���i�ϥΡA�Ьd�����Ҷl��õ��ݮ֭�C</p><a href="/login">�^��n�J</a></section>');
      }
      const {error}=await client.auth.signInWithPassword({email,password});
      return error ? loginPage('�n�J���ѡA�нT�{��Ʃεy��A�աC') : redirect('/');
    }
    return errorPage('�䤣�쭶���C',404);
  }
  const toolId=toolIdForPath(path);
  if(toolId && (request.method==='GET'||request.method==='HEAD')) {
    const claims=await identity(client);if(!claims)return errorPage('�Х��n�J�C',401);
    const {data,error}=await client.rpc('ech_has_tool_access',{requested_tool_id:toolId});
    if(error)return errorPage('���v�A�ȼȮɵL�k�ϥΡC',503);
    if(data!==true)return errorPage('���b���|����o���u�㪺���v�C',403);
    if(!assets?.fetch)return errorPage('�u��ثe�L�k�ϥΡC',503);
    const source=await assets.fetch(request), h=new Headers(source.headers);
    h.set('cache-control','private, no-store, max-age=0');h.set('x-content-type-options','nosniff');h.set('referrer-policy','no-referrer');h.set('vary','Cookie');h.delete('set-cookie');
    return new Response(request.method==='HEAD'?null:source.body,{status:source.status,statusText:source.statusText,headers:h});
  }
  if(!['/','/admin','/mfa','/mfa/enroll','/mfa/verify','/admin/status','/admin/permission','/admin/role'].includes(path))return errorPage('�䤣�쭶���C',404);
  if(!['GET','POST'].includes(request.method))return errorPage('���䴩���ާ@�C',405);
  const claims=await identity(client);if(!claims)return redirect('/login');
  const p=await profile(client,claims);if(!approved(p))return page('�b���|���}�q',`<section><p>�b���ݮ֭�B�w���ΩΤw�L���A���p���޲z���C</p><form method="post" action="/auth/logout"><button>�n�X</button></form></section>`,403);
  if(path==='/' && request.method==='GET') {
    const {data,error}=await client.from('ech_tools').select('tool_id,name').order('name');
    if(error)return errorPage('�u��M��ȮɵL�k���o�C',503);
    const cards=(data||[]).filter(x=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(x.tool_id)).map(x=>`<article><a href="/tools/${esc(x.tool_id)}/">${esc(x.name)}</a></article>`).join('');
    return page('�u�{�p��u�㤤��',`${userToolbar}<section><p>��ܤw���v�B�w�ҥΪ��u��C</p><div class="tools">${cards||'<p>�ثe�S���i�ϥΪ��u��C</p>'}</div></section>`);
  }
  if(path==='/mfa' && request.method==='GET'){
    const {data,error}=await client.auth.mfa.listFactors();if(error)return errorPage('�L�kŪ�����ҳ]�w�C',503);
    const factor=(data?.totp||[]).find(f=>f.status==='verified');
    const body=factor?`<form method="post" action="/mfa/verify"><input type="hidden" name="factor_id" value="${esc(factor.id)}"><label>���ҽX <input required inputmode="numeric" pattern="[0-9]{6}" name="code"></label><button>����</button></form>`:`<form method="post" action="/mfa/enroll"><button>�ҥ����Ҿ�</button></form>`;
    return page('�h�]������',`${userToolbar}<section><p>�޲z���ݨϥ����Ҿ����ͪ����ҽX�C</p>${body}</section>`);
  }
  if(path==='/mfa/enroll' && request.method==='POST'){
    try{await formValues(request)}catch{return errorPage('�ШD�榡�L�ġC',400)}
    const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'�u�{�u�����Ҿ�'});
    const qr=data?.totp?.qr_code||''; if(error || !UUID.test(data?.id||'') || !qr.startsWith('data:image/svg+xml'))return errorPage('�L�k�إ����Ҿ��C',503);
    return page('�]�w���Ҿ�',`<section><p>�Шϥ����Ҿ� App ���y�A�A��J��������ҽX�C</p><img class="qr" alt="���Ҿ� QR code" src="${esc(qr)}"><form method="post" action="/mfa/verify"><input type="hidden" name="factor_id" value="${esc(data.id)}"><label>���ҽX <input required inputmode="numeric" pattern="[0-9]{6}" name="code"></label><button>��������</button></form></section>`);
  }
  if(path==='/mfa/verify' && request.method==='POST'){
    let f;try{f=await formValues(request)}catch{return errorPage('�ШD�榡�L�ġC',400)}
    const factorId=f.get('factor_id')||'',code=f.get('code')||'';if(!UUID.test(factorId)||!/^\d{6}$/.test(code))return errorPage('���ҽX�榡���~�C',400);
    const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});return error?errorPage('���ҥ����\�C',400):redirect('/admin');
  }
  if(!['owner','admin'].includes(p.role))return errorPage('�S���޲z�v���C',403);
  if(claims.aal!=='aal2')return page('�ݭn�h�]������',`${userToolbar}<section><p>�Х��������Ҿ����ҡA�A�i�J�޲z��x�C</p><a href="/mfa">�e������</a></section>`,403);
  if(path==='/admin' && request.method==='GET'){
    const n=Number(u.searchParams.get('page')||0);if(!Number.isInteger(n)||n<0||n>2000)return errorPage('���X�L�ġC',400);
    const result=await client.rpc('ech_admin_users',{page_size:50,page_offset:n*50});if(result.error)return errorPage('�޲z��ƼȮɵL�k���o�C',503);
    const rows=(result.data||[]).map(x=>`<tr><td><a href="/admin?page=${n}&target=${encodeURIComponent(x.user_id)}">${esc(x.email)}</a></td><td>${esc(x.role)}</td><td>${esc(x.status)}</td></tr>`).join('');
    let details='',target=u.searchParams.get('target');
    if(target && UUID.test(target)){
      const selected=(result.data||[]).find(x=>x.user_id===target);
      if(selected){const r=await client.rpc('ech_admin_permissions',{target});if(r.error)return errorPage('�v����ƼȮɵL�k���o�C',503);
        const tools=(r.data||[]).map(t=>`<tr><td>${esc(t.name)}</td><td>${t.enabled?'�w�ҥ�':'���ҥ�'}</td><td>${t.allowed?'���\':'�����v'}</td><td><form method="post" action="/admin/permission"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><input type="hidden" name="tool" value="${esc(t.tool_id)}"><input type="hidden" name="allowed" value="${t.allowed?'false':'true'}"><label>�����]UTC�A�i�d�š^<input type="datetime-local" name="valid_until" value="${t.valid_until?esc(new Date(t.valid_until).toISOString().slice(0,16)):''}"></label><button>${t.allowed?'�������v':'�}��'}</button></form></td></tr>`).join('');
        const options=['pending','approved','disabled'].map(s=>`<option value="${s}" ${s===selected.status?'selected':''}>${s}</option>`).join('');
        const roles=['user','admin','owner'].map(s=>`<option value="${s}" ${s===selected.role?'selected':''}>${s}</option>`).join('');
        const roleForm=p.role==='owner' && target!==claims.sub?`<form method="post" action="/admin/role"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><label>�޲z���� <select name="role">${roles}</select></label><button>��s����</button></form>`:'';
        details=`<section><h2>${esc(selected.email)} ���v��</h2><form method="post" action="/admin/status"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><label>�b�����A <select name="status">${options}</select></label><label>�����]UTC�A�d�Ŭ������^<input type="datetime-local" name="expiry" value="${selected.expires_at?esc(new Date(selected.expires_at).toISOString().slice(0,16)):''}"></label><button>��s���A</button></form>${roleForm}<table><tr><th>�u��</th><th>���p</th><th>���v</th><th>�ާ@</th></tr>${tools}</table></section>`;
      }
    }
    return page('�޲z��x',`${userToolbar}<section><h2>�b��</h2><table><tr><th>�q�l�l��</th><th>����</th><th>���A</th></tr>${rows}</table><p>${n>0?`<a href="/admin?page=${n-1}">�W�@��</a> `:''}${(result.data||[]).length===50?`<a href="/admin?page=${n+1}">�U�@��</a>`:''}</p></section>${details}`);
  }
  if(request.method==='POST' && ['/admin/status','/admin/permission','/admin/role'].includes(path)){
    let f;try{f=await formValues(request)}catch{return errorPage('�ШD�榡�L�ġC',400)}
    const target=f.get('target')||'',pageNum=Number(f.get('page')||0);if(!UUID.test(target)||!Number.isInteger(pageNum)||pageNum<0||pageNum>2000)return errorPage('�b���榡�L�ġC',400);
    let r;
    if(path==='/admin/status'){
      const status=f.get('status'),raw=f.get('expiry')||'';if(!['pending','approved','disabled'].includes(status) || (raw&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)))return errorPage('��Ʈ榡�L�ġC',400);
      r=await client.rpc('ech_admin_set_status',{target,new_status:status,new_expiry:raw?raw+':00Z':null});
    } else if(path==='/admin/permission'){
      const tool=f.get('tool')||'',allowed=f.get('allowed'),until=f.get('valid_until')||'';if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(tool)||!['true','false'].includes(allowed)||(until&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(until)))return errorPage('��Ʈ榡�L�ġC',400);
      r=await client.rpc('ech_admin_set_permission',{target,requested_tool:tool,new_allowed:allowed==='true',new_valid_from:null,new_valid_until:until?until+':00Z':null});
    } else {
      const role=f.get('role');if(!['user','admin','owner'].includes(role))return errorPage('����L�ġC',400);
      r=await client.rpc('ech_admin_set_role',{target,new_role:role});
    }
    return r.error?errorPage('�ާ@���ѡA�нT�{�޲z�v���P��ơC',403):redirect('/admin?page='+pageNum+'&target='+encodeURIComponent(target));
  }
  return errorPage('���䴩���ާ@�C',405);
}

