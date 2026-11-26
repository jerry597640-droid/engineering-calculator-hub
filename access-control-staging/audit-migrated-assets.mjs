// Read-only browser smoke audit for migration candidates. This intentionally
// does not grant access or claim to validate engineering calculations.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const root=dirname(fileURLToPath(import.meta.url));
const assetRoot=resolve(root,'assets');
const manifest=JSON.parse(await readFile(join(root,'migration-manifest.json'),'utf8'));
const ids=manifest.tools.map(t=>t.id);
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.gif':'image/gif','.mp4':'video/mp4','.mp3':'audio/mpeg','.pdf':'application/pdf',
  '.woff':'font/woff','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const missing=[];
const server=createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/'){res.writeHead(200,{'content-type':'text/plain'});res.end('staging hub');return}
  if(!/^\/tools\/[a-z0-9][a-z0-9-]{0,79}\//.test(pathname) || /%|\\\\|\/\//.test(pathname)){
    if(pathname!=='/favicon.ico')missing.push(pathname);
    res.writeHead(404);res.end();return;
  }
  let name=pathname.endsWith('/')?pathname+'index.html':pathname;
  const path=resolve(assetRoot,'.'+name);
  if(!path.startsWith(assetRoot+sep)){res.writeHead(404);res.end();return}
  try {
    const info=await stat(path);if(!info.isFile())throw Error('not a file');
    res.writeHead(200,{'content-type':contentTypes[extname(path).toLowerCase()]||'application/octet-stream',
      'content-length':info.size,'cache-control':'no-store'});
    if(req.method==='HEAD')res.end();else createReadStream(path).pipe(res);
  } catch {missing.push(pathname);res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp(join(tmpdir(),'ech-tool-audit-'));
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--remote-debugging-port=9222',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chromeError='';chrome.stderr.on('data',chunk=>{chromeError=(chromeError+chunk.toString()).slice(-2000)});
let ws;
try {
  let pages;
  for(let n=0;n<300;n++){
    try{pages=await (await fetch('http://127.0.0.1:9222/json/list')).json();if(pages.length)break}catch{}
    await delay(100);
  }
  if(!pages?.[0]?.webSocketDebuggerUrl)throw Error('headless Chrome unavailable: '+chromeError);
  ws=new WebSocket(pages[0].webSocketDebuggerUrl);
  await Promise.race([new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});
  }),delay(10000).then(()=>{throw Error('browser connection timed out')})]);
  let seq=0;const pending=new Map();let exceptions=[],failedExternal=[];
  ws.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}return}
    if(m.method==='Runtime.exceptionThrown')exceptions.push((m.params?.exceptionDetails?.exception?.description||m.params?.exceptionDetails?.text||'error').split('\n')[0].slice(0,200));
    if(m.method==='Network.responseReceived' && m.params?.response?.status>=400 && !m.params.response.url.startsWith(origin))
      failedExternal.push({url:m.params.response.url.slice(0,240),status:m.params.response.status});
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
    setTimeout(()=>{if(pending.delete(id))reject(Error(method+' timed out'))},12000).unref();
  });
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true});
    if(r.exceptionDetails)throw Error('evaluation failed');
    return r.result?.value;
  };
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  const report=[];
  for(const id of ids){
    missing.length=0;exceptions=[];failedExternal=[];
    let info=null,issue='';
    try{
      const navigation=await send('Page.navigate',{url:origin+'/tools/'+id+'/'});
      if(navigation.errorText)throw Error(navigation.errorText);
      for(let n=0;n<80;n++){
        await delay(100);
        info=await evaluate(`(()=>({ready:document.readyState,path:location.pathname,title:document.title,
          body:(document.body?.innerText||'').trim().length,
          controls:document.querySelectorAll('input,select,button,textarea').length,
          legacy:[...document.querySelectorAll('a[href]')].map(a=>a.href)
            .filter(u=>/^https?:\\/\\/(?:jerry597640-droid\\.github\\.io\\/|github\\.com\\/jerry597640-droid\\/)/i.test(u)).slice(0,4),
          offlineLinks:[...document.querySelectorAll('a[href]')]
            .filter(a=>/\\.zip(?:$|[?#])/i.test(a.href) || /離線(?:版|版本|套件).*下載|下載.*離線/.test(a.innerText))
            .map(a=>a.getAttribute('href')).slice(0,4)}))()`);
        if(info?.path==='/tools/'+id+'/' && info.ready!=='loading' && info.body>0)break;
      }
      await delay(1200);
    }catch(e){issue=String(e.message||e).slice(0,200)}
    const localMissing=[...new Set(missing)].slice(0,8);
    const problems=[...new Set(exceptions)].slice(0,4);
    const remoteErrors=failedExternal.filter((x,i,a)=>a.findIndex(y=>y.url===x.url&&y.status===x.status)===i).slice(0,4);
    const ok=Boolean(info && info.path==='/tools/'+id+'/' && info.body>0 && !issue &&
      !localMissing.length && !problems.length && !info.legacy.length && !info.offlineLinks.length && !remoteErrors.length);
    const row={id,status:ok?'initial-load-ok':'review',title:info?.title||'',controls:info?.controls||0,
      ...(issue?{issue}:{}),...(localMissing.length?{localMissing}:{}),...(problems.length?{exceptions:problems}:{}),
      ...(info?.legacy?.length?{legacy:info.legacy}:{}),...(info?.offlineLinks?.length?{offlineLinks:info.offlineLinks}:{}),
      ...(remoteErrors.length?{remoteErrors}:{})};
    report.push(row);console.log(JSON.stringify(row));
  }
  console.log(JSON.stringify({summary:{total:report.length,initialLoadOk:report.filter(x=>x.status==='initial-load-ok').length,
    needsReview:report.filter(x=>x.status==='review').length}}));
} finally {
  ws?.close();chrome.kill('SIGTERM');server.close();
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
