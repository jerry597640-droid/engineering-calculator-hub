/* DOM interaction tests (JSDOM, no browser automation or layout engine).
   Responsive CSS is checked separately; real-device visual QA remains separate. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let checks=0,downloads=[],runtimeErrors=[];
const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>runtimeErrors.push(e.message));
function create(blockStorage=false,embeddedHtml=html){
 return new JSDOM(embeddedHtml,{url:'https://beam.test/index.html',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole,beforeParse(w){
  w.innerWidth=390;w.TextEncoder=TextEncoder;w.Blob=Blob;w.URL.createObjectURL=b=>{downloads.push({blob:b});return 'blob:test-'+downloads.length;};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){downloads.at(-1).filename=this.download;};w.print=()=>{};
  if(blockStorage)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('blocked','SecurityError');}});
 }});
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<600;i++){if(fn())return;await delay(10);}throw Error('Timed out: '+label);}
const near=(a,b,label)=>{assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);checks++;};
function field(w,path,value){const e=w.document.querySelector(`[data-field="${path}"]`);assert.ok(e,'field '+path);e.value=String(value);e.dispatchEvent(new w.Event('change',{bubbles:true}));checks++;}
function click(w,selector){const e=w.document.querySelector(selector);assert.ok(e,'button '+selector);e.click();checks++;}
function unzipStored(buffer){const entries={};let p=0;while(buffer.readUInt32LE(p)===0x04034b50){assert.equal(buffer.readUInt16LE(p+8),0);const size=buffer.readUInt32LE(p+18),nameLength=buffer.readUInt16LE(p+26),extra=buffer.readUInt16LE(p+28),name=buffer.subarray(p+30,p+30+nameLength).toString('utf8'),start=p+30+nameLength+extra;entries[name]=buffer.subarray(start,start+size).toString('utf8');p=start+size;}assert.equal(buffer.readUInt32LE(p),0x02014b50);return entries;}
async function main(){const dom=create(),w=dom.window,d=w.document;await until(()=>w.BeamWorkbench?.getResults(),'initial analysis');
 near(w.BeamWorkbench.getResults().summary.Mplus.value,45,'initial result');
 assert.equal(d.querySelectorAll('#stats .stat-card').length,4);checks++;
 const uu=d.getElementById('force-unit');uu.value='tf';uu.dispatchEvent(new w.Event('change',{bubbles:true}));near(w.BeamWorkbench.getModel().loads[0].q0,10,'unit switch preserves physics');near(Number(d.querySelector('[data-field="loads.0.q0"]').value),10/9.80665,'tf input conversion');
 click(w,'[data-action="add-load"][data-type="point"]');near(w.BeamWorkbench.getModel().loads[1].value,10*9.80665,'new load uses selected force unit');assert.equal(w.BeamWorkbench.getResults(),null);assert.match(d.getElementById('dirty-status').textContent,/變更/);checks+=2;
 click(w,'[data-action="remove-load"][data-index="1"]');field(w,'loads.0.q0',2);field(w,'loads.0.q1',2);click(w,'#run-analysis');await until(()=>w.BeamWorkbench.getResults(),'updated uniform');near(w.BeamWorkbench.getResults().summary.Mplus.value,2*9.80665*36/8,'uniform tf load');
 click(w,'[data-view="capacity"]');field(w,'checks.Mplus',100);field(w,'checks.V',100);field(w,'checks.capacitySource','工程S-01，ASD容許內力');field(w,'checks.defSource','工程S-01，L/360');click(w,'#run-analysis');await until(()=>w.BeamWorkbench.getResults(),'capacity analysis');assert.equal(w.BeamWorkbench.getResults().check.items[0].status,'通過');checks++;
 field(w,'combination','rc12');click(w,'#run-analysis');await until(()=>w.BeamWorkbench.getResults(),'strength basis mismatch');assert.equal(w.BeamWorkbench.getResults().check.items[0].status,'待確認');checks++;
 click(w,'[data-view="help"]');click(w,'[data-example="moment"]');await until(()=>w.BeamWorkbench.getResults(),'moment example');near(w.BeamWorkbench.getResults().summary.Mminus.value,10,'UI moment example');assert.match(d.getElementById('analysis-notes').textContent,/負反力/);checks++;
 w.BeamWorkbench.loadExample('vehicle');await until(()=>w.BeamWorkbench.getResults(),'vehicle current');click(w,'#run-envelope');await until(()=>w.BeamWorkbench.getResults()?.envelope,'vehicle envelope');assert.ok(w.BeamWorkbench.getResults().envelope.count>100);checks++;
 const count=w.BeamWorkbench.getResults().envelope.count,slider=d.getElementById('vehicle-slider');slider.value='2';slider.dispatchEvent(new w.Event('input',{bubbles:true}));near(w.BeamWorkbench.getModel().vehicle.position,2,'vehicle slider');assert.equal(w.BeamWorkbench.getResults().envelope.count,count);checks++;
 click(w,'[data-action="governing"][data-key="Mplus"]');assert.equal(w.BeamWorkbench.getResults().envelope.count,count);checks++;
 // Offline archive must be valid and standalone; reload the produced HTML in a new DOM.
 const title=d.getElementById('project-title');title.value='測試 </script> <img src=x onerror=alert(1)>';title.dispatchEvent(new w.Event('input',{bubbles:true}));click(w,'#offline-download');const offline=downloads.at(-1);assert.match(offline.filename,/\.zip$/);const buffer=Buffer.from(await offline.blob.arrayBuffer()),entries=unzipStored(buffer);assert.equal(Object.keys(entries).length,4);assert.ok(entries['index.html'].includes('beam-core-source'));assert.equal(JSON.parse(entries['目前專案.json']).title,title.value);checks+=3;
 assert.match(entries['操作說明.txt'],/資料來源/);checks++;
 const offlineDom=create(true,entries['index.html']);await until(()=>offlineDom.window.BeamWorkbench?.getResults(),'offline with storage blocked');assert.equal(offlineDom.window.BeamWorkbench.getModel().title,title.value);assert.match(offlineDom.window.document.getElementById('save-status').textContent,/無法保存/);checks+=2;offlineDom.window.close();
 click(w,'[data-view="calculation"]');click(w,'[data-action="export-csv"]');const csv=Buffer.from(await downloads.at(-1).blob.arrayBuffer()).toString('utf8');assert.match(csv,/車行包絡/);assert.match(csv,/Vmin/);checks+=2;click(w,'[data-action="export-report"]');const report=await downloads.at(-1).blob.text();assert.match(report,/剛度/);assert.match(report,/支承/);assert.ok(!report.includes('<img src=x onerror'));checks+=3;
 // Invalid project is rejected before replacing current state.
 click(w,'#import-project');const fileInput=d.getElementById('project-file'),before=w.BeamWorkbench.getModel().title;Object.defineProperty(fileInput,'files',{value:[{size:20,text:async()=>'{"schema":"wrong"}'}],configurable:true});fileInput.dispatchEvent(new w.Event('change',{bubbles:true}));await until(()=>!d.getElementById('error-box').hidden,'invalid project error');assert.equal(w.BeamWorkbench.getModel().title,before);checks++;
 assert.deepEqual(runtimeErrors,[]);checks++;dom.window.close();
 const result={status:'passed',checks,environment:'JSDOM, 390px viewport; DOM interactions only',covered:['initial analysis','unit conversions','add/remove loads','dirty-state invalidation','capacity/source validation','service/strength basis','load couple and uplift warning','moving envelope and control positions','vehicle slider cache','ZIP structure and offline reload','blocked storage','CSV/report export','import validation','HTML escaping'],visualLayoutVerified:false};fs.writeFileSync(path.join(__dirname,'ui-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));}
main().catch(e=>{console.error(e);process.exit(1)});
