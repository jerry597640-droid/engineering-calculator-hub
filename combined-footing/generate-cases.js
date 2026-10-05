const fs=require('fs'),F=require('./engine.js');let cases=Object.entries(F.examples).map(([name,p])=>({name,p})),seed=12437;
function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
for(let i=0;i<60;i++)cases.push({name:'random'+i,p:{...F.defaults,mode:i%2?'trap':'rect',L:7,a1:.7,spacing:4.5,b1:2+rnd(),b2:2+rnd(),D1:45+rnd()*35,D2:45+rnd()*35,Q1:rnd()*30,Q2:rnd()*30}});
let records=cases.map(({name,p})=>{let r=F.calc(p);return{name,p,g:r.g,valid:r.valid,errors:r.errors,invalidContact:r.invalidContact,overall:r.overall,checks:r.checks,reinforcement:r.reinforcement,punching:r.punching,models:r.models?.map(m=>({name:m.name,P:m.P,fD:m.fD,seg:m.seg,beamW:m.beamW,balanceV:m.balanceV,balanceM:m.balanceM,values:[.12,.25,.43,.51,.68,.82,.94].map(t=>({x:r.g.L*t,V:m.V(r.g.L*t),M:m.M(r.g.L*t),q:m.netQ(r.g.L*t)}))}))}});
fs.writeFileSync(__dirname+'/test-data.json',JSON.stringify(records));console.log('Generated '+records.length+' deterministic cases');
