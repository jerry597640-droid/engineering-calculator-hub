// Staging application core. A verified Supabase SSR client is injected per request.
// No service-role key, browser-side permission decision, or public tool fallback.
import { toolIdForPath } from './gateway.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const headers = {'cache-control':'private, no-store, max-age=0','content-type':'text/html; charset=utf-8',
  'x-content-type-options':'nosniff','referrer-policy':'same-origin','x-frame-options':'DENY',
  'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const CSS = `:root{--bg:#f3f5f8;--surface:#fff;--border:#dde4ec;--border-strong:#c4d0dc;--text:#1c2b3d;--muted:#5f6f82;--primary:#1d4e75;--primary-hover:#163d5c;--primary-soft:#e8f0f7;--link:#135d87;--danger:#b42318;--danger-soft:#fef3f2;--warn:#93370d;--warn-soft:#fffaeb;--radius:12px;--radius-sm:8px;--ring:0 0 0 3px rgba(29,78,117,.22);--shadow:0 1px 2px rgba(16,24,40,.04),0 4px 16px rgba(16,24,40,.06)}*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}h1,h2,h3{line-height:1.3;margin:0 0 .5em}h1{font-size:1.6rem}h2{font-size:1.25rem}p{margin:.5em 0}a{color:var(--link);text-underline-offset:3px}a:hover{color:var(--primary-hover)}:focus-visible{outline:none;box-shadow:var(--ring);border-radius:4px}small{color:var(--muted)}main{max-width:1040px;margin:0 auto;padding:32px 20px 48px}section,article{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;margin:16px 0;box-shadow:var(--shadow)}label{display:block;margin:0 0 16px;font-weight:600;font-size:.92rem}input,select,textarea{font:inherit;color:inherit;padding:10px 12px;min-height:44px;background:#fff;border:1px solid var(--border-strong);border-radius:var(--radius-sm);transition:border-color .15s,box-shadow .15s}input:hover,select:hover{border-color:#9fb1c3}input:focus,select:focus,textarea:focus{outline:none;border-color:var(--primary);box-shadow:var(--ring)}input:user-invalid{border-color:var(--danger)}.hint{display:block;margin-top:6px;font-size:.82rem;font-weight:400;color:var(--muted)}button,.btn{font:inherit;font-weight:600;min-height:44px;padding:10px 18px;border-radius:var(--radius-sm);border:1px solid var(--primary);background:var(--primary);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;transition:background .15s}button:hover,.btn:hover{background:var(--primary-hover);color:#fff}button:disabled{opacity:.55;cursor:not-allowed}.btn-secondary{background:#fff;color:var(--text);border-color:var(--border-strong)}.btn-secondary:hover{background:#f6f8fa;color:var(--text)}.alert{padding:12px 14px;border-radius:var(--radius-sm);margin:0 0 16px;font-size:.92rem;border:1px solid}.alert-info{background:var(--primary-soft);border-color:#c5d8ea;color:var(--primary)}.alert-error{background:var(--danger-soft);border-color:#fecdca;color:var(--danger)}.badge{display:inline-block;font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:999px;background:#eef2f6;color:var(--muted)}.env-banner{background:var(--warn-soft);color:var(--warn);border-bottom:1px solid #fedf89;text-align:center;font-size:.85rem;padding:8px 16px}.auth{min-height:calc(100vh - 38px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px}.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:20px;color:var(--text);text-decoration:none}.auth-logo{width:40px;height:40px;border-radius:10px;background:var(--primary);color:#fff;display:grid;place-items:center}.auth-brand strong{font-size:1.1rem}.auth-card{width:100%;max-width:420px;margin:0;padding:32px}.auth-card h1{font-size:1.4rem;margin-bottom:4px}.auth-card .lead{color:var(--muted);margin:0 0 24px;font-size:.93rem}.auth-card label input{display:block;width:100%;margin-top:6px;font-weight:400}.auth-card form button{width:100%;margin-top:4px}.auth-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.auth-row a{font-size:.85rem;font-weight:400}.divider{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:.82rem;margin:20px 0}.divider::before,.divider::after{content:"";flex:1;height:1px;background:var(--border)}.auth-foot{text-align:center;margin:20px 0 0;font-size:.92rem;color:var(--muted)}.steps{margin:20px 0 0;padding-left:1.2em;font-size:.82rem;color:var(--muted)}table{border-collapse:collapse;width:100%;font-size:.93rem}th{font-size:.82rem;color:var(--muted);background:#f8fafc}td,th{text-align:left;padding:12px;border-bottom:1px solid var(--border);vertical-align:middle}tbody tr:hover{background:#f8fafc}.tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}.tools article{margin:0;transition:border-color .15s,box-shadow .15s,transform .15s}.tools article:hover{border-color:#a9bfd3;box-shadow:0 6px 20px rgba(16,24,40,.08);transform:translateY(-2px)}.toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}form.inline{display:inline-block;margin:4px}.qr{max-width:220px;border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;background:#fff}@media (max-width:480px){main{padding:20px 12px}section,article{padding:18px}.auth-card{padding:24px 20px;box-shadow:none}}@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
const doc = (title,inner,status) => new Response(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body>${inner}</body></html>`,{status,headers});
const page = (title,body,status=200) => doc(title,`<main><h1>${esc(title)}</h1>${body}</main>`,status);
const LOGO = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h2M14 18h2"/></svg>';
// 帳號相關頁面（登入／申請／重設）：置中卡片版面；body 內容為受信任的靜態 HTML
const authPage = (title,heading,body,status=200) => doc(title,`<div class="env-banner" role="status">⚠ 測試環境：工具尚未正式開放</div><main class="auth"><a class="auth-brand" href="/login"><span class="auth-logo">${LOGO}</span><strong>工程計算工具中心</strong></a><section class="auth-card"><h1>${esc(heading)}</h1>${body}</section></main>`,status);
const redirect = location => new Response(null,{status:303,headers:{...headers,location}});
const recoveryCookie = (response,clear=false) => {
  const h=new Headers(response.headers);
  h.append('set-cookie','__Host-ech-recovery='+(clear?'':'1')+'; Path=/; Max-Age='+(clear?'0':'1800')+'; HttpOnly; Secure; SameSite=Lax');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
};
const hasRecoveryCookie = request => {
  const matches=(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('__Host-ech-recovery='));
  return matches.length===1 && matches[0]==='__Host-ech-recovery=1';
};
const errorPage = (message,status=403) => page('無法完成操作',`<section><p>${esc(message)}</p><p><a href="/">回到入口</a></p></section>`,status);
const callbackError = () => page('登入連結無法使用','<section><p>連結可能已過期、已使用，或無法在目前的瀏覽器完成驗證。請在原本申請的同一台裝置及瀏覽器重新操作，並只開啟最新的郵件。</p><p><a href="/forgot-password">重新申請密碼重設</a> · <a href="/login">回到登入</a> · <a href="/signup">重新申請帳號</a></p></section>',400);
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

async function formValues(req,{allowMultiple=[]}={}) {
  if (!sameOrigin(req) || !(req.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) throw new Error('bad request');
  const reader=req.body?.getReader(); let size=0, parts=[];
  if(reader) for (;;) { const {value,done}=await reader.read(); if(done)break; size+=value.byteLength; if(size>16384){await reader.cancel();throw Error('too large')} parts.push(value); }
  const bytes=new Uint8Array(size);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.byteLength}
  const params=new URLSearchParams(new TextDecoder().decode(bytes));
  for(const key of new Set(params.keys()))if(params.getAll(key).length!==1 && !allowMultiple.includes(key))throw Error('duplicate field');
  return params;
}
const searchValue = value => {
  const text=(value||'').trim();
  if(text.length>254 || /[\u0000-\u001f\u007f]/.test(text))throw Error('invalid search');
  return text;
};
const adminUrl = (pageNumber,search,target) => {
  const q=new URLSearchParams({page:String(pageNumber)});
  if(search)q.set('q',search);
  if(target)q.set('target',target);
  return '/admin?'+q.toString();
};

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
const loginPage = message => authPage('工程計算工具中心｜登入','登入',`<p class="lead">帳號須經管理員核准後才能使用。</p>${message?`<div class="alert alert-error" role="alert">${esc(message)}</div>`:''}<form method="post" action="/auth/login"><label>電子郵件<input required type="email" name="email" autocomplete="username" placeholder="name@company.com" autofocus></label><label><span class="auth-row"><span>密碼</span><a href="/forgot-password">忘記密碼？</a></span><input required type="password" name="password" autocomplete="current-password"></label><button>登入</button></form><div class="divider">或</div><button type="button" class="btn-secondary" style="width:100%" disabled>使用 Google 帳號登入 <span class="badge">即將開放</span></button><p class="auth-foot">還沒有帳號？<a href="/signup">申請帳號</a></p>`);
const signupPage = () => authPage('申請帳號','申請帳號',`<p class="lead">送出後請先驗證電子郵件，再等候管理員核准。</p><form method="post" action="/auth/signup"><label>電子郵件<input required type="email" name="email" autocomplete="email" placeholder="name@company.com" autofocus></label><label>密碼<input required minlength="10" type="password" name="password" autocomplete="new-password" aria-describedby="pw-hint"><span class="hint" id="pw-hint">至少 10 個字元</span></label><button>送出申請</button></form><ol class="steps"><li>送出申請</li><li>點擊驗證信中的連結</li><li>管理員核准後即可登入</li></ol><p class="auth-foot">已經有帳號？<a href="/login">回到登入</a></p>`);
const userToolbar = `<nav class="toolbar"><a href="/">工具入口</a><a href="/mfa">多因素驗證</a><a href="/admin">管理後台</a><form class="inline" method="post" action="/auth/logout"><button>登出</button></form></nav>`;
const forgotPage = () => authPage('重設密碼','重設密碼',`<p class="lead">輸入註冊時的電子郵件，我們會寄送重設連結給你。</p><div class="alert alert-info">請用<strong>目前這個瀏覽器</strong>開啟郵件中的重設連結，否則連結會失效。</div><form method="post" action="/auth/request-reset"><label>電子郵件<input required type="email" name="email" autocomplete="username" placeholder="name@company.com" autofocus></label><button>寄送重設連結</button></form><p class="auth-foot"><a href="/login">← 回到登入</a></p>`);
const resetPage = () => authPage('設定新密碼','設定新密碼',`<p class="lead">請設定至少 10 個字元的新密碼。</p><form method="post" action="/auth/reset-password"><label>新密碼<input required minlength="10" maxlength="256" type="password" name="password" autocomplete="new-password" autofocus></label><label>再次輸入新密碼<input required minlength="10" maxlength="256" type="password" name="confirm" autocomplete="new-password"></label><button>更新密碼</button></form>`);

export async function route(request,{client,assets}) {
  const u=new URL(request.url), path=u.pathname;
  if(request.method==='GET' && path==='/login') return recoveryCookie(loginPage(),true);
  if(request.method==='GET' && path==='/signup') return recoveryCookie(signupPage(),true);
  if(request.method==='GET' && path==='/forgot-password')return forgotPage();
  if(request.method==='GET' && path==='/reset-password'){
    const claims=await identity(client);return claims?resetPage():redirect('/login');
  }
  if(request.method==='GET' && path==='/auth/callback') {
    const code=u.searchParams.get('code'); if(!code || code.length>512)return recoveryCookie(callbackError(),true);
    const {data,error}=await client.auth.exchangeCodeForSession(code);
    return error ? recoveryCookie(callbackError(),true) :
      recoveryCookie(redirect(data?.redirectType==='recovery'||hasRecoveryCookie(request)?'/reset-password':'/'),true);
  }
  if(request.method==='POST' && path.startsWith('/auth/')) {
    let form;try{form=await formValues(request)}catch{return errorPage('請求格式無效。',400)}
    if(path==='/auth/logout'){await client.auth.signOut({scope:'local'});return redirect('/login')}
    if(path==='/auth/request-reset'){
      const email=form.get('email')||'';if(email.length>254||!email.includes('@'))return errorPage('請檢查電子郵件格式。',400);
      await client.auth.resetPasswordForEmail(email,{redirectTo:u.origin+'/auth/callback'});
      return recoveryCookie(page('請查看電子郵件','<section><p>若帳號存在且寄信服務可用，您會收到重設連結。請用相同瀏覽器開啟；若未收到，請稍後再試。</p><a href="/login">回到登入</a></section>'));
    }
    if(path==='/auth/reset-password'){
      const claims=await identity(client),password=form.get('password')||'',confirm=form.get('confirm')||'';
      if(!claims)return errorPage('請先使用重設連結登入。',401);
      if(password.length<10||password.length>256||password!==confirm)return errorPage('請確認兩次輸入相同且至少 10 個字元。',400);
      const {error}=await client.auth.updateUser({password});
      if(error?.code==='same_password')return page('無法更新密碼','<section><p>新密碼必須與原密碼不同，請換一組至少 10 個字元的密碼。</p><a href="/reset-password">重新設定密碼</a></section>',400);
      if(error?.code==='weak_password')return page('無法更新密碼','<section><p>此密碼不符合安全設定，請換一組較強且未重複使用的密碼。</p><a href="/reset-password">重新設定密碼</a></section>',400);
      if(error)return page('無法更新密碼','<section><p>密碼更新失敗，請重新申請重設連結。</p><a href="/forgot-password">重新申請重設連結</a></section>',400);
      const signedOut=await client.auth.signOut({scope:'global'});
      if(signedOut.error)return recoveryCookie(errorPage('密碼已更新，但無法登出其他裝置，請聯絡管理員。',503),true);
      return recoveryCookie(page('密碼已更新','<section><p>請使用新密碼重新登入。</p><a href="/login">前往登入</a></section>'),true);
    }
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
  if(!['/','/admin','/admin/audit','/mfa','/mfa/enroll','/mfa/verify','/admin/status','/admin/permission','/admin/permission-batch/preview','/admin/permission-batch','/admin/role'].includes(path))return errorPage('找不到頁面。',404);
  if(!['GET','POST'].includes(request.method))return errorPage('不支援此操作。',405);
  const claims=await identity(client);if(!claims)return redirect('/login');
  const p=await profile(client,claims);if(!approved(p))return page('帳號尚未開通',`<section><p>帳號待核准、已停用或已過期，請聯絡管理員。</p><form method="post" action="/auth/logout"><button>登出</button></form></section>`,403);
  if(path==='/' && request.method==='GET') {
    const {data,error}=await client.from('ech_tools').select('tool_id,name').order('name');
    if(error)return errorPage('工具清單暫時無法取得。',503);
    const cards=(data||[]).filter(x=>/^[a-z0-9][a-z0-9-]{0,79}$/.test(x.tool_id)).map(x=>`<article><a href="/tools/${esc(x.tool_id)}/">${esc(x.name)}</a></article>`).join('');
    return page('工程計算工具中心｜測試版',`${userToolbar}<section><strong>測試環境</strong><p>部分工具目前僅完成頁面載入檢查；工程案例、匯出及手機操作仍需逐項驗證。</p></section><section><p>顯示已授權且已啟用的工具。</p><div class="tools">${cards||'<p>目前沒有可使用的工具。</p>'}</div></section>`);
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
    let search;try{search=searchValue(u.searchParams.get('q'))}catch{return errorPage('搜尋條件無效。',400)}
    const result=search?await client.rpc('ech_admin_search_users',{search_text:search,page_size:50,page_offset:n*50}):
      await client.rpc('ech_admin_users',{page_size:50,page_offset:n*50});
    if(result.error)return errorPage('管理資料暫時無法取得。',503);
    const rows=(result.data||[]).map(x=>`<tr><td><a href="${esc(adminUrl(n,search,x.user_id))}">${esc(x.email)}</a></td><td>${esc(x.role)}</td><td>${esc(x.status)}</td></tr>`).join('');
    let details='',target=u.searchParams.get('target');
    if(target && UUID.test(target)){
      const selected=(result.data||[]).find(x=>x.user_id===target);
      if(selected){const r=await client.rpc('ech_admin_permissions',{target});if(r.error)return errorPage('權限資料暫時無法取得。',503);
        const common=`<input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><input type="hidden" name="q" value="${esc(search)}">`;
        const tools=(r.data||[]).map(t=>`<tr><td><input type="checkbox" form="batch-permissions" name="tools" value="${esc(t.tool_id)}" aria-label="選取 ${esc(t.name)}"></td><td>${esc(t.name)}</td><td>${t.enabled?'已啟用':'未啟用'}</td><td>${t.allowed?'允許':'未授權'}</td><td><form method="post" action="/admin/permission">${common}<input type="hidden" name="tool" value="${esc(t.tool_id)}"><label>到期日（台北時間 UTC+8，可留空）<input type="datetime-local" name="valid_until" value="${t.valid_until?esc(taipeiValue(t.valid_until)):''}"></label><button name="allowed" value="true">${t.allowed?'更新期限':'開放'}</button>${t.allowed?' <button name="allowed" value="false">取消授權</button>':''}</form></td></tr>`).join('');
        const options=['pending','approved','disabled'].map(s=>`<option value="${s}" ${s===selected.status?'selected':''}>${s}</option>`).join('');
        const roles=['user','admin','owner'].map(s=>`<option value="${s}" ${s===selected.role?'selected':''}>${s}</option>`).join('');
        const roleForm=p.role==='owner' && target!==claims.sub?`<form method="post" action="/admin/role">${common}<label>管理角色 <select name="role">${roles}</select></label><button>更新角色</button></form>`:'';
        const batch=`<form id="batch-permissions" method="post" action="/admin/permission-batch/preview">${common}<p>勾選工具後預覽授權異動。全部開放只影響目前已啟用的工具，未來新增工具仍須另外授權。</p><label>批次授權到期日（台北時間，可留空）<input type="datetime-local" name="valid_until"></label><button name="operation" value="grant-selected">預覽開放勾選</button> <button name="operation" value="revoke-selected">預覽取消勾選</button> <button name="operation" value="grant-enabled">預覽開放全部已啟用工具</button> <button name="operation" value="revoke-all">預覽取消全部工具</button></form>`;
        details=`<section><h2>${esc(selected.email)} 的權限</h2><form method="post" action="/admin/status">${common}<label>帳號狀態 <select name="status">${options}</select></label><label>到期日（台北時間 UTC+8，留空為不限）<input type="datetime-local" name="expiry" value="${selected.expires_at?esc(taipeiValue(selected.expires_at)):''}"></label><button>更新狀態</button></form>${roleForm}${batch}<table><tr><th>勾選</th><th>工具</th><th>部署</th><th>授權</th><th>操作</th></tr>${tools}</table></section>`;
      }
    }
    return page('管理後台',`${userToolbar}<section><h2>帳號</h2>${p.role==='owner'?'<p><a href="/admin/audit">查看管理異動紀錄</a></p>':''}<form method="get" action="/admin"><label>搜尋電子郵件或姓名 <input name="q" maxlength="254" value="${esc(search)}"></label><button>搜尋</button> <a href="/admin">清除搜尋</a></form><table><tr><th>電子郵件</th><th>角色</th><th>狀態</th></tr>${rows}</table><p>${n>0?`<a href="${esc(adminUrl(n-1,search))}">上一頁</a> `:''}${(result.data||[]).length===50?`<a href="${esc(adminUrl(n+1,search))}">下一頁</a>`:''}</p></section>${details}`);
  }
  if(path==='/admin/audit' && request.method==='GET'){
    if(p.role!=='owner')return errorPage('只有擁有者可查看管理紀錄。',403);
    const n=Number(u.searchParams.get('page')||0);if(!Number.isInteger(n)||n<0||n>2000)return errorPage('頁碼無效。',400);
    const r=await client.rpc('ech_admin_audit',{page_size:50,page_offset:n*50});if(r.error)return errorPage('管理紀錄暫時無法取得。',503);
    const rows=(r.data||[]).map(x=>`<tr><td>${esc(taipeiValue(x.created_at))}</td><td>${esc(x.action)}</td><td>${esc(x.actor_id||'')}</td><td>${esc(x.target_user_id||'')}</td><td>${esc(x.target_tool_id||'')}</td><td>${esc(JSON.stringify(x.detail||{}))}</td></tr>`).join('');
    return page('管理異動紀錄',`${userToolbar}<section><p>時間顯示為台北時間；僅擁有者可查看。</p><table><tr><th>時間</th><th>操作</th><th>操作者</th><th>對象</th><th>工具</th><th>異動內容</th></tr>${rows}</table><p>${n>0?`<a href="/admin/audit?page=${n-1}">上一頁</a> `:''}${(r.data||[]).length===50?`<a href="/admin/audit?page=${n+1}">下一頁</a>`:''}</p></section>`);
  }
  if(path==='/admin/permission-batch/preview' && request.method==='POST'){
    let f;try{f=await formValues(request,{allowMultiple:['tools']})}catch{return errorPage('請求格式無效。',400)}
    const target=f.get('target')||'',n=Number(f.get('page')||0),operation=f.get('operation')||'',raw=f.get('valid_until')||'';
    let search;try{search=searchValue(f.get('q'));taipeiInstant(raw)}catch{return errorPage('資料格式無效。',400)}
    if(!UUID.test(target)||!Number.isInteger(n)||n<0||n>2000||!['grant-selected','revoke-selected','grant-enabled','revoke-all'].includes(operation))return errorPage('資料格式無效。',400);
    const r=await client.rpc('ech_admin_permissions',{target});if(r.error)return errorPage('權限資料暫時無法取得。',503);
    const available=r.data||[],requested=f.getAll('tools');
    const chosen=operation==='grant-enabled'?available.filter(t=>t.enabled).map(t=>t.tool_id):
      operation==='revoke-all'?available.map(t=>t.tool_id):requested;
    if(!chosen.length||chosen.length>100||new Set(chosen).size!==chosen.length||
      chosen.some(id=>!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)||!available.some(t=>t.tool_id===id)))return errorPage('請選取有效的工具。',400);
    const allowed=operation.startsWith('grant-');
    const names=chosen.map(id=>{const t=available.find(x=>x.tool_id===id);return `<li>${esc(t.name)}（${t.enabled?'已啟用':'未啟用'}）</li>`}).join('');
    const hidden=chosen.map(id=>`<input type="hidden" name="tools" value="${esc(id)}">`).join('');
    const date=allowed&&raw?raw:'';
    return page('確認批次授權',`${userToolbar}<section><p>將對此帳號${allowed?'開放':'取消'}以下 ${chosen.length} 個工具的個別授權：</p><ul>${names}</ul><p>${allowed?(date?'到期日：'+esc(date.replace('T',' '))+'（台北時間）':'到期日：不限'):'取消後，新的受控資源請求會被拒絕。'}</p><form method="post" action="/admin/permission-batch"><input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="page" value="${n}"><input type="hidden" name="q" value="${esc(search)}"><input type="hidden" name="allowed" value="${allowed}"><input type="hidden" name="valid_until" value="${esc(date)}">${hidden}<button>確認執行</button> <a href="${esc(adminUrl(n,search,target))}">返回修改</a></form></section>`);
  }
  if(path==='/admin/permission-batch' && request.method==='POST'){
    let f;try{f=await formValues(request,{allowMultiple:['tools']})}catch{return errorPage('請求格式無效。',400)}
    const target=f.get('target')||'',n=Number(f.get('page')||0),allowed=f.get('allowed'),tools=f.getAll('tools');
    let search,until;try{search=searchValue(f.get('q'));until=taipeiInstant(f.get('valid_until')||'')}catch{return errorPage('資料格式無效。',400)}
    if(!UUID.test(target)||!Number.isInteger(n)||n<0||n>2000||!['true','false'].includes(allowed)||
      !tools.length||tools.length>100||new Set(tools).size!==tools.length||tools.some(id=>!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)))return errorPage('資料格式無效。',400);
    const r=await client.rpc('ech_admin_set_permissions',{target,requested_tools:tools,new_allowed:allowed==='true',new_valid_until:allowed==='true'?until:null});
    return r.error?errorPage('操作失敗，請確認管理權限與資料。',403):redirect(adminUrl(n,search,target));
  }
  if(request.method==='POST' && ['/admin/status','/admin/permission','/admin/role'].includes(path)){
    let f;try{f=await formValues(request)}catch{return errorPage('請求格式無效。',400)}
    const target=f.get('target')||'',pageNum=Number(f.get('page')||0);if(!UUID.test(target)||!Number.isInteger(pageNum)||pageNum<0||pageNum>2000)return errorPage('帳號格式無效。',400);
    let search;try{search=searchValue(f.get('q'))}catch{return errorPage('搜尋條件無效。',400)}
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
    return r.error?errorPage('操作失敗，請確認管理權限與資料。',403):redirect(adminUrl(pageNum,search,target));
  }
  return errorPage('不支援此操作。',405);
}
