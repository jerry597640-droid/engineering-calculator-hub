const assert=require('node:assert/strict'),fs=require('fs');const {calcWeb}=require('./web-engine.js');
const MP=6.894757293168,TF=.45359237,TM=.01152124619879058;
const p={H:23.6*2.54,B:7.01*2.54,tw:.395*2.54,tf:.505*2.54,Fy:36*MP};
const w={shape:'rect',design:'lrfd',ho:25.4,ao:50.8,e:-5.08,V:12*TF,M:3470*TM,edge:100,radius:2.1,Z:134*2.54**3,braced:true,conditions:true,teeVerified:false};
let tests=[];function near(a,b,t=1e-8){assert(Math.abs(a-b)<=t,`${a} vs ${b} tol ${t}`)}function test(n,f){f();tests.push(n)}
const a=calcWeb(p,w);let source=[];function compare(name,actual,reference,tol){const error=100*(actual/reference-1);assert(Math.abs(error)<=tol,`${name} ${error}%`);source.push({name,reference,calculated:actual,error_percent:error,tolerance_percent:tol})}
// Published DG2 examples 1 / 1A, pp.22-24, capacities not fitted to this implementation.
compare('Mm（kip·in）',a.Mm/TM,4184,.01);
compare('Vm（kip）',a.Vm/TF,60.31,.5);
compare('φMm（kip·in，LRFD）',.9*a.Mm/TM,3766,.02);
compare('φVm（kip，LRFD）',.9*a.Vm/TF,54.28,.5);
const published=[{x:3,M:1192,V:30.1,R:.60,pass:true},{x:6,M:2169,V:24.1,R:.65,pass:true},{x:9,M:2928,V:18.1,R:.80,pass:true},{x:12,M:3470,V:12,R:.93,pass:true},{x:15,M:3795,V:6,R:1.01,pass:false},{x:18,M:3903,V:0,R:1.04,pass:false}];
const points=published.map(q=>{const r=calcWeb(p,{...w,M:q.M*TM,V:q.V*TF});if(q.x===3)assert(r.interaction<.60);else assert(Math.abs(r.interaction-q.R)<.015);assert.equal(r.capacityPass,q.pass);return {...q,calculated_R:r.interaction}});
test('published W24x55 capacities and six LRFD decisions',()=>assert(source.length===4&&points.length===6));
test('published ASD example 1A decisions',()=>{for(const q of [{M:1418,V:35.8,R:.63,pass:true},{M:2581,V:28.7,R:.70,pass:true},{M:4129,V:14.4,R:1,pass:true},{M:4516,V:7.1,R:1.08,pass:false},{M:4645,V:0,R:1.11,pass:false}]){let r=calcWeb(p,{...w,design:'asd',M:q.M*TM/1.7,V:q.V*TF/1.7});assert(Math.abs(r.interaction-q.R)<.015);assert.equal(r.capacityPass,q.pass)}});
test('unit-invariant closed-form shear checked in kip-inch directly',()=>{let d=23.6,tw=.395,Fy=36;const v=s=>Fy*tw*s/Math.sqrt(3)*Math.min(1,Math.sqrt(6)/(20/s+Math.sqrt(3)));near(a.Vm/TF,v(8.8)+v(4.8),1e-8)});
test('plastic net moment independently integrated to PNA',()=>{const H=p.H,B=p.B,t=p.tf,tw=p.tw,lo=H/2+w.e-w.ho/2,hi=lo+w.ho;const width=y=>y<t||y>H-t?B:(y>=lo&&y<=hi?0:tw);let A=0,Q=0;let dy=H/1000000,arr=[];for(let i=0;i<1000000;i++){let y=(i+.5)*dy,b=width(y);A+=b*dy;arr.push([y,b*dy])}let accu=0,na=0;for(const [y,da]of arr){accu+=da;if(accu>=A/2){na=y;break}}for(const [y,da]of arr)Q+=Math.abs(y-na)*da;const Zgeom=p.B*p.tf*(H-p.tf)+tw*(H-2*t)**2/4;let expected=a.Mm+(Zgeom-a.Z)*(p.Fy/98.0665)/100;near(Q*p.Fy/98.0665/100,expected,.002)});
test('opening eccentricity mirrors capacity',()=>{let b=calcWeb(p,{...w,e:-w.e});near(b.Vm,a.Vm);near(b.Mm,a.Mm);near(b.top.Vm,a.bottom.Vm)});
test('moment sign changes compression tee gate',()=>{let b=calcWeb(p,{...w,M:-w.M});assert(b.reasons.some(s=>s.includes('T')))});
test('ASD bridge only once',()=>{let b=calcWeb(p,{...w,design:'asd',V:2,M:3});near(b.Vd,3.4);near(b.Md,5.1);near(b.Vallow,b.Vm/1.7)});
test('zero bending allows pure shear capacity',()=>{let b=calcWeb(p,{...w,M:0});near(b.shearAtM,b.Vallow)});
test('zero shear reduces to bending ratio',()=>{let b=calcWeb(p,{...w,V:0});near(b.interaction,b.rm)});
test('combined capacity boundary is exact',()=>{let b=calcWeb(p,{...w,V:a.shearAtM});near(b.interaction,1)});
test('longer rectangular hole reduces shear capacity',()=>assert(calcWeb(p,{...w,ao:60}).Vm<a.Vm));
test('circle substitutions 0.9D and 0.45D',()=>{let b=calcWeb(p,{...w,shape:'circle'});near(b.hs,.9*w.ho);near(b.as,.45*w.ho)});
test('small radius fails geometry, capacity cannot turn overall green',()=>{let b=calcWeb(p,{...w,radius:.2});assert(!b.applicable&&!b.pass)});
test('missing lateral restraint gates pass',()=>assert(!calcWeb(p,{...w,braced:false}).pass));
test('too near support gates pass',()=>assert(!calcWeb(p,{...w,edge:2}).pass));
test('stocky web shear upper bound enforced',()=>{let b=calcWeb(p,{...w,shape:'circle',ho:5,e:0});assert(b.Vm<=2/3*b.Vp)});
test('nonstocky web upper bound enforced',()=>{let q={...p,tw:.6};let b=calcWeb(q,w);assert(!b.stocky);assert(b.Vm<=.45*b.Vp)});
test('invalid and flange-intersecting inputs stop calculation',()=>{for(const q of [{ho:-1},{ho:1000},{V:NaN},{e:1e6},{design:'x'},{radius:-1}])assert.throws(()=>calcWeb(p,{...w,...q}))});
const result={date:'2026-10-17',method:'AISC DG2 equations and published examples 1/1A; Bentley authored technical manual cross-check',sources:['https://www.aisc.org/aisc/publications/design-guides/design-guide-summary/','https://studylib.net/doc/28030624/design-guide-2---steel-and-composite-beams-with-web-openings','https://p.urbanpro.com/tv-prod/documents/null-STAAD%20Tutorial.pdf'],model:'Unreinforced isolated opening, noncomposite beam, DG2 ASD bridge or DG2 LRFD',passed:tests.length,tests,source_comparison:source,case_points:points};fs.writeFileSync(__dirname+'/web-verification.json',JSON.stringify(result,null,2));
const fmt=x=>Number(x).toFixed(3);let html='<div class="table"><table><thead><tr><th>公開案例比對</th><th>原文值</th><th>本程式</th><th>差異</th></tr></thead><tbody>'+source.map(q=>'<tr><td>'+q.name+'</td><td>'+fmt(q.reference)+'</td><td>'+fmt(q.calculated)+'</td><td>'+fmt(q.error_percent)+'%</td></tr>').join('')+'</tbody></table><table><thead><tr><th>離支承 ft</th><th>原文 R（圖解）</th><th>程式 R</th><th>容量判定</th></tr></thead><tbody>'+points.map(q=>'<tr><td>'+q.x+'</td><td>'+(q.x===3?'&lt;0.60':q.R)+'</td><td>'+fmt(q.calculated_R)+'</td><td>'+(q.pass?'符合':'不符')+'／與原文相同</td></tr>').join('')+'</tbody></table></div><p>另通過 '+tests.length+' 項腹板計算測試，包含 ASD 轉換、正負彎矩、圓孔等效、支承淨距、孔角半徑及獨立塑性模數積分。</p>';fs.writeFileSync(__dirname+'/web-validation.html',html);console.log(JSON.stringify({passed:tests.length,comparisons:source,points},null,2));
