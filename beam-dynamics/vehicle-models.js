// Illustrative, editable axle patterns only: not manufacturer data or design vehicles.
export const vehicleModels=[
 {id:'car',name:'小車',description:'雙軸小客車',speed:30,axles:[{p:8,offset:0},{p:7,offset:2.7}]},
 {id:'bus',name:'大車／巴士',description:'雙軸大型車',speed:20,axles:[{p:50,offset:0},{p:90,offset:6}]},
 {id:'truck',name:'卡車',description:'三軸貨車',speed:20,axles:[{p:60,offset:0},{p:100,offset:4},{p:100,offset:5.4}]},
 {id:'forklift',name:'堆高機',description:'雙軸堆高機（輪胎行走）',speed:5,axles:[{p:45,offset:0},{p:15,offset:1.8}]},
 {id:'aerial',name:'高空作業車',description:'剪刀式平台（輪胎行走）',speed:3,axles:[{p:40,offset:0},{p:40,offset:2.5}]}
];
export const vehicleModel=c=>vehicleModels.find(v=>v.id===c.vehicleType);
export function vehicleDescription(c){
 const v=vehicleModel(c);if(!v)return '自訂車輛';
 const match=JSON.stringify(c.axles)===JSON.stringify(v.axles);
 return v.name+(match?' · 示範軸列':' · 自訂軸列');
}
export function applyVehicleModel(c,id){
 if(id==='custom')return {...c,vehicleType:'custom'};
 const v=vehicleModels.find(v=>v.id===id);if(!v)throw Error('不支援的車型');
 return {...c,vehicleType:v.id,axles:structuredClone(v.axles),speed:v.speed,factor:1};
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Representative silhouette dimensions (m); illustrative, not manufacturer-specific.
const outlines={car:{height:1.45,front:.95,back:1,radius:.31},bus:{height:3.2,front:2.2,back:3,radius:.5},truck:{height:3.3,front:1.3,back:1.5,radius:.5},forklift:{height:2.2,front:.45,back:.55,radius:.3},aerial:{height:2.4,front:.35,back:.35,radius:.2},custom:{height:1,front:.5,back:.5,radius:.3}};
export function vehicleShape(c){return {...outlines[vehicleModel(c)?.id||'custom']};}
export function vehicleDrawing(c,{frontX,scale,maxHeight=74,wheelY=100,interactive=false}){
 const dim=vehicleShape(c),drawScale=Math.min(scale,maxHeight/dim.height);
 const svg=vehicleBody(c,{frontX,scale:drawScale,wheelY,interactive});
 return {svg,scale:drawScale,radius:dim.radius*drawScale};
}
export function vehicleBody(c,{frontX,scale,wheelY=78,interactive=false}){
 const kind=vehicleModel(c)?.id||'custom',dim=vehicleShape(c),rear=Math.max(...c.axles.map(a=>a.offset));
 const dir=c.direction===-1?-1:1,left=-rear-dim.back,right=dim.front,h=dim.height-dim.radius;
 const cabin=Math.max(left+.2,-1),paint='#e7ae5d',glass='#d6eef0';
 const rect=(x,y,w,z,fill)=>`<rect x="${x}" y="${y}" width="${Math.max(.01,w)}" height="${z}" rx=".06" fill="${fill}" stroke="#765936" stroke-width=".035"/>`;
 const line=d=>`<path d="${d}" fill="none" stroke="#605d51" stroke-width=".05" stroke-linejoin="round"/>`;
 let body='';
 if(kind==='car'){
  body=`<path d="M${left},0V${-h*.45}L${left+.7},${-h*.56}L${left+1.15},${-h}H${cabin}L${right-.55},${-h*.5}H${right}V0Z" fill="${paint}" stroke="#765936" stroke-width=".035"/>`;
  body+=`<path d="M${left+1.2},${-h*.9}H${cabin-.08}L${right-.65},${-h*.5}H${left+.83}Z" fill="${glass}"/>`;
 }else if(kind==='bus'){
  body=rect(left,-h,right-left,h,paint);const n=Math.max(2,Math.ceil((right-left)/1.2)),w=(right-left-.3)/n;
  for(let i=0;i<n;i++)body+=rect(left+.15+i*w,-h+.15,w-.12,h*.4,glass);
  body+=line(`M${left},${-h*.25}H${right}`);
 }else if(kind==='truck'){
  body=rect(left,-h,Math.max(.1,cabin-left-.1),h*.9,'#c5d7d5')+`<path d="M${cabin},0V${-h*.83}H${right-.4}L${right},${-h*.5}V0Z" fill="${paint}" stroke="#765936" stroke-width=".035"/>`;
  body+=`<path d="M${cabin+.12},${-h*.76}H${right-.47}L${right-.15},${-h*.52}H${cabin+.12}Z" fill="${glass}"/>`;
 }else if(kind==='forklift'){
  body=rect(left,-h*.4,right-left,h*.4,paint)+line(`M${left+.15},${-h*.4}V${-h}H${right-.1}V${-h*.4}M${right},${-h}V.12H${right+1.05}M${right+.08},${-h}V.08`);
  body+=rect(left+.3,-h*.55,.4,h*.15,'#334b52');
 }else if(kind==='aerial'){
  body=rect(left,-h*.25,right-left,h*.25,paint)+line(`M${left+.15},${-h*.26}L${right-.15},${-h*.4}L${left+.15},${-h*.54}M${right-.15},${-h*.26}L${left+.15},${-h*.4}L${right-.15},${-h*.54}`)+rect(left,-h*.57,right-left,.08,paint)+line(`M${left},${-h*.57}V${-h}H${right}V${-h*.57}M${left},${-h*.8}H${right}`);
 }else body=rect(left,-h*.4,right-left,h*.4,'#b9cfcc');
 let out=`<g class="vehicle-body" data-drawing-scale="${scale}" transform="translate(${frontX},${wheelY}) scale(${dir*scale},${scale})"><g pointer-events="none">${body}</g>`;
 c.axles.forEach((a,i)=>{
  out+=`<g data-vehicle-wheel="${i}" ${interactive?`data-load-key="axles:${i}" tabindex="0" role="button" aria-label="調整車輛第 ${i+1} 軸" aria-haspopup="dialog"`:''}><title>第 ${i+1} 軸</title><circle cx="${-a.offset}" cy="0" r="${Math.max(dim.radius,14/scale)}" fill="transparent" pointer-events="${interactive?'all':'none'}"/><circle cx="${-a.offset}" cy="0" r="${dim.radius}" fill="#2b4148" stroke="#fff" stroke-width=".03"/><circle cx="${-a.offset}" cy="0" r="${dim.radius*.38}" fill="#cbd9da"/></g>`;
 });return out+'</g>';
}
export function vehicleLane(c,{front,length,left,right,width,contactY}){
 const scale=(right-left)/length,frontX=left+(c.direction===1?front:length-front)*scale;
 const dim=vehicleShape(c),wheelY=contactY-dim.radius*scale;
 return '<g class="vehicle-lane"><text x="'+left+'" y="19" fill="#82551f" font-size="13">'+esc(vehicleDescription(c))+' · 車身、輪軸與載重共用比例</text>'+vehicleBody(c,{frontX,scale,wheelY,interactive:true})+'</g>';
}
export function renderVehiclePicker(c,quantity){
 const select=document.getElementById('vehicleType');
 if(!select.options.length)select.innerHTML='<option value="custom">自訂車輛／保留現有軸列</option>'+vehicleModels.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('');
 select.value=vehicleModel(c)?.id||'custom';
 const span=Math.max(...c.axles.map(a=>a.offset),1),dim=vehicleShape(c),extra=c.vehicleType==='forklift'?1.05:0,scale=Math.min(45,220/(span+dim.front+dim.back+extra),82/dim.height);
 const previewFront=c.direction===1?20+(span+dim.back)*scale:240-(span+dim.back)*scale;
 document.getElementById('vehiclePreview').innerHTML='<svg viewBox="0 0 260 130" role="img" aria-label="'+esc(vehicleDescription(c))+'側視示意">'+vehicleDrawing(c,{frontX:previewFront,scale,maxHeight:82,wheelY:105}).svg+'</svg>';
 document.getElementById('vehicleSummary').textContent=vehicleDescription(c)+' · '+c.axles.length+' 軸 · 輸入總重 '+quantity(c.axles.reduce((s,a)=>s+a.p,0),'kN',1)+' · 軸列長 '+quantity(span===1&&Math.max(...c.axles.map(a=>a.offset))===0?0:Math.max(...c.axles.map(a=>a.offset)),'m',2);
}
