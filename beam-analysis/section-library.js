/* Same geometry conventions as steel-sections v1.2.1. Catalog properties are never recomputed. */
(function(root,factory){
 if(typeof module==='object'&&module.exports){const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),bytes=fs.readFileSync(path.join(__dirname,'../steel-sections/section-data.json'));module.exports=factory(JSON.parse(bytes),{version:'1.2.1',sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
 else{const packet=JSON.parse(document.getElementById('beam-section-data').textContent);root.BeamSections=factory(packet.data,packet.meta);}
})(typeof globalThis!=='undefined'?globalThis:this,function(data,meta){'use strict';
const copy=value=>JSON.parse(JSON.stringify(value));
const TYPES=Object.freeze({...data.types}),records=[...data.catalog,...data.examples],byId=new Map(records.map(r=>[r.id,r]));
const dims=['H','B','tw','tf','t','lip','D'],props=['A','W','Ix','Iy','Sx','Sy','rx','ry'];
const toolUrl='https://jerry597640-droid.github.io/engineering-calculator-hub/steel-sections/';
const sourceUrl='https://www.tunghosteel.com/Files/papp/400/%E5%9E%8B%E9%8B%BC%E5%9E%8B%E9%8C%84%E8%A1%A8%282021.04.12%29%282%29.pdf';
function active(type){return type==='CHS'?['D','t']:['RHS','SHS','L'].includes(type)?['H','B','t']:type==='C'?['H','B','t','lip']:['H','B','tw','tf'];}
function pieces(p){let {type,H,B,tw,tf,t,lip,D}=p;
 if(type==='H'||type==='I')return [[0,0,B,tf,1],[(B-tw)/2,tf,tw,H-2*tf,1],[0,H-tf,B,tf,1]];
 if(type==='U')return [[0,0,tw,H,1],[tw,0,B-tw,tf,1],[tw,H-tf,B-tw,tf,1]];
 if(type==='L')return [[0,0,t,H,1],[t,0,B-t,t,1]];
 if(type==='C')return [[0,0,t,H,1],[t,0,B-t,t,1],[t,H-t,B-t,t,1],[B-t,t,t,lip,1],[B-t,H-t-lip,t,lip,1]];
 if(type==='RHS'||type==='SHS')return [[0,0,B,H,1],[t,t,B-2*t,H-2*t,-1]];
 if(type==='T')return [[0,0,tw,H-tf,1],[0-(B-tw)/2+0,H-tf,B,tf,1]].map((r,i)=>i===0?[(B-tw)/2,0,tw,H-tf,1]:[0,H-tf,B,tf,1]);
 return [];
}
function calculate(p){const {type}=p;let H=+p.H||0,B=+p.B||0,tw=+p.tw||0,tf=+p.tf||0,t=+p.t||0,lip=+p.lip||0,D=+p.D||0;
 const fail=m=>{throw new Error(m)};
 for(const k of ['H','B','tw','tf','t','lip','D'])if(p[k]!=null&&(!Number.isFinite(+p[k])||+p[k]<0))fail(k+' 必須為有效的非負數值。');
 if(type==='CHS'){
  if(!(D>0&&t>0&&D>2*t))fail('圓管請確認 D > 2t 且 t > 0。');
  H=B=D;const A=Math.PI/4*(D*D-(D-2*t)**2),Im=Math.PI/64*(D**4-(D-2*t)**4);
  return shapeResult(p,H,B,A,Im,Im,D/2,D/2);
 }
 if(!(H>0&&B>0))fail('H、B 必須大於零。');
 if((type==='RHS'||type==='SHS')&&!(t>0&&2*t<Math.min(H,B)))fail('方／矩形管須符合 0 < 2t < min(H,B)。');
 if(['H','I','U','T'].includes(type)&&!(tw>0&&tf>0&&tw<=B&&2*tf<H))fail('請確認 0 < tw ≤ B，且 0 < 2tf < H。');
 if(type==='L'&&!(t>0&&t<Math.min(H,B)))fail('角鋼須符合 0 < t < min(H,B)。');
 if(type==='C'&&!(t>0&&2*t<Math.min(H,B)&&lip>=0&&2*lip<=H-2*t&&B>2*t))fail('C 型鋼應符合 2t < min(H,B)、B > 2t 且 0 ≤ 2lip ≤ H−2t。');
 const rec=pieces({...p,H,B,tw,tf,t,lip}),mom=rec.map(([x,y,w,h,s])=>({a:w*h*s,x:x+w/2,y:y+h/2,w,h,s}));
 const A=mom.reduce((a,r)=>a+r.a,0);if(A<=0)fail('斷面淨面積必須大於 0。');
 const cx=mom.reduce((a,r)=>a+r.a*r.x,0)/A,cy=mom.reduce((a,r)=>a+r.a*r.y,0)/A;
 const ix=mom.reduce((a,r)=>a+r.s*r.w*r.h**3/12+r.a*(r.y-cy)**2,0),iy=mom.reduce((a,r)=>a+r.s*r.h*r.w**3/12+r.a*(r.x-cx)**2,0);
 if(ix<=0||iy<=0)fail('斷面慣性矩必須大於零。');
 return shapeResult(p,H,B,A,ix,iy,cx,cy);
}
function shapeResult(p,H,B,a,ix,iy,cx,cy){const A=a/100,Ix=ix/1e4,Iy=iy/1e4;
 return {...p,H,B,A,W:A*0.785,Ix,Iy,rx:Math.sqrt(ix/a)/10,ry:Math.sqrt(iy/a)/10,Sx:ix/Math.max(cy,H-cy)/1000,Sy:iy/Math.max(cx,B-cx)/1000,xc:cx/10,yc:cy/10,mode:'estimate',R:null,R2:null,Zx:null,Zy:null};
}
function custom(p,index=0){
 if(!p||typeof p!=='object'||!Object.hasOwn(TYPES,p.type))throw Error('不支援的自訂型鋼型式');
 const v={type:p.type};for(const k of active(p.type)){const n=p[k];if(typeof n!=='number'||!Number.isFinite(n)||n<0||(k!=='lip'&&n===0)||n>100000)throw Error(k+'須為有效mm尺寸');v[k]=n;}
 if(['H','I','U','T'].includes(v.type)&&v.tw>=v.B)throw Error('腹板厚須小於總寬');if(v.type==='SHS'&&Math.abs(v.H-v.B)>1e-8)throw Error('方管須H=B');
 const r=calculate(v);if(!props.every(k=>Number.isFinite(r[k])&&r[k]>0))throw Error('斷面計算結果無效');
 const label=String(p.label||'').trim().slice(0,60),id=/^USER-[A-Za-z0-9-]{1,100}$/.test(p.id||'')?p.id:'USER-IMPORT-'+index;
 const spec=v.type==='CHS'?'CHS-'+v.D+'×'+v.t:v.type==='C'?'C-'+v.H+'×'+v.B+'×'+v.lip+'×'+v.t:['L','RHS','SHS'].includes(v.type)?v.type+'-'+v.H+'×'+v.B+'×'+v.t:v.type+'-'+v.H+'×'+v.B+'×'+v.tw+'×'+v.tf;
 return {...r,id,label,name:label?label+' ｜ '+spec:spec,alias:spec+' '+label,source:'使用者自訂・查詢工具同式理論幾何',origin:'custom'};
}
function importBackup(packet){
 if(!packet||packet.schema!=='steel-sections-custom-v2'||packet.unit!=='mm'||!Array.isArray(packet.sections)||packet.sections.length>200)throw Error('請使用查詢工具匯出的mm格式JSON（最多200筆）');
 const rows=packet.sections.map((p,i)=>custom(p,i));if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('自訂斷面編號重複');return rows;
}
function serialize(r){return {id:r.id,type:r.type,label:r.label||'',...Object.fromEntries(active(r.type).map(k=>[k,r[k]]))};}
function get(id){const r=byId.get(id);return r?copy(r):null;}
function validateRecord(r){if(!r||!Object.hasOwn(TYPES,r.type)||!props.every(k=>typeof r[k]==='number'&&Number.isFinite(r[k])&&r[k]>0))throw Error('型鋼資料缺少有效斷面性質');return r;}
function resolve(r){
 if(!r||typeof r.id!=='string')throw Error('缺少型鋼斷面記錄');const known=byId.get(r.id);
 if(known){for(const k of [...dims,...props,'type','mode','name','source'])if(known[k]!==r[k])throw Error('斷面快照與同源資料不符，請重新選取或改用自訂數值');return copy(known);}
 if(r.origin==='custom'){const c=custom(serialize(r));for(const k of props)if(Math.abs(c[k]-r[k])>Math.max(1,Math.abs(c[k]))*1e-12)throw Error('自訂斷面性質與尺寸不符');return c;}
 throw Error('型鋼編號不在同源斷面庫');
}
function beamValues(r,axis,G=9.80665){
 validateRecord(r);if(!['x','y'].includes(axis))throw Error('請選x–x或y–y受彎軸');if(r.type==='L')throw Error('角鋼Ix／Iy非主軸，單平面梁未處理Ixy耦合；本庫可查詢，梁分析請另取得適用I並以自訂數值輸入');
 return {A:r.A,I:r[axis==='x'?'Ix':'Iy'],Splus:r[axis==='x'?'Sx':'Sy'],Sminus:r[axis==='x'?'Sx':'Sy'],gamma:r.W*G*10/r.A};
}
function snapshot(r,axis){const row=resolve(r);beamValues(row,axis);return {schema:'beam-section/1',datasetVersion:meta.version,datasetSha256:meta.sha256,axis,record:row};}
function restore(s){if(!s||s.schema!=='beam-section/1'||!['x','y'].includes(s.axis)||s.datasetSha256!==meta.sha256)throw Error('型鋼快照版本或受彎軸不符，請重新選取');const row=resolve(s.record);beamValues(row,s.axis);return {record:row,axis:s.axis};}
function list(){return copy(records);}
return Object.freeze({meta:Object.freeze({...meta}),TYPES,toolUrl,sourceUrl,list,get,active,pieces,calculate,custom,importBackup,serialize,resolve,beamValues,snapshot,restore});
});
