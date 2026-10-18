const {chromium}=require('playwright');
const assert=require('node:assert/strict');const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.SRC_TEST_CHROME||undefined,args:['--no-sandbox']});
 for(const [width,height]of [[1512,982],[1280,800],[1024,768],[320,844],[390,844],[768,844]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file://'+path.resolve('src-beam/index.html'));
  const button=page.locator(width>820?'.viewer-panel [data-diagram-pin]':'#mobile-preview [data-diagram-pin]');
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  await page.locator('#s').fill('14');await page.waitForTimeout(60);
  await button.focus();await page.keyboard.press('Enter');await page.waitForTimeout(50);
  assert.equal(await button.getAttribute('aria-pressed'),'false');
  await page.locator('#mp').fill('120');await page.waitForTimeout(50);
  assert.notEqual(await page.locator('#cap-pos').innerText(),'—');
  const chart=await page.locator(width>820?'#drawing':'#preview-drawing').boundingBox();
  assert(chart.y+chart.height<0,`unpin should scroll chart off screen ${width}: ${JSON.stringify(chart)}`);
  await page.reload();assert.equal(await button.getAttribute('aria-pressed'),'false');
  await button.click();await page.waitForTimeout(80);assert.equal(await button.getAttribute('aria-pressed'),'true');
  await page.locator('#s').fill('13');await page.waitForTimeout(60);
  const pinned=await page.locator(width>820?'#drawing':'#preview-drawing').boundingBox();
  assert(pinned.y>=0&&pinned.y+pinned.height<=height+1,`repin ${width}: ${JSON.stringify(pinned)}`);
  if(width>820){
   for(const selector of ['#strength-table tr:last-child','#composition tr:last-child','#diagram-data div:last-child','#checklist .check-item:last-child']){
    const item=page.locator(selector);await item.evaluate(e=>e.scrollIntoView({block:'center'}));
    assert(await item.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return e.contains(hit);}),`covered ${selector}`);
   }
  }
  await page.reload();assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-diagram-pin]').count(),2);
  assert.equal(errors.length,0,errors.join('\n'));
  if(width===1512||width===390)await page.screenshot({path:`src-beam/pin-${width}.png`});
  await page.close();
 }
 const page=await browser.newPage();await page.goto('file://'+path.resolve('src-beam/index.html'));
 await page.locator('.viewer-panel [data-diagram-pin]').click();
 const download=page.waitForEvent('download');await page.locator('#offline').click();await(await download).saveAs(path.resolve('src-beam/pin-offline.html'));
 const offline=await browser.newPage();await offline.addInitScript(()=>localStorage.setItem('src-beam-diagram-pinned','true'));
 await offline.route('http**/*',r=>r.abort());await offline.goto('file://'+path.resolve('src-beam/pin-offline.html'));
 assert.equal(await offline.locator('.viewer-panel [data-diagram-pin]').getAttribute('aria-pressed'),'false');
 assert.equal(await offline.locator('[data-diagram-pin]').count(),2);assert.equal(await offline.locator('.viewer-heading').count(),1);
 assert.equal(await offline.locator('#cap-pos').innerText(),'145.17');
 await offline.locator('.viewer-panel [data-diagram-pin]').click();assert.equal(await offline.locator('.viewer-panel [data-diagram-pin]').getAttribute('aria-pressed'),'true');
 await browser.close();console.log('Pin passed: desktop/tablet/mobile 320–1512px, keyboard toggle, natural page scrolling when unpinned, visible chart when pinned, uncovered result sections, persistence in both states, offline mode preservation and idempotent controls.');
})().catch(e=>{console.error(e);process.exit(1)});
