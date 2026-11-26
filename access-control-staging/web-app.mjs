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
const errorPage = (message,status=403) => page('無法完成操作',`<section><p>${esc(message)}</p><p><a href="/">回到入口</a></p></section>`,status);
const sameOrigin = req => req.headers.get('origin') === new URL(req.url).origin;
// The administration form always uses Taiwan time, independent of the server locale.
const taipeiValue = value => {
  const ms=Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms+8*60*60*1000).toISOString().slice(0,16) : '';
};
const taipeiInstant = value => {
  if(!value)return null;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('invalid date');
  const ms=Date.parse(value+':00+08:00');
  if(!Number.isFinite(ms) || taipeiValue(new Date(ms).toISOString())!==value)throw Error('invalid date');
  return new Date(ms).toISOString();
};

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
const loginPage = message => page('工程計算工具中心｜登入',`<section><p>${esc(message || '請登入，帳號須經管理員核准後使用。')}</p><form method="post" action="/auth/login"><label>電子郵件 <input required type="email" name="email" autocomplete="username"></label><label>密碼 <input required type="password" name="password" autocomplete="current-password"></label><button>登入</button></form><form method="post" action="/auth/google"><button>使用 Google 登入</button></form><p><a href="/signup">申請帳號</a></p><small>測試環境：工具尚未正式開放。</small></section>`);
const signupPage = () => page('申請帳號',`<section><p>申請後需先驗證電子郵件，並由管理員核准。</p><form method="post" action="/auth/signup"><label>電子郵件 <input required type="email" name="email"></label><label>密碼 <input required minlength="10" type="password" name="password" autocomplete="new-password"></label><button>送出申請</button></form><p><a href="/login">回到登入</a></p></section>`);
const userToolbar = `<nav class="toolbar"><a href="/">工具入口</a><a href="/mfa">多因素驗證</a><a href="/admin">管理後台</a><form class="inline" method="post" action="/auth/logout"><button>登出</button></form></nav>`;

export async function route(request,{client,assets}) {
  const u=new URL(request.url), path=u.pathname;
  if(request.method==='GET' && path==='/login') return loginPage();
  if(request.method==='GET' && path==='/signup') return signupPage();
  if(request.method==='GET' && path==='/auth/callback') {
    const code=u.searchParams.get('code'); if(!code || code.length>512)return errorPage('登入連結無效。',400);
    const {error}=await client.auth.exchangeCodeForSession(code);
    return error ? errorPage('登入或驗證失敗，請重新操作。',400) : redirect('/');
  }
  if(request.method==='POST' && path.startsWith('/auth/')) {
    let form;try{form=await formValues(request)}catch{return errorPage('請求格式無效。',400)}
    if(path==='/auth/logout'){await client.auth.signOut({scope:'local'});return redirect('/login')}
    if(path==='/auth/google') {
      const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:u.origin+'/auth/callback'}});
      if(error || !data?.url)return errorPage('Google 登入尚未設定或暫時無法使用。',503);
      const dest=new URL(data.url); if(dest.protocol!=='https:' || !dest.hostname.endsWith('.supabase.co'))return errorPage('登入服務設定錯誤。',503);
      return redirect(dest.href);
    }
    if(path==='/auth/login'||path==='/auth/signup') {
      const email=form.get('email')||'',password=form.get('password')||'';
      if(email.length>254 || password.length>256 || !email.includes('@') || password.length<(path==='/auth/signup'?10:8))return errorPage('請檢查帳號及密碼格式。',400);
      if(path==='/auth/signup'){
        const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:u.origin+'/auth/callback'}});
        return error ? errorPage('無法送出申請，請稍後重試。',400) : page('申請已送出','<section><p>如帳號可使用，請查看驗證郵件並等待核准。</p><a href="/login">回到登入</a></section>');
      }
      const {error}=await client.auth.signInWithPassword({email,password});
      return error ? loginPage('登入失敗，請確認資料或稍後再試。') : redirect('/');
    }
    return errorPage('找不到頁面。',404);
  }
  const toolId=toolIdForPath(path);
  if(toolId && (request.method==='GET'||request.method==='HEAD')) {
    const claims=await identity(client);if(!claims)return errorPage('請先登入。',401);
    const {data,error}=await client.rpc('ech_has_tool_access',{requested_tool_id:toolId});
    if(error)return errorPage('授權服務暫時無法使用。',503);
    if(data!==true)return errorPage('此帳號尚未獲得此工具的授權。',403);
    if(!assets?.fetch)return errorPage('工具目前無法使用。',503);
    const source=await assets.fetch(request), h=new Headers(source.headers);
    h.set('cache-control','private, no-store, max-age=0');h.set('x-content-type-options','nosniff');h.set('referrer-policy','no-referrer');h.set('vary','Cookie');h.delete('set-cookie');
    return new Response(request.method==='HEAD'?null:source.body,{status:source.status,statusText:source.statusText,headers:h});
  }
  if(!['/','/admin','/mfa','/mfa/enroll','/mfa/verify','/admin/status','/admin/permission','/admin/role'].includes(path))return errorPage('找不到頁面。',404);
  if(!['GET','POST'].includes(request.method))return errorPage('不支援此操作。',405);
  const claims=await identity(client);if(!claims)return redirect('/login');
  const p=await profile(client,claims);if(!approved(p))return page('帳號尚未開通',`<section><p>帳號待核准、已停用或已過期，請聯絡管理員。</p><form method="post" action="/auth/logout"><button>登出</button></form></section>`,403);
  if(path==='/' && request.method==='GET') {
    const {data,error}=await client.from('ech_tools').select('tool_id,name').order('name');
    if(error)return errorPage('工具清單暫時無法取得。',503);
    const cards=(data||[]).filter(x=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(x.tool_id)).map(x=>`<article><a href="/tools/${esc(x.tool_id)}/">${esc(x.name)}</a></article>`).join('');
    return page('工程計算工具中心',`${userToolbar}<section><p>顯示已授權且已啟用的工具。</p><div class="tools">${cards||'<p>目前沒有可使用的工具。</p>'}</div></section>`);
  }
  if(path==='/mfa' && request.method==='GET'){
    const {data,error}=await client.auth.mfa.listFactors();if(error)return errorPage('無法讀取驗證設定。',503);
    const factor=(data?.totp||[]).find(f=>f.status==='verified');
    const body=factor?`<form method="post" action="/mfa/verify"><input type="hidden" name="factor_id" value="${esc(factor.id)}"><label>驗證碼 <input required inputmode="numeric" pattern="[0-9]{6}" name="code"></label><button>驗證</button></form>`:`<form method="post" action="/mfa/enroll"><button>啟用驗證器</button></form>`;
    return page('多因素驗證',`${userToolbar}<section><p>管理員需使用驗證器產生的驗證碼。</p>${body}</section>`);
  }
  if(path==='/mfa/enroll' && request.method==='POST'){
    try{await formValues(request)}catch{return errorPage('請求格式無效。',400)}
    const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'工程工具驗證器'});
    const qr=data?.totp?.qr_code||''; if(error || !UUID.test(data?.id||'') || !qr.startsWith('data:image/svg+xml'))return errorPage('無法建立驗證器。',503);
    return page('設定驗證器',`<section><p>請使用驗證器 App 掃描，再輸入六位數驗證碼。</p><img class="qr" alt="驗證器 QR code" src="${esc(qr)}"><form method="post" action="/mfa/verify"><input type="hidden" name="factor_id" value="${esc(data.id)}"><label>驗證碼 <input required inputmode="numeric" pattern="[0-9]{6}" name="code"></label><button>完成驗證</button></form></section>`);
  }
  if(path==='/mfa/verify' && request.method==='POST'){
    let f;try{f=await formValues(request)}catch{return errorPage('請求格式無效。',400)}
    const factorId=f.get('factor_id')||'',code=f.get('code')||'';if(!UUID.test(factorId)||!/^\d{6}$/.test(code))return errorPage('驗證碼格式錯誤。',400);
    const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});return error?errorPage('驗證未成功。',400):redirect('/admin');
  }
  if(!['owner','admin'].includes(p.role))return errorPage('沒有管理權限。',403);
  if(claims.aal!=='aal2')return page('需要多因素驗證',`${userToolbar}<section><p>請先完成驗證器驗證，再進入管理後台。</p><a href="/mfa">前往驗證</a></section>`,403);
  if(path==='/admin' && request.method==='GET'){
    const n=Number(u.searchParams.get('page')||0);if(!Number.isInteger(n)||n<0||n>2000)return errorPage('頁碼無效。',400);
    const result=await client.rpc('ech_admin_users',{page_size:50,page_offset:n*50});if(result.error)return errorPage('管理資料暫時無法取得。',503);
    const rows=(result.data||[]).map(x=>`<tr><td><a href="/admin?page=${n}&target=${encodeURIComponent(x.user_id)}">${esc(x.email)}</a></td><td>${esc(x.role)}</td><td>${esc(x.status)}</td></tr>`).join('');
    let details='',target=u.searchParams.get('target');
    if(target && UUID.test(target)){
      const selected=(result.data||[]).find(x=>x.user_id===target);
      if(selected){const r=await client.rpc('ech_admin_permissions',{target});if(r.error)return errorPage('權限資料暫時無法取得。',503);
        const tools=(r.data||[]).map(t=>`<tr><td>${esc(t.name)}</td><td>${t.enabled?'已啟用':'未啟用'}</td><td>${t.allowed?'允許':'未授權'}</td><td><form method="post" action="/admin/permission"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><input type="hidden" name="tool" value="${esc(t.tool_id)}"><label>到期日（台北時間 UTC+8，可留空）<input type="datetime-local" name="valid_until" value="${t.valid_until?esc(taipeiValue(t.valid_until)):''}"></label><button name="allowed" value="true">${t.allowed?'更新期限':'開放'}</button>${t.allowed?' <button name="allowed" value="false">取消授權</button>':''}</form></td></tr>`).join('');
        const options=['pending','approved','disabled'].map(s=>`<option value="${s}" ${s===selected.status?'selected':''}>${s}</option>`).join('');
        const roles=['user','admin','owner'].map(s=>`<option value="${s}" ${s===selected.role?'selected':''}>${s}</option>`).join('');
        const roleForm=p.role==='owner' && target!==claims.sub?`<form method="post" action="/admin/role"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><label>管理角色 <select name="role">${roles}</select></label><button>更新角色</button></form>`:'';
        details=`<section><h2>${esc(selected.email)} 的權限</h2><form method="post" action="/admin/status"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><label>帳號狀態 <select name="status">${options}</select></label><label>到期日（台北時間 UTC+8，留空為不限）<input type="datetime-local" name="expiry" value="${selected.expires_at?esc(taipeiValue(selected.expires_at)):''}"></label><button>更新狀態</button></form>${roleForm}<table><tr><th>工具</th><th>部署</th><th>授權</th><th>操作</th></tr>${tools}</table></section>`;
      }
    }
    return page('管理後台',`${userToolbar}<section><h2>帳號</h2><table><tr><th>電子郵件</th><th>角色</th><th>狀態</th></tr>${rows}</table><p>${n>0?`<a href="/admin?page=${n-1}">上一頁</a> `:''}${(result.data||[]).length===50?`<a href="/admin?page=${n+1}">下一頁</a>`:''}</p></section>${details}`);
  }
  if(request.method==='POST' && ['/admin/status','/admin/permission','/admin/role'].includes(path)){
    let f;try{f=await formValues(request)}catch{return errorPage('請求格式無效。',400)}
    const target=f.get('target')||'',pageNum=Number(f.get('page')||0);if(!UUID.test(target)||!Number.isInteger(pageNum)||pageNum<0||pageNum>2000)return errorPage('帳號格式無效。',400);
    let r;
    if(path==='/admin/status'){
      const status=f.get('status'),raw=f.get('expiry')||'';let expiry;try{expiry=taipeiInstant(raw)}catch{return errorPage('資料格式無效。',400)}
      if(!['pending','approved','disabled'].includes(status))return errorPage('資料格式無效。',400);
      r=await client.rpc('ech_admin_set_status',{target,new_status:status,new_expiry:expiry});
    } else if(path==='/admin/permission'){
      const tool=f.get('tool')||'',allowed=f.get('allowed'),until=f.get('valid_until')||'';let validUntil;try{validUntil=taipeiInstant(until)}catch{return errorPage('資料格式無效。',400)}
      if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(tool)||!['true','false'].includes(allowed))return errorPage('資料格式無效。',400);
      r=await client.rpc('ech_admin_set_permission',{target,requested_tool:tool,new_allowed:allowed==='true',new_valid_from:null,new_valid_until:validUntil});
    } else {
      const role=f.get('role');if(!['user','admin','owner'].includes(role))return errorPage('角色無效。',400);
      r=await client.rpc('ech_admin_set_role',{target,new_role:role});
    }
    return r.error?errorPage('操作失敗，請確認管理權限與資料。',403):redirect('/admin?page='+pageNum+'&target='+encodeURIComponent(target));
  }
  return errorPage('不支援此操作。',405);
}
