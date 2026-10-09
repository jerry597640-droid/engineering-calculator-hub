/* v1.6 regression: effective perimeter nl, conservative seismic shear, and traceable offline reports. */
const A=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const pw=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));

(async()=>{
 const browser=await pw.chromium.launch({executablePath:'/tmp/chromium',args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await context.setOffline(true);
 const p=await context.newPage(),checks=[],errors=[],requests=[],temp=fs.mkdtempSync(path.join(os.tmpdir(),'rc-v16-regression-'));
 function observe(page){page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});}observe(p);
 const ready=async(page=p)=>{await page.waitForFunction(()=>result&&pm3dModel&&!pm3dStale&&!pm3dJob,{},{timeout:60000});await page.waitForTimeout(100);};
 const state=async(page=p)=>page.evaluate(()=>({snapshot:result.inputSnapshot,s:result.s,loads:result.loads,nl:result.det.nl,kn:result.det.kn,high:result.det.high,reqX:result.det.reqX,reqY:result.det.reqY,Ach:result.det.Ach,n:result.g.bars.length,ratios:result.cases.map(c=>c.ratio),shear:result.cases.map(c=>({x:c.sx,y:c.sy})),surfaceKey:pm3dModel.key}));
 const stable=async(before,page=p)=>A.equal((await state(page)).snapshot,before.snapshot);
 const textFromDocx=file=>execFileSync('python3',['-c',"import sys,zipfile,xml.etree.ElementTree as E\nwith zipfile.ZipFile(sys.argv[1]) as z:\n r=E.fromstring(z.read('word/document.xml'));print('\\n'.join(''.join(p.itertext()) for p in r.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')))",file],{encoding:'utf8',maxBuffer:8*1024*1024});

 await p.goto('file://'+path.resolve(__dirname,'dist/index.html'));await ready();
 await p.locator('#layout').selectOption('custom');await ready();await p.locator('#customExample').click();await ready();
 await p.locator('#mode').selectOption('seismic');await p.locator('#nl').fill('8');await p.locator('#supported').check();await ready();
 await p.locator('.nav [data-view="loads"]').click();await p.locator('#loadEditor [data-i="0"][data-k="P"]').fill('380');await ready();
 await p.locator('.nav [data-view="overview"]').click();await ready();const current=await state();
 A.equal(current.s.mode,'seismic');A.equal(current.s.layout,'custom');A.equal(current.s.nl,8);A.equal(current.nl,8);A.equal(current.n,12);A.equal(current.high,true);A(Math.abs(current.kn-8/6)<1e-12);
 const ratio=Math.max(.3*(current.s.b*current.s.h/current.Ach-1)*current.s.fc/current.s.fyt,.09*current.s.fc/current.s.fyt,.2*Math.max(current.s.fc/1750+.6,1)*(8/6)*380000/(current.s.fyt*current.Ach));
 A(Math.abs(current.reqX-ratio*current.s.s*(current.s.h-2*current.s.cover))<1e-10);A(Math.abs(current.reqY-ratio*current.s.s*(current.s.b-2*current.s.cover))<1e-10);
 checks.push('高軸力實際座標12根，nl=8只计有效核心周邊側撐筋，kn及圍束量与独立代入一致');

 for(const c of current.shear)for(const v of [c.x,c.y]){A.equal(v.phiV,.6);A.equal(v.Vc,0);const cap=.6*Math.min(v.Vs,2.12*Math.sqrt(current.s.fc)*v.bw*v.d/1000);A(Math.abs(v.cap-cap)<1e-10);A(Math.abs(v.ratio-v.demand/cap)<1e-12);}
 checks.push('耐震剪力兩向與各組合均用φv=0.60、Vc=0，容量及D/C独立核對');

 await p.locator('#pm3dSliceMode').selectOption('free');await p.locator('#pm3dSliceP').fill('330.125');await p.waitForFunction(()=>pm3dSliceData?.P===330.125&&!pm3dSliceJob);
 const slice=await p.evaluate(()=>({count:pm3dSliceData.points.length,valid:pm3dSliceData.valid,error:Math.max(...[0,17,43,79,119].map(i=>{const a=pm3dSliceData.points[i],b=RCC.capacityAtP(result.s,result.g,a.theta,a.P);return Math.max(Math.abs(a.mx-b.mx),Math.abs(a.my-b.my),Math.abs(a.P-b.dp));}))}));A(slice.valid);A.equal(slice.count,120);A(slice.error<1e-4);await stable(current);
 checks.push('耐震实际座標3D曲面与任意Pu精確切片可用，剪力改動不影響軸彎求解或專案快照');

 await p.locator('.nav [data-view="detail"]').click();const calculation=await p.locator('#calculation').innerText();
 A(/kn=nl\/\(nl[−-]2\)=8\/\(8[−-]2\)=1\.333333/.test(calculation),calculation.slice(-7000));A(calculation.includes('耐震φv=0.60'));A(calculation.includes('φVn=0.60'));A(calculation.includes('nl僅計核心周邊有效側撐筋'));
 const auditSums=await p.evaluate(()=>{const rows=[...document.querySelectorAll('.audit-bars table')[1].querySelectorAll('tbody tr')],parse=t=>Number(t.replace(/,/g,'')),sum=i=>rows.reduce((a,tr)=>a+parse(tr.children[i].textContent),0),w=result.cases[selected].witness;return {P:sum(5)+w.concrete,Ptarget:w.P/1000,Mx:sum(6)+w.concreteMx,Mxtarget:w.Mx/100000,My:sum(7)+w.concreteMy,Mytarget:w.My/100000};});for(const k of ['P','Mx','My'])A(Math.abs(auditSums[k]-auditSums[k+'target'])<1e-4);
 checks.push('高軸力計算明細列nl=8與φv=0.60，逐筋合力／力矩表與本次核心一致');

 const docEvent=p.waitForEvent('download');await p.locator('#docxTop').click();const doc=await docEvent,docFile=path.join(temp,'high-p-custom-nl8.docx');await doc.saveAs(docFile);A.equal(fs.readFileSync(docFile).subarray(0,2).toString(),'PK');const documentText=textFromDocx(docFile);A(documentText.includes('φv=0.6'),documentText.slice(0,2000));A(documentText.includes('nl=8'));A(documentText.includes('kn=nl/(nl-2)=8/(8-2)=1.3333333333333333'));A(documentText.includes('high比較：380×1000'));await stable(current);
 checks.push('原生DOCX的word/document.xml確實含φv=0.6、nl=8、高軸力kn代入及380tf，沒有沿用舊值');

 const jsonEvent=p.waitForEvent('download');await p.locator('#saveProject').click();const json=await jsonEvent,jsonFile=path.join(temp,'nl8-project.json');await json.saveAs(jsonFile);const project=JSON.parse(fs.readFileSync(jsonFile,'utf8'));A.equal(project.s.nl,8);A.equal(project.s.mode,'seismic');A.equal(project.loads[0].P,380);A.equal(project.s.customBars.length,12);
 await p.locator('.nav [data-view="overview"]').click();const offlineEvent=p.waitForEvent('download');await p.locator('#offlineTop').click();const offline=await offlineEvent,offlineFile=path.join(temp,'nl8-offline.html');await offline.saveAs(offlineFile);
 const p2=await context.newPage();observe(p2);await p2.goto('file://'+offlineFile);await ready(p2);const reopened=await state(p2);A.equal(reopened.snapshot,current.snapshot);A.equal(reopened.nl,8);A.equal(reopened.kn,current.kn);A.deepEqual(reopened.ratios,current.ratios);A.equal(reopened.shear[0].x.phiV,.6);A.equal(reopened.surfaceKey,current.surfaceKey);
 checks.push('JSON与單檔離線保存nl／seismic／高Pu及12根坐標，重開快照与D/C完全一致');

 await p.locator('#nl').fill('6');await ready();const changed=await state();A.equal(changed.nl,6);A.equal(changed.kn,1.5);A(changed.reqX>current.reqX);A.equal(changed.surfaceKey,current.surfaceKey);A.deepEqual(changed.ratios,current.ratios);A.notEqual(changed.snapshot,current.snapshot);
 await p.locator('#nl').fill('3');await p.waitForFunction(()=>result===null);A.equal(await p.evaluate(()=>pm3dModel),null);A(await p.locator('#docxTop').isDisabled());await p.locator('#nl').fill('13');await p.waitForTimeout(250);A.equal(await p.evaluate(()=>result),null);await p.locator('#nl').fill('8');await ready();
 checks.push('nl改6只改圍束要求，轴彎曲面／D/C保持；nl<4或>總根數確實拒絕並停用報告');

 await p.locator('#projectFile').setInputFiles(jsonFile);await ready();const imported=await state();A.equal(imported.snapshot,current.snapshot);A.equal(imported.nl,8);A.equal(imported.shear[0].x.phiV,.6);
 checks.push('JSON重匯入還原nl=8、本次耐震剪力折減與全部工程輸入');

 await p.locator('#layout').selectOption('layers');await ready();await p.locator('#nl').fill('12');await p.locator('#dX').fill('45');await p.locator('#dY').fill('45');await p.locator('#hx').fill('15.64');await p.locator('#supported').check();
 await p.locator('.nav [data-view="loads"]').click();await p.locator('#loadEditor [data-i="0"][data-k="P"]').fill('550');await ready();await p.locator('.nav [data-view="overview"]').click();await ready();const layered=await state();
 A.equal(layered.n,24);A.equal(layered.nl,12);A.equal(layered.kn,1.2);A.equal(layered.high,true);A.equal(layered.shear[0].x.phiV,.6);A(Math.abs(layered.reqX-6.043956043956044)<1e-10);A(Math.abs(layered.shear[0].x.cap-57.46850390257258)<1e-10);
 await p.locator('#nl').fill('4');await ready();const cornersOnly=await state();A.equal(cornersOnly.nl,4);A.equal(cornersOnly.kn,2);A(cornersOnly.reqX>layered.reqX);A.equal(cornersOnly.surfaceKey,layered.surfaceKey);A.deepEqual(cornersOnly.ratios,layered.ratios);
 checks.push('兩層24根高Pu550tf只取外層nl12，容量与獨立核心測例一致；nl4增加圍束要求、不改3D軸彎容量');
 A.equal(errors.length,0,JSON.stringify(errors));A.equal(requests.length,0,JSON.stringify(requests));checks.push('新情境完全離線、零外部請求與零JavaScript錯誤');

 const preceding=['surface-pro-ui-validation.json','audit-ui-validation.json'].map(name=>{const v=JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));return {file:name,count:v.checks.length,checks:v.checks,errors:v.errors||[],requests:v.requests||[]};});for(const v of preceding){A.equal(v.errors.length,0);A.equal(v.requests.length,0);}
 const output={version:'1.6.0',date:'2026-10-09',buildBytes:fs.statSync(path.join(__dirname,'dist/index.html')).size,existingSuites:preceding,checks,errors,requests,numericalEvidence:{highP:380,nl:current.nl,totalBars:current.n,kn:current.kn,reqX:current.reqX,reqY:current.reqY,shearPhi:current.shear[0].x.phiV,sliceError:slice.error,auditSums},testAdaptations:['僅將既有兩套測試的Chromium啟動參數改為已驗證可執行的/tmp/chromium與no-sandbox/disable-gpu/disable-dev-shm-usage；保留原來所有數值及UI判斷。']};
 fs.writeFileSync(path.join(__dirname,'regression-v16-validation.json'),JSON.stringify(output,null,2));console.log(checks.join('\n'));console.log('Existing suites: '+preceding.map(v=>v.file+' '+v.count).join(', '));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
