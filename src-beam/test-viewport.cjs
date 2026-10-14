const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.SRC_TEST_CHROME||undefined,args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('file://'+path.resolve('src-beam/index.html'));
  for(const [width,height] of [[1512,982],[1280,800],[1024,768],[900,650]]){
    await page.setViewportSize({width,height});await page.locator('#example').click();
    await page.locator('[data-view="analysis"]').click();await page.evaluate(()=>scrollTo(0,0));
    await page.waitForTimeout(80);
    for(const [id,value] of [['fc','300'],['xs','24'],['r-3-y','71'],['s','14'],['mp','110']]){
      const field=page.locator('#'+id);
      const before=await page.locator('#drawing').innerHTML();
      await field.evaluate(e=>e.scrollIntoView({block:'center'}));await field.fill(value);
      await page.waitForTimeout(50);
      const box=await page.locator('#drawing').boundingBox();
      assert(box&&box.y>=0&&box.y+box.height<=height+1,`${width} ${id}: drawing ${JSON.stringify(box)}`);
      assert(await page.locator('#drawing circle').count()>0);
      if(['fc','xs','r-3-y'].includes(id))assert.notEqual(await page.locator('#drawing').innerHTML(),before);
      assert(await page.locator('.inputs').evaluate(e=>e.scrollHeight>e.clientHeight));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
    await page.screenshot({path:`src-beam/viewport-desktop-${width}.png`});
  }
  for(const [width,height] of [[320,844],[390,844],[768,844],[390,400]]){
    await page.setViewportSize({width,height});await page.locator('#example').click();
    await page.locator('#mobile-inputs').click();await page.locator('[data-direction="positive"]').evaluate(e=>e.click());await page.locator('#s').evaluate(e=>e.scrollIntoView({block:'center'}));
    await page.locator('#s').fill('14');await page.waitForTimeout(50);
    const box=await page.locator('#preview-drawing').boundingBox();
    assert(box&&box.y>=0&&box.y+box.height<=height,`mobile ${width}×${height}: ${JSON.stringify(box)}`);
    assert.equal(await page.locator('#preview-drawing').innerHTML(),await page.locator('#drawing').innerHTML());
    await page.locator('#preview-direction').click();await page.waitForTimeout(30);
    assert((await page.locator('#preview-direction').innerText()).includes('負彎矩'));
    assert.equal(await page.locator('#preview-drawing').innerHTML(),await page.locator('#drawing').innerHTML());
    await page.locator('#preview-expand').click();assert(await page.locator('.results').isVisible());assert(await page.locator('#mobile-preview').isHidden());
    await page.locator('#mobile-inputs').click();await page.locator('#fc').fill('');await page.waitForTimeout(30);
    assert.equal(await page.locator('#preview-drawing').innerHTML(),'');assert(await page.locator('.mobile-preview-empty').isVisible());
    await page.locator('#fc').fill('280');await page.waitForTimeout(30);assert(await page.locator('#preview-drawing circle').count()>0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.locator('#s').evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:`src-beam/viewport-mobile-${width}-${height}.png`});
  }
  const dl=page.waitForEvent('download');await page.locator('#offline').click();await(await dl).saveAs(path.resolve('src-beam/viewport-offline.html'));
  const offline=await browser.newPage();await offline.route('http**/*',r=>r.abort());await offline.goto('file://'+path.resolve('src-beam/viewport-offline.html'));
  assert.equal(await offline.locator('#mobile-preview').count(),1);assert.equal(await offline.locator('#cap-pos').innerText(),'145.17');
  assert.equal(errors.length,0,errors.join('\n'));await browser.close();
  console.log('Viewport passed: desktop 900–1512px long-form scroll/edit keeps full diagram visible; mobile 320–768px and short viewport live preview, direction, expand, invalid/recovery; single HTML remains idempotent/offline.');
})().catch(e=>{console.error(e);process.exit(1)});
