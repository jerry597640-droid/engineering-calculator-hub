'use strict';
const WeldEngine=(()=>{
const finite=(v,n)=>{if(!Number.isFinite(v))throw Error(n+'必須是有限數字');return v};
function analyze(s){
 const trace={s:structuredClone(s),loads:[],inertias:[],endOffsets:[],branch:'zero-moments',ring:null};
 const w=finite(s.w,'焊腳'),t1=finite(s.t1,'板厚1'),t2=finite(s.t2,'板厚2'),F=finite(s.F,'FEXX');if(Math.min(w,t1,t2,F)<=0)throw Error('焊腳、板厚、焊材強度必須大於零');
 if(!['TW','AISC'].includes(s.basis))throw Error('規範基準無效');if(![60,70,80,90,100,110].includes(F))throw Error('焊材分類無效');if(!Array.isArray(s.loads)||!s.loads.length||s.loads.length>100||!Array.isArray(s.seg)||s.seg.length>200)throw Error('至少一筆載重；焊線最多200筆、載重最多100筆');if(!['ASD','LRFD'].includes(s.method))throw Error('設計方法無效');
 const seg=s.seg.map((a,i)=>{if(a.length!==4)throw Error('焊線欄位不足');a.forEach(v=>finite(v,'焊線 '+(i+1)));const [x,y,X,Y]=a.map(v=>v*10),l=Math.hypot(X-x,Y-y);if(l<1e-7)throw Error('焊線 '+(i+1)+' 長度為零');return{x,y,X,Y,l,mx:(x+X)/2,my:(y+Y)/2}});if(!seg.length)throw Error('至少需要一條焊線');const radius=s.circle?finite(s.circle,'圓直徑')*5:0;if(s.circle&&radius<=0)throw Error('圓直徑必須大於零');
 // Reject coincident / overlapping segments: doubling one weld cannot double capacity.
 for(let i=0;i<seg.length;i++)for(let j=0;j<i;j++){let a=seg[i],b=seg[j],dx=a.X-a.x,dy=a.Y-a.y,cr=(x,y)=>dx*y-dy*x;if(Math.abs(cr(b.x-a.x,b.y-a.y))<1e-6*a.l&&Math.abs(cr(b.X-a.x,b.Y-a.y))<1e-6*a.l){let u=((b.x-a.x)*dx+(b.y-a.y)*dy)/a.l**2,v=((b.X-a.x)*dx+(b.Y-a.y)*dy)/a.l**2;if(Math.min(1,Math.max(u,v))-Math.max(0,Math.min(u,v))>1e-8)throw Error('焊線 '+(i+1)+' 與 '+(j+1)+' 重疊；每條實體焊線只能輸入一次')}}
 let L=seg.reduce((a,b)=>a+b.l,0),cx=seg.reduce((a,b)=>a+b.l*b.mx,0)/L,cy=seg.reduce((a,b)=>a+b.l*b.my,0)/L,Ix=0,Iy=0,Ixy=0;
 seg.forEach(a=>{let dx=a.X-a.x,dy=a.Y-a.y,x=a.mx-cx,y=a.my-cy;const ix=a.l*(dy*dy/12+y*y),iy=a.l*(dx*dx/12+x*x),ixy=a.l*(dx*dy/12+x*y);Ix+=ix;Iy+=iy;Ixy+=ixy;trace.inertias.push({dx,dy,x,y,ix,iy,ixy,Ix,Iy,Ixy})});
 if(radius){L=2*Math.PI*radius;cx=0;cy=0;Ix=Iy=Math.PI*radius**3;Ixy=0;}let px=0,py=0,pz=0,mx=0,my=0,mz=0;
 s.loads.forEach((a,i)=>{if(a.length!==9)throw Error('載重列欄位不足');a.forEach(v=>finite(v,'載重 '+(i+1)));let [x,y,z,fx,fy,fz,MX,MY,MZ]=a;x=x*10-cx;y=y*10-cy;z*=10;fx*=9806.65;fy*=9806.65;fz*=9806.65;px+=fx;py+=fy;pz+=fz;const dmx=MX*9806650+y*fz-z*fy,dmy=MY*9806650+z*fx-x*fz,dmz=MZ*9806650+x*fy-y*fx;mx+=dmx;my+=dmy;mz+=dmz;trace.loads.push({x,y,z,fx,fy,fz,MX,MY,MZ,dmx,dmy,dmz,px,py,pz,mx,my,mz})});
 let D=Ix*Iy-Ixy**2,A=0,B=0;if(Math.abs(mx)+Math.abs(my)>1e-7){if(D<=1e-10*Math.max(Ix*Iy,1)){trace.branch='rank-deficient';let tr=Ix+Iy;trace.tr=tr;A=(-my*Iy+mx*Ixy)/tr**2;B=(-my*Ixy+mx*Ix)/tr**2;if(Math.hypot(Iy*A+Ixy*B+my,Ixy*A+Ix*B-mx)>1e-7*Math.max(1,Math.hypot(mx,my)))throw Error('焊線群組無法抵抗此面外彎矩：請增加非共線焊線')}else{trace.branch='full-inertia';A=(-my*Ix-mx*Ixy)/D;B=(mx*Iy+my*Ixy)/D}}
 let J=Ix+Iy;if(J<1e-10&&Math.abs(mz)>1e-7)throw Error('焊線群組扭轉慣性不足');
 const ends=[];seg.forEach((a,i)=>[[a.x,a.y],[a.X,a.Y]].forEach(([x,y],k)=>{let X=x-cx,Y=y-cy,qx=px/L-mz*Y/J,qy=py/L+mz*X/J,qz=pz/L+A*X+B*Y;trace.endOffsets.push({X,Y});ends.push({i:i+1,end:k+1,x:x/10,y:y/10,qx,qy,qz,q:Math.hypot(qx,qy,qz)})}));
 if(radius){const point=t=>{let X=radius*Math.cos(t),Y=radius*Math.sin(t);trace.lastPointOffset={X,Y};let qx=px/L-mz*Y/J,qy=py/L+mz*X/J,qz=pz/L+A*X+B*Y;return{i:1,end:0,x:X/10,y:Y/10,qx,qy,qz,q:Math.hypot(qx,qy,qz)}};ends.length=0;let best=0;for(let i=0;i<720;i++){let t=i*Math.PI/360;ends.push(point(t));if(ends.at(-1).q>ends[best].q)best=i}let lo=(best-1)*Math.PI/360,hi=(best+1)*Math.PI/360;trace.ring={sampleCount:720,bestIndex:best,sampledQ:ends[best].q,initialBracket:[lo,hi],iterations:70,samples:[]};for(let i=0;i<70;i++){let a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;const qa=point(a).q,qb=point(b).q;if(i<3||i>=67)trace.ring.samples.push({iteration:i+1,lo,hi,a,b,qa,qb,branch:qa<qb?"lo=a":"hi=b"});if(qa<qb)lo=a;else hi=b}trace.ring.finalBracket=[lo,hi];trace.ring.angle=(lo+hi)/2;let cp=point((lo+hi)/2);ends.length=0;ends.push(cp);trace.endOffsets=[trace.lastPointOffset];}let critical=ends.reduce((a,b)=>a.q>b.q?a:b),factor=s.method==='ASD'?0.3:0.45,fd=factor*F*6.894757293168,throat=w/Math.sqrt(2),capacity=fd*throat,ratio=critical.q/capacity,req=critical.q/(fd/Math.sqrt(2)),thin=Math.min(t1,t2),thick=Math.max(t1,t2);
 // Conservative shared detailing screen; 2022 AISC thinner-part exception is not taken.
 let min=thick<=6?3:thick<=12?5:thick<=19?6:8,max=thin<6?thin:thin-(s.basis==='TW'?1.5:2);
 let checks=[{name:'焊材合成需求 / 可用強度',ok:ratio<=1+1e-10,value:ratio.toFixed(3)+' ≤ 1.000'},{name:'最小焊腳（以較厚板保守檢查）',ok:w>=min,value:w+' ≥ '+min+' mm'},{name:'板邊最大焊腳（未採滿焊例外）',ok:w<=max,value:w+' ≤ '+max.toFixed(2)+' mm'},{name:'每條焊線有效長度 ≥ 4s',ok:radius?L>=4*w:seg.every(a=>a.l>=4*w),value:(radius?L:Math.min(...seg.map(a=>a.l))).toFixed(1)+' ≥ '+4*w+' mm'}];
 const long=!radius&&seg.some(a=>a.l>100*w);if(long&&s.endLoaded)checks.push({name:'端部受力長焊線',ok:false,value:'L > 100s：需另行折減有效長度；本結果不得作通過判定'});
 Object.assign(trace,{D,A,B,factor,thin,thick});return {trace,radius,L,cx,cy,Ix,Iy,Ixy,J,px,py,pz,mx,my,mz,fd,throat,capacity,ratio,req,min,max,critical,ends,checks,pass:checks.every(a=>a.ok),seg,long};
}
return{analyze};})();
if(typeof module!=='undefined')module.exports=WeldEngine;

