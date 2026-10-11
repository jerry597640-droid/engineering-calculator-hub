const assert=require('assert'),C=require('../engine.js'),fs=require('fs'),path=require('path');
const base=require('../example-project.json').model,reference=require('../verification.json').checks.find(c=>c.name==='Search and slice refinement').detail;
const results=[];
for(const [name,m,want] of [['base',base,reference.baseFS],['fine',{...base,slices:120,density:20},reference.fineFS]]){
 const actual=C.run(m).results.map(r=>r.best.fs);
 actual.forEach((v,i)=>assert(Math.abs(v-want[i])<1e-10));results.push({name,actual,expected:want,pass:true});
}
assert(C.benchmarks().every(b=>b.pass));
const output=process.env.SLOPE_VERIFY_OUTPUT||path.join(__dirname,'live-output');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'numerical-regression.json'),JSON.stringify({results,benchmarks:C.benchmarks().map(({rows,...b})=>b)},null,2));console.log(JSON.stringify(results,null,2));
