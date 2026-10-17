const assert=require('node:assert/strict'),fs=require('node:fs');
const {compactness,calc}=require('./engine.js');
const p={H:50,B:20,tw:1,tf:1.6,Fy:325,d:18,nt:2,nb:0,Lb:100,M:20,Fb:0,add:1.5};
const tests=[];
function test(name,fn){fn();tests.push(name);console.log('PASS',name)}
function near(a,b){assert(Math.abs(a-b)<1e-11,`${a} versus ${b}`)}
test('official table limits, independently calculated decimal reference',()=>{
 const r=compactness(p);near(r.b,10);near(r.h,46.8);near(r.flange,6.25);near(r.web,46.8);
 near(r.fy,3.3140776921782668);near(r.flangeLimit,9.338294771036585);near(r.webLimit,93.38294771036585);
 near(r.flangeRatio,.669287075771568);near(r.webRatio,.5011621623377501);assert(r.compact);
});
test('flange alone controls',()=>{const r=compactness({...p,B:40});assert(!r.flangePass&&r.webPass&&!r.compact)});
test('web alone controls',()=>{const r=compactness({...p,tw:.4});assert(r.flangePass&&!r.webPass&&!r.compact)});
test('both elements can exceed limits',()=>{const r=compactness({...p,B:40,tw:.4});assert(!r.flangePass&&!r.webPass&&!r.compact)});
const boundary={H:172,B:34,tw:1,tf:1,Fy:98.0665};
test('equality is included for both compact limits',()=>assert(compactness(boundary).compact));
test('flange boundary uses full precision',()=>{assert(compactness({...boundary,B:34-1e-8}).flangePass);assert(!compactness({...boundary,B:34+1e-8}).flangePass)});
test('web boundary uses full precision',()=>{assert(compactness({...boundary,H:172-1e-8}).webPass);assert(!compactness({...boundary,H:172+1e-8}).webPass)});
test('uniform dimension scaling preserves classification',()=>{const a=compactness(p),b=compactness({...p,H:p.H*10,B:p.B*10,tw:p.tw*10,tf:p.tf*10});near(a.flangeRatio,b.flangeRatio);near(a.webRatio,b.webRatio);assert.equal(a.compact,b.compact)});
test('high-strength material restriction is separate from compact geometry',()=>{const r=calc({...p,Fy:500});assert(r.compact&&!r.auto);assert(!compactness({...p,Fy:500}).materialPass)});
test('long unbraced length does not change compactness',()=>{const r=calc({...p,Lb:480});assert(r.compact&&!r.auto);assert.equal(r.mn,null)});
test('moment sign and hole count do not relabel the gross section',()=>{const a=calc(p),b=calc({...p,M:-20,nt:0,nb:2});assert.equal(a.compact,b.compact);assert.deepEqual(compactness(p),compactness({...p,M:-20,nt:0,nb:2}))});
test('blank, nonpositive and impossible geometry are rejected',()=>{for(const x of [{H:NaN},{B:0},{tw:-1},{tf:25},{B:.5},{Fy:Infinity}])assert.throws(()=>compactness({...p,...x}))});
fs.writeFileSync(__dirname+'/compact-verification.json',JSON.stringify({date:'2026-10-17',passed:tests.length,source:'TW ASD 4.5, Table 4.5-1 and 7.2.1',source_url:'https://www.nlma.gov.tw/uploads/files/e7c2c9d73eefc69beecde12336374b9b.pdf',tests,example:compactness(p)},null,2));
