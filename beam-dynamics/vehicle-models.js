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
export function vehicleBody(c,{frontX,scale,wheelY=78,interactive=false}){
 const kind=vehicleModel(c)?.id||'custom',rear=Math.max(...c.axles.map(a=>a.offset))*scale;
 const direction=c.direction===-1?-1:1,pad=Math.max(8,Math.min(18,scale*.7)),left=-rear-pad,right=pad;
 const cabin=Math.max(left+4,-Math.max(20,Math.min(36,rear*.42))),bodyY=-29;
 let body='';
 const rect=(x,y,w,h,fill,rx=3)=>`<rect x="${x}" y="${y}" width="${Math.max(1,w)}" height="${h}" rx="${rx}" fill="${fill}" stroke="#876132" stroke-width="1.4"/>`;
 const line=(d,color='#805a2b',width=2)=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
 const glass='#d6eef0',paint='#e7ae5d';
 if(kind==='car'){
  body=`<path d="M${left},-8V-23L${left+rear*.22},-27L${left+rear*.35},-42H${cabin}L${right-3},-25L${right+5},-21V-8Z" fill="${paint}" stroke="#876132" stroke-width="1.5"/>`;
  body+=`<path d="M${left+rear*.39},-38H${cabin-2}L${right-10},-27H${left+rear*.27}Z" fill="${glass}"/>`;
 }else if(kind==='bus'){
  body=rect(left,-45,right-left+4,37,paint,6);
  const count=Math.max(2,Math.min(9,Math.floor((right-left)/24))),width=(right-left-12)/count;
  for(let i=0;i<count;i++)body+=rect(left+6+i*width,-39,width-4,15,glass,2);
  body+=line(`M${left+4},-18H${right}`,'#b47a36',3);
 }else if(kind==='truck'){
  body=rect(left,-45,Math.max(4,cabin-left-4),32,'#d3dedc',2)+`<path d="M${cabin},-8V-40H${right-8}L${right+5},-24V-8Z" fill="${paint}" stroke="#876132" stroke-width="1.5"/>`;
  body+=`<path d="M${cabin+4},-36H${right-11}L${right},-25H${cabin+4}Z" fill="${glass}"/>`;
 }else if(kind==='forklift'){
  body=rect(left,-27,right-left,19,paint)+line(`M${left+5},-27V-56H${right-3}V-27`,'#645d50',3)+line(`M${right+6},-60V-5H${right+25}M${right+11},-60V-9`,'#645d50',3);
  body+=rect(left+8,-37,Math.max(5,rear*.24),10,'#334b52');
 }else if(kind==='aerial'){
  body=rect(left,-23,right-left,15,paint)+line(`M${left+5},-24L${right-5},-39L${left+5},-55M${right-5},-24L${left+5},-39L${right-5},-55`,'#876132',3)+rect(left-4,-60,right-left+8,5,paint,1)+line(`M${left-4},-60V-77H${right+4}V-60M${left-4},-69H${right+4}`,'#876132',2);
 }else body=rect(left,-19,right-left,11,'#b9cfcc');
 body+=line(`M${left},-7H${right}`,'#344b50',4);
 let out=`<g class="vehicle-body" transform="translate(${frontX},${wheelY}) scale(${direction},1)"><g pointer-events="none">${body}</g>`;
 c.axles.forEach((a,i)=>{
  const x=-a.offset*scale,key='axles:'+i;
  out+=`<g data-vehicle-wheel="${i}" ${interactive?`data-load-key="${key}" tabindex="0" role="button" aria-label="調整車輛第 ${i+1} 軸" aria-haspopup="dialog"`:''}>`;
  out+=`<title>第 ${i+1} 軸 · 點選調整軸重與軸距</title><circle cx="${x}" cy="0" r="14" fill="transparent" pointer-events="${interactive?'all':'none'}"/><circle cx="${x}" cy="0" r="8" fill="#2b4148" stroke="#fff" stroke-width="1.5"/><circle cx="${x}" cy="0" r="3" fill="#d4e1e2"/></g>`;
 });
 return out+'</g>';
}
export function vehicleLane(c,{front,length,left,right,width}){
 const scale=(right-left)/length,frontX=left+(c.direction===1?front:length-front)*scale;
 let out='<g class="vehicle-lane"><text x="'+left+'" y="19" fill="#82551f" font-size="13">'+esc(vehicleDescription(c))+' · 車身示意／輪軸依座標</text>';
 out+='<path d="M'+left+',110H'+right+'" stroke="#d9e4e4" stroke-dasharray="4 4"/>';
 for(const a of c.axles){const x=c.direction===1?front-a.offset:length-front+a.offset;if(x>=0&&x<=length)out+=`<path d="M${left+x*scale},109V232" stroke="#c58b44" stroke-dasharray="3 4" opacity=".4" pointer-events="none"/>`;}
 out+=vehicleBody(c,{frontX,scale,wheelY:100,interactive:true});
 return out+'</g>';
}
export function renderVehiclePicker(c,quantity){
 const select=document.getElementById('vehicleType');
 if(!select.options.length)select.innerHTML='<option value="custom">自訂車輛／保留現有軸列</option>'+vehicleModels.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('');
 select.value=vehicleModel(c)?.id||'custom';
 const span=Math.max(...c.axles.map(a=>a.offset),1),scale=Math.min(45,180/span);
 document.getElementById('vehiclePreview').innerHTML='<svg viewBox="0 0 260 130" role="img" aria-label="'+esc(vehicleDescription(c))+'側視示意">'+vehicleBody(c,{frontX:c.direction===1?225:35,scale,wheelY:105})+'</svg>';
 document.getElementById('vehicleSummary').textContent=vehicleDescription(c)+' · '+c.axles.length+' 軸 · 輸入總重 '+quantity(c.axles.reduce((s,a)=>s+a.p,0),'kN',1)+' · 軸列長 '+quantity(span===1&&Math.max(...c.axles.map(a=>a.offset))===0?0:Math.max(...c.axles.map(a=>a.offset)),'m',2);
}
