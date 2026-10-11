/* Independent three-moment recurrence checks for 2–11 span beams. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),B=require('../beam-core.js');
let checks=0;
function near(a,b,label){assert.ok(Math.abs(a-b)<2e-8*Math.max(1,Math.abs(b)),label+': '+a+' != '+b);checks++;}
function threeMoment(lengths,weights){
 const n=lengths.length,lower=[],diag=[],upper=[],rhs=[];
 for(let j=1;j<n;j++){const a=lengths[j-1],b=lengths[j];lower.push(a);diag.push(2*(a+b));upper.push(b);rhs.push(-(weights[j-1]*a**3+weights[j]*b**3)/4);}
 for(let i=1;i<n-1;i++){const f=lower[i]/diag[i-1];diag[i]-=f*upper[i-1];rhs[i]-=f*rhs[i-1];}
 const M=Array(n+1).fill(0);for(let i=n-2;i>=0;i--)M[i+1]=(rhs[i]-upper[i]*M[i+2])/diag[i];return M;
}
const cases=[];
for(let n=2;n<=11;n++)for(const equal of [true,false]){
 const lengths=Array.from({length:n},(_,i)=>equal?6:3+(i%4)*.8),weights=Array.from({length:n},(_,i)=>equal?10:5+(i%3)*4);
 const m=B.continuousModel(B.example(),lengths);let x=0;m.loads=lengths.map((L,i)=>{const a=x;x+=L;return {name:'第'+(i+1)+'跨UDL',type:'distributed',a,b:x,q0:weights[i],q1:weights[i],group:'D',enabled:true};});
 const solution=B.solve(B.compile(m)),moments=threeMoment(lengths,weights),reactions=Array(n+1).fill(0);
 x=0;for(let i=0;i<n;i++){const L=lengths[i],w=weights[i],left=w*L/2+(moments[i+1]-moments[i])/L;reactions[i]+=left;reactions[i+1]+=w*L-left;near(B.evaluate(solution,x,'right').M,moments[i],n+' spans support M');near(B.evaluate(solution,x,'right').y,0,'support displacement');x+=L;}
 near(B.evaluate(solution,x,'left').M,0,'end moment');near(B.evaluate(solution,x,'left').y,0,'end displacement');
 reactions.forEach((R,i)=>near(solution.reactions[i].R,R,n+' spans reaction '+i));near(reactions.reduce((a,b)=>a+b,0),weights.reduce((sum,w,i)=>sum+w*lengths[i],0),'vertical equilibrium');
 cases.push({spans:n,equal,moments,reactions});
}
const original=B.example(),snapshot=JSON.stringify(original),unequal=B.continuousModel(original,[4,6,5]);
assert.equal(JSON.stringify(original),snapshot);assert.equal(unequal.length,15);assert.deepEqual(unequal.supports.map(s=>s.x),[0,4,10,15]);assert.equal(unequal.loads[0].b,15);assert.equal(unequal.loads[0].q0,10);checks+=5;
const partial=B.example();partial.loads[0].a=1;partial.loads[0].b=5;partial.loads.push({type:'point',name:'point',group:'L',enabled:true,x:3,value:20});const kept=B.continuousModel(partial,[4,6,5]);assert.equal(kept.loads[0].a,1);assert.equal(kept.loads[0].b,5);assert.equal(kept.loads[1].x,3);checks+=3;
const noExtension=B.continuousModel(original,[6,6,6],false);assert.equal(noExtension.loads[0].b,6);checks++;
for(const invalid of [[6],Array(12).fill(6),[6,0],[6,-1],[6,NaN],[6,Infinity],[6,'6'],[600,600]]){assert.throws(()=>B.continuousModel(original,invalid));assert.equal(JSON.stringify(original),snapshot);checks+=2;}
const outOfRange=B.example('point');outOfRange.loads[0].x=5;const before=JSON.stringify(outOfRange);assert.throws(()=>B.continuousModel(outOfRange,[2,2]),/位置超出梁長/);assert.equal(JSON.stringify(outOfRange),before);checks+=2;
for(const name of ['three-span','four-span','unequal-span'])B.validate(B.example(name));checks+=3;
const triple=B.summarize(B.solve(B.compile(B.example('three-span'))),B.example('three-span'));near(triple.Mplus.value,28.8,'3-span positive moment');near(triple.Mminus.value,36,'3-span support moment');
const result={status:'passed',checks,range:'2–11 spans',method:'Independent three-moment recurrence for span UDL, plus atomic geometry/load validation',cases:cases.length,reference:cases.filter(c=>c.equal&&c.spans<=4)};
fs.writeFileSync(path.join(__dirname,'spans-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
