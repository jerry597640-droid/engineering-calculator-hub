import assert from 'node:assert/strict';
import {vehicleModels,applyVehicleModel,vehicleDescription,vehicleBody,vehicleLane} from './vehicle-models.js';
import {build,statics,axleLoads,validate} from './solver.js';
const base={spans:[{L:12,E:200,I:.001,mass:800}],supports:['pin','roller'],loads:[],axles:[{p:1,offset:0}],mode:'moving',mesh:8,selfWeight:false,direction:1,factor:2,speed:60,step:.5,dt:.01,damping:2,tail:0};
for(const v of vehicleModels)for(const direction of [1,-1]){
 const c=applyVehicleModel({...base,direction},v.id);validate(c);assert.equal(c.factor,1);assert.equal(base.axles[0].p,1);
 const m=build(c),front=8,loads=axleLoads(m,front),r=statics(m,front);
 const P=loads.reduce((s,a)=>s+a.p,0),RB=loads.reduce((s,a)=>s+a.p*a.x/12,0);
 assert.ok(Math.abs(r.reactions[1].R-RB)<1e-6);assert.ok(Math.abs(r.reactions[0].R-(P-RB))<1e-6);
 const svg=vehicleLane(c,{front,length:12,left:50,right:650,width:700});
 assert.doesNotMatch(svg,/NaN|undefined/);assert.equal((svg.match(/data-vehicle-wheel=/g)||[]).length,c.axles.length);
 assert.match(vehicleDescription(c),/示範/);c.axles[0].p+=1;assert.match(vehicleDescription(c),/自訂/);
 assert.equal(applyVehicleModel(c,'custom').axles,c.axles);
 const saved=JSON.parse(JSON.stringify(c));assert.equal(saved.vehicleType,v.id);assert.deepEqual(saved.axles,c.axles);
}
assert.throws(()=>applyVehicleModel(base,'unknown'));
console.log('5 vehicle presets × 2 directions: reactions, custom edits, model round-trip and SVG wheel mapping passed.');
const {vehicleDrawing}=await import('./vehicle-models.js');
const {vehicleLabelLayout,vehicleChartOverlay}=await import('./chart-vehicle.js');
for(const v of vehicleModels)for(const direction of [1,-1]){
 const c=applyVehicleModel({...base,direction},v.id),m=build(c),front=8,r=statics(m,front),wheels=axleLoads(m,front);
 const drawing=vehicleDrawing(c,{frontX:400,scale:100,maxHeight:70});
 assert.match(drawing.svg,new RegExp(`scale\\(${direction*drawing.scale},${drawing.scale}\\)`));
 assert.ok(drawing.scale<100);
 const quantity=(v,u)=>`${v} ${u}`,layout=vehicleLabelLayout(c,12,50,650,quantity);
 for(const key of ['M','V','D']){
 const svg=vehicleChartOverlay({layout,wheels,left:50,right:650,bottom:400,X:x=>50+50*x,Y:v=>300-v,result:{...r,length:12},key,quantity,time:1,config:c,front});
 assert.doesNotMatch(svg,/NaN|undefined/);assert.match(svg,/class="vehicle-body"/);
 for(const a of wheels)assert.ok(svg.includes(`data-x="${a.x}" data-force="${a.p}"`));
 }
}
console.log('Uniform silhouette scaling and M/V/D actual axle coordinate/weight overlays passed for all presets and directions.');
