// Run with Playwright available on NODE_PATH; uses a local file and no server.
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),output=process.env.SLOPE_VERIFY_OUTPUT||path.join(root,'tests','live-output');
fs.mkdirSync(output,{recursive:true});
(async()=>{
const browser=await chromium.launch({channel:process.env.SLOPE_BROWSER_CHANNEL||undefined,headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},offline:true,acceptDownloads:true});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.workerStarts=0;window.NativeWorker=Worker;window.Worker=class extends NativeWorker{constructor(...args){super(...args);window.workerStarts++;}};});
const done=async()=>page.waitForFunction(()=>document.getElementById('run-status').dataset.state==='complete',{},{timeout:120000});
const state=()=>page.locator('#run-status').getAttribute('data-state');
const capture=async name=>{await page.locator('#plot').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,name+'.png'),fullPage:false});};
await page.goto('file:///'+path.join(root,'index.html').replaceAll('\\','/'));await done();
const baseline=await page.evaluate(()=>JSON.stringify(result));
const expected=JSON.parse(JSON.stringify(require('../engine.js').run(JSON.parse(baseline).model)));
const compare=(a,b,at='result')=>{if(typeof a==='number'&&typeof b==='number'){assert(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),at+': '+a+' != '+b);return;}if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b),at);for(const k of Object.keys(a))compare(a[k],b[k],at+'.'+k);return;}assert.deepEqual(a,b,at);};
compare(JSON.parse(baseline),expected);checks.push('offline file initial auto-run equals core output (relative tolerance 1e-10)');await capture('desktop-complete');
await page.locator('#solve-h-btn').click();await page.waitForFunction(()=>document.getElementById('inverse-h-result').dataset.state==='complete',{},{timeout:120000});await done();const inverse=await page.evaluate(()=>({H:Number(horizontalLength.value),V:result.model.geometry.height,normal:result.results[0],seismic:result.results[2]}));assert.equal(inverse.V,10);assert(inverse.H>14&&inverse.H<16);assert(inverse.normal.best.fs>=inverse.normal.target&&inverse.seismic.best.fs>=inverse.seismic.target);checks.push('fixed V inverse H applies a normal-and-seismic compliant result');
const before=await page.evaluate(()=>workerStarts);
await page.locator('#horizontalLength').fill('16');await page.locator('#horizontalLength').fill('18');await page.locator('#horizontalLength').fill('20');
assert.equal(await state(),'waiting');assert(await page.evaluate(()=>result===null&&dirty&&selectedSlice===0));await done();
assert.equal(await page.evaluate(()=>workerStarts),before+1);assert.equal(await page.evaluate(()=>result.model.ground[2][0]),20);checks.push('rapid edits debounce to one run and latest geometry');
await page.locator('#height').fill('');assert.equal(await state(),'invalid');assert(await page.evaluate(()=>result===null&&lastModel===null));await capture('invalid-input');
await page.locator('#height').fill('10');await page.locator('#cancel-btn').click();assert.equal(await state(),'cancelled');let count=await page.evaluate(()=>workerStarts);await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>workerStarts),count);checks.push('invalid input clears all results; pending run cancels');
await page.locator('#run-btn').click();await done();checks.push('manual run recovers after cancellation');
await page.locator('#density').fill('30');await page.locator('#run-btn').click();await page.locator('#cancel-btn').click();assert.equal(await state(),'cancelled');await page.waitForTimeout(700);assert.equal(await state(),'cancelled');await page.locator('#density').fill('14');await done();checks.push('high-density background run cancellation and edit recovery');
// Deliver a terminated worker's success and error callbacks after a new edit.
await page.evaluate(()=>{window.savedWorker=worker;runAnalysis();window.savedWorker=worker;window.oldMessage=worker.onmessage;window.oldError=worker.onerror;});
await page.locator('#q').fill('12');
await page.evaluate(old=>{oldMessage({data:{ok:true,data:JSON.parse(old)}});oldError({message:'obsolete error'});},baseline);
assert.equal(await state(),'waiting');assert(await page.evaluate(()=>result===null));await done();assert.equal(await page.evaluate(()=>result.model.q),12);checks.push('late success/error callbacks ignored');
for(const scene of ['normal','rain','seismic']){await page.locator('#scenario').selectOption(scene);assert(await page.evaluate(()=>document.getElementById('plot').innerHTML.includes('FS '+current().best.fs.toFixed(3))));await page.locator('#slice-select').selectOption('6');assert.equal(await page.evaluate(()=>selectedSlice),6);}
count=await page.evaluate(()=>workerStarts);await page.locator('#zoom-in').click();await page.locator('#plot').hover();await page.mouse.wheel(0,-100);await page.locator('#zoom-reset').click();assert.equal(await page.evaluate(()=>workerStarts),count);checks.push('three scenarios, slice selection, desktop zoom do not recalculate');
await page.evaluate(()=>fillModel(example('bench')));await done();assert.equal(await page.evaluate(()=>result.model.layers.length),2);checks.push('example switch auto-runs');
await page.locator('#import-file').setInputFiles(path.join(root,'example-project.json'));await page.waitForFunction(()=>result?.model?.name==='10 m 土坡教學範例',{},{timeout:120000});assert.equal(await page.evaluate(()=>result.model.ground[2][1]-result.model.ground[1][1]),10);checks.push('project import auto-runs');
const downloadEvent=page.waitForEvent('download');await page.locator('#offline-btn').click();const download=await downloadEvent;const single=path.join(output,'standalone.html');await download.saveAs(single);
await page.goto('file:///'+single.replaceAll('\\','/'));await done();checks.push('downloaded standalone auto-runs with network offline');
await page.setViewportSize({width:390,height:844});await page.locator('#plot').scrollIntoViewIfNeeded();await capture('mobile-complete');
count=await page.evaluate(()=>workerStarts);
await page.evaluate(()=>{const plot=document.getElementById('plot'),r=plot.getBoundingClientRect();const send=(type,id,x,y)=>plot.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:r.left+x,clientY:r.top+y,bubbles:true}));plot.setPointerCapture=()=>{};send('pointerdown',1,100,100);send('pointerdown',2,250,100);send('pointermove',2,280,100);send('pointerup',2,280,100);send('pointermove',1,120,120);send('pointerup',1,120,120);});
assert.equal(await page.evaluate(()=>workerStarts),count);assert(await page.evaluate(()=>view.w<900));await capture('mobile-zoom-pan');checks.push('mobile viewport synthetic two-pointer pinch/pan without recalculation');
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,pageErrors:errors},null,2));console.log(checks.join('\n'));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
