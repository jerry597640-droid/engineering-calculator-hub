// Compare public pinned-source defaults with the staged copies. This is a
// migration regression, not an independent certification of engineering design.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const repoRoot=resolve(root,'..');
const originals=join(repoRoot,'.baseline-sources');
const tools=JSON.parse(await readFile(join(root,'migration-manifest.json'),'utf8')).tools;
const entries=new Map(tools.map(t=>[t.id,t]));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
  '.mp4':'video/mp4','.mp3':'audio/mpeg','.pdf':'application/pdf','.woff2':'font/woff2'};
let missing=[];
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(path==='/'){res.writeHead(200);res.end('comparison only');return}
  const match=/^\/(original|tools)\/([a-z0-9][a-z0-9-]{0,79})\/(.*)$/.exec(path);
  if(!match||/%|\\|\/\//.test(path)||!entries.has(match[2])){
    if(path!=='/favicon.ico')missing.push(path);res.writeHead(404);res.end();return;
  }
  const [,kind,id,tail]=match,t=entries.get(id);
  const base=kind==='tools'?join(root,'assets','tools',id):
    t.kind==='hub'?join(originals,'hub',t.source.endsWith('.html')?'':t.source):join(originals,id);
  const name=tail||'index.html';
  const target=kind==='original'&&t.kind==='hub'&&t.source.endsWith('.html')&&name==='index.html'?
    resolve(originals,'hub',t.source):resolve(base,name);
  const rootDir=resolve(base);
  if(!target.startsWith(rootDir+sep) || name.split('/').some(x=>x==='..'||x.startsWith('.'))){
    missing.push(path);res.writeHead(404);res.end();return;
  }
  try{
    const info=await stat(target);if(!info.isFile())throw Error('not file');
    res.writeHead(200,{'content-type':types[extname(target).toLowerCase()]||'application/octet-stream',
      'content-length':info.size,'cache-control':'no-store'});
    createReadStream(target).pipe(res);
  }catch{missing.push(path);res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'ech-defaults-'));
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-debugging-port=9222','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe']});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let ws;
try{
  let pages;for(let n=0;n<300;n++){try{pages=await (await fetch('http://127.0.0.1:9222/json/list')).json();if(pages.length)break}catch{}await delay(100)}
  if(!pages?.[0]?.webSocketDebuggerUrl)throw Error('browser unavailable');
  ws=new WebSocket(pages[0].webSocketDebuggerUrl);
  await Promise.race([new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})}),
    delay(10000).then(()=>{throw Error('browser connection timed out')})]);
  let seq=0,exceptions=[];const pending=new Map();
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}return}
    if(m.method==='Runtime.exceptionThrown')exceptions.push((m.params?.exceptionDetails?.text||'exception').slice(0,100));
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
    setTimeout(()=>{if(pending.delete(id))reject(Error(method+' timeout'))},12000).unref();
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(r.exceptionDetails)throw Error('snapshot failed');return r.result?.value};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  const expression=String.raw`(()=>{
    const visible=e=>e.getClientRects().length>0;
    const inputs=[...document.querySelectorAll('input,select,textarea')].filter(e=>visible(e)&&
      !['hidden','file','password','button','submit'].includes(e.type))
      .map((e,i)=>({key:e.id||e.name||'#'+i,value:e.type==='checkbox'||e.type==='radio'?String(e.checked):e.value}));
    const result=[...document.querySelectorAll('[id]')].filter(e=>visible(e)&&
      /^(?:results?|output|summary|calcresult|rescard)/i.test(e.id))
      .map(e=>({id:e.id,text:(e.innerText||'').slice(0,3000)}))
      .filter(e=>/\d/.test(e.text))
      .map(e=>({id:e.id,numbers:(e.text.match(/-?\d[\d,]*(?:\.\d+)?(?:e[+-]?\d+)?/gi)||[]).map(x=>x.replace(/,/g,''))}));
    return {path:location.pathname,title:document.title,body:(document.body?.innerText||'').trim().length,inputs,result};
  })()`;
  async function snapshot(kind,id){
    missing=[];exceptions=[];
    await send('Storage.clearDataForOrigin',{origin,storageTypes:'all'});
    const path='/'+kind+'/'+id+'/';await send('Page.navigate',{url:origin+path});
    let data;
    for(let n=0;n<80;n++){await delay(100);data=await evaluate(expression);if(data?.path===path&&data.body>0)break}
    await delay(1200);data=await evaluate(expression);
    return {data,missing:[...new Set(missing)].slice(0,5),exceptions:[...new Set(exceptions)].slice(0,3)};
  }
  const rows=[];
  for(const tool of tools){
    let original,staged,issue='';
    try{original=await snapshot('original',tool.id);staged=await snapshot('tools',tool.id)}
    catch(e){issue=String(e.message||e).slice(0,150)}
    const before=original?.data,after=staged?.data;
    const inputsMatch=Boolean(before&&after&&JSON.stringify(before.inputs)===JSON.stringify(after.inputs));
    const bmap=new Map((before?.result||[]).map(x=>[x.id,x.numbers]));
    const amap=new Map((after?.result||[]).map(x=>[x.id,x.numbers]));
    const shared=[...bmap.keys()].filter(k=>amap.has(k));
    const different=shared.filter(k=>JSON.stringify(bmap.get(k))!==JSON.stringify(amap.get(k)));
    const healthy=Boolean(before&&after&&before.body&&after.body&&!issue&&
      !original.missing.length&&!staged.missing.length&&!original.exceptions.length&&!staged.exceptions.length);
    const row={id:tool.id,status:healthy&&inputsMatch&&shared.length>0&&!different.length?'baseline-match':'review',
      inputsMatch,resultFields:shared.length,different:different.slice(0,5),
      ...(issue?{issue}:{}),...(original?.missing?.length?{originalMissing:original.missing}:{}),
      ...(staged?.missing?.length?{stagedMissing:staged.missing}:{}),
      ...(original?.exceptions?.length?{originalExceptions:original.exceptions}:{}),
      ...(staged?.exceptions?.length?{stagedExceptions:staged.exceptions}:{})};
    rows.push(row);console.log(JSON.stringify(row));
  }
  console.log(JSON.stringify({summary:{total:rows.length,baselineMatch:rows.filter(x=>x.status==='baseline-match').length,
    review:rows.filter(x=>x.status==='review').length}}));
}finally{
  ws?.close();chrome.kill('SIGTERM');server.close();
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
