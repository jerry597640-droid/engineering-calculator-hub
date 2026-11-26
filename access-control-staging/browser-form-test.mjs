// Real-browser regression test: submits a deliberately invalid, non-account
// password so validation runs without creating a user or sending email.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin='https://engineering-tools-access-staging.jerry597640.workers.dev';
const profile=await mkdtemp(join(tmpdir(),'ech-browser-'));
const chrome=spawn('google-chrome',['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--remote-debugging-port=9222',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chromeError='';chrome.stderr.on('data',chunk=>{chromeError=(chromeError+chunk.toString()).slice(-2000)});
let ws;
try {
  let pages;
  for(let n=0;n<300;n++){
    try{const r=await fetch('http://127.0.0.1:9222/json/list');pages=await r.json();if(pages.length)break}catch{}
    await delay(100);
  }
  assert.ok(pages?.[0]?.webSocketDebuggerUrl,'headless Chrome did not start: '+chromeError);
  ws=new WebSocket(pages[0].webSocketDebuggerUrl);
  await Promise.race([new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})}),delay(10000).then(()=>{throw Error('browser connection timed out')})]);
  let seq=0;const pending=new Map();
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id)return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));setTimeout(()=>{if(pending.delete(id))reject(Error(method+' timed out'))},10000).unref()});
  const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true})).result?.value;
  await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:origin+'/login'});
  let ready=false;for(let n=0;n<100;n++){ready=await evaluate("document.readyState === 'complete' && !!document.querySelector('form[action=\"/auth/login\"]')");if(ready)break;await delay(100)}
  assert.ok(ready,'login page did not load');
  await evaluate(`(()=>{const f=document.querySelector('form[action="/auth/login"]');f.elements.email.value='qa@example.invalid';f.elements.password.value='x';f.requestSubmit();})()`);
  let outcome='';for(let n=0;n<100;n++){outcome=await evaluate("location.pathname === '/auth/login' ? document.body.innerText : ''");if(outcome)break;await delay(100)}
  assert.match(outcome,/請檢查帳號及密碼格式/,'browser form did not reach server-side field validation');
  assert.doesNotMatch(outcome,/請求格式無效/);
  console.log('PASS: real browser form reaches validation without weakening origin checks');
} finally {
  ws?.close();chrome.kill('SIGTERM');await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
