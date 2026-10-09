/* RC Column Workbench 1.6 · Taiwan 112 corrected edition · kgf, cm.
   Geometry-integrated concrete block and center-strain steel.
   No section capacities are increased by confinement. */
const RCC = (() => {
  'use strict';
  const BARS = {D10:{d:.953,a:.7133},D13:{d:1.27,a:1.267},D16:{d:1.59,a:1.986},D19:{d:1.91,a:2.865},D22:{d:2.22,a:3.871},D25:{d:2.54,a:5.067},D29:{d:2.87,a:6.469},D32:{d:3.22,a:8.143},D36:{d:3.58,a:10.07}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const beta=fc=>clamp(.85-.05*(fc-280)/70,.65,.85);
  const phi=(et,fy,Es)=>.65+.25*clamp((et-fy/Es)/.003,0,1);
  const custom=s=>s.layout==='custom';
  function validate(s) {
    const ranges={b:[20,200],h:[20,200],fc:[210,700],fy:[2800,5600],fyt:[2800,5600],Es:[1900000,2150000],cover:[4,15],agg:[.5,4],nx:[2,12],ny:[2,12],s:[3,60],L:[50,1500],kx:[.3,3],ky:[.3,3],ratioX:[-1,1],ratioY:[-1,1]};
    const errors=[];
    for(const [k,[lo,hi]] of Object.entries(ranges)) if(!(custom(s)&&['nx','ny'].includes(k))&&(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)) errors.push(`${k} 必須介於 ${lo}～${hi}`);
    if(!custom(s)&&(!Number.isInteger(s.nx)||!Number.isInteger(s.ny))) errors.push('每邊根數必須為整數');
    if((!custom(s)&&!BARS[s.bar])||!BARS[s.tie]) errors.push('鋼筋尺寸無效');
    if(!['uniform','custom'].includes(s.layout??'uniform'))errors.push('主筋輸入方式無效');
    if(!['normal','seismic'].includes(s.mode)||!['braced','sway'].includes(s.frame)) errors.push('柱類型或支撐條件無效');
    if(typeof s.second!=='boolean') errors.push('二階效應確認值無效');
    if(s.mode==='seismic'&&(s.fc<280||![4200,5000,5600].includes(s.fy))) errors.push('本版特殊抗彎矩構架支援 fc′ ≥ 280，fy 為 4200、5000 或 5600');
    if(!['inside','exposed','soil','corrosive'].includes(s.environment)) errors.push('暴露環境無效');
    if(custom(s)){
      if(!Array.isArray(s.customBars)||!s.customBars.length||s.customBars.length>200)errors.push('實際配筋需填入1～200列');
      else{
        let n=0;
        s.customBars.forEach((r,i)=>{if(!r||!BARS[r.bar]||!Number.isInteger(r.n)||r.n<1||r.n>50||['x1','y1'].concat(r?.n>1?['x2','y2']:[]).some(k=>!Number.isFinite(r[k])))errors.push(`配筋第${i+1}列：筋徑、根數或座標無效`);else n+=r.n;if(r?.layer!=null&&(!Number.isInteger(r.layer)||r.layer<1||r.layer>6))errors.push(`配筋第${i+1}列：來源層須為1～6整數`);});
        if(n<4||n>200)errors.push('總主筋數須為4～200根（不含束筋）');
        const nl=s.nl??4;if(!Number.isInteger(nl)||nl<4||nl>n)errors.push('核心周邊有效側撐主筋數 nl 必須為4～總主筋數之整數（舊專案缺省4）');
      }
      for(const [k,lo,hi] of [['tieLegsX',2,30],['tieLegsY',2,30],['dX',1,s.b],['dY',1,s.h],['hx',1,100]])if(!Number.isFinite(s[k])||s[k]<lo||s[k]>hi)errors.push(`${k} 必須介於 ${lo}～${hi}`);
      if(!Number.isInteger(s.tieLegsX)||!Number.isInteger(s.tieLegsY))errors.push('有效箍筋肢數須為整數');
      if(typeof s.supported!=='boolean')errors.push('主筋側撐確認值無效');
      if(!errors.length){const g=geometry(s);
        g.bars.forEach((p,i)=>{if(Math.abs(p.x)+p.d/2>s.b/2-s.cover-g.dt+1e-8||Math.abs(p.y)+p.d/2>s.h/2-s.cover-g.dt+1e-8)errors.push(`第${i+1}根主筋超出箍筋內緣／保護層範圍`);});
        if(g.duplicates)errors.push('主筋中心重疊；根數大於1時請填不同起終點，不支援束筋');
        if(s.dX>g.dMaxX+1e-8||s.dY>g.dMaxY+1e-8)errors.push('有效深度不得超過兩側實際最外主筋中心深度的較小值');
      }
    }else if(!errors.length && 2*(s.cover+BARS[s.tie].d+BARS[s.bar].d)>=Math.min(s.b,s.h)) errors.push('保護層與鋼筋無法容納於斷面');
    return errors;
  }
  function geometry(s) {
    if(custom(s)){
      const bars=[];
      s.customBars.forEach((r,row)=>{const rb=BARS[r.bar];for(let i=0;i<r.n;i++){const t=r.n===1?0:i/(r.n-1);bars.push({x:r.x1+(r.n===1?0:t*(r.x2-r.x1))-s.b/2,y:r.y1+(r.n===1?0:t*(r.y2-r.y1))-s.h/2,a:rb.a,d:rb.d,bar:r.bar,layer:Number.isInteger(r.layer)?r.layer:null,row:row+1});}});
      const xs=bars.map(p=>p.x),ys=bars.map(p=>p.y),maxDb=Math.max(...bars.map(p=>p.d)),minDb=Math.min(...bars.map(p=>p.d));
      const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
      let clear=Infinity,spacingOK=true,duplicates=false,minMargin=Infinity;
      for(let i=0;i<bars.length;i++)for(let j=i+1;j<bars.length;j++){const p=bars[i],q=bars[j],dist=Math.hypot(p.x-q.x,p.y-q.y),gap=dist-(p.d+q.d)/2,req=Math.max(4,1.5*Math.max(p.d,q.d),4*s.agg/3);clear=Math.min(clear,gap);minMargin=Math.min(minMargin,gap-req);spacingOK&&=gap>=req-1e-8;duplicates||=dist<1e-8;}
      const edgeArea=(axis,v)=>bars.filter(p=>Math.abs(p[axis]-v)<1e-7).reduce((a,p)=>a+p.a,0);
      const Ast=bars.reduce((a,p)=>a+p.a,0),cx=bars.reduce((a,p)=>a+p.a*p.x,0)/Ast,cy=bars.reduce((a,p)=>a+p.a*p.y,0)/Ast;
      return {bars,Ast,Ag:s.b*s.h,dt:BARS[s.tie].d,o:s.cover+BARS[s.tie].d+maxDb/2,rb:{d:minDb},maxDb,minDb,clearX:clear,clearY:clear,spacingOK,minMargin,duplicates,hx:s.hx,legsX:s.tieLegsX,legsY:s.tieLegsY,dX:s.dX,dY:s.dY,dMaxX:Math.min(s.b/2-minx,s.b/2+maxx),dMaxY:Math.min(s.h/2-miny,s.h/2+maxy),edgeAsX:Math.min(edgeArea('x',minx),edgeArea('x',maxx)),edgeAsY:Math.min(edgeArea('y',miny),edgeArea('y',maxy)),cx,cy};
    }
    const rb=BARS[s.bar],dt=BARS[s.tie].d,o=s.cover+dt+rb.d/2;
    const xb=s.b/2-o,yb=s.h/2-o,bars=[];
    for(let i=0;i<s.nx;i++){const x=-xb+2*xb*i/(s.nx-1);bars.push({x,y:yb,a:rb.a,d:rb.d},{x,y:-yb,a:rb.a,d:rb.d});}
    for(let j=1;j<s.ny-1;j++){const y=-yb+2*yb*j/(s.ny-1);bars.push({x:xb,y,a:rb.a,d:rb.d},{x:-xb,y,a:rb.a,d:rb.d});}
    bars.forEach(p=>p.bar=s.bar);
    return {bars,o,Ast:bars.length*rb.a,Ag:s.b*s.h,clearX:2*xb/(s.nx-1)-rb.d,clearY:2*yb/(s.ny-1)-rb.d,hx:Math.max(2*xb/(s.nx-1),2*yb/(s.ny-1)),rb,dt,maxDb:rb.d,minDb:rb.d,legsX:s.ny,legsY:s.nx,dX:s.b-o,dY:s.h-o,edgeAsX:s.ny*rb.a,edgeAsY:s.nx*rb.a,cx:0,cy:0};
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
      if(details)rows.push({...bar,depth,eps,fs,Fs,subArea,first,steelForce:bar.a*fs,concreteForce:stress*subArea,netMx:bar.a*fs*bar.y-stress*(subArea*bar.y+first*ny),netMy:bar.a*fs*bar.x-stress*(subArea*bar.x+first*nx)});
    }
    const ph=phi(et,s.fy,s.Es);
    return {P,Mx,My,phi:ph,dp:ph*P/1000,mx:ph*Mx/100000,my:ph*My/100000,theta,c,a,et,poly,rows,concreteArea:cm.area,concreteMx:cm.Qy*stress/100000,concreteMy:cm.Qx*stress/100000,concrete:cm.area*stress/1000};
  }
  function capacityAtP(s,g,theta,pu){
    let lo=Math.max(s.b,s.h)*1e-8,hi=Math.max(s.b,s.h)*1e5;
    if(pu<-.9*g.Ast*s.fy/1000-1e-7||pu>.65*(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000) return null;
    let v;const solverHistory=[];
    for(let i=0;i<65;i++){const c=(lo+hi)/2;v=state(s,g,theta,c);solverHistory.push({i,lo,hi,c,dp:v.dp,branch:v.dp<pu?'lo=c':'hi=c'});if(v.dp<pu)lo=c;else hi=c;}
    v=state(s,g,theta,(lo+hi)/2,true);
    if(Math.abs(v.dp-pu)>1e-5*Math.max(1,Math.abs(pu))) return null;
    v.solverHistory=solverHistory;return v;
  }
  function section(s,load,angles=120){
    const g=geometry(s),P0=(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000,Pmax=.8*.65*P0,Tmax=.9*s.fy*g.Ast/1000;
    if(custom(s)&&Math.abs(load.P+Tmax)<1e-7){
      const mx=-.9*s.fy*g.Ast*g.cy/100000,my=-.9*s.fy*g.Ast*g.cx/100000;
      const inside=Math.hypot(load.Mx-mx,load.My-my)<1e-7;
      return {g,P0,Pmax,Tmax,envelope:[{mx,my,dp:-Tmax}],ratio:inside?1:Infinity,capacity:Math.hypot(mx,my),axialOK:true,witness:null,inside,originInside:Math.hypot(mx,my)<1e-7,pass:inside};
    }
    const envelope=[];
    if(load.P>=-Tmax+1e-6&&load.P<=Pmax+1e-7){for(let i=0;i<angles;i++){const r=capacityAtP(s,g,i*2*Math.PI/angles,load.P);if(r)envelope.push(r);}}
    const norm=Math.hypot(load.Mx,load.My),axialOK=load.P<=Pmax+1e-7&&load.P>=-Tmax-1e-7;
    let capacity=0,witness=null,boundary=null;
    if(norm>1e-10){
      const ux=load.Mx/norm,uy=load.My/norm;
      for(let i=0;i<envelope.length;i++){
        const p=envelope[i],r=envelope[(i+1)%envelope.length];
        const cp=p.mx*uy-p.my*ux,cr=r.mx*uy-r.my*ux;
        if(cp*cr<=0&&Math.abs(cp-cr)>1e-12){const t=cp/(cp-cr),mx=p.mx+t*(r.mx-p.mx),my=p.my+t*(r.my-p.my),len=mx*ux+my*uy;
          if(len>capacity){capacity=len;witness=Math.abs(cp)<Math.abs(cr)?p:r;boundary={t,mx,my,ux,uy,start:{theta:p.theta,dp:p.dp,mx:p.mx,my:p.my},end:{theta:r.theta,dp:r.dp,mx:r.mx,my:r.my}};}}
      }
    }
    // With asymmetric reinforcement the fixed-P envelope need not contain the origin.
    // Test the actual demand point; a ray's outer intersection alone is insufficient.
    const pointInside=(x,y)=>{let inside=false;for(let i=0,j=envelope.length-1;i<envelope.length;j=i++){
      const a=envelope[j],b=envelope[i],dx=b.mx-a.mx,dy=b.my-a.my,t=((x-a.mx)*dx+(y-a.my)*dy)/(dx*dx+dy*dy||1);
      if(t>=0&&t<=1&&Math.hypot(x-a.mx-t*dx,y-a.my-t*dy)<1e-7)return true;
      if((a.my>y)!==(b.my>y)&&x<(b.mx-a.mx)*(y-a.my)/(b.my-a.my)+a.mx)inside=!inside;
    }return inside;};
    const inside=custom(s)?envelope.length===angles&&pointInside(load.Mx,load.My):null;
    const originInside=custom(s)?pointInside(0,0):true;
    let ratio=norm<1e-10?(axialOK?Math.max(load.P>=0?load.P/Pmax:-load.P/Tmax,0):Infinity):(capacity>0?norm/capacity:Infinity);
    if(custom(s)&&!inside&&(!originInside||norm<1e-10))ratio=Infinity;
    return {g,P0,Pmax,Tmax,envelope,ratio,capacity,axialOK,witness,boundary,inside,originInside,pass:axialOK&&(custom(s)?inside:ratio<=1+1e-8)};
  }
  function shear(s,g,load,dir){
    const isX=dir==='x',bw=isX?s.h:s.b,d=isX?g.dX:g.dY,legs=isX?g.legsX:g.legsY;
    const fytUsed=Math.min(s.fyt,s.mode==='seismic'?5600:4200); // Table20.2.2.4(a), deformed ties.
    const Av=legs*BARS[s.tie].a,Avmin=Math.max(.2*Math.sqrt(s.fc),3.5)*bw*s.s/fytUsed;
    const Nu=load.P*1000,ax=Math.min(Nu/(6*g.Ag),.05*s.fc),rho=(isX?g.edgeAsX:g.edgeAsY)/(bw*d),lambdaS=Math.min(1,Math.sqrt(2/(1+d/25)));
    // Seismic option conservatively assumes no concrete shear contribution for all rows.
    const raw=s.mode==='seismic'?0:(Av>=Avmin?.53*Math.sqrt(s.fc):2.12*lambdaS*Math.cbrt(rho)*Math.sqrt(s.fc))+ax;
    const zeroVc=s.mode==='seismic'||(custom(s)&&Av<Avmin);
    const Vc=zeroVc?0:clamp(raw*bw*d,0,1.33*Math.sqrt(s.fc)*bw*d),Vs=Av*fytUsed*d/s.s;
    // Until the 21.2.4.1 nominal flexural/shear relation is established externally, use conservative seismic phiV.
    const phiV=s.mode==='seismic'?.60:.75;
    const cap=phiV*Math.min(Vc+Vs,Vc+2.12*Math.sqrt(s.fc)*bw*d)/1000;
    const demand=Math.abs(isX?load.Vx:load.Vy),minRequired=demand>phiV*.265*Math.sqrt(s.fc)*bw*d/1000;
    const spacing=Math.min(d/2,60); // 10.7.6.5; higher Vs requires d/4, 30 cm.
    const shearS=Vs>1.06*Math.sqrt(s.fc)*bw*d?Math.min(d/4,30):spacing;
    const result={bw,d,legs,Av,Avmin,fytUsed,phiV,Vc:Vc/1000,Vs:Vs/1000,cap,demand,ratio:demand/cap,pass:demand<=cap+1e-8&&(!minRequired||Av>=Avmin)&&s.s<=shearS+1e-8,case:s.mode==='seismic'?'Vc = 0（耐震保守值）':custom(s)&&Av<Avmin?'Vc = 0（座標配置且Av不足之保守值）':Av>=Avmin?'22.5.5.1(a)':'22.5.5.1(c)',minRequired,shearS};
    result.trace=[{title:'剪力 '+dir+'向',formula:'fyt=min(fyt,模式上限)；Av=肢數Ai；Av,min=max(.2√fc,3.5)bw s/fyt；Vc=clamp(raw bw d,0,1.33√fc bw d)；φV=φv min(Vc+Vs,Vc+2.12√fc bw d)/1000',substitution:`φv=${phiV}（${s.mode==='seismic'?'容量關係未自動驗證之耐震保守值':'一般剪力'}）；fyt=${s.fyt}→${fytUsed}；bw=${bw},d=${d},legs=${legs},Av=${Av},Avmin=${Avmin}；Nu=${Nu},ax=min(${Nu}/(6×${g.Ag}),.05×${s.fc})=${ax}；ρ=${rho},λs=${lambdaS},raw=${raw},zeroVc=${zeroVc}；Vc=${Vc},Vs=${Vs} kgf；候選${Vc+Vs}與${Vc+2.12*Math.sqrt(s.fc)*bw*d} kgf`,result:cap,unit:'tf',condition:`分支=${result.case}；需求=${demand},D/C=${result.ratio}；最小筋觸發門檻=${phiV*.265*Math.sqrt(s.fc)*bw*d/1000}；minRequired=${minRequired}；Vs高於${1.06*Math.sqrt(s.fc)*bw*d} kgf則間距min(d/4,30)，否則min(d/2,60)；採${shearS}cm；通過=${result.pass}`,source:'表21.2.1、21.2.4.1、22.5.5、10.7.6.5；耐震或custom筋不足保守Vc=0；容量設計剪力須另完成'}];return result;
  }
  function detailing(s,g,maxP){
    const minClear=Math.max(4,1.5*g.maxDb,4*s.agg/3),rho=g.Ast/g.Ag,bcx=s.b-2*s.cover,bcy=s.h-2*s.cover,Ach=bcx*bcy;
    const generalS=Math.min(16*g.minDb,48*g.dt,s.b,s.h),barLimit=s.fy<=4200?6:s.fy<=5000?5.5:5;
    const so=clamp(10+(35-g.hx)/3,10,15),smax=s.mode==='seismic'?Math.min(generalS,Math.min(s.b,s.h)/4,barLimit*g.minDb,so):generalS;
    const AshX=g.legsX*BARS[s.tie].a,AshY=g.legsY*BARS[s.tie].a;
    // nl counts supported longitudinal bars along the confined core perimeter, excluding interior layers.
    const nl=custom(s)?(s.nl??4):g.bars.length,kn=nl/(nl-2),kf=Math.max(s.fc/1750+.6,1),high=maxP*1000>.3*g.Ag*s.fc;
    const confRatio=Math.max(.3*(g.Ag/Ach-1)*s.fc/s.fyt,.09*s.fc/s.fyt,high?.2*kf*kn*maxP*1000/(s.fyt*Ach):0);
    const reqX=confRatio*s.s*bcy,reqY=confRatio*s.s*bcx;
    const rx=s.h/Math.sqrt(12),ry=s.b/Math.sqrt(12),slx=s.kx*s.L/rx,sly=s.ky*s.L/ry;
    const limX=s.frame==='sway'?22:Math.min(40,34+12*s.ratioX),limY=s.frame==='sway'?22:Math.min(40,34+12*s.ratioY),slender=slx>limX||sly>limY;
    const checks=[
      {name:'淨保護層',value:s.cover,unit:'cm',limit:'≥ '+(s.environment==='corrosive'?10:s.environment==='soil'?7.5:s.environment==='exposed'?5:4),pass:s.cover>=(s.environment==='corrosive'?10:s.environment==='soil'?7.5:s.environment==='exposed'?5:4),ref:'表20.5.1.3.1（暴露取保守5 cm；海水／腐蝕10 cm）'},
      {name:'縱向配筋率',value:rho*100,unit:'%',limit:s.mode==='seismic'?'1～6 %':'1～8 %',pass:rho>=.01-1e-9&&rho<=(s.mode==='seismic'?.06:.08)+1e-9,ref:s.mode==='seismic'?'18.4.4.1':'10.6.1.1'},
      {name:'主筋最小淨距',value:Math.min(g.clearX,g.clearY),unit:'cm',limit:custom(s)?'各對 ≥ max(4, 1.5db較大, 4dagg/3)':'≥ '+minClear.toFixed(2),pass:custom(s)?g.spacingOK:Math.min(g.clearX,g.clearY)>=minClear-1e-9,ref:'25.2.3'},
      {name:'箍筋尺寸',value:s.tie,unit:'',limit:g.maxDb>3.22?'≥ D13':'≥ D10',pass:g.dt>=(g.maxDb>3.22?1.27:.953),ref:'25.7.2.2'},
      {name:'箍筋中心間距',value:s.s,unit:'cm',limit:'≤ '+smax.toFixed(2),pass:s.s<=smax+1e-9,ref:s.mode==='seismic'?'18.4.5.3':'25.7.2.1'},
      {name:'箍筋垂直淨距',value:s.s-g.dt,unit:'cm',limit:'≥ '+(4*s.agg/3).toFixed(2),pass:s.s-g.dt>=4*s.agg/3,ref:'25.7.2.1(a)'},
      {name:'X 軸長細比',value:slx,unit:'',limit:'≤ '+limX.toFixed(1),pass:slx<=limX,info:slx>limX&&s.second,ref:'6.2.5'},
      {name:'Y 軸長細比',value:sly,unit:'',limit:'≤ '+limY.toFixed(1),pass:sly<=limY,info:sly>limY&&s.second,ref:'6.2.5'}
    ];
    if(custom(s))checks.push({name:'全部主筋側撐與箍筋肢數確認',value:s.supported?'已確認':'尚未確認',unit:'',limit:'依實際箍／繫筋詳圖確認',pass:s.supported,ref:'25.7.2、18.4.5（耐震）'});
    if(s.mode==='seismic')checks.push(
      {name:'耐震柱幾何',value:Math.min(s.b,s.h),unit:'cm',limit:'最小尺寸 ≥ 30、短長比 ≥ 0.4',pass:Math.min(s.b,s.h)>=30&&Math.min(s.b,s.h)/Math.max(s.b,s.h)>=.4,ref:'18.4.2.1'},
      {name:'側撐主筋中心距 hx',value:g.hx,unit:'cm',limit:high?'≤ 20':'≤ 35',pass:g.hx<=(high?20:35),ref:'18.4.5.2'},
      {name:'平行 X 箍筋 Ash,x',value:AshX,unit:'cm²',limit:'≥ '+reqX.toFixed(3),pass:AshX>=reqX,ref:'表18.4.5.4'},
      {name:'平行 Y 箍筋 Ash,y',value:AshY,unit:'cm²',limit:'≥ '+reqY.toFixed(3),pass:AshY>=reqY,ref:'表18.4.5.4'}
    );
    const result={checks,rho,minClear,smax,slx,sly,limX,limY,slender,lo:Math.max(s.b,s.h,s.L/6,45),nl,kn,kf,confRatio,AshX,AshY,reqX,reqY,Ach,high,pass:checks.every(c=>c.pass||c.info)};
    result.trace=traceDetail(s,g,{minClear,rho,bcx,bcy,Ach,generalS,barLimit,so,smax,nl,kn,kf,high,confRatio,reqX,reqY,rx,ry,slx,sly,limX,limY,checks,maxP,AshX,AshY});return result;
  }
  function evaluate(s,loads,angles=120){
    const errors=validate(s);
    if(!Array.isArray(loads)||!loads.length||loads.length>30)errors.push('載重組合需為 1～30 組');
    else loads.forEach((l,i)=>{if(['P','Mx','My','Vx','Vy'].some(k=>!Number.isFinite(l[k])||Math.abs(l[k])>100000))errors.push(`組合 ${i+1} 載重無效`);});
    if(errors.length)throw new Error(errors.join('；'));
    const g=geometry(s),det=detailing(s,g,Math.max(...loads.map(l=>l.P),0));
    const cases=loads.map(l=>{const sec=section(s,l,angles),sx=shear(s,g,l,'x'),sy=shear(s,g,l,'y');
    const interact=sx.ratio>.5&&sy.ratio>.5?(sx.ratio+sy.ratio)/1.5:Math.max(sx.ratio,sy.ratio);
      sec.load=l;sec.trace=traceSection(s,sec,angles);return {load:l,...sec,sx,sy,shearInteraction:interact,allPass:sec.pass&&sx.pass&&sy.pass&&interact<=1+1e-8};});
    const worst=cases.reduce((a,b)=>b.ratio>a.ratio?b:a);
    const trace=[{title:'主筋查表與座標展開',formula:'Ast=ΣAi；Ag=b h；x=X-b/2,y=Y-h/2；均勻配置o=cover+dt+db/2',substitution:`採用主筋=${g.bars.map(b=>b.bar||s.bar).join(',')}；Ast=${g.Ast}；Ag=${s.b}×${s.h}；o=${g.o} cm；共${g.bars.length}根；每根Ai/db/x/y由同geometry結果列於表格`,result:g.Ast,unit:'cm²',condition:'整排N=1只取起點；N>1逐根插值；多層或拖曳後以目前實際座標權威，不把未套用模板當成結果',source:'核心BARS固定表查筋徑列a(cm²)、d(cm)欄；座標同核心geometry展開'},...det.trace,...cases.flatMap((c,i)=>[{title:`組合 ${i+1} ${c.load.name}`,formula:'載重為同時發生設計內力',substitution:JSON.stringify(c.load),result:c.allPass?'通過':'未通過',source:'本次輸入'},...c.trace,...c.sx.trace,...c.sy.trace,{title:'雙向剪力交互作用',formula:'rx、ry均>.5 ? (rx+ry)/1.5 : max(rx,ry)',substitution:`rx=${c.sx.ratio},ry=${c.sy.ratio}`,result:String(c.shearInteraction),condition:'≤1；原容差1e-8',source:'22.5.1.10、22.5.1.11正交剪力交互作用'}])];
    return {trace,inputSnapshot:JSON.stringify({s,loads}),s,loads,g,det,cases,worst,pass:det.pass&&cases.every(c=>c.allPass),pendingSeismic:s.mode==='seismic',version:'1.6.0'};
  }
  function designCandidates(s,loads){
    if(custom(s))return [];
    const list=[];const searchAudit=[];
    for(const bar of ['D19','D22','D25','D29','D32','D36'])for(let nx=2;nx<=10;nx++)for(let ny=2;ny<=10;ny++){
      const ss={...s,bar,nx,ny},g=geometry(ss);const errors=validate(ss),record={bar,nx,ny,Ast:g.Ast,geometry:g.bars.length,stage:'輸入範圍',detail:errors.join('；')};searchAudit.push(record);if(errors.length)continue;
      const d=detailing(ss,g,Math.max(...loads.map(l=>l.P),0));
      record.stage='構造';record.detail=d.checks.map(c=>`${c.name}:${c.value}${c.unit} ${c.limit} → ${c.pass||c.info}`).join('；');if(!d.pass)continue;const maxP=.52*(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000;
      record.stage='軸力上下限';record.detail=`Pmax=${maxP},Tmax=${.9*g.Ast*s.fy/1000} tf；輸入P=${loads.map(l=>l.P)}`;if(loads.some(l=>l.P>maxP||-l.P>.9*g.Ast*s.fy/1000))continue;record.stage='進入排序待逐案檢核';
      list.push({ss,Ast:g.Ast});
    }
    list.sort((a,b)=>a.Ast-b.Ast||geometry(a.ss).bars.length-geometry(b.ss).bars.length);list.searchAudit=searchAudit;return list;
  }
  function axisSlice(s,axis,steps=64,angles=120){
    const g=geometry(s),Pmax=.52*(.85*s.fc*(g.Ag-g.Ast)+s.fy*g.Ast)/1000,Tmax=.9*s.fy*g.Ast/1000;
    const key=axis==='x'?'mx':'my',other=axis==='x'?'my':'mx',positive=[],negative=[];
    for(let i=0;i<=steps;i++){
      const P=-Tmax+(Pmax+Tmax)*i/steps,sec=section(s,{P,Mx:axis==='x'?1:0,My:axis==='x'?0:1},angles),env=sec.envelope,values=[];
      for(let j=0;j<env.length;j++){
        const a=env[j],b=env[(j+1)%env.length];
        if(Math.abs(a[other])<1e-8)values.push(a[key]);
        if(a[other]*b[other]<0){const t=-a[other]/(b[other]-a[other]);values.push(a[key]+t*(b[key]-a[key]));}
      }
      if(values.length){positive.push({x:Math.max(...values),y:P});negative.push({x:Math.min(...values),y:P});}
    }
    return [...positive,...negative.reverse()];
  }
  function buildLayers(s,layers){
    if(!Array.isArray(layers)||layers.length<2||layers.length>6)throw new Error('多層配置需2～6層');
    if(!Number.isFinite(s.b)||!Number.isFinite(s.h)||s.b<20||s.b>200||s.h<20||s.h>200||!Number.isFinite(s.cover)||s.cover<4||s.cover>15||!BARS[s.tie])throw new Error('請先修正柱尺寸、保護層或箍筋');
    const rows=[],info=[];let offset=0,total=0,previous=null;
    layers.forEach((l,i)=>{
      if(!l||!BARS[l.bar]||!Number.isInteger(l.nx)||!Number.isInteger(l.ny)||l.nx<2||l.nx>12||l.ny<2||l.ny>12)throw new Error(`第${i+1}層筋徑或每邊根數無效（2～12）`);
      if(i&&(!Number.isFinite(l.clear)||l.clear<.1||l.clear>30))throw new Error(`第${i+1}層與前層淨距須為0.1～30 cm`);
      const d=BARS[l.bar].d;
      offset=i?offset+(previous+d)/2+l.clear:s.cover+BARS[s.tie].d+d/2;
      const width=s.b-2*offset,depth=s.h-2*offset,N=2*l.nx+2*l.ny-4;
      if(width<=0||depth<=0)throw new Error(`第${i+1}層無法容納於柱內，請減少層數／淨距或增大斷面`);
      total+=N;if(total>200)throw new Error('多層總主筋數不得超過200根');
      const layer=i+1,yStep=depth/(l.ny-1);
      rows.push({layer,bar:l.bar,n:l.nx,x1:offset,y1:offset,x2:s.b-offset,y2:offset},{layer,bar:l.bar,n:l.nx,x1:offset,y1:s.h-offset,x2:s.b-offset,y2:s.h-offset});
      if(l.ny>2){const n=l.ny-2,y1=offset+yStep,y2=n===1?y1:s.h-offset-yStep;rows.push({layer,bar:l.bar,n,x1:offset,y1,x2:offset,y2},{layer,bar:l.bar,n,x1:s.b-offset,y1,x2:s.b-offset,y2});}
      info.push({layer,bar:l.bar,nx:l.nx,ny:l.ny,clear:i?l.clear:0,offset,width,depth,N,Ast:N*BARS[l.bar].a});previous=d;
    });
    return {rows,info,total,Ast:info.reduce((a,l)=>a+l.Ast,0)};
  }
function traceDetail(s,g,values){const {minClear,rho,bcx,bcy,Ach,generalS,barLimit,so,smax,nl,kn,kf,high,confRatio,reqX,reqY,rx,ry,slx,sly,limX,limY,checks}=values,t=[];const add=(title,formula,substitution,result,unit='',condition='',source='臺灣112年混凝土規範含113勘誤；既有核心')=>t.push({title,formula,substitution,result,unit,condition,source});
 add('配筋與主筋淨距','ρ=Ast/Ag；淨距要求=max(4,1.5db,max,4dagg/3)',`${g.Ast}/${g.Ag}；max(4,1.5×${g.maxDb},4×${s.agg}/3)`,`ρ=${rho}；最小要求=${minClear}`,'cm','混合筋徑／跨層逐對間距以原geometry判定','10.6、25.2.3');
 add('箍筋一般間距','sg=min(16db,min,48dt,b,h)',`min(${16*g.minDb},${48*g.dt},${s.b},${s.h})`,generalS,'cm','','25.7.2.1');
 add('耐震間距候選','smax=min(sg,min(b,h)/4,kbar db,min,so)；so=clamp(10+(35-hx)/3,10,15)',`sg=${generalS}；短邊/4=${Math.min(s.b,s.h)/4}；kbar=${barLimit}×${g.minDb}；so=${so}`,smax,'cm',`mode=${s.mode}；一般模式只採sg`,'18.4.5.3');
 add('核心圍束面積','bcx=b-2cover；bcy=h-2cover；Ach=bcx bcy',`${s.b}-2×${s.cover}=${bcx}；${s.h}-2×${s.cover}=${bcy}`,Ach,'cm²','僅箍筋需求，不增加斷面承載強度');
 add('圍束三候選最大值','ρconf=max(.3(Ag/Ach-1)fc/fyt,.09fc/fyt,high?.2kf kn Pu,max/(fyt Ach):0)',`候選=${.3*(g.Ag/Ach-1)*s.fc/s.fyt},${.09*s.fc/s.fyt},${high?.2*kf*kn*values.maxP*1000/(s.fyt*Ach):0}；kf=${kf}；nl=${nl}；kn=nl/(nl-2)=${nl}/(${nl}-2)=${kn}；高軸力=${high}`,confRatio,'',`high比較：${values.maxP}×1000>.3×${g.Ag}×${s.fc}`,'表18.4.5.4，核心周邊有效側撐主筋數；內層主筋不自動計入nl');
 add('箍筋面積需求','Ash,x,req=ρconf s bcy；Ash,y,req=ρconf s bcx',`${confRatio}×${s.s}×${bcy}；${confRatio}×${s.s}×${bcx}`,`X=${reqX}；Y=${reqY}`,'cm²',`實配X=${values.AshX}；Y=${values.AshY}`);
 add('長細篩選','rx=h/√12,ry=b/√12；λx=kxL/rx,λy=kyL/ry',`rx=${rx},ry=${ry}；${s.kx}×${s.L}/${rx}；${s.ky}×${s.L}/${ry}`,`λx=${slx},λy=${sly}`,'',`限值X=${limX},Y=${limY}；無側移min(40,34+12M1/M2)；有側移22；勾選second只確認外部內力，不替引擎放大`,'6.2.5');
 checks.forEach(c=>add('構造檢核 '+c.name,c.limit,`${c.value} ${c.unit}`,c.pass?'通過':c.info?'外部二階分析已確認':'未通過','',c.info?'超限但外部二階效應已確認':'保留原引擎容差與判定',c.ref));return t;}
function traceSection(s,c,angles){const t=[];const add=(title,formula,substitution,result,unit='',condition='',source='同一次RCC.section，臺灣112年混凝土規範')=>t.push({title,formula,substitution,result,unit,condition,source}),g=c.g,l=c.load||{};
 add('材料係數上下限','β1=clamp(.85-.05(fc-280)/70,.65,.85)；εy=fy/Es',`clamp(.85-.05×(${s.fc}-280)/70,.65,.85)；${s.fy}/${s.Es}`,`β1=${beta(s.fc)}；εy=${s.fy/s.Es}`,'','允許betaOverride驗算時保留原覆盖值');
 add('名義軸壓及設計上下限','P0=[.85fc(Ag-Ast)+fyAst]/1000；Pmax=.8×.65P0；Tmax=.9fyAst/1000',`[.85×${s.fc}×(${g.Ag}-${g.Ast})+${s.fy}×${g.Ast}]/1000`, `P0=${c.P0}；Pmax=${c.Pmax}；Tmax=${c.Tmax}`,'tf',`Pu=${l.P}；軸力界限通過=${c.axialOK}`);
 const w=c.witness;if(w){add('實際鄰近邊界求解','固定θ，以65次二分使φPn=Pu',w.solverHistory.map(z=>`i=${z.i},lo=${z.lo},hi=${z.hi},c=${z.c},φPn=${z.dp},更新=${z.branch}`).join('\n'),w.c,'cm',`角度=${w.theta} rad；角度樣本=${angles}；最終殘差=${w.dp-l.P} tf，求解接受容差1e-5max(1,|Pu|)`);
 add('壓力塊與折減','a=β1c；top=|nx|b/2+|ny|h/2；φ=.65+.25clamp((εt-εy)/.003,0,1)',`θ=${w.theta}；a=${w.a}；c=${w.c}；εt=${w.et}`,w.phi,'',`保留半平面nx x+ny y≥top-a；Ac=${w.concreteArea}；毛壓力=${w.concrete} tf`);
 w.rows.forEach((bar,i)=>add(`逐筋 ${i+1}${bar.layer?' 層'+bar.layer:''}`, 'ε=.003(1-d/c)；fs=clamp(Es ε,-fy,fy)；F=Ai fs-.85fc Aci',`bar=${bar.bar}；x=${bar.x},y=${bar.y},Ai=${bar.a},d=${bar.depth}；ε=${bar.eps}；fs=${bar.fs}；Aci=${bar.subArea}；Q=${bar.first}`,`鋼筋力=${bar.steelForce},扣除混凝土=${bar.concreteForce},淨力=${bar.Fs}；Mx=${bar.netMx},My=${bar.netMy}`,'kgf／kgf·cm','圓筋占用面積t=clamp((top-a-z)/(db/2),-1,1)，Aci=Ai[acos(t)-t√(1-t²)]/π；形心Q修正納入兩軸力矩'));
 add('斷面合力','Pn=Cc+ΣFi；Mn,c+ΣMi；φPn=φPn',`毛混凝土=${w.concrete} tf；Σ筋=${w.rows.reduce((a,b)=>a+b.Fs,0)/1000} tf；Pn=${w.P/1000}；Mnx=${w.Mx/100000},Mny=${w.My/100000}`,`φPn=${w.dp}；φMnx=${w.mx}；φMny=${w.my}`,'tf／tf·m','kgf→tf除1000；kgf·cm→tf·m除100000');}
 if(c.boundary){const b=c.boundary,cp=b.start.mx*b.uy-b.start.my*b.ux,cr=b.end.mx*b.uy-b.end.my*b.ux;add('包絡插值控制','t=kA/(kA-kB)；R=A+t(B-A)；Rc=R·u',`A=(${b.start.mx},${b.start.my}),B=(${b.end.mx},${b.end.my})；u=(${b.ux},${b.uy})；kA=${cp},kB=${cr}；t=${b.t}`,c.capacity,'tf·m',`交點R=(${b.mx},${b.my})；取需求正向最大交點`);}
 add('軸彎判定','D/C=|Mu|/Rc；純軸力採Pu/Pmax或|Pu|/Tmax',`Pu=${l.P},Mx=${l.Mx},My=${l.My}；容量=${c.capacity}`,String(c.ratio),'',`通過=${c.pass}；custom實際需求點inside=${c.inside},originInside=${c.originInside}；不是只看外側射線；無有效解不虛列逐筋表`);return t;}
  return {BARS,beta,phi,validate,geometry,clip,moments,state,capacityAtP,section,axisSlice,shear,detailing,evaluate,designCandidates,buildLayers};
})();
if(typeof module!=='undefined')module.exports=RCC;

