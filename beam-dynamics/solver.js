/* BeamLab: independently implemented Euler–Bernoulli / Newmark solver.
 * Units: kN, m, s; displacement upward+, rotation CCW+, applied P/w downward+.
 * No third-party solver source is incorporated. */
export const zero=n=>new Float64Array(n);
const mat=n=>Array.from({length:n},()=>zero(n));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export function mv(A,x){return Float64Array.from(A,(r,i)=>{let v=0;for(let j=Math.max(0,i-3);j<=Math.min(x.length-1,i+3);j++)v+=r[j]*x[j];return v;});}
function chol(A){const n=A.length,L=mat(n);for(let i=0;i<n;i++)for(let j=Math.max(0,i-3);j<=i;j++){let v=A[i][j];for(let k=Math.max(0,i-3,j-3);k<j;k++)v-=L[i][k]*L[j][k];if(i===j){if(!(v>Math.max(1e-15,A[i][i]*1e-12)))throw Error('支承不足或剛度條件不良，請確認支承與 EI。');L[i][j]=Math.sqrt(v);}else L[i][j]=v/L[j][j];}return L;}
export function solve(L,b){const n=b.length,y=zero(n),x=zero(n);for(let i=0;i<n;i++){let s=b[i];for(let j=Math.max(0,i-3);j<i;j++)s-=L[i][j]*y[j];y[i]=s/L[i][i];}for(let i=n-1;i>=0;i--){let s=y[i];for(let j=i+1;j<=Math.min(n-1,i+3);j++)s-=L[j][i]*x[j];x[i]=s/L[i][i];}return x;}
export function shape(s,L){let r=s/L;return [1-3*r*r+2*r*r*r,L*(r-2*r*r+r*r*r),3*r*r-2*r*r*r,L*(-r*r+r*r*r)];}
function deriv(s,L){let r=s/L;return [(-6*r+6*r*r)/L,1-4*r+3*r*r,(6*r-6*r*r)/L,-2*r+3*r*r];}
const gx=[-Math.sqrt(3/5),0,Math.sqrt(3/5)],gw=[5/9,8/9,5/9];
function quad(a,b,f){if(b<=a)return 0;let h=(b-a)/2,c=(a+b)/2;return h*gx.reduce((s,x,i)=>s+gw[i]*f(c+h*x),0);}
export const maxSpans=12;
export const total=c=>c.spans.reduce((s,x)=>s+x.L,0);
export const vehicleLength=c=>c.axles.reduce((s,a)=>Math.max(s,a.offset),0);
export function validate(c){
 if(!c||!Array.isArray(c.spans)||c.spans.length<1||c.spans.length>maxSpans)throw Error('請設定 1–'+maxSpans+' 跨梁。');
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 for(const s of c.spans)if(![s.L,s.E,s.I,s.mass].every(num)||s.L<0.1||s.L>200||s.E<=0||s.I<=0||s.mass<=0)throw Error('跨長須為 0.1–200 m；E、I、單位長度質量須大於 0。');
 if(!Array.isArray(c.supports)||c.supports.length!==c.spans.length+1||c.supports.some(s=>!['pin','roller','fixed','free'].includes(s)))throw Error('支承資料不完整。');
 if(!c.supports.includes('fixed')&&c.supports.filter(s=>s!=='free').length<2)throw Error('此模型形成機構：至少需要兩個垂直支承，或一個固定端。');
 let L=total(c);if(!Array.isArray(c.loads)||c.loads.length>50)throw Error('載重筆數須不超過 50 筆。');
 for(const l of c.loads){if(!['point','moment','line'].includes(l.type))throw Error('不支援的載重類型。');if(l.type==='line'){if(![l.a,l.b,l.w1,l.w2].every(num)||l.a<0||l.b>L+1e-8||l.b<=l.a)throw Error('分布載重需滿足 0 ≤ 起點 < 終點 ≤ 梁長。');}else if(![l.x,l.p].every(num)||l.x<0||l.x>L)throw Error('集中載重的位置必須在梁上，數值須為有限數。');}
 if(!Array.isArray(c.axles)||c.axles.length<1||c.axles.length>12||c.axles.some(a=>![a.p,a.offset].every(num)||a.p<=0||a.offset<0)||Math.min(...c.axles.map(a=>a.offset))!==0)throw Error('車輛須有 1–12 軸；軸重 > 0、距前軸距離 ≥ 0，至少一軸位於 0。');
 if(!num(c.factor)||c.factor<=0||c.factor>5||!num(c.speed)||c.speed<=0||c.speed>300||!num(c.damping)||c.damping<0||c.damping>30||!num(c.step)||c.step<0.01||!num(c.dt)||c.dt<0.0001||c.dt>0.1||!num(c.tail)||c.tail<0||c.tail>10||![8,12,24].includes(c.mesh))throw Error('請檢查車速、倍率、阻尼、步長與網格設定。');
 if(!['static','moving','dynamic'].includes(c.mode)||![-1,1].includes(c.direction))throw Error('分析模式或方向錯誤。');
}
export function build(c){validate(c);let xs=[0],ss=[0],pos=0;
 c.spans.forEach(s=>{for(let j=1;j<=c.mesh;j++)xs.push(pos+s.L*j/c.mesh);pos+=s.L;ss.push(pos);});
 for(const l of c.loads)xs.push(...(l.type==='line'?[l.a,l.b]:[l.x]));
 xs=xs.sort((a,b)=>a-b).filter((x,i,a)=>!i||x-a[i-1]>1e-8);
 let n=xs.length*2,K=mat(n),M=mat(n),els=[],span=0;
 for(let e=0;e<xs.length-1;e++){let a=xs[e],b=xs[e+1],h=b-a;while(a>=ss[span+1]-1e-8&&span<c.spans.length-1)span++;let s=c.spans[span],EI=s.E*1e6*s.I,mu=s.mass/1000;
 const ke=[[12,6*h,-12,6*h],[6*h,4*h*h,-6*h,2*h*h],[-12,-6*h,12,-6*h],[6*h,2*h*h,-6*h,4*h*h]].map(row=>row.map(x=>x*EI/h**3));
 const me=[[156,22*h,54,-13*h],[22*h,4*h*h,13*h,-3*h*h],[54,13*h,156,-22*h],[-13*h,-3*h*h,-22*h,4*h*h]].map(row=>row.map(x=>x*mu*h/420));
 const ids=[2*e,2*e+1,2*e+2,2*e+3];for(let i=0;i<4;i++)for(let j=0;j<4;j++){K[ids[i]][ids[j]]+=ke[i][j];M[ids[i]][ids[j]]+=me[i][j];}els.push({a,b,h,EI,mu,ke,me,ids});}
 let constrained=[];ss.forEach((x,i)=>{const ni=xs.findIndex(y=>Math.abs(x-y)<1e-7);if(c.supports[i]!=='free')constrained.push(2*ni);if(c.supports[i]==='fixed')constrained.push(2*ni+1);});
 const free=Array.from({length:n},(_,i)=>i).filter(i=>!constrained.includes(i)),sub=A=>free.map(i=>Float64Array.from(free,j=>A[i][j]));let k=sub(K),m=sub(M),factor=chol(k);
 let v=Float64Array.from(free,i=>Math.sin(i*1.278)+.31);for(let it=0;it<70;it++){let u=solve(factor,mv(m,v)),norm=Math.sqrt(dot(u,mv(m,u)));v=u.map(x=>x/norm);}let omega=Math.sqrt(dot(v,mv(k,v))/dot(v,mv(m,v)));
 const expand=x=>{let u=zero(n);free.forEach((j,i)=>u[j]=x[i]);return u;};
 return {c,xs,ss,els,n,K,M,k,m,free,factor,omega,expand,constrained,L:pos};
}
export function axleLoads(model,front){if(front==null)return [];let {c,L}=model;return c.axles.map(a=>({type:'point',x:c.direction===1?front-a.offset:L-front+a.offset,p:a.p*c.factor,vehicle:true})).filter(a=>a.x>=-1e-8&&a.x<=L+1e-8).map(a=>({...a,x:Math.max(0,Math.min(L,a.x))}));}
export function loading(model,front=null){let loads=[...model.c.loads,...axleLoads(model,front)];if(model.c.selfWeight)model.els.forEach(e=>loads.push({type:'line',a:e.a,b:e.b,w1:e.mu*9.80665,w2:e.mu*9.80665}));
 let F=zero(model.n),efs=model.els.map(()=>zero(4)),elLoads=model.els.map(()=>[]);
 for(const l of loads){if(l.type==='line'){model.els.forEach((e,i)=>{let a=Math.max(e.a,l.a),b=Math.min(e.b,l.b);if(b<=a)return;elLoads[i].push(l);for(let j=0;j<4;j++)efs[i][j]+=quad(a,b,x=>-intensity(l,x)*shape(x-e.a,e.h)[j]);});}else{let i=model.els.findIndex(e=>l.x>=e.a-1e-8&&l.x<=e.b+1e-8);if(i<0)continue;let e=model.els[i],s=Math.max(0,Math.min(e.h,l.x-e.a)),N=l.type==='moment'?deriv(s,e.h):shape(s,e.h);elLoads[i].push(l);for(let j=0;j<4;j++)efs[i][j]+=N[j]*l.p*(l.type==='moment'?1:-1);}}
 model.els.forEach((e,i)=>e.ids.forEach((j,k)=>F[j]+=efs[i][k]));return {F,efs,elLoads,loads};
}
function intensity(l,x){return l.w1+(l.w2-l.w1)*(x-l.a)/(l.b-l.a);}
function tiny(a){return Math.abs(a)<1e-7?0:a;}
export function response(model,load,u,v=zero(model.n),acc=zero(model.n),alpha=0){const {els,K,M}=model;
 const ma=mv(M,acc),cv=mv(M,v),ku=mv(K,u),res=ku.map((x,i)=>x+ma[i]+alpha*cv[i]-load.F[i]);
 const ends=els.map((e,i)=>e.ke.map((row,j)=>row.reduce((s,x,k)=>s+x*u[e.ids[k]]+e.me[j][k]*(acc[e.ids[k]]+alpha*v[e.ids[k]]),0)-load.efs[i][j]));
 function atElement(i,s,side=1){let e=els[i],x=e.a+s,V=ends[i][0],B=-ends[i][1]+V*s;
 for(const l of load.elLoads[i]){if(l.type==='line'){let a=Math.max(e.a,l.a),b=Math.min(x,l.b);V-=quad(a,b,y=>intensity(l,y));B-=quad(a,b,y=>intensity(l,y)*(x-y));}else if(l.x<x-1e-9||(side>0&&l.x<=x+1e-9)){if(l.type==='moment')B-=l.p;else{V-=l.p;B-=l.p*(x-l.x);}}}
 if(hasInertia){const f=y=>-e.mu*dot(shape(y,e.h),e.ids.map(j=>acc[j]+alpha*v[j]));V+=quad(0,s,f);B+=quad(0,s,y=>f(y)*(s-y));}
 const D=dot(shape(s,e.h),e.ids.map(j=>u[j]))*1000;return {x,V:tiny(V),M:tiny(B),D:tiny(D)};}
 function at(x,side=1){let i=side<0?els.findIndex(e=>x<=e.b+1e-9):els.findIndex(e=>x<e.b-1e-9);if(i<0)i=els.length-1;return atElement(i,Math.max(0,Math.min(els[i].h,x-els[i].a)),side);}
 const hasInertia=alpha!==0||acc.some(a=>a!==0);
 let points=[];els.forEach((e,i)=>{let sp=[0,e.h/4,e.h/2,3*e.h/4,e.h];load.elLoads[i].filter(l=>l.type!=='line'&&l.x>e.a+1e-8&&l.x<e.b-1e-8).forEach(l=>sp.push(l.x-e.a));sp.sort((a,b)=>a-b);for(let j=0;j<sp.length;j++){const x=sp[j];const jump=load.elLoads[i].some(l=>l.type!=='line'&&Math.abs(l.x-e.a-x)<1e-9)&&x>1e-8&&x<e.h-1e-8;points.push(atElement(i,x,j===sp.length-1||jump?-1:1));if(jump)points.push(atElement(i,x,1));if(j>0){let lo=sp[j-1]+1e-8,hi=x-1e-8,vl=atElement(i,lo).V,vh=atElement(i,hi).V;if(vl*vh<0){for(let k=0;k<25;k++){let mid=(lo+hi)/2,vm=atElement(i,mid).V;if(vm*vl>0){lo=mid;vl=vm;}else hi=mid;}points.push(atElement(i,(lo+hi)/2));}}}});
 points.sort((a,b)=>a.x-b.x);const reactions=model.ss.map((x,i)=>{let j=model.xs.findIndex(z=>Math.abs(z-x)<1e-7)*2;return {label:String.fromCharCode(65+i),x,R:model.c.supports[i]==='free'?0:tiny(res[j]),T:model.c.supports[i]==='fixed'?tiny(res[j+1]):0,type:model.c.supports[i]};});
 return {u,v,acc,at,points,reactions,ends,residual:Math.max(0,...model.free.map(i=>Math.abs(res[i]))),load};
}
export function statics(model,front=null){const ld=loading(model,front),u=model.expand(solve(model.factor,model.free.map(i=>ld.F[i])));return response(model,ld,u);}
export function stations(model){let p=[];model.els.forEach(e=>{for(let j=0;j<=4;j++)p.push({x:e.a+e.h*j/4,side:j===4?-1:1});});return p;}
export function envelope(model,frames){let st=stations(model);let rows=st.map(s=>({x:s.x,side:s.side,Vmin:Infinity,Vmax:-Infinity,Mmin:Infinity,Mmax:-Infinity,Dmin:Infinity,Dmax:-Infinity})),R=model.ss.map(()=>({min:Infinity,max:-Infinity,tmin:0,tmax:0}));frames.forEach((f,index)=>{let r=f.result;st.forEach((s,i)=>{let p=r.at(s.x,s.side);for(let k of ['V','M','D'])for(let bound of ['min','max']){let key=k+bound;if((bound==='min'&&p[k]<rows[i][key])||(bound==='max'&&p[k]>rows[i][key])){rows[i][key]=p[k];rows[i][key+'Frame']=index;}}});r.reactions.forEach((p,i)=>{if(p.R<R[i].min){R[i].min=p.R;R[i].tmin=index;}if(p.R>R[i].max){R[i].max=p.R;R[i].tmax=index;}});});return {rows,R};}
export async function moving(model,onProgress=()=>{}){let distance=model.L+vehicleLength(model.c),n=Math.ceil(distance/model.c.step);if(n>2000)throw Error('移動分析超過 2,000 步，請增大車輛移動步長。');let fronts=new Set([0,distance]);for(let i=0;i<=n;i++)fronts.add(distance*i/n);for(let x of [...model.ss,model.L/2])for(let a of model.c.axles){let f=(model.c.direction===1?x:model.L-x)+a.offset;if(f>=0&&f<=distance)fronts.add(f);}let pos=[...fronts].sort((a,b)=>a-b),frames=[];for(let i=0;i<pos.length;i++){frames.push({front:pos[i],t:pos[i]/(model.c.speed/3.6),result:statics(model,pos[i])});if(i%30===0){onProgress(i/pos.length);await new Promise(r=>setTimeout(r,0));}}return {frames,envelope:envelope(model,frames),step:distance/n};}
export async function dynamic(model,onProgress=()=>{}){const c=model.c,speed=c.speed/3.6,T=(model.L+vehicleLength(c))/speed+c.tail,dtLimit=Math.min(c.dt,1/(model.omega/(2*Math.PI)*60),Math.min(...model.els.map(e=>e.h))/(speed*10));let count=Math.ceil(T/dtLimit);if(count*model.els.length>180000)throw Error('網格與歷時資料量過大，請減少跨數、網格或離梁觀察時間。');if(count>6000)throw Error('所需動力步數超過 6,000。請縮短離梁觀察時間、調整車速或網格；不可直接放大步長掩蓋精度。');let dt=T/count,alpha=2*c.damping/100*model.omega,n=model.free.length,C=model.m.map(row=>row.map(v=>v*alpha)),a0=4/dt**2,a1=2/dt;
 let ke=model.k.map((row,i)=>row.map((v,j)=>v+a0*model.m[i][j]+a1*C[i][j])),fact=chol(ke);let initial=statics(model,null),u=Float64Array.from(model.free,i=>initial.u[i]),v=zero(n),a=zero(n),frames=[];
 const initialLoad=loading(model,0),initResidual=model.free.map((id,i)=>initialLoad.F[id]-mv(model.k,u)[i]);a=solve(chol(model.m),initResidual);
 for(let step=0;step<=count;step++){let t=step*dt,front=speed*t,ld=loading(model,front);if(step>0){let pm=mv(model.m,u.map((x,i)=>a0*x+4/dt*v[i]+a[i])),pc=mv(C,u.map((x,i)=>a1*x+v[i])),rhs=model.free.map((id,i)=>ld.F[id]+pm[i]+pc[i]),un=solve(fact,rhs),an=un.map((x,i)=>a0*(x-u[i])-4/dt*v[i]-a[i]),vn=v.map((x,i)=>x+dt*(a[i]+an[i])/2);u=un;v=vn;a=an;}
 frames.push({t,front,result:response(model,ld,model.expand(u),model.expand(v),model.expand(a),alpha)});if(step%30===0){onProgress(step/count);await new Promise(r=>setTimeout(r,0));}}
 return {frames,envelope:envelope(model,frames),dt,alpha};}
