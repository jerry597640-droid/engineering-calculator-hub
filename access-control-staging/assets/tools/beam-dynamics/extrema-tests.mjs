import assert from 'node:assert/strict';
import {build,statics,moving,dynamic} from './solver.js';
import {peakSummary,peakLocation,unitRoots} from './extrema.js';
import {movingAtDistance} from './live-loads.js';

const base={spans:[{L:10,E:200,I:.0008,mass:800}],supports:['pin','roller'],loads:[],axles:[{p:100,offset:0}],
  mode:'static',mesh:8,selfWeight:false,direction:1,factor:1,speed:60,step:2,dt:.01,damping:2,tail:.1};
const close=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),a+' != '+b);
function one(loads){
  const model=build({...base,loads});
  const analysis={frames:[{front:0,t:0,result:statics(model)}]};
  return {model,analysis,peaks:peakSummary(analysis)};
}
// An eccentric point load has its deflection extremum away from the force and from mesh stations.
const point=one([{type:'point',x:3,p:100}]);
const b=Math.sqrt((100-9)/3),x=10-b,EI=200e6*.0008;
close(point.peaks.D.control.x,x);
close(point.peaks.D.control.value,-100*3*b*(100-9-b*b)/(6*10*EI)*1000);
close(point.peaks.M.control.value,210);close(point.peaks.M.control.x,3);
close(point.peaks.V.control.value,70);
const varying=one([{type:'line',a:0,b:10,w1:8,w2:-7}]);
close(varying.peaks.V.min.x,8/1.5);close(varying.peaks.V.min.value,15-8**2/(2*1.5));
assert.equal(one([]).peaks.D.control.value,0);
const twoSpanModel=build({...base,mesh:12,spans:[base.spans[0],base.spans[0]],supports:['pin','roller','roller'],
  loads:[{type:'line',a:0,b:20,w1:10,w2:10},{type:'point',x:5,p:50}]});
const twoSpan={frames:[{result:statics(twoSpanModel)}]};
const two=peakSummary(twoSpan);
close(two.M.control.value,-171.875);
assert.match(peakLocation(twoSpanModel,twoSpan,'M',two.M.control),/第 1、2 跨交界 · B 支點/);
close(two.V.control.value,-92.1875);
assert.match(peakLocation(twoSpanModel,twoSpan,'V',two.V.control),/第 1 跨 · B 支點左側/);
assert.equal(two.D.control.value.toFixed(2),'-8.03');
const roots=unitRoots([-.08,.66,-1.5,1]);[.2,.5,.8].forEach((r,i)=>close(roots[i],r));
for(const mode of ['moving','dynamic']){
  const model=build({...base,mode,direction:-1});
  const sweep=await (mode==='moving'?moving(model):dynamic(model));
  const {analysis,index}=mode==='moving'?movingAtDistance(sweep,model,4.321,statics):{analysis:sweep,index:3};
  if(mode==='moving'){
    const peak=peakSummary(analysis,index).M.control;
    close(peak.x,10-4.321);close(peak.value,100*peak.x*(10-peak.x)/10);
  }
  const all=peakSummary(analysis);
  for(const key of ['M','V','D']){
    const p=all[key].control;
    close(analysis.frames[p.frame].result.at(p.x,p.side||1)[key],p.value);
    assert.match(peakLocation(model,analysis,key,p),/第 1 跨/);
    for(const fr of analysis.frames){
      for(let j=0;j<=50;j++){
        const q=fr.result.at(j/5,j===50?-1:1)[key];
        assert.ok(q>=all[key].min.value-1e-5&&q<=all[key].max.value+1e-5);
      }
    }
  }
}
console.log('Verified signed section and frame extrema, off-grid deflection, varying loads, moving and dynamic peaks.');
