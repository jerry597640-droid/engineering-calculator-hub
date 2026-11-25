import assert from 'node:assert/strict';
import {vehicleModels,applyVehicleModel,vehicleLane,vehicleRenderShape} from './vehicle-models.js';
import {build,axleLoads} from './solver.js';

const base={spans:[{L:5,E:200,I:.001,mass:800}],supports:['pin','roller'],loads:[],axles:[{p:50,offset:0},{p:90,offset:2}],mode:'moving',mesh:8,selfWeight:false,direction:1,factor:1,speed:60,step:.5,dt:.01,damping:2,tail:0};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
// Include the user's edited bus: 5 m beam, 2 m axle spacing, front at 2.8 m.
const vehicles=[...vehicleModels.map(v=>applyVehicleModel(base,v.id)),{...base,vehicleType:'bus'}];
for(const template of vehicles)for(const length of [2,5,20,80])for(const width of [320,390,768,1440,2000])for(const direction of [1,-1]){
 const c={...template,spans:[{...base.spans[0],L:length}],direction},before=JSON.stringify(c);
 const left=35,right=width-35,scale=(right-left)/length,shape=vehicleRenderShape(c,scale),m=build(c);
 assert.ok(shape.height*scale<=44+1e-8);
 assert.ok(shape.radius*scale<=6+1e-8);
 assert.ok(shape.front*scale<=24+1e-8&&shape.back*scale<=24+1e-8);
 const rear=Math.max(...c.axles.map(a=>a.offset));
 for(const front of [0,2.8,length/2,length+rear]){
  const svg=vehicleLane(c,{front,length,left,right,width,contactY:160});
  assert.doesNotMatch(svg,/NaN|undefined|Infinity/);
  const [tx,ty,sx,sy]=svg.match(/transform="translate\(([-\d.e+]+),([-\d.e+]+)\) scale\(([-\d.e+]+),([-\d.e+]+)\)"/).slice(1).map(Number);
  const wheels=[...svg.matchAll(/<g data-vehicle-wheel="(\d+)"[^>]*><title>[^<]*<\/title><circle cx="([-\d.e+]+)" cy="0" r="([-\d.e+]+)"[^>]*\/><circle cx="[-\d.e+]+" cy="0" r="([-\d.e+]+)"/g)];
  assert.equal(wheels.length,c.axles.length);
  for(const [index,w] of wheels.entries()){
   const [,id,cx,hit,radius]=w.map(Number);
   assert.equal(id,index);
   const expected=direction===1?front-c.axles[index].offset:length-front+c.axles[index].offset;
   near(tx+Number(cx)*sx,left+expected*scale);
   near(ty+Number(radius)*sy,160);
   assert.ok(Number(hit)*sy>=22-1e-8,'44 px wheel touch target');
   const force=axleLoads(m,front).find(a=>a.axleIndex===index);
   if(force)near(tx+Number(cx)*sx,left+force.x*scale);
  }
  // Windows stay inside the body even when the user shortens a preset axle spacing.
  if(c.vehicleType==='bus'){
   const rects=[...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/g)].map(r=>r.slice(1).map(Number));
   const [body,...windows]=rects;
   for(const window of windows){
    assert.ok(window[0]>=body[0]&&window[0]+window[2]<=body[0]+body[2]+1e-8);
    assert.ok(window[1]>=body[1]&&window[1]+window[3]<=body[1]+body[3]);
   }
  }
  assert.match(svg,/stroke-width="1.3" vector-effect="non-scaling-stroke"/);
 }
 assert.equal(JSON.stringify(c),before,'Rendering must not change analysis inputs');
}
console.log('Vehicle proportions: true wheel/load coordinates, contact line, touch targets, window bounds and immutable inputs passed.');
