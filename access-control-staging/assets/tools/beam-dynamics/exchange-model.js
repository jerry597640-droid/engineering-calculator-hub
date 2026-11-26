// Native model axes are global X along the beam and global Z up.
// Positive slope in the X–Z diagram is rotation about negative global Y.
import {axleLoads,shape} from './solver.js';
import {evaluateSection} from './section-geometry.js';

export function decimal(value) {
  if (!Number.isFinite(value)) throw Error('模型資料含無效數值。');
  return Number(value.toPrecision(15)).toString();
}
function addJoint(loads,node,fz,my) {
  const row=loads.get(node) || {node,fz:0,my:0};
  row.fz+=fz;row.my+=my;loads.set(node,row);
}
function beamGeometry(model) {
  const {c,xs,ss}=model;
  const supportNodes=ss.map(x=>xs.findIndex(y=>Math.abs(y-x)<1e-7));
  const supports=new Map(supportNodes.map((n,i)=>[n,c.supports[i]]));
  const onlyRollers=c.supports.every(s=>s==='roller'||s==='free');
  const anchor=onlyRollers?supportNodes[c.supports.indexOf('roller')]:-1;
  const nodes=xs.map((x,i)=>{
    const s=supports.get(i);
    return {id:i+1,x,ux:s==='pin'||s==='fixed'||i===anchor,uz:!!s&&s!=='free',ry:s==='fixed'};
  });
  const spans=c.spans.map((s,i)=>{
    const side=(12*s.I)**.25, area=s.A??side**2;
    if(!(Number.isFinite(area)&&area>0))throw Error('第 '+(i+1)+' 跨斷面積必須大於零。');
    const height=Math.sqrt(12*s.I/area), width=area/height;
    const id=String(s.material?.id||'').replace(/[^A-Za-z0-9_]/g,'_').slice(0,18);
    const materialName=id?'M'+(i+1)+'_'+id:'BLMAT'+(i+1);
    const sectionProperties=s.section?evaluateSection(s.section):undefined;
    const sid=s.section?String(s.section.id||s.section.type).replace(/[^A-Za-z0-9_]/g,'_').slice(0,22):null;
    const sectionName=sid?'S'+(i+1)+'_'+sid+'_'+(s.section.axis==='v'?'V':'H'):'BLSEC'+(i+1);
    return {...s,id:i+1,side,area,height,width,materialName,sectionName,sectionProperties,density:s.mass/(1000*area)};
  });
  let span=1;
  const elements=model.els.map((e,i)=>{
    while(span<c.spans.length&&e.a>=ss[span]-1e-8)span++;
    return {id:i+1,i:i+1,j:i+2,span,a:e.a,b:e.b};
  });
  return {nodes,spans,elements,anchor:anchor<0?null:anchor+1};
}
function baseLoads(model,geometry) {
  const joint=new Map();
  const distributed=model.c.loads.filter(l=>l.type==='line');
  for(const l of model.c.loads){
    if(l.type==='line')continue;
    const i=model.xs.findIndex(x=>Math.abs(x-l.x)<=1e-8);
    if(i<0)throw Error('找不到集中載重的網格節點。');
    addJoint(joint,i+1,l.type==='point'?-l.p:0,l.type==='moment'?-l.p:0);
  }
  const line=[];
  for(const e of geometry.elements){
    const w=model.c.selfWeight?geometry.spans[e.span-1].mass*9.80665/1000:0;
    let w1=-w,w2=-w;
    const mid=(e.a+e.b)/2;
    for(const l of distributed){
      if(mid<l.a||mid>l.b)continue;
      const slope=(l.w2-l.w1)/(l.b-l.a);
      w1-=l.w1+slope*(e.a-l.a);w2-=l.w1+slope*(e.b-l.a);
    }
    if(w1!==0||w2!==0)line.push({element:e.id,w1,w2});
  }
  return {nodal:[...joint.values()].filter(r=>r.fz!==0||r.my!==0),line,point:[],name:'BL_BASE'};
}

function locate(model,x) {
  let lo=0,hi=model.xs.length-1;
  while(lo+1<hi){const mid=Math.floor((lo+hi)/2);if(model.xs[mid]<=x)lo=mid;else hi=mid;}
  if(Math.abs(model.xs[lo]-x)<1e-9)return {node:lo+1};
  if(Math.abs(model.xs[hi]-x)<1e-9)return {node:hi+1};
  return {element:lo+1,ratio:(x-model.xs[lo])/(model.xs[hi]-model.xs[lo])};
}
function positionCase(model,base,frame,index) {
  const loads=new Map(base.nodal.map(row=>[row.node,{...row}]));
  const interior=new Map();
  for(const axle of axleLoads(model,frame.front)) {
    const at=locate(model,axle.x);
    if(at.node)addJoint(loads,at.node,-axle.p,0);
    else {
      // Coincident axles act as one concentrated load in native table imports.
      const id=at.element+'@'+decimal(at.ratio), row=interior.get(id)||{...at,fz:0};
      row.fz-=axle.p;interior.set(id,row);
    }
  }
  return {name:'BL_POS_'+String(index).padStart(4,'0'),nodal:[...loads.values()],line:base.line,point:[...interior.values()],t:frame.t,frontX:model.c.direction===1?frame.front:model.L-frame.front};
}
export function exchangeModel(model,analysis,frameIndex,scope='base') {
  if(!['base','current','all','history'].includes(scope))throw Error('請選擇有效的匯出工況。');
  if(scope==='history'&&model.c.mode!=='dynamic')throw Error('請先執行動力歷時分析。');
  if(scope==='all'&&model.c.mode!=='moving')throw Error('全車程靜力工況須先執行車輛移動包絡分析。');
  const geometry=beamGeometry(model), base=baseLoads(model,geometry), cases=[base];
  if((scope==='current'||scope==='all')&&model.c.mode!=='static'){
    if(!analysis?.frames?.[frameIndex])throw Error('請先完成目前模型的分析。');
    if(scope==='all')analysis.frames.forEach((f,i)=>cases.push(positionCase(model,base,f,i)));
    else cases.push(positionCase(model,base,analysis.frames[frameIndex],frameIndex));
  }
  const history=scope==='history'?nativeHistory(model,analysis):undefined;
  return {...geometry,cases,history};
}

// Generate target-axis incremental vehicle forces directly; subtracting large
// constant loads from the total vector would lose accuracy for light vehicles.
function vehicleVector(model,frame) {
  const v=new Float64Array(model.n);
  for(const axle of axleLoads(model,frame.front)){
    const loc=locate(model,axle.x);
    if(loc.node){v[2*(loc.node-1)]-=axle.p;continue;}
    const e=model.els[loc.element-1],N=shape(loc.ratio*e.h,e.h);
    for(let j=0;j<4;j++)v[e.ids[j]]+=(j%2?1:-1)*N[j]*axle.p;
  }
  return v;
}
// Omit only the interiors of exactly-zero plateaus. Their endpoints preserve
// the same piecewise-linear function as all original integration time steps.
function nativeHistory(model,analysis) {
  if(!(analysis?.dt>0)||!Number.isFinite(analysis.alpha))throw Error('缺少求解後的動力步長或阻尼資料。');
  const steps=analysis.frames.length-1;
  const channels=Array.from({length:model.n},(_,i)=>{
    const node=Math.floor(i/2)+1, dof=i%2?'MY':'FZ';
    return {name:'H_'+String(node).padStart(4,'0')+'_'+dof,node,dof,samples:[],active:false};
  });
  for(let i=0;i<=steps;i++){
    const frame=analysis.frames[i],v=vehicleVector(model,frame);
    for(let j=0;j<v.length;j++){
      const ch=channels[j], samples=ch.samples, value=v[j];
      ch.active ||= value!==0;
      if(i>=2&&value===0&&samples.at(-1).value===0&&samples.at(-2)?.value===0)samples.pop();
      samples.push({t:frame.t,value});
    }
  }
  return {dt:analysis.dt,steps,alpha:analysis.alpha,channels:channels.filter(ch=>ch.active)};
}
export function vehicleForcingCsv(model,analysis) {
  if(model.c.mode!=='dynamic')throw Error('請先執行動力歷時分析。');
  const headers=['step','time_s','front_x_m'];
  model.xs.forEach((_,i)=>headers.push('J'+(i+1)+'_FZ_kN','J'+(i+1)+'_MY_kNm'));
  const rows=[headers.join(',')];
  analysis.frames.forEach((f,i)=>{
    const x=model.c.direction===1?f.front:model.L-f.front;
    rows.push([i,decimal(f.t),decimal(x),...Array.from(vehicleVector(model,f),decimal)].join(','));
  });
  return rows.join('\r\n')+'\r\n';
}
export function stationMapCsv(model,analysis) {
  const rows=['case,step,time_s,front_x_m'];
  analysis.frames.forEach((f,i)=>rows.push(['BL_POS_'+String(i).padStart(4,'0'),i,decimal(f.t),decimal(model.c.direction===1?f.front:model.L-f.front)].join(',')));
  return rows.join('\r\n')+'\r\n';
}
