/* Geometry and multiple load cases. Canonical calculation units: cm, kgf, tf. */
(function(root){'use strict';
const E=root.AnchorEngine||(typeof require==='function'?require('./engine.js'):null);
const LOAD_KEYS=['N','Mx','My','Vx','Vy','Tz','sustained'];
function caseFrom(p,id,label){return {id,label,...Object.fromEntries(LOAD_KEYS.map(k=>[k,Number(p[k])]))};}
function calculateCases(p){const cases=p.caseBatch&&p.mode==='global'?p.loadCases:[];if(!Array.isArray(cases)||cases.length>12||(p.caseBatch&&p.mode==='global'&&!cases.length))return {entries:[],errors:['載重組合須為1～12組陣列'],overall:'載重組合格式錯誤',worst:null};
const ids=new Set(),errors=[];const entries=cases.map((c,i)=>{const input={...p,caseBatch:false};let e=[];
if(!c||typeof c!=='object')e.push('組合資料格式錯誤');
else{if(typeof c.id!=='string'||!c.id||ids.has(c.id))e.push('組合識別缺漏或重複');ids.add(c.id);if(typeof c.label!=='string'||!c.label.trim()||c.label.length>100)e.push('組合名稱須為1～100字');for(const k of LOAD_KEYS){if(c[k]===null||c[k]===''||!Number.isFinite(Number(c[k])))e.push(k+' 必須為有限數字');else input[k]=Number(c[k]);}}
const loadLabel=c&&typeof c.label==='string'?c.label:'組合 '+(i+1);input.name=p.name+'／'+loadLabel;
const r=e.length?{p:input,errors:e,pending:[],notes:[],rows:[],anchors:[],status:'輸入錯誤'}:E.calculate(input);
const ratios=(r.rows||[]).filter(q=>q.ratio!==null);const governing=ratios.reduce((best,q)=>!best||q.ratio>best.ratio?q:best,null);
return {id:c?.id||'invalid-'+i,label:loadLabel,input,result:r,dcr:r.interaction??null,governing:governing?.name||'尚無有效結果'};});
const valid=entries.filter(q=>!q.result.errors.length&&q.dcr!==null),worst=valid.reduce((a,b)=>!a||b.dcr>a.dcr?b:a,null);
const hasErrors=entries.some(q=>q.result.errors.length),hasFailure=entries.some(q=>q.result.failed),hasPending=entries.some(q=>q.result.missing);
const overall=hasErrors?'至少一組輸入錯誤，尚未完成包絡':hasFailure?'至少一組已計算項目不符合':hasPending?'至少一組待補資料／專項檢核':entries.length?'所有組合已計算項目符合':'單一載重組合';
return {entries,errors,overall,worst,hasErrors,hasFailure,hasPending};}
function unionCells(rects){const good=rects.filter(r=>r.every(Number.isFinite)&&r[1]>r[0]&&r[3]>r[2]);const xs=[...new Set(good.flatMap(r=>[r[0],r[1]]))].sort((a,b)=>a-b),cells=[];
for(let i=1;i<xs.length;i++){const mid=(xs[i-1]+xs[i])/2,intervals=good.filter(r=>r[0]<mid&&r[1]>mid).map(r=>[r[2],r[3]]).sort((a,b)=>a[0]-b[0]);let current=null;for(const [lo,hi] of intervals){if(!current||lo>current[1]){if(current)cells.push([xs[i-1],xs[i],...current]);current=[lo,hi];}else current[1]=Math.max(current[1],hi);}if(current)cells.push([xs[i-1],xs[i],...current]);}return cells;}
const area=rects=>unionCells(rects).reduce((s,r)=>s+(r[1]-r[0])*(r[3]-r[2]),0);
function tensionProjection(r,all=false){if(!r.anchors?.length||!r.bounds||r.errors.length)return null;const row=r.rows.find(q=>q.key==='breakoutN'),ids=all?r.anchors.map(q=>q.id):row?.detail.ids||r.anchors.filter(q=>q.N>0).map(q=>q.id);const g=r.anchors.filter(q=>ids.includes(q.id)),b=r.bounds,h=r.p.hef,rad=1.5*h;
const rects=g.map(q=>[Math.max(b.L,q.x-rad),Math.min(b.R,q.x+rad),Math.max(b.B,q.y-rad),Math.min(b.T,q.y+rad)]);
return {kind:'N',g,rects,cells:unionCells(rects),A:area(rects),A0:9*h*h,h,rad,ids,detail:row?.detail,all};}
function shearProjection(r){const row=r.rows?.find(q=>q.key==='breakoutV'),d=row?.detail;if(!d?.edge||!d.front)return null;const b=r.bounds,xAxis=['L','R'].includes(d.edge),lo=xAxis?b.B:b.L,hi=xAxis?b.T:b.R,depth=Math.min(1.5*d.ca,r.p.ha),g=r.anchors.filter(q=>d.front.includes(q.id)),rad=1.5*d.ca;
const rects=g.map(q=>{const u=xAxis?q.y:q.x;return [Math.max(lo,u-rad),Math.min(hi,u+rad),-depth,0];});
return {kind:'V',edge:d.edge,xAxis,g,rects,cells:unionCells(rects),A:area(rects),A0:4.5*d.ca*d.ca,depth,rad,ids:d.ids,detail:d,all:false};}
function viewBounds(r){const a=r.anchors||[],p=r.p;if(!a.length)return {L:-40,R:40,B:-40,T:40};const margin=Math.max(1.7*p.hef,20),raw=r.bounds;return {L:Number.isFinite(raw.L)?raw.L:Math.min(...a.map(q=>q.x))-margin,R:Number.isFinite(raw.R)?raw.R:Math.max(...a.map(q=>q.x))+margin,B:Number.isFinite(raw.B)?raw.B:Math.min(...a.map(q=>q.y))-margin,T:Number.isFinite(raw.T)?raw.T:Math.max(...a.map(q=>q.y))+margin};}
root.AnchorCCD={LOAD_KEYS,caseFrom,calculateCases,unionCells,area,tensionProjection,shearProjection,viewBounds};
if(typeof module!=='undefined'&&module.exports)module.exports=root.AnchorCCD;
})(typeof globalThis!=='undefined'?globalThis:this);
