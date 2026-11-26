const APPROVALS = "xj_r4_staging_project_grants";
const SESSION = "__Host-xj-r4-staging";
const PENDING = "__Host-xj-r4-mfa";
const PROJECTS = Object.freeze([
  { code: "R4-DEMO-A", name: "協作驗收專案 A", rows: [
    ["DEMO-RFI-01", "檢查梁孔圖面位置", "待回覆"],
    ["DEMO-RFI-02", "確認結構圖與模型版次", "已回覆"],
  ] },
  { code: "R4-DEMO-B", name: "未授權隔離測試專案 B", rows: [
    ["DEMO-RFI-03", "測試專案隔離樣本", "待回覆"],
  ] },
]);
const ROLES = Object.freeze({ viewer: "檢視者", admin: "測試管理者" });
const STYLES = `
:root{font-family:system-ui,"Noto Sans TC",sans-serif;color:#342522;background:#f5efe7;line-height:1.55}
*{box-sizing:border-box}body{margin:0;min-height:100vh}header{max-width:66rem;padding:22px 22px 0;margin:auto;display:flex;justify-content:space-between;align-items:center;gap:1rem}.mark{width:92px;height:auto;display:block}.flag{background:#eddfd3;color:#624438;padding:5px 10px;border-radius:99px;font-size:.78rem;font-weight:700}
main{max-width:42rem;margin:7vh auto;padding:0 20px}.wide{max-width:66rem}.card{background:#fffaf4;border:1px solid #e2d3c5;border-top:4px solid #ae5a3e;padding:clamp(23px,5vw,40px);border-radius:18px;box-shadow:0 16px 46px #64443011}
h1{font-size:clamp(1.65rem,4.5vw,2.35rem);line-height:1.18;margin:.35em 0 .5em;letter-spacing:-.035em}h2{font-size:1.15rem;margin:0 0 .4em}.eyebrow{color:#8b4a37;letter-spacing:.11em;font-size:.82rem;font-weight:800}.desc,.muted{color:#6f584f}.muted{font-size:.88rem}.form{margin:1.4rem 0 .8rem;display:grid;gap:.35rem}label{font-weight:700;margin:.25rem 0 0}input{font:inherit;background:#fff;border:1px solid #ad9589;color:inherit;border-radius:9px;padding:.76rem;width:100%;min-width:0;margin:0 0 .32rem}.password{display:flex;align-items:baseline;gap:.5rem}.password button{flex:none}.main-btn,.quiet,a.button{font:inherit;border-radius:9px;padding:.72rem .85rem;cursor:pointer;text-align:center;text-decoration:none;font-weight:700}.main-btn{margin:.5rem 0;background:#92452e;color:white;border:1px solid #92452e}.quiet,a.button{color:#713c2d;background:#fff5eb;border:1px solid #c3a596}.main-btn:hover{background:#753b2b}.quiet:hover,a.button:hover{background:#f4e1d3}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #923f26;outline-offset:2px}a{color:#713c2d}.msg{border:1px solid #e4ac93;border-radius:9px;background:#fbeddf;padding:.64rem .8rem;color:#762c18}.note{margin:1.15rem 0 0;border-top:1px solid #ecded2;padding-top:.9rem;color:#654f44}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px}.project-card{border:1px solid #e5d3c6;padding:16px;border-radius:11px}.chip{font-size:.8rem;color:#713d2e;background:#f4e3d8;border-radius:7px;padding:3px 7px;white-space:nowrap}.row{padding:0;list-style:none}.row li{padding:12px 0;border-bottom:1px solid #e8dbd1}.row li:last-child{border-bottom:none}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:1.4rem}footer{margin:12px auto;text-align:center;padding:0 20px;color:#735e53;font-size:.8rem}
@media(max-width:500px){main{margin:5vh auto}.flag{font-size:.72rem}.card{border-radius:14px}.row .chip{display:inline-block}}
`;
const SCRIPT = `const b=document.getElementById('show'),p=document.getElementById('password');if(b&&p)b.addEventListener('click',()=>{const show=p.type==='password';p.type=show?'text':'password';b.textContent=show?'隱藏':'顯示';b.setAttribute('aria-pressed',String(show));});`;
const LOGIN = `<span class="eyebrow">XJTC 工程協作中心</span><h1>登入 R4 測試入口</h1><p class="desc">請使用工程工具管控平台的既有帳號。登入後，R4 會另外檢查你的專案權限。</p>`;
const NOTE = `<p class="note muted">本入口只使用獨立測試資料，不連接正式 R4 專案、附件或 RFI。</p>`;
const BRAND = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"190 176 1394 320\">\n  <title>XJTC</title>\n  <defs>\n    <linearGradient id=\"copper\" x2=\".78\" y2=\"1\" gradientUnits=\"objectBoundingBox\">\n      <stop stop-color=\"#e06424\"/>\n      <stop offset=\"1\" stop-color=\"#c7480b\"/>\n    </linearGradient>\n    <linearGradient id=\"fold-x\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">\n      <stop offset=\".42\" stop-color=\"#d95913\"/>\n      <stop offset=\".56\" stop-color=\"#9f360a\"/>\n      <stop offset=\".74\" stop-color=\"#d54804\"/>\n    </linearGradient>\n    <linearGradient id=\"fold-t\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\">\n      <stop stop-color=\"#d85010\"/>\n      <stop offset=\"1\" stop-color=\"#943107\"/>\n    </linearGradient>\n    <linearGradient id=\"fold-c\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\".55\">\n      <stop stop-color=\"#96330a\"/>\n      <stop offset=\".70\" stop-color=\"#ce4b11\"/>\n    </linearGradient>\n  </defs>\n  <path fill=\"url(#fold-x)\" d=\"M198 181h94l224 302h-97z\"/>\n  <path fill=\"url(#copper)\" d=\"M423 181h89L283 483h-90zM723 181h81v174c0 87-44 135-117 135-55 0-89-25-107-74l56-30c11 23 28 35 46 35 29 0 41-25 41-63z\"/>\n  <path fill=\"url(#fold-t)\" d=\"M947 181h166c-46 7-81 28-104 59h-80c-19 0-34 8-41 22-3-42 20-81 59-81z\"/>\n  <path fill=\"url(#copper)\" d=\"M1117 181h119l-33 37c-14 16-31 23-50 23h-57v184c0 35-18 58-51 58h-69c18-8 28-24 28-48V295c0-58 50-104 113-114zM1405 181h171l-45 45c-12 11-24 17-42 17h-61c-52 0-99 43-99 91 0 49 42 87 88 87h77c20 0 34 5 48 21l37 43h-184c-81 0-150-63-150-143 0-83 72-161 160-161z\"/>\n  <path fill=\"url(#fold-c)\" d=\"M1329 333c0 49 42 88 88 88h77c20 0 34 5 48 21l37 43h-180c-51-2-86-41-84-91 0-22 5-43 14-61z\"/>\n</svg>\n";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const jwt = /^[\w-]+\.[\w-]+\.[\w-]+$/;
const escape = (s) => String(s).replace(/[&<>"']/g, (x) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[x]);
function response(body, status, contentType, extra = []) {
  const h = new Headers({
    "Content-Type":contentType,"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff",
    "Content-Security-Policy":"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    "Referrer-Policy":"no-referrer","X-Frame-Options":"DENY","X-Robots-Tag":"noindex, nofollow",
    "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  });
  for(const [k,v] of extra) h.append(k,v);
  return new Response(body,{status,headers:h});
}
function page(content,{title="工程協作中心 R4",status=200,cookies=[],wide=false}={}) {
  return response(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}｜XJTC</title><link rel="stylesheet" href="/ui.css"><script src="/ui.js" defer></script></head><body><header><img class="mark" src="/xjtc.svg" alt="XJTC" width="92" height="22"><span class="flag">獨立測試環境</span></header><main class="${wide?"wide":""}"><section class="card">${content}</section></main><footer>學靜技術顧問有限公司 · R4 共用帳號試辦</footer></body></html>`,status,"text/html; charset=utf-8",cookies.map(x=>["Set-Cookie",x]));
}
function msg(s){return s?`<p class="msg" role="alert">${escape(s)}</p>`:"";}
function login(alert="",status=200,cookies=[]) {
  return page(`${LOGIN}${msg(alert)}<form class="form" method="post" action="/auth/login"><label for="email">帳號（電子郵件）</label><input id="email" name="email" type="email" autocomplete="username" maxlength="254" required><label for="password">密碼</label><div class="password"><input id="password" name="password" type="password" autocomplete="current-password" maxlength="512" required><button class="quiet" type="button" id="show" aria-controls="password" aria-pressed="false">顯示</button></div><button class="main-btn" type="submit">登入測試平台</button></form>${NOTE}`,{title:"登入 R4 測試入口",status,cookies});
}
function mfa(alert="",status=200,cookies=[]) {
  return page(`<span class="eyebrow">帳號驗證 · 第 2 步</span><h1>輸入手機驗證碼</h1><p class="desc">請開啟原本的驗證器，輸入目前顯示的 6 位數。</p>${msg(alert)}<form class="form" method="post" action="/auth/mfa"><label for="code">6 位數驗證碼</label><input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required><button class="main-btn" type="submit">驗證並進入 R4</button></form><a href="/login">回登入畫面</a>${NOTE}`,{title:"驗證手機驗證碼",status,cookies});
}
const logout = '<form method="post" action="/auth/logout"><button class="quiet" type="submit">登出 R4</button></form>';
function blocked(noProject=false) {
  return page(`<span class="eyebrow">R4 授權檢查</span><h1>${noProject?"沒有這個專案的權限":"已驗證帳號，但未開通 R4"}</h1><p class="desc">工程工具管控平台的權限不會自動套用到 R4。需要查看時，請向 R4 管理者申請。</p><div class="actions">${noProject?'<a class="button" href="/workspace">回測試工作區</a>':""}${logout}</div>${NOTE}`,{status:403,title:"R4 未授權"});
}
function workspace(grants) {
  return page(`<span class="eyebrow">R4 測試工作區</span><h1>登入成功</h1><p class="desc">身分已驗證。這裡只列出 R4 另外授權的測試專案。</p><div class="grid">${PROJECTS.filter(p=>grants.has(p.code)).map(p=>`<article class="project-card"><span class="chip">${ROLES[grants.get(p.code)]}</span><h2>${p.name}</h2><p class="muted">${p.code} · 示範 RFI</p><a href="/workspace/${p.code}">開啟專案 →</a></article>`).join("")}</div><div class="actions">${logout}</div>${NOTE}`,{wide:true,title:"R4 測試工作區"});
}
function projectPage(p,role) {
  return page(`<span class="eyebrow">${p.code} · 示範專案</span><h1>${p.name}</h1><p class="desc">你的權限為「${ROLES[role]}」。本試辦不開放編輯，以下不是正式 RFI。</p><ul class="row">${p.rows.map(([id,title,status])=>`<li><strong>${id}</strong>　${title}　<span class="chip">${status}</span></li>`).join("")}</ul><div class="actions"><a class="button" href="/workspace">回測試工作區</a>${logout}</div>${NOTE}`,{title:p.name});
}
const api = (data,status=200) => response(JSON.stringify(data),status,"application/json; charset=utf-8");
const redirect = (path,cookies=[]) => response(null,303,"text/plain; charset=utf-8",[["Location",path],...cookies.map(x=>["Set-Cookie",x])]);
const cookie = (name,token="",age=0) => `${name}=${token}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`;
function tokenFrom(request,name) {
  const list=(request.headers.get("Cookie")??"").split(";").map(s=>s.trim()).filter(s=>s.startsWith(name+"="));
  if(list.length!==1) return "";
  const token=list[0].slice(name.length+1);
  return token.length < 3500 && jwt.test(token) ? token : "";
}
function claimsOf(token) {
  try {
    const t=token.split(".")[1].replaceAll("-","+").replaceAll("_","/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t),c=>c.charCodeAt(0))));
  } catch { return {}; }
}
const endpoint = (env) => /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(env.SUPABASE_URL??"") &&
    /^sb_publishable_[\w-]{15,}$/.test(env.SUPABASE_PUBLISHABLE_KEY??"");
function makeProvider(env,fetcher) {
  const call=async (path,options={})=>{
    const headers=new Headers({apikey:env.SUPABASE_PUBLISHABLE_KEY,Accept:"application/json"});
    if(options.token) headers.set("Authorization","Bearer "+options.token);
    if(options.payload!==undefined) headers.set("Content-Type","application/json");
    try {
      const r=await fetcher(env.SUPABASE_URL+path,{method:options.method??"GET",headers,body:options.payload===undefined?undefined:JSON.stringify(options.payload),signal:AbortSignal.timeout(7000),redirect:"error"});
      const data=options.empty ? null : await r.json().catch(()=>null);
      return {status:r.status,data};
    } catch { return {status:503,data:null}; }
  };
  return {
    login:(email,password)=>call("/auth/v1/token?grant_type=password",{method:"POST",payload:{email,password}}),
    user:token=>call("/auth/v1/user",{token}),
    challenge:(token,factor)=>call("/auth/v1/factors/"+factor+"/challenge",{method:"POST",token,payload:{}}),
    verify:(token,factor,challenge,code)=>call("/auth/v1/factors/"+factor+"/verify",{method:"POST",token,payload:{challenge_id:challenge,code}}),
    logout:token=>call("/auth/v1/logout?scope=local",{method:"POST",token,empty:true}),
    grants:(token,userId)=>call("/rest/v1/"+APPROVALS+"?select=project_code,role&user_id=eq."+userId,{token}),
  };
}
function providerDown(status){return status>=500;}
function validJwt(token){return typeof token==="string"&&token.length<3500&&jwt.test(token);}
async function identity(provider,env,token,level) {
  if(!validJwt(token)) return {status:401};
  const result=await provider.user(token);
  if(providerDown(result.status)) return {status:503};
  if(result.status!==200) return {status:401};
  const user=result.data, claim=claimsOf(token);
  const now=Math.floor(Date.now()/1000);
  if(!user || !uuid.test(user.id) || user.is_anonymous || !user.email_confirmed_at ||
      claim.sub!==user.id || claim.iss!==env.SUPABASE_URL+"/auth/v1" || claim.aud!=="authenticated" ||
      claim.role!=="authenticated" || claim.aal!==level || !uuid.test(claim.session_id) ||
      !Number.isInteger(claim.exp) || claim.exp<=now) return {status:401};
  const factor=user.factors?.find(x=>x.factor_type==="totp" && x.status==="verified" && uuid.test(x.id));
  if(!factor) return {status:403};
  return {status:200,subject:user.id,factor:factor.id,ttl:claim.exp-now};
}
async function authForm(request) {
  if(request.headers.get("Origin")!==new URL(request.url).origin) return null;
  if(request.headers.has("Sec-Fetch-Site") && request.headers.get("Sec-Fetch-Site")!=="same-origin") return null;
  if(!(request.headers.get("Content-Type")??"").toLowerCase().startsWith("application/x-www-form-urlencoded")) return null;
  if(!request.body || Number(request.headers.get("Content-Length"))>4096) return null;
  const reader=request.body.getReader();
  const chunks=[];
  let bytes=0;
  for(;;) {
    const {value,done}=await reader.read();
    if(done) break;
    bytes+=value.byteLength;
    if(bytes>4096){await reader.cancel();return null;}
    chunks.push(value);
  }
  const data=new Uint8Array(bytes);
  let i=0;
  for(const c of chunks){data.set(c,i);i+=c.byteLength;}
  return new URLSearchParams(new TextDecoder().decode(data));
}
function limits(refused=false){return refused?"嘗試次數過多，請稍後再試。":"帳號或密碼不正確，或該帳號尚未完成確認。";}
const unavailable=()=>page('<h1>測試入口暫時無法驗證</h1><p>請稍後再試，或請 R4 管理者檢查測試環境。</p><a href="/login">回登入畫面</a>'+NOTE,{status:503,title:"服務暫時不可用"});

export function makeWorker(fetcher=(...args)=>fetch(...args)) {
  return { async fetch(req,env) {
    try {
      const url=new URL(req.url), path=url.pathname;
      if(env.SITE_ORIGIN!==url.origin) return api({error:"not_found"},404);
      const method=req.method;
      if(method==="GET"){
        if(path==="/ui.css") return response(STYLES,200,"text/css; charset=utf-8");
        if(path==="/ui.js") return response(SCRIPT,200,"text/javascript; charset=utf-8");
        if(path==="/xjtc.svg") return response(BRAND,200,"image/svg+xml");
        if(path==="/"||path==="/login") return login();
      }
      if(method==="POST" && ["/auth/login","/auth/mfa","/auth/logout"].includes(path)){
        if(!endpoint(env)) return unavailable();
        const provider=makeProvider(env,fetcher);
        const form=await authForm(req);
        if(!form) return api({error:"invalid_request"},403);
        if(path==="/auth/logout"){
          const token=tokenFrom(req,SESSION);
          if(token) await provider.logout(token);
          return redirect("/login",[cookie(SESSION),cookie(PENDING)]);
        }
        if(env.LOGIN_RATE && req.headers.get("CF-Connecting-IP")){
          const {success}=await env.LOGIN_RATE.limit({key:req.headers.get("CF-Connecting-IP")});
          if(!success) return path==="/auth/login"?login(limits(true),429):mfa(limits(true),429);
        }
        if(path==="/auth/login"){
          const email=(form.get("email")??"").trim(), password=form.get("password")??"";
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!password||password.length>512) return login(limits(),400);
          const auth=await provider.login(email,password);
          if(providerDown(auth.status)) return unavailable();
          const cookies=[cookie(SESSION),cookie(PENDING)];
          if(auth.status!==200 || !validJwt(auth.data?.access_token)) return login(limits(auth.status===429),auth.status===429?429:401,cookies);
          const token=auth.data.access_token, pending=await identity(provider,env,token,"aal1");
          if(pending.status===503) return unavailable();
          if(pending.status===403) return login("請先到原本的工具管控平台設定手機驗證器，再回來登入。",403,cookies);
          if(pending.status!==200) return login(limits(),401,cookies);
          return redirect("/auth/mfa",[cookie(SESSION),cookie(PENDING,token,Math.min(180,pending.ttl))]);
        }
        const token=tokenFrom(req,PENDING);
        const who=await identity(provider,env,token,"aal1");
        if(who.status===503) return unavailable();
        if(who.status!==200) return login("登入階段已過期，請重新登入。",401,[cookie(PENDING)]);
        const code=(form.get("code")??"").trim();
        if(!/^\d{6}$/.test(code)) return mfa("請輸入 6 位數驗證碼。",400);
        const first=await provider.challenge(token,who.factor);
        if(providerDown(first.status)) return unavailable();
        if(first.status===429) return mfa(limits(true),429);
        if(first.status!==200||!uuid.test(first.data?.id??"")) return mfa("無法啟動手機驗證，請再試一次。",401);
        const checked=await provider.verify(token,who.factor,first.data.id,code);
        if(providerDown(checked.status)) return unavailable();
        if(checked.status===429) return mfa(limits(true),429);
        if(checked.status!==200||!validJwt(checked.data?.access_token)) return mfa("驗證碼錯誤或已過期，請輸入新的驗證碼。",401);
        const verified=await identity(provider,env,checked.data.access_token,"aal2");
        if(verified.status===503) return unavailable();
        if(verified.status!==200||verified.subject!==who.subject) return login("驗證未完成，請重新登入。",401,[cookie(PENDING)]);
        return redirect("/workspace",[cookie(PENDING),cookie(SESSION,checked.data.access_token,Math.min(900,verified.ttl))]);
      }
      if(method==="GET"&&path==="/auth/mfa") return tokenFrom(req,PENDING)?mfa():redirect("/login");
      const match=path.match(/^\/(workspace|api\/projects)(?:\/(R4-DEMO-[AB]))?$/);
      if(method==="GET"&&match){
        const isApi=match[1]!=="workspace";
        const token=tokenFrom(req,SESSION);
        if(!token) return isApi?api({error:"authentication_required"},401):redirect("/login");
        if(!endpoint(env)) return isApi?api({error:"unavailable"},503):unavailable();
        const provider=makeProvider(env,fetcher);
        const who=await identity(provider,env,token,"aal2");
        if(who.status===503) return isApi?api({error:"unavailable"},503):unavailable();
        if(who.status!==200) return isApi?api({error:"authentication_required"},401):login("登入階段已過期，請重新登入。",401,[cookie(SESSION)]);
        const list=await provider.grants(token,who.subject);
        if(list.status!==200||!Array.isArray(list.data)) return isApi?api({error:"unavailable"},503):unavailable();
        const grants=new Map(list.data.filter(x=>x&&Object.hasOwn(ROLES,x.role)&&PROJECTS.some(p=>p.code===x.project_code)).map(x=>[x.project_code,x.role]));
        if(!grants.size) return isApi?api({error:"r4_not_granted"},403):blocked();
        if(!match[2]) return isApi?api({projects:PROJECTS.filter(p=>grants.has(p.code)).map(({code,name})=>({code,name,role:grants.get(code)}))}):workspace(grants);
        const p=PROJECTS.find(x=>x.code===match[2]), role=grants.get(match[2]);
        if(!role) return isApi?api({error:"project_not_granted"},403):blocked(true);
        return isApi?api({project:p,role}):projectPage(p,role);
      }
      return api({error:"not_found"},404);
    } catch { return unavailable(); }
  }};
}
export default makeWorker();
