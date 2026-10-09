/* Guarded RC-column v1.6 card migration: preserve the user's complete tool shelf. */
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const pw=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const input=path.resolve(__dirname,'hub-updated-v16.html'),html=fs.readFileSync(input,'utf8'),match=html.match(/<script\b[^>]*id="seed-data"[^>]*>([\s\S]*?)<\/script>/);
A(match,'seed-data not found');const seed=JSON.parse(match[1]),KEY='engineering-calculator-hub.v1',MARK='engineering-calculator-hub.rc-column.v16';
const oldDescription='矩形RC柱軸力、雙向彎矩、剪力、長細與耐震圍束檢核；含配筋搜尋、操作說明、驗算與離線版。';
const updated=seed.find(t=>t.id==='rc-column');A(updated);const clone=v=>structuredClone(v);

(async()=>{
 const browser=await pw.chromium.launch({executablePath:'/tmp/chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true});
 const checks=[],errors=[],requests=[];
 async function open(saved,markers={}){const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.setOffline(true);
  if(saved)await context.addInitScript(({saved,markers,KEY})=>{if(!localStorage.getItem('__hub_test_initialized')){localStorage.setItem(KEY,JSON.stringify({version:1,tools:saved}));for(const [key,value] of Object.entries(markers))localStorage.setItem(key,value);localStorage.setItem('__hub_test_initialized','1');}},{saved,markers,KEY});
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});await p.goto('file://'+input);await p.waitForFunction(()=>document.querySelectorAll('[data-tool-id]').length>0);return {p,context};
 }
 const stored=p=>p.evaluate(KEY=>JSON.parse(localStorage.getItem(KEY)).tools,KEY);
 const noDuplicates=list=>{A.equal(new Set(list.map(t=>t.id)).size,list.length);A.equal(list.filter(t=>t.id==='rc-column').length,1);A.equal(list.filter(t=>t.url===updated.url).length,1);};

 const fresh=await open(),card=fresh.p.locator('[data-tool-id="rc-column"]');const text=await card.innerText();A(text.includes('3D P–Mx–My'));A(/52項?參數/.test(text));A(text.includes('操作影片'));A.equal(await card.locator('a.tool-link').getAttribute('href'),updated.url);A.equal(updated.url,'https://jerry597640-droid.github.io/engineering-calculator-hub/rc-column/');noDuplicates(await stored(fresh.p));A.equal(await fresh.p.evaluate(MARK=>localStorage.getItem(MARK),MARK),'1');
 checks.push('新使用者RC卡有3D、52項參數及操作影片說明，URL維持原入口且不重複');

 const personalized=clone(seed).reverse(),rc=personalized.find(t=>t.id==='rc-column');Object.assign(rc,{name:'學殷的柱檢核工作台',description:'自訂說明：廠房柱C1及實際配筋優先',favorite:true,category:'我的工地工具',code:'RC-ME'});
 const other=personalized.find(t=>t.id!=='rc-column');Object.assign(other,{name:'自訂的其他工程工具',description:'其他工具的備註不得被更新',favorite:true,category:'我的工地工具',code:'MY-1'});
 const personal=await open(personalized);A.deepEqual(await stored(personal.p),personalized);noDuplicates(await stored(personal.p));A.equal(await personal.p.evaluate(MARK=>localStorage.getItem(MARK),MARK),'1');await personal.p.reload();A.deepEqual(await stored(personal.p),personalized);
 const rendered=personal.p.locator('[data-tool-id="rc-column"]');A((await rendered.innerText()).includes(rc.name));A((await rendered.innerText()).includes(rc.description));A.equal(await rendered.locator('[data-favorite]').getAttribute('aria-pressed'),'true');
 checks.push('預存RC自訂name／description／favorite／category／code和其他工具、順序全部原樣保留，重載仍保留');

 const legacy=clone(personalized),legacyRc=legacy.find(t=>t.id==='rc-column');legacyRc.description=oldDescription;const expected=clone(legacy);expected.find(t=>t.id==='rc-column').description=updated.description;
 const migrated=await open(legacy);A.deepEqual(await stored(migrated.p),expected);noDuplicates(await stored(migrated.p));await migrated.p.reload();A.deepEqual(await stored(migrated.p),expected);A.equal(await migrated.p.evaluate(MARK=>localStorage.getItem(MARK),MARK),'1');
 checks.push('只有符合原URL與原預設description的RC卡更新說明，name／favorite／順序及其餘完整工具保持不變');

 const customUrl=clone(legacy);customUrl.find(t=>t.id==='rc-column').url='https://example.invalid/my-rc-column/';const relocated=await open(customUrl);A.deepEqual(await stored(relocated.p),customUrl);A.equal((await stored(relocated.p)).filter(t=>t.id==='rc-column').length,1);A.equal((await stored(relocated.p)).length,seed.length);
 checks.push('RC原網址經使用者自訂時，舊description也不強制改寫或新增重複RC');

 const already=await open(legacy,{[MARK]:'1'});A.deepEqual(await stored(already.p),legacy);await already.p.reload();A.deepEqual(await stored(already.p),legacy);
 checks.push('v16 marker已存在時不重跑migration，後續使用者編輯完整保留');
 const deleted=clone(personalized).filter(t=>t.id!=='rc-column'),removed=await open(deleted,{'engineering-calculator-hub.rc-column.v1':'1'});A.deepEqual(await stored(removed.p),deleted);A.equal((await stored(removed.p)).filter(t=>t.id==='rc-column').length,0);
 checks.push('曾自行刪除RC卡且既有新增標記已存在時，v16 migration不重新加回');

 for(const width of [1440,390]){await fresh.p.setViewportSize({width,height:900});await fresh.p.locator('#search').fill('RC 柱');A.equal(await fresh.p.locator('[data-tool-id="rc-column"]').count(),1);await fresh.p.locator('#view-list').click();A(await fresh.p.locator('#cards').evaluate(el=>el.classList.contains('list-view')));A.equal(await fresh.p.locator('[data-tool-id="rc-column"] a.tool-link').getAttribute('href'),updated.url);await fresh.p.locator('#view-grid').click();await fresh.p.locator('#search').fill('');const size=await fresh.p.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth}));A(size.sw<=size.w+1,JSON.stringify(size));checks.push(width+'px入口搜尋／圖示／清單操作正常且無水平溢出');}
 A.equal(errors.length,0,JSON.stringify(errors));A.equal(requests.length,0,JSON.stringify(requests));checks.push('入口migration及桌面／手機操作零執行錯誤、零外部資源請求');
 fs.writeFileSync(path.resolve(__dirname,'hub-v16-ui-validation.json'),JSON.stringify({version:'1.6.0',date:'2026-10-09',source:'hub-updated-v16.html',sourceBytes:fs.statSync(input).size,seedCount:seed.length,checks,errors,requests},null,2));console.log(checks.join('\n'));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
