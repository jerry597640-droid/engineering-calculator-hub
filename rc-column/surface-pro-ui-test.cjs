/* Professional 3D viewer regression tests. Run against the built, completely offline page. */
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const pw=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));

(async()=>{
 const cr=(await import('../qa-tools/node_modules/@sparticuz/chromium/build/index.js')).default;
 const browser=await pw.chromium.launch({executablePath:'/tmp/chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true});
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'rc-pm3d-pro-'));
 const errors=[],requests=[],checks=[];
 const ctx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await ctx.setOffline(true);
 const page=await ctx.newPage();
 function observe(p){p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});}
 observe(page);
 const ready=async(p=page)=>{await p.waitForFunction(()=>pm3dModel&&!pm3dStale&&!pm3dJob,{},{timeout:60000});await p.waitForTimeout(100);};
 const sliceReady=async(P,p=page)=>{await p.waitForFunction(P=>pm3dSliceData&&pm3dSliceData.P===P&&!pm3dSliceJob,P,{timeout:30000});await p.waitForTimeout(80);};
 const bounds=async(p=page)=>{await p.locator('#pm3dCanvas').scrollIntoViewIfNeeded();return p.locator('#pm3dCanvas').boundingBox();};
 const drag=async({dx=65,dy=30,button='left',shift=false,p=page}={})=>{
  const b=await bounds(p),x=b.x+b.width*.5,y=b.y+Math.min(b.height*.5,250);
  if(shift)await p.keyboard.down('Shift');await p.mouse.move(x,y);await p.mouse.down({button});await p.mouse.move(x+dx,y+dy,{steps:8});await p.mouse.up({button});if(shift)await p.keyboard.up('Shift');await p.waitForTimeout(80);
 };
 const unchanged=async(before,p=page)=>A.deepEqual(await p.evaluate(()=>({snapshot:result.inputSnapshot,ratios:result.cases.map(c=>c.ratio),loads:result.loads})),before);
 const capture=async(p=page)=>p.evaluate(()=>({snapshot:result.inputSnapshot,ratios:result.cases.map(c=>c.ratio),loads:result.loads}));

 await page.goto('file://'+path.resolve(__dirname,'dist/index.html'));await ready();
 A.equal(await page.evaluate(()=>pm3dModel.points),1740);A.equal(await page.locator('#pm3dCaseList button[data-pm-case]').count(),2);
 const baseline=await capture();A(Math.abs(baseline.ratios[0]-.384387)<1e-5);A(Math.abs(baseline.ratios[1]-.647230)<1e-5);
 checks.push('離線專業版1740點曲面、載重列表與原D/C一致');

 const yaw=await page.evaluate(()=>pm3dYaw);await page.locator('#pm3dTool').selectOption('rotate');await drag();A(Math.abs(await page.evaluate(()=>pm3dYaw)-yaw)>.1);
 const zoom=await page.evaluate(()=>pm3dZoom);await page.mouse.wheel(0,-150);await page.waitForTimeout(80);A(await page.evaluate(()=>pm3dZoom)>zoom);
 checks.push('真實滑鼠旋轉及滾輪縮放');

 await page.locator('#pm3dTool').selectOption('pan');const panYaw=await page.evaluate(()=>pm3dYaw);await drag({dx:48,dy:-23});let pan=await page.evaluate(()=>pm3dPan);A(Math.abs(pan.x)>20);A(Math.abs(pan.y)>10);A.equal(await page.evaluate(()=>pm3dYaw),panYaw);
 await page.locator('#pm3dFit').click();A.deepEqual(await page.evaluate(()=>pm3dPan),{x:0,y:0});A.equal(await page.evaluate(()=>pm3dZoom),1);
 await page.locator('#pm3dTool').selectOption('rotate');await drag({button:'right',dx:35,dy:20});A(Math.abs((await page.evaluate(()=>pm3dPan)).x)>10);
 await page.locator('#pm3dFit').click();await drag({shift:true,dx:42,dy:20});A(Math.abs((await page.evaluate(()=>pm3dPan)).x)>10);await page.locator('#pm3dFit').click();
 checks.push('平移工具、右鍵／Shift平移及Fit歸零，旋轉角度保持');

 await page.locator('#pm3dTheme').selectOption('light');await page.locator('#pm3dTheme').selectOption('dark');
 A.equal(await page.locator('.pm3d-advanced').evaluate(el=>el.open),false);await page.locator('.pm3d-advanced summary').click();
 for(const id of ['pm3dAll','pm3dSlice','pm3dGrid','pm3dLabels']){A.equal(await page.locator('#'+id).getAttribute('type'),'checkbox');A(await page.locator('#'+id).isEnabled());}
 await page.locator('#pm3dGrid').uncheck();await page.locator('#pm3dGrid').check();await page.locator('#pm3dLabels').uncheck();await page.locator('#pm3dLabels').check();
 await page.locator('#pm3dOpacity').focus();await page.keyboard.press('Home');A.equal(await page.locator('#pm3dOpacity').inputValue(),'20');await page.keyboard.press('End');A.equal(await page.locator('#pm3dOpacity').inputValue(),'85');await unchanged(baseline);
 checks.push('深淺色、格線、標籤及20～85透明度只改圖面，不改計算');

 await page.locator('#pm3dCaseList button[data-pm-case="1"]').click();await page.waitForTimeout(100);A.equal(await page.evaluate(()=>selected),1);A.equal(await page.locator('#pm3dCase').inputValue(),'1');
 await page.locator('#pm3dCase').selectOption('0');await page.waitForTimeout(100);A.equal(await page.evaluate(()=>selected),0);await unchanged(baseline);
 checks.push('載重列表與既有選單互相同步，不變更載重資料');

 await page.locator('#pm3dView').selectOption('iso');await page.locator('#pm3dFit').click();await page.waitForTimeout(120);
 const hit=await page.evaluate(()=>pm3dHits.find(h=>h.case===0));A(hit);const cb=await bounds();await page.mouse.move(cb.x+hit.x,cb.y+hit.y);await page.waitForTimeout(100);
 A(await page.evaluate(()=>!!pm3dHover));A(await page.locator('#pm3dTooltip').isVisible());const tooltip=await page.locator('#pm3dTooltip').innerText();A(tooltip.includes('U1'));A(/300/.test(tooltip));A(/20/.test(tooltip));A(/10/.test(tooltip));
 await page.mouse.move(cb.x+4,cb.y+4);await page.waitForTimeout(80);A(!(await page.locator('#pm3dTooltip').isVisible()));
 checks.push('需求點Hover顯示組合名、Pu及Mx／My，移開清除');

 const capacityHit=await page.evaluate(()=>{const b=$('pm3dCanvas').getBoundingClientRect();return pm3dVertices.find(v=>v.type==='capacity'&&v.x>30&&v.x<b.width-30&&v.y>80&&v.y<b.height-35&&pm3dHits.every(h=>Math.hypot(v.x-h.x,v.y-h.y)>30));});A(capacityHit);
 const capacityBox=await bounds();await page.mouse.move(capacityBox.x+capacityHit.x,capacityBox.y+capacityHit.y);await page.waitForTimeout(100);A.equal(await page.evaluate(()=>pm3dHover?.type),'capacity');
 const capacityTooltip=await page.locator('#pm3dTooltip').innerText();for(const token of ['容量取樣點','φPn','φMnx','φMny','中性軸法向角'])A(capacityTooltip.includes(token),capacityTooltip);
 A(await page.evaluate(()=>['P','mx','my','phi','theta'].every(k=>Number.isFinite(pm3dHover.point[k]))));await page.mouse.move(capacityBox.x+4,capacityBox.y+4);
 checks.push('實際容量點Hover含φPn、φMnx／φMny、φ及中性軸法向角');

 await page.locator('#pm3dSliceMode').selectOption('free');await page.locator('#pm3dSliceP').fill('123.456');await sliceReady(123.456);
 const exact=await page.evaluate(()=>{const d=pm3dSliceData,s=result.s,g=result.g;return {valid:d.valid,count:d.points.length,maxError:Math.max(...[0,17,43,79,119].map(i=>{const p=d.points[i],v=RCC.capacityAtP(s,g,p.theta,d.P);return Math.max(Math.abs(p.mx-v.mx),Math.abs(p.my-v.my),Math.abs(p.P-v.dp));}))};});
 A(exact.valid);A.equal(exact.count,120);A(exact.maxError<1e-4,JSON.stringify(exact));await unchanged(baseline);
 checks.push('任意Pu=123.456 tf以120方向直接求解，抽查與核心逐點一致');

 await page.locator('#pm3dSliceP').fill('150');await page.locator('#pm3dSliceP').fill('200');await page.locator('#pm3dSliceP').fill('271.125');await sliceReady(271.125);await page.waitForTimeout(400);A.equal(await page.evaluate(()=>pm3dSliceData.P),271.125);await unchanged(baseline);
 checks.push('切片連續輸入取消舊工作，只顯示最新Pu，不改D/C或快照');

 const limits=await page.evaluate(()=>({upper:pm3dModel.Pmax+20,lower:-pm3dModel.Tmax-20}));
 for(const P of [limits.upper,limits.lower]){await page.locator('#pm3dSliceP').fill(String(P));await sliceReady(P);const d=await page.evaluate(()=>({valid:pm3dSliceData.valid,count:pm3dSliceData.points.length,reason:pm3dSliceData.reason}));A.equal(d.valid,false);A.equal(d.count,0);A(d.reason);A((await page.locator('#pm3dSliceInfo').innerText()).length>0);}
 await unchanged(baseline);checks.push('拉力／壓力超界返回無效空切片與明確提示，無虛構輪廓');

 await page.locator('#pm3dSliceP').fill('180');await sliceReady(180);
 await page.locator('#pm3dSliceRange').focus();await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>pm3dSliceData&&!pm3dSliceJob&&Math.abs(pm3dSliceData.P-Number($('pm3dSliceRange').value))<1e-6);
 await page.locator('#pm3dSliceReset').click();await sliceReady(300);A.equal(await page.locator('#pm3dSliceMode').inputValue(),'load');
 await page.locator('#pm3dCaseList button[data-pm-case="1"]').click();await sliceReady(220);A.equal(await page.evaluate(()=>pm3dSliceData.P),220);await page.locator('#pm3dCase').selectOption('0');await sliceReady(300);
 checks.push('滑桿自由切片、Reset跟隨載重Pu、選取另一組同步切片');

 await page.locator('#layout').selectOption('custom');await ready();await page.locator('#customExample').click();await ready();const customSnapshot=await capture(),pureP=await page.evaluate(()=>-pm3dModel.Tmax);
 await page.locator('#pm3dSliceMode').selectOption('free');await page.locator('#pm3dSliceP').fill(String(pureP));await sliceReady(pureP);
 const pure=await page.evaluate(()=>{const d=pm3dSliceData,g=result.g,p=d.points[0];return {valid:d.valid,count:d.points.length,mx:p.mx,my:p.my,expectedMx:d.P*g.cy/100,expectedMy:d.P*g.cx/100,allSame:d.points.every(v=>v.mx===p.mx&&v.my===p.my),projected:pm3dVertices.filter(v=>v.type==='slice').every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)),sliceCount:pm3dVertices.filter(v=>v.type==='slice').length};});
 A(pure.valid);A.equal(pure.count,120);A(pure.allSame);A(Math.abs(pure.mx-pure.expectedMx)<1e-10);A(Math.abs(pure.my-pure.expectedMy)<1e-10);A(Math.hypot(pure.mx,pure.my)>1e-5);A(pure.projected);A.equal(pure.sliceCount,120);await unchanged(customSnapshot);
 await page.locator('#pm3dSlice').uncheck();await page.waitForTimeout(80);A.equal(await page.evaluate(()=>pm3dVertices.filter(v=>v.type==='slice').length),0);await page.locator('#pm3dSlice').check();await page.waitForTimeout(80);A.equal(await page.evaluate(()=>pm3dVertices.filter(v=>v.type==='slice').length),120);
 await page.locator('#exampleSmall').click();await ready();await page.locator('#pm3dSliceReset').click();await sliceReady(300);
 checks.push('非對稱純拉自由切片120重複點依鋼筋形心偏移，切換顯示正常且圖面不崩潰');

 await page.locator('.pm3d-advanced summary').click();

 await page.locator('#pm3dMaximize').click();A(await page.locator('#surfaceCard').evaluate(el=>el.classList.contains('pm3d-maximized')));await page.waitForTimeout(80);
 await page.screenshot({path:path.resolve(__dirname,'pm3d-pro-max.png')});
 const maxSize=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth}));A(maxSize.sw<=maxSize.w+1,JSON.stringify(maxSize));
 await page.keyboard.press('Escape');A(!(await page.locator('#surfaceCard').evaluate(el=>el.classList.contains('pm3d-maximized'))));A.equal(await page.evaluate(()=>document.activeElement.id),'pm3dMaximize');
 await page.locator('#pm3dMaximize').click();await page.locator('#pm3dMaximize').click();A(!(await page.locator('#surfaceCard').evaluate(el=>el.classList.contains('pm3d-maximized'))));
 checks.push('最大化／復原、Escape退出與焦點歸還，無水平溢出');

 const exportSnapshot=await capture();await page.evaluate(()=>{window.__pmExportTexts=[];window.__pmOriginalFillText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.__pmExportTexts.push(String(text));return window.__pmOriginalFillText.call(this,text,...args);};});
 const pngEvent=page.waitForEvent('download');await page.locator('#pm3dPNG').click();const png=await pngEvent,pngFile=path.join(scratch,'pro-export.png');await png.saveAs(pngFile);const bytes=fs.readFileSync(pngFile);A.equal(bytes.subarray(1,4).toString(),'PNG');
 const exportData=await page.evaluate(()=>({texts:window.__pmExportTexts.join('\n'),name:result.s.name,b:result.s.b,h:result.s.h,width:$('pm3dCanvas').width}));
 await page.evaluate(()=>{CanvasRenderingContext2D.prototype.fillText=window.__pmOriginalFillText;delete window.__pmExportTexts;delete window.__pmOriginalFillText;});
 const pngWidth=bytes.readUInt32BE(16);A(pngWidth>=2000||pngWidth>=exportData.width*2);A(exportData.texts.includes(exportData.name));A(exportData.texts.includes(String(exportData.b)));await unchanged(exportSnapshot);
 checks.push('PNG高解析輸出含本次柱資料報告資訊，PNG寬度'+pngWidth+'px');

 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(80);
  let size=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth}));A(size.sw<=size.w+1,JSON.stringify({width,...size}));
  await page.locator('#pm3dMaximize').click();await page.waitForTimeout(80);size=await page.evaluate(()=>({w:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth}));A(size.sw<=size.w+1,JSON.stringify({width,...size}));
  await page.locator('#pm3dFit').click();await page.locator('#pm3dTool').selectOption('pan');await drag({dx:25,dy:10});A(Math.abs((await page.evaluate(()=>pm3dPan)).x)>5);await page.locator('#pm3dFit').click();
  await page.locator('#pm3dMaximize').click();await page.locator('#pm3dTool').selectOption('rotate');
  checks.push(width+'px一般及最大化無全頁水平溢出，工具列可操作');
 }

 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,scrollY+$('surfaceCard').getBoundingClientRect().top-65));await page.waitForTimeout(80);await page.screenshot({path:path.resolve(__dirname,'pm3d-pro-mobile.png')});

 await page.setViewportSize({width:1440,height:1000});await page.locator('#pm3dMaximize').click();
 const offlineEvent=page.waitForEvent('download');await page.evaluate(()=>$('offlineTop').click());const offline=await offlineEvent,offlineFile=path.join(scratch,'pro-offline.html');await offline.saveAs(offlineFile);
 const p2=await ctx.newPage();observe(p2);await p2.goto('file://'+offlineFile);await ready(p2);
 A(!(await p2.locator('#surfaceCard').evaluate(el=>el.classList.contains('pm3d-maximized'))));A.notEqual(await p2.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');A.equal(await p2.evaluate(()=>pm3dModel.points),1740);
 checks.push('最大化狀態下載离線再開啟，清除body鎖定並正常重建曲面');
 await page.locator('#pm3dMaximize').click();

 const docSnapshot=await capture(),docEvent=page.waitForEvent('download');await page.locator('#docxTop').click();const doc=await docEvent,docFile=path.join(scratch,'pro-regression.docx');await doc.saveAs(docFile);A.equal(fs.readFileSync(docFile).subarray(0,2).toString(),'PK');await unchanged(docSnapshot);
 checks.push('原生可編輯DOCX匯出仍有效，計算輸入快照保持一致');

 await page.locator('.nav button[data-view="loads"]').click();await page.locator('#loadEditor input[data-i="0"][data-k="Vx"]').fill('10000');await ready();
 A.equal(await page.evaluate(()=>result.cases[0].pass),true);A.equal(await page.evaluate(()=>result.cases[0].allPass),false);await page.locator('.nav button[data-view="overview"]').click();
 const passText=await page.locator('#pm3dCaseList button[data-pm-case="0"]').innerText();A(/容量內|軸彎通過/.test(passText),passText);await page.locator('#exampleSmall').click();await ready();
 checks.push('載重點／列表只依軸彎c.pass，剪力失敗不誤標軸彎容量外');

 await page.locator('#pm3dSliceMode').selectOption('free');await page.locator('#pm3dSliceP').fill('150');await page.locator('#fc').fill('420');await page.waitForFunction(()=>result?.s.fc===420&&pm3dModel&&!pm3dJob&&!pm3dStale);await sliceReady(150);A.equal(await page.evaluate(()=>JSON.parse(pm3dModel.key)[2]),420);await page.locator('#exampleSmall').click();await ready();
 checks.push('切片／曲面同時變更材料，取消過期資料並使用新斷面重算');
 await page.locator('#b').fill('');await page.waitForFunction(()=>result===null);A.equal(await page.evaluate(()=>pm3dModel),null);A.equal(await page.evaluate(()=>pm3dSliceData),null);A.equal(await page.evaluate(()=>pm3dSliceJob),null);A(await page.locator('#pm3dPNG').isDisabled());await page.locator('#exampleSmall').click();await ready();
 checks.push('無效斷面清空專業版曲面／切片及匯出，範例可復原');

 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.setOffline(true);const mp=await mobile.newPage();observe(mp);await mp.goto('file://'+path.resolve(__dirname,'dist/index.html'));await ready(mp);const cdp=await mobile.newCDPSession(mp);
 await mp.locator('#pm3dTool').selectOption('rotate');let mb=await bounds(mp),ax=mb.x+mb.width*.4,ay=mb.y+Math.min(180,mb.height*.5);const myaw=await mp.evaluate(()=>pm3dYaw),scroll=await mp.evaluate(()=>scrollY);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:ax,y:ay,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:ax+40,y:ay+20,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});A(Math.abs(await mp.evaluate(()=>pm3dYaw)-myaw)>.1);A.equal(await mp.evaluate(()=>scrollY),scroll);
 checks.push('手機真實單指旋轉，不誤捲動頁面');
 await mp.locator('#pm3dTool').selectOption('pan');mb=await bounds(mp);ax=mb.x+mb.width*.4;ay=mb.y+Math.min(180,mb.height*.5);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:ax,y:ay,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:ax+30,y:ay+15,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});A(Math.abs((await mp.evaluate(()=>pm3dPan)).x)>10);
 const oldZoom=await mp.evaluate(()=>pm3dZoom);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:mb.x+65,y:ay,id:1},{x:mb.x+160,y:ay,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:mb.x+40,y:ay,id:1},{x:mb.x+190,y:ay,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});A(await mp.evaluate(()=>pm3dZoom)>oldZoom);await mp.locator('#pm3dFit').click();A.deepEqual(await mp.evaluate(()=>pm3dPan),{x:0,y:0});
 checks.push('手機真實單指平移、雙指縮放及Fit可操作');

 A.equal(errors.length,0,JSON.stringify(errors));A.equal(requests.length,0,JSON.stringify(requests));checks.push('完全離線、零外部資源請求及零JavaScript錯誤');
 fs.writeFileSync(path.join(__dirname,'surface-pro-ui-validation.json'),JSON.stringify({version:'1.5.0',date:'2026-10-07',checks,errors,requests},null,2));
 console.log(checks.join('\n'));console.log('Temporary test downloads: '+scratch);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
