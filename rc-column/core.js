/* RC Column Workbench 1.0 · Taiwan 112 corrected edition · kgf, cm.
   Geometry-integrated concrete block and center-strain steel.
   No section capacities are increased by confinement. */
const RCC = (() => {
  'use strict';
  const BARS = {D10:{d:.953,a:.7133},D13:{d:1.27,a:1.267},D16:{d:1.59,a:1.986},D19:{d:1.91,a:2.865},D22:{d:2.22,a:3.871},D25:{d:2.54,a:5.067},D29:{d:2.87,a:6.469},D32:{d:3.22,a:8.143},D36:{d:3.58,a:10.07}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const beta=fc=>clamp(.85-.05*(fc-280)/70,.65,.85);
  const phi=(et,fy,Es)=>.65+.25*clamp((et-fy/Es)/.003,0,1);
  function validate(s) {
    const ranges={b:[20,200],h:[20,200],fc:[210,700],fy:[2800,5600],fyt:[2800,5600],Es:[1900000,2150000],cover:[4,15],agg:[.5,4],nx:[2,12],ny:[2,12],s:[3,60],L:[50,1500],kx:[.3,3],ky:[.3,3],ratioX:[-1,1],ratioY:[-1,1]};
    const errors=[];
    for(const [k,[lo,hi]] of Object.entries(ranges)) if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi) errors.push(`${k} 必須介於 ${lo}～${hi}`);
    if(!Number.isInteger(s.nx)||!Number.isInteger(s.ny)) errors.push('每邊根數必須為整數');
    if(!BARS[s.bar]||!BARS[s.tie]) errors.push('鋼筋尺寸無效');
    if(!['normal','seismic'].includes(s.mode)||!['braced','sway'].includes(s.frame)) errors.push('柱類型或支撐條件無效');
    if(typeof s.second!=='boolean') errors.push('二階效應確認值無效');
    if(s.mode==='seismic'&&(s.fc<280||![4200,5000,5600].includes(s.fy))) errors.push('本版特殊抗彎矩構架支援 fc′ ≥ 280，fy 為 4200、5000 或 5600');
    if(!['inside','exposed','soil'].includes(s.environment)) errors.push('暴露環境無效');
    if(!errors.length && 2*(s.cover+BARS[s.tie].d+BARS[s.bar].d)>=Math.min(s.b,s.h)) errors.push('保護層與鋼筋無法容納於斷面');
    return errors;
  }
  function geometry(s) {
    const rb=BARS[s.bar],dt=BARS[s.tie].d,o=s.cover+dt+rb.d/2;
    const xb=s.b/2-o,yb=s.h/2-o,bars=[];
    for(let i=0;i<s.nx;i++){const x=-xb+2*xb*i/(s.nx-1);bars.push({x,y:yb,a:rb.a,d:rb.d},{x,y:-yb,a:rb.a,d:rb.d});}
    for(let j=1;j<s.ny-1;j++){const y=-yb+2*yb*j/(s.ny-1);bars.push({x:xb,y,a:rb.a,d:rb.d},{x:-xb,y,a:rb.a,d:rb.d});}
    return {bars,o,Ast:bars.length*rb.a,Ag:s.b*s.h,clearX:2*xb/(s.nx-1)-rb.d,clearY:2*yb/(s.ny-1)-rb.d,hx:Math.max(2*xb/(s.nx-1),2*yb/(s.ny-1)),rb,dt};
  }
  function clip(poly,nx,ny,q) {
    const out=[];
    for(let i=0;i<poly.length;i++){
      const p=poly[i],r=poly[(i+1)%poly.length],fp=p.x*nx+p.y*ny-q,fr=r.x*nx+r.y*ny-q;
      if(fp>=0)out.push(p);
      if((fp>=0)!==(fr>=0)){const t=fp/(fp-fr);out.push({x:p.x+t*(r.x-p.x),y:p.y+t*(r.y-p.y)});}
    }return out;
  }
  function moments(poly) {
    let area=0,Qx=0,Qy=0;
    for(let i=0;i<poly.length;i++){const p=poly[i],r=poly[(i+1)%poly.length],z=p.x*r.y-r.x*p.y;area+=z;Qx+=(p.x+r.x)*z;Qy+=(p.y+r.y)*z;}
    return {area:area/2,Qx:Qx/6,Qy:Qy/6};
  }
  function state(s,g,theta,c,details=false) {
    const nx=Math.cos(theta),ny=Math.sin(theta),top=Math.abs(nx)*s.b/2+Math.abs(ny)*s.h/2;
    const a=(s.betaOverride??beta(s.fc))*c,q=top-a;
    const poly=clip([{x:-s.b/2,y:-s.h/2},{x:s.b/2,y:-s.h/2},{x:s.b/2,y:s.h/2},{x:-s.b/2,y:s.h/2}],nx,ny,q);
    const cm=moments(poly),stress=.85*s.fc;let P=cm.area*stress,Mx=cm.Qy*stress,My=cm.Qx*stress,et=0;
    const rows=[];
    for(const bar of g.bars){
      const z=nx*bar.x+ny*bar.y,depth=top-z,eps=.003*(1-depth/c),fs=clamp(s.Es*eps,-s.fy,s.fy);
      et=Math.max(et,-eps);
      // Exact circular segment of displaced concrete avoids jumps when a crosses a bar.
      const radius=bar.d/2,t=clamp((q-z)/radius,-1,1),root=Math.sqrt(Math.max(0,1-t*t));
      const fraction=(Math.acos(t)-t*root)/Math.PI,subArea=bar.a*fraction;
      const first=bar.a/(Math.PI*radius*radius)*(2/3)*radius**3*root**3;
      const Fs=bar.a*fs-stress*subArea;
      P+=Fs;Mx+=bar.a*fs*bar.y-stress*(subArea*bar.y+first*ny);My+=bar.a*fs*bar.x-stress*(subArea*bar.x+first*nx);
      if(details)rows.push({...bar,depth,eps,fs,Fs,subArea});
    }
    const ph=phi(et,s.fy,s.Es);
    return {P,Mx,My,phi:ph,dp:ph*P/1000,mx:ph*Mx/100000,my:ph*My/100000,theta,c,a,et,poly,rows,concrete:cm.area*stress/1000};
  }
  function capacityAtP(s,g,theta,pu){
    let lo=Math.max(s.b,s.h)*1e-8,hi=Math.max(s.b,s.h)*1e5;
    if(pu<-.9*g.Ast*s.fy/1000-1e-7||pu>.65*(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000) return null;
    let v;
    for(let i=0;i<65;i++){const c=(lo+hi)/2;v=state(s,g,theta,c);if(v.dp<pu)lo=c;else hi=c;}
    v=state(s,g,theta,(lo+hi)/2,true);
    if(Math.abs(v.dp-pu)>1e-5*Math.max(1,Math.abs(pu))) return null;
    return v;
  }
  function section(s,load,angles=120){
    const g=geometry(s),P0=(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000,Pmax=.8*.65*P0,Tmax=.9*s.fy*g.Ast/1000;
    const envelope=[];
    if(load.P>=-Tmax+1e-6&&load.P<=Pmax+1e-7){for(let i=0;i<angles;i++){const r=capacityAtP(s,g,i*2*Math.PI/angles,load.P);if(r)envelope.push(r);}}
    const norm=Math.hypot(load.Mx,load.My),axialOK=load.P<=Pmax+1e-7&&load.P>=-Tmax-1e-7;
    let capacity=0,witness=null;
    if(norm>1e-10){
      const ux=load.Mx/norm,uy=load.My/norm;
      for(let i=0;i<envelope.length;i++){
        const p=envelope[i],r=envelope[(i+1)%envelope.length];
        const cp=p.mx*uy-p.my*ux,cr=r.mx*uy-r.my*ux;
        if(cp*cr<=0&&Math.abs(cp-cr)>1e-12){const t=cp/(cp-cr),mx=p.mx+t*(r.mx-p.mx),my=p.my+t*(r.my-p.my),len=mx*ux+my*uy;
          if(len>capacity){capacity=len;witness=Math.abs(cp)<Math.abs(cr)?p:r;}}
      }
    }
    const ratio=norm<1e-10?(axialOK?Math.max(load.P>=0?load.P/Pmax:-load.P/Tmax,0):Infinity):(capacity>0?norm/capacity:Infinity);
    return {g,P0,Pmax,Tmax,envelope,ratio,capacity,axialOK,witness,pass:axialOK&&ratio<=1+1e-8};
  }
  function shear(s,g,load,dir){
    const isX=dir==='x',bw=isX?s.h:s.b,d=(isX?s.b:s.h)-g.o,legs=isX?s.ny:s.nx;
    const fytUsed=Math.min(s.fyt,s.mode==='seismic'?5600:4200); // Table20.2.2.4(a), deformed ties.
    const Av=legs*BARS[s.tie].a,Avmin=Math.max(.2*Math.sqrt(s.fc),3.5)*bw*s.s/fytUsed;
    const Nu=load.P*1000,ax=Math.min(Nu/(6*g.Ag),.05*s.fc),rho=(isX?s.ny:s.nx)*g.rb.a/(bw*d),lambdaS=Math.min(1,Math.sqrt(2/(1+d/25)));
    // Seismic option conservatively assumes no concrete shear contribution for all rows.
    const raw=s.mode==='seismic'?0:(Av>=Avmin?.53*Math.sqrt(s.fc):2.12*lambdaS*Math.cbrt(rho)*Math.sqrt(s.fc))+ax;
    const Vc=s.mode==='seismic'?0:clamp(raw*bw*d,0,1.33*Math.sqrt(s.fc)*bw*d),Vs=Av*fytUsed*d/s.s;
    const cap=.75*Math.min(Vc+Vs,Vc+2.12*Math.sqrt(s.fc)*bw*d)/1000;
    const demand=Math.abs(isX?load.Vx:load.Vy),minRequired=demand>.75*.265*Math.sqrt(s.fc)*bw*d/1000;
    const spacing=Math.min(d/2,60); // 10.7.6.5; higher Vs requires d/4, 30 cm.
    const shearS=Vs>1.06*Math.sqrt(s.fc)*bw*d?Math.min(d/4,30):spacing;
    return {bw,d,legs,Av,Avmin,fytUsed,Vc:Vc/1000,Vs:Vs/1000,cap,demand,ratio:demand/cap,pass:demand<=cap+1e-8&&(!minRequired||Av>=Avmin)&&s.s<=shearS+1e-8,case:s.mode==='seismic'?'Vc = 0（耐震保守值）':Av>=Avmin?'22.5.5.1(a)':'22.5.5.1(c)',minRequired,shearS};
  }
  function detailing(s,g,maxP){
    const minClear=Math.max(4,1.5*g.rb.d,4*s.agg/3),rho=g.Ast/g.Ag,bcx=s.b-2*s.cover,bcy=s.h-2*s.cover,Ach=bcx*bcy;
    const generalS=Math.min(16*g.rb.d,48*g.dt,s.b,s.h),barLimit=s.fy<=4200?6:s.fy<=5000?5.5:5;
    const so=clamp(10+(35-g.hx)/3,10,15),smax=s.mode==='seismic'?Math.min(generalS,Math.min(s.b,s.h)/4,barLimit*g.rb.d,so):generalS;
    const AshX=s.ny*BARS[s.tie].a,AshY=s.nx*BARS[s.tie].a;
    const kn=g.bars.length/(g.bars.length-2),kf=Math.max(s.fc/1750+.6,1),high=maxP*1000>.3*g.Ag*s.fc;
    const confRatio=Math.max(.3*(g.Ag/Ach-1)*s.fc/s.fyt,.09*s.fc/s.fyt,high?.2*kf*kn*maxP*1000/(s.fyt*Ach):0);
    const reqX=confRatio*s.s*bcy,reqY=confRatio*s.s*bcx;
    const rx=s.h/Math.sqrt(12),ry=s.b/Math.sqrt(12),slx=s.kx*s.L/rx,sly=s.ky*s.L/ry;
    const limX=s.frame==='sway'?22:Math.min(40,34+12*s.ratioX),limY=s.frame==='sway'?22:Math.min(40,34+12*s.ratioY),slender=slx>limX||sly>limY;
    const checks=[
      {name:'淨保護層',value:s.cover,unit:'cm',limit:'≥ '+(s.environment==='soil'?7.5:s.environment==='exposed'?5:4),pass:s.cover>=(s.environment==='soil'?7.5:s.environment==='exposed'?5:4),ref:'20.5.1.3（暴露取保守5 cm）'},
      {name:'縱向配筋率',value:rho*100,unit:'%',limit:s.mode==='seismic'?'1～6 %':'1～8 %',pass:rho>=.01-1e-9&&rho<=(s.mode==='seismic'?.06:.08)+1e-9,ref:s.mode==='seismic'?'18.4.4.1':'10.6.1.1'},
      {name:'主筋最小淨距',value:Math.min(g.clearX,g.clearY),unit:'cm',limit:'≥ '+minClear.toFixed(2),pass:Math.min(g.clearX,g.clearY)>=minClear-1e-9,ref:'25.2.3'},
      {name:'箍筋尺寸',value:s.tie,unit:'',limit:g.rb.d>3.22?'≥ D13':'≥ D10',pass:g.dt>=(g.rb.d>3.22?1.27:.953),ref:'25.7.2.2'},
      {name:'箍筋中心間距',value:s.s,unit:'cm',limit:'≤ '+smax.toFixed(2),pass:s.s<=smax+1e-9,ref:s.mode==='seismic'?'18.4.5.3':'25.7.2.1'},
      {name:'箍筋垂直淨距',value:s.s-g.dt,unit:'cm',limit:'≥ '+(4*s.agg/3).toFixed(2),pass:s.s-g.dt>=4*s.agg/3,ref:'25.7.2.1(a)'},
      {name:'X 軸長細比',value:slx,unit:'',limit:'≤ '+limX.toFixed(1),pass:slx<=limX,info:slx>limX&&s.second,ref:'6.2.5'},
      {name:'Y 軸長細比',value:sly,unit:'',limit:'≤ '+limY.toFixed(1),pass:sly<=limY,info:sly>limY&&s.second,ref:'6.2.5'}
    ];
    if(s.mode==='seismic')checks.push(
      {name:'耐震柱幾何',value:Math.min(s.b,s.h),unit:'cm',limit:'最小尺寸 ≥ 30、短長比 ≥ 0.4',pass:Math.min(s.b,s.h)>=30&&Math.min(s.b,s.h)/Math.max(s.b,s.h)>=.4,ref:'18.4.2.1'},
      {name:'側撐主筋中心距 hx',value:g.hx,unit:'cm',limit:high?'≤ 20':'≤ 35',pass:g.hx<=(high?20:35),ref:'18.4.5.2'},
      {name:'平行 X 箍筋 Ash,x',value:AshX,unit:'cm²',limit:'≥ '+reqX.toFixed(3),pass:AshX>=reqX,ref:'表18.4.5.4'},
      {name:'平行 Y 箍筋 Ash,y',value:AshY,unit:'cm²',limit:'≥ '+reqY.toFixed(3),pass:AshY>=reqY,ref:'表18.4.5.4'}
    );
    return {checks,rho,minClear,smax,slx,sly,limX,limY,slender,lo:Math.max(s.b,s.h,s.L/6,45),AshX,AshY,reqX,reqY,Ach,high,pass:checks.every(c=>c.pass||c.info)};
  }
  function evaluate(s,loads,angles=120){
    const errors=validate(s);
    if(!Array.isArray(loads)||!loads.length||loads.length>30)errors.push('載重組合需為 1～30 組');
    else loads.forEach((l,i)=>{if(['P','Mx','My','Vx','Vy'].some(k=>!Number.isFinite(l[k])||Math.abs(l[k])>100000))errors.push(`組合 ${i+1} 載重無效`);});
    if(errors.length)throw new Error(errors.join('；'));
    const g=geometry(s),det=detailing(s,g,Math.max(...loads.map(l=>l.P),0));
    const cases=loads.map(l=>{const sec=section(s,l,angles),sx=shear(s,g,l,'x'),sy=shear(s,g,l,'y');
    const interact=sx.ratio>.5&&sy.ratio>.5?(sx.ratio+sy.ratio)/1.5:Math.max(sx.ratio,sy.ratio);
      return {load:l,...sec,sx,sy,shearInteraction:interact,allPass:sec.pass&&sx.pass&&sy.pass&&interact<=1+1e-8};});
    const worst=cases.reduce((a,b)=>b.ratio>a.ratio?b:a);
    return {s,loads,g,det,cases,worst,pass:det.pass&&cases.every(c=>c.allPass),pendingSeismic:s.mode==='seismic',version:'1.0.0'};
  }
  function designCandidates(s,loads){
    const list=[];
    for(const bar of ['D19','D22','D25','D29','D32','D36'])for(let nx=2;nx<=10;nx++)for(let ny=2;ny<=10;ny++){
      const ss={...s,bar,nx,ny},g=geometry(ss);if(validate(ss).length)continue;
      const d=detailing(ss,g,Math.max(...loads.map(l=>l.P),0));
      if(!d.pass)continue;const maxP=.52*(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000;
      if(loads.some(l=>l.P>maxP||-l.P>.9*g.Ast*s.fy/1000))continue;
      list.push({ss,Ast:g.Ast});
    }
    return list.sort((a,b)=>a.Ast-b.Ast||geometry(a.ss).bars.length-geometry(b.ss).bars.length);
  }
  return {BARS,beta,phi,validate,geometry,clip,moments,state,capacityAtP,section,shear,detailing,evaluate,designCandidates};
})();
if(typeof module!=='undefined')module.exports=RCC;
