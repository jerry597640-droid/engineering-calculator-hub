/* Beam Workbench 1.1.0 — linear, prismatic Euler–Bernoulli beam.
   Internal units: kN, m, rad. Input loads: downward force/q positive,
   counterclockwise applied couple positive. Displacement/reaction upward positive.
   Consistent nodal loading + exact equilibrium/integrated displacement recovery. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BeamCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='1.1.0', G=9.80665, groups=['D','L','X'];
const copy=x=>JSON.parse(JSON.stringify(x));
const finite=(x,n)=>{if(typeof x!=='number'||!Number.isFinite(x))throw Error(n+'必須為有限數值');return x;};
function continuousModel(model,lengths,extendFullLengthLoads=true){
 if(!Array.isArray(lengths)||lengths.length<2||lengths.length>11)throw Error('連續梁快速設定須為 2～11 跨（3～12 個支承）');
 lengths.forEach((L,i)=>{finite(L,'第'+(i+1)+'跨長度');if(L<=0)throw Error('第'+(i+1)+'跨長度須大於零');});
 const m=copy(model),oldLength=m.length;let x=0;
 m.supports=[{x:0,type:'pin',settlement:0}];
 for(const L of lengths){x+=L;m.supports.push({x,type:'roller',settlement:0});}
 m.length=x;
 if(extendFullLengthLoads)for(const l of m.loads)if(l.type==='distributed'&&l.a===0&&Math.abs(l.b-oldLength)<=Math.max(1,oldLength)*1e-9)l.b=x;
 // Validate a copy before applying: never leave a partially changed project.
 try{validate(m);}catch(e){throw Error('分跨設定未套用：'+e.message+'。原載重位置採絕對座標，請先檢查載重及車位。');}
 return m;
}
function validate(m){
 if(!m||m.schema!=='beam-workbench/1')throw Error('專案格式不支援，請使用本工具匯出的 JSON');
 finite(m.length,'梁長');if(m.length<.1||m.length>1000)throw Error('梁長須介於 0.1～1000 m');
 finite(m.E,'彈性模數 E');finite(m.I,'慣性矩 I');if(m.E<=0||m.I<=0||!Number.isFinite(m.E*m.I*1e-5))throw Error('E 與 I 必須大於零且EI須在可計算範圍');
 if(typeof m.selfWeight!=='boolean')throw Error('梁自重選項格式錯誤');
 for(const k of ['A','Splus','Sminus','gamma']){finite(m[k],k);if(m[k]<0)throw Error(k+'不得為負值');}
 if(m.selfWeight&&!(m.A>0&&m.gamma>0))throw Error('自重開啟時須提供正值 A 與單位重 γ');
 if(!Array.isArray(m.supports)||m.supports.length<1||m.supports.length>12)throw Error('支承數須為 1～12');
 const tol=m.length*1e-9;
 const ss=[...m.supports].sort((a,b)=>a.x-b.x);
 ss.forEach((s,i)=>{finite(s.x,'支承位置');finite(s.settlement,'支承沉陷');if(s.x<0||s.x>m.length)throw Error('支承位置超出梁長');if(!['pin','roller','fixed'].includes(s.type))throw Error('支承型式不支援');if(i&&s.x-ss[i-1].x<tol)throw Error('支承位置重複，請合併支承');if(s.x>tol&&s.x<m.length-tol&&Math.min(s.x,m.length-s.x)<m.length*1e-6)throw Error('支承過於接近端點，請改為端點支承');if(i&&s.x-ss[i-1].x<m.length*1e-6)throw Error('支承距離過近，請檢查單位');});
 if(!ss.some(s=>s.type==='fixed')&&ss.length<2)throw Error('模型不穩定：需一個固定端，或至少兩個不同位置的垂直支承');
 if(!Array.isArray(m.loads)||m.loads.length>100)throw Error('靜態載重最多 100 筆');
 m.loads.forEach(l=>{
  if(!groups.includes(l.group))throw Error('載重分類須為 D、L 或 X');
  if(!['point','moment','distributed'].includes(l.type))throw Error('載重型式不支援');
  if(l.type==='distributed'){for(const k of ['a','b','q0','q1'])finite(l[k],'分布載重 '+k);if(l.a<0||l.b>m.length||l.b-l.a<tol)throw Error('分布載重須满足 0 ≤ 起點 < 終點 ≤ 梁長');}
  else{finite(l.x,'載重位置');finite(l.value,'載重大小');if(l.x<0||l.x>m.length)throw Error('集中載重位置超出梁長');}
 });
 if(!m.factors||!m.serviceFactors)throw Error('缺少載重組合');for(const f of [m.factors,m.serviceFactors])for(const g of groups){finite(f[g],'組合係數 '+g);if(Math.abs(f[g])>10)throw Error('組合係數絕對值不得超過 10');}
 if(!m.vehicle||!Array.isArray(m.vehicle.axles)||typeof m.vehicle.enabled!=='boolean'||typeof m.vehicle.reverse!=='boolean')throw Error('缺少車輛設定或格式錯誤');
 if(m.vehicle.enabled){const v=m.vehicle;if(v.axles.length<1||v.axles.length>12)throw Error('車軸數須為 1～12');for(const k of ['position','step','impact','share'])finite(v[k],'車行參數 '+k);if(v.step<=0||v.step>m.length)throw Error('掃描步距須大於零且不得超過梁長');if(v.impact<0||v.impact>1||v.share<=0||v.share>10)throw Error('衝擊加成須為 0～1，分配係數須大於 0 且不超過 10');v.axles.forEach((a,i)=>{finite(a.offset,'車軸偏距');finite(a.p,'軸重');if(a.p<=0||a.offset<0||a.offset>1000)throw Error('車軸偏距須為 0～1000 m，軸重須大於零');if(i&&a.offset<=v.axles[i-1].offset)throw Error('車軸偏距須由小到大且不可重複');});if(Math.abs(v.axles[0].offset)>tol)throw Error('第一軸偏距須為 0');const t=v.axles.at(-1).offset;if(v.position<-t||v.position>m.length)throw Error('車輛基準軸位置超出行駛範圍');if(2*(m.length+t)/v.step+v.axles.length*160>6500)throw Error('掃描位置過多，請放大步距（含加密掃描上限約 6500 個位置）');}
 if(!['service','rc14','rc12','custom-service','custom-strength'].includes(m.combination))throw Error('分析組合型式不支援');
 finite(m.shearFactor,'剪應力係數');if(m.shearFactor<0)throw Error('剪應力係數不得為負');
 if(typeof m.title!=='string'||m.title.length>200)throw Error('專案名稱須為200字以內');
 if(!m.checks||!['service','strength'].includes(m.checks.basis)||!['ratio','absolute'].includes(m.checks.defMode))throw Error('檢核設定型式不支援');for(const k of ['Mplus','Mminus','V','fb','fv','defDen','defAbs']){finite(m.checks[k],'檢核值 '+k);if(m.checks[k]<0)throw Error('檢核值不得為負');}if(m.checks.defMode==='ratio'&&m.checks.defDen<=0)throw Error('撓度分母須大於零');if(m.checks.defMode==='absolute'&&m.checks.defAbs<=0)throw Error('容許撓度須大於零');
 return m;
}
function uniq(a,tol){return a.sort((a,b)=>a-b).filter((x,i,arr)=>i===0||x-arr[i-1]>tol);}
function shape(r,L){return [1-3*r*r+2*r*r*r,L*(r-2*r*r+r*r*r),3*r*r-2*r*r*r,L*(-r*r+r*r*r)];}
function shapeDeriv(r,L){return [(-6*r+6*r*r)/L,1-4*r+3*r*r,(6*r-6*r*r)/L,-2*r+3*r*r];}
function chol(A){const n=A.length,B=Array.from({length:n},()=>new Float64Array(n));const scale=A.map((r,i)=>Math.sqrt(r[i]));if(scale.some(x=>!Number.isFinite(x)||x<=0))throw Error('模型剛度異常');for(let i=0;i<n;i++)for(let j=0;j<=i;j++){let s=A[i][j]/(scale[i]*scale[j]);for(let k=0;k<j;k++)s-=B[i][k]*B[j][k];if(i===j){if(s<1e-12)throw Error('模型不穩定或支承間距造成數值病態');B[i][j]=Math.sqrt(s);}else B[i][j]=s/B[j][j];}return {B,scale};}
function backsolve({B,scale},b){const n=b.length,y=new Float64Array(n),z=new Float64Array(n),out=new Float64Array(n);for(let i=0;i<n;i++){let s=b[i]/scale[i];for(let j=0;j<i;j++)s-=B[i][j]*y[j];y[i]=s/B[i][i];}for(let i=n-1;i>=0;i--){let s=y[i];for(let j=i+1;j<n;j++)s-=B[j][i]*z[j];z[i]=s/B[i][i];out[i]=z[i]/scale[i];}return out;}
function compile(m){validate(m);const nodes=uniq([0,m.length,...m.supports.map(s=>s.x)],m.length*1e-10),n=nodes.length*2,EI=m.E*m.I*1e-5,K=Array.from({length:n},()=>new Float64Array(n));
 for(let e=0;e<nodes.length-1;e++){const L=nodes[e+1]-nodes[e],f=EI/(L*L*L),k=[[12,6*L,-12,6*L],[6*L,4*L*L,-6*L,2*L*L],[-12,-6*L,12,-6*L],[6*L,2*L*L,-6*L,4*L*L]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)K[2*e+i][2*e+j]+=f*k[i][j];}
 const known=new Map(),supportMap=m.supports.map(s=>{const i=nodes.findIndex(x=>Math.abs(s.x-x)<m.length*1e-9);known.set(2*i,-s.settlement/1000);if(s.type==='fixed')known.set(2*i+1,0);return {...s,node:i};});const free=Array.from({length:n},(_,i)=>i).filter(i=>!known.has(i));const solver=free.length?chol(free.map(i=>free.map(j=>K[i][j]))):null;
 return {model:copy(m),nodes,EI,K,known,free,solver,supportMap};
}
function loadsFor(m,factors,position=m.vehicle.position){const arr=m.loads.filter(l=>l.enabled!==false).map(l=>{const f=factors[l.group];return l.type==='distributed'?{...l,q0:l.q0*f,q1:l.q1*f}:{...l,value:l.value*f};});if(m.selfWeight)arr.push({type:'distributed',group:'D',a:0,b:m.length,q0:m.gamma*m.A*1e-4*factors.D,q1:m.gamma*m.A*1e-4*factors.D,name:'自動自重'});if(m.vehicle.enabled){const v=m.vehicle,t=v.axles.at(-1).offset;v.axles.forEach((a,i)=>{const offset=v.reverse?t-a.offset:a.offset,x=position+offset;if(x>=-1e-10&&x<=m.length+1e-10)arr.push({type:'point',group:'L',x:Math.max(0,Math.min(m.length,x)),value:a.p*v.share*(1+v.impact)*factors.L,name:'車軸 '+(i+1),vehicle:true});});}return arr;}
function elemAt(nodes,x){let i=0;while(i<nodes.length-2&&x>nodes[i+1])i++;return i;}
function solve(comp,factors=comp.model.factors,position=comp.model.vehicle.position){const {model:m,nodes,EI,K,known,free,solver}=comp,loads=loadsFor(m,factors,position),F=new Float64Array(K.length);
 for(const l of loads){if(l.type==='point'||l.type==='moment'){const e=elemAt(nodes,l.x),L=nodes[e+1]-nodes[e],r=(l.x-nodes[e])/L,N=l.type==='point'?shape(r,L):shapeDeriv(r,L),v=l.type==='point'?-l.value:l.value;for(let j=0;j<4;j++)F[2*e+j]+=v*N[j];}else{for(let e=0;e<nodes.length-1;e++){const a=Math.max(nodes[e],l.a),b=Math.min(nodes[e+1],l.b);if(b<=a)continue;const L=nodes[e+1]-nodes[e],mid=(a+b)/2,half=(b-a)/2,pts=[-Math.sqrt(3/5),0,Math.sqrt(3/5)],wt=[5/9,8/9,5/9];for(let g=0;g<3;g++){const x=mid+half*pts[g],q=-(l.q0+(l.q1-l.q0)*(x-l.a)/(l.b-l.a)),N=shape((x-nodes[e])/L,L);for(let j=0;j<4;j++)F[2*e+j]+=wt[g]*half*q*N[j];}}}}
 const d=new Float64Array(K.length);for(const [i,v]of known)d[i]=v;const rhs=free.map(i=>{let v=F[i];for(const [j,c]of known)v-=K[i][j]*c;return v;});if(free.length){const df=backsolve(solver,rhs);free.forEach((i,j)=>d[i]=df[j]);}
 if([...F,...d].some(v=>!Number.isFinite(v)))throw Error('輸入數值超出數值求解範圍');
 const residual=K.map((row,i)=>row.reduce((s,k,j)=>s+k*d[j],0)-F[i]),reactions=comp.supportMap.map(s=>({...s,R:residual[2*s.node],C:s.type==='fixed'?residual[2*s.node+1]:0}));let sumF=reactions.reduce((s,r)=>s+r.R,0),sumM=reactions.reduce((s,r)=>s+r.R*r.x+r.C,0),forceScale=0,momentScale=0;
 for(const l of loads){if(l.type==='point'){sumF-=l.value;sumM-=l.value*l.x;forceScale+=Math.abs(l.value);momentScale+=Math.abs(l.value*l.x);}else if(l.type==='moment'){sumM+=l.value;momentScale+=Math.abs(l.value);}else{const L=l.b-l.a,Q=L*(l.q0+l.q1)/2,first=l.a*Q+L*L*(l.q0+2*l.q1)/6;sumF-=Q;sumM-=first;forceScale+=L*(Math.abs(l.q0)+Math.abs(l.q1))/2;momentScale+=Math.abs(first);}}
 const balance={force:sumF,moment:sumM,relativeForce:Math.abs(sumF)/Math.max(1,forceScale),relativeMoment:Math.abs(sumM)/Math.max(1,momentScale)};if(Object.values(balance).some(v=>!Number.isFinite(v))||balance.relativeForce>1e-7||balance.relativeMoment>1e-7)throw Error('平衡殘差過大，請检查支承與輸入單位');
 return {length:m.length,EI,nodes:[...nodes],d:[...d],F:[...F],reactions,loads,balance,factors:{...factors},position,freeResidual:Math.max(0,...free.map(i=>Math.abs(residual[i])))};
}
function convolution(l,x){const z=x-l.a;if(z<=0)return [0,0,0,0];const t=Math.min(z,l.b-l.a),q=-l.q0,k=-(l.q1-l.q0)/(l.b-l.a),t2=t*t,t3=t2*t,t4=t3*t,t5=t4*t,z2=z*z,z3=z2*z;return [q*t+k*t2/2,q*(z*t-t2/2)+k*(z*t2/2-t3/3),(q*(z2*t-z*t2+t3/3)+k*(z2*t2/2-2*z*t3/3+t4/4))/2,(q*(z3*t-1.5*z2*t2+z*t3-t4/4)+k*(z3*t2/2-z2*t3+3*z*t4/4-t5/5))/6];}
function evaluate(s,x,side='right'){if(x<-1e-10||x>s.length+1e-10)throw Error('取值座標超出梁長');x=Math.max(0,Math.min(s.length,x));let V=0,M=0,T=0,Y=0;const tol=s.length*1e-11;
 const force=(a,p)=>{const t=x-a;if(t>tol||(Math.abs(t)<=tol&&side==='right')){V+=p;M+=p*t;}if(t>0){T+=p*t*t/2;Y+=p*t*t*t/6;}};
 const couple=(a,c)=>{const t=x-a;if(t>tol||(Math.abs(t)<=tol&&side==='right'))M-=c;if(t>0){T-=c*t;Y-=c*t*t/2;}};
 for(const r of s.reactions){force(r.x,r.R);couple(r.x,r.C);}for(const l of s.loads){if(l.type==='point')force(l.x,-l.value);else if(l.type==='moment')couple(l.x,l.value);else{const p=convolution(l,x);V+=p[0];M+=p[1];T+=p[2];Y+=p[3];}}
 return {x,side,V,M,theta:s.d[1]+T/s.EI,y:s.d[0]+s.d[1]*x+Y/s.EI};
}
function polyVal(a,x){let v=0;for(let i=a.length-1;i>=0;i--)v=v*x+a[i];return v;}
function roots(a,lo,hi){a=[...a];const scale=Math.max(0,...a.map(Math.abs));if(scale===0)return [];a=a.map(v=>v/scale);while(a.length>1&&Math.abs(a.at(-1))*Math.max(1,hi**(a.length-1))<1e-14)a.pop();if(a.length<2)return [];if(a.length===2){const x=-a[0]/a[1];return x>=lo-1e-10&&x<=hi+1e-10?[Math.max(lo,Math.min(hi,x))]:[];}const mid=roots(a.slice(1).map((v,i)=>v*(i+1)),lo,hi),bounds=uniq([lo,...mid,hi],1e-12),out=[];for(const t of bounds)if(Math.abs(polyVal(a,t))<1e-10*Math.max(1,...a.map((v,i)=>Math.abs(v)*Math.max(1,t**i))))out.push(t);for(let i=0;i<bounds.length-1;i++){let l=bounds[i],r=bounds[i+1],fl=polyVal(a,l),fr=polyVal(a,r);if(fl*fr>=0)continue;for(let j=0;j<60;j++){const c=(l+r)/2,fc=polyVal(a,c);if(fl*fc<=0){r=c;fr=fc;}else{l=c;fl=fc;}}out.push((l+r)/2);}return uniq(out,1e-8*Math.max(1,hi-lo));}
function eventXs(s){const p=[0,s.length,...s.reactions.map(r=>r.x)];for(const l of s.loads)if(l.type==='distributed')p.push(l.a,l.b);else p.push(l.x);return uniq(p,s.length*1e-10);}
function spans(m){const ss=[...m.supports].sort((a,b)=>a.x-b.x),arr=[];if(ss[0].x>0)arr.push({a:0,b:ss[0].x,kind:'cantilever',anchor:ss[0].x});for(let i=0;i<ss.length-1;i++)arr.push({a:ss[i].x,b:ss[i+1].x,kind:'span'});if(ss.at(-1).x<m.length)arr.push({a:ss.at(-1).x,b:m.length,kind:'cantilever',anchor:ss.at(-1).x});return arr.map((p,i)=>({...p,index:i+1,length:p.b-p.a}));}
function chord(s,p){if(p.kind==='span'){const a=evaluate(s,p.a),b=evaluate(s,p.b);return {base:a.y,at:p.a,slope:(b.y-a.y)/p.length};}const a=evaluate(s,p.anchor);return {base:a.y,at:p.anchor,slope:a.theta};}
function qAt(s,x){let q=0,k=0;for(const l of s.loads)if(l.type==='distributed'&&x>l.a&&x<l.b){const z=-(l.q1-l.q0)/(l.b-l.a);q-=l.q0-z*(x-l.a);k+=z;}return {q,k};}
function summarize(s,m,sampleCount=160){const events=eventXs(s),candidates=[...events],spanList=spans(m),spanInfo=spanList.map(p=>({...p,chord:chord(s,p)}));
 for(let i=0;i<events.length-1;i++){const a=events[i],b=events[i+1],L=b-a,p=evaluate(s,a,'right'),mid=(a+b)/2,{q:qm,k}=qAt(s,mid),q0=qm-k*L/2;candidates.push(...roots([p.V,q0,k/2],0,L).map(t=>a+t),...roots([q0,k],0,L).map(t=>a+t));const th=[p.theta,p.M/s.EI,p.V/(2*s.EI),q0/(6*s.EI),k/(24*s.EI)];candidates.push(...roots(th,0,L).map(t=>a+t));for(const sp of spanInfo)if(mid>=sp.a&&mid<=sp.b)candidates.push(...roots([th[0]-sp.chord.slope,...th.slice(1)],0,L).map(t=>a+t));}
 for(let i=0;i<=sampleCount;i++)candidates.push(s.length*i/sampleCount);const xs=uniq(candidates,s.length*1e-10),rows=[];for(const x of xs){const isEvent=events.some(a=>Math.abs(a-x)<s.length*1e-9);if(isEvent&&x>0&&x<s.length)rows.push(evaluate(s,x,'left'));rows.push(evaluate(s,x,x===s.length?'left':'right'));}
 let Mplus={value:0,x:0,side:'right'},Mminus={value:0,x:0,side:'right'},Vabs={value:0,x:0,side:'right'},Dabs={value:0,x:0,side:'right'};
 for(const r of rows){if(r.M>Mplus.value)Mplus={value:r.M,x:r.x,side:r.side};if(-r.M>Mminus.value)Mminus={value:-r.M,x:r.x,side:r.side};if(Math.abs(r.V)>Vabs.value)Vabs={value:Math.abs(r.V),x:r.x,side:r.side};}
 Dabs=rows.reduce((best,r)=>Math.abs(r.y)*1000>best.value?{value:Math.abs(r.y)*1000,x:r.x,side:r.side}:best,{value:0,x:0,side:'right'});
 let deflection={value:0,ratio:0,x:0,span:0,limit:0};const spanResults=spanInfo.map(p=>{let best={value:0,x:p.a};for(const r of rows)if(r.x>=p.a-1e-9&&r.x<=p.b+1e-9){const v=Math.abs(r.y-p.chord.base-p.chord.slope*(r.x-p.chord.at))*1000;if(v>best.value)best={value:v,x:r.x};}const limit=m.checks.defMode==='absolute'?m.checks.defAbs:p.length*1000/m.checks.defDen,ratio=best.value/limit;if(deflection.span===0||ratio>deflection.ratio)deflection={...best,ratio,span:p.index,limit};return {...p,...best,limit,ratio};});
 return {rows,Mplus,Mminus,Vabs,Dabs,deflection,spanResults};
}
function stations(comp,count=120){const x=uniq([0,comp.model.length,...comp.nodes, ...Array.from({length:count+1},(_,i)=>comp.model.length*i/count),...comp.model.loads.flatMap(l=>l.type==='distributed'?[l.a,l.b]:[l.x])],comp.model.length*1e-10),out=[];for(const t of x){if(t>0&&t<comp.model.length)out.push({x:t,side:'left'});out.push({x:t,side:t===comp.model.length?'left':'right'});}return out;}
function scanPositions(m,step,st){const v=m.vehicle,t=v.axles.at(-1).offset,arr=[-t,m.length],N=Math.ceil((m.length+t)/step);for(let i=0;i<=N;i++)arr.push(Math.min(m.length,-t+i*step));for(const a of v.axles){const off=v.reverse?t-a.offset:a.offset;for(const p of st){const s=p.x-off;if(s>=-t&&s<=m.length)arr.push(s);}}return uniq(arr,m.length*1e-10);}
async function scan(comp,factors,step,onProgress){const m=comp.model,st=stations(comp),positions=scanPositions(m,step,st),env=st.map(p=>({...p,Vmin:Infinity,Vmax:-Infinity,Mmin:Infinity,Mmax:-Infinity,ymin:Infinity,ymax:-Infinity})),reactionEnv=m.supports.map(s=>({x:s.x,Rmin:Infinity,Rmax:-Infinity,Cmin:Infinity,Cmax:-Infinity})),governing={Mplus:null,Mminus:null,Vabs:null,Dabs:null,deflection:null};
 for(let i=0;i<positions.length;i++){const s=solve(comp,factors,positions[i]),a=summarize(s,m,24);for(const k of Object.keys(governing)){const val=k==='deflection'?a[k].ratio:a[k].value;if(!governing[k]||val>governing[k].metric)governing[k]={metric:val,position:s.position,result:a[k],solution:s};}env.forEach(e=>{const p=evaluate(s,e.x,e.side);for(const k of ['V','M','y']){e[k+'min']=Math.min(e[k+'min'],p[k]);e[k+'max']=Math.max(e[k+'max'],p[k]);}});reactionEnv.forEach((e,j)=>{const r=s.reactions[j];e.Rmin=Math.min(e.Rmin,r.R);e.Rmax=Math.max(e.Rmax,r.R);e.Cmin=Math.min(e.Cmin,r.C);e.Cmax=Math.max(e.Cmax,r.C);});if(i%16===0){if(onProgress)onProgress(i/positions.length);await new Promise(resolve=>setTimeout(resolve,0));}}
 if(onProgress)onProgress(1);return {step,count:positions.length,rows:env,reactions:reactionEnv,governing,maxGap:Math.max(...positions.slice(1).map((x,i)=>x-positions[i]))};
}
async function envelope(comp,factors=comp.model.factors,onProgress){if(!comp.model.vehicle.enabled)throw Error('請先啟用車行載重');const coarse=await scan(comp,factors,comp.model.vehicle.step,p=>onProgress&&onProgress(p*.4)),fine=await scan(comp,factors,comp.model.vehicle.step/2,p=>onProgress&&onProgress(.4+p*.6)),changes={};for(const k of Object.keys(fine.governing)){const a=coarse.governing[k].metric,b=fine.governing[k].metric;changes[k]=Math.abs(b-a)/Math.max(1e-12,Math.abs(b));}return {...fine,coarseStep:coarse.step,coarseCount:coarse.count,changes,converged:Math.max(...Object.values(changes))<=.005};}
function checks(m,a,service,env=null,serviceEnv=null){const c=m.checks,sel=k=>env?env.governing[k].result:a[k],sdef=serviceEnv?serviceEnv.governing.deflection.result:service.deflection,items=[],isService=['service','custom-service'].includes(m.combination);const compatible=(c.basis==='service'&&isService)||(c.basis==='strength'&&!isService),source=String(c.capacitySource||'').trim();
 const row=(name,demand,capacity,unit,ready,reason)=>({name,demand,capacity,unit,ratio:capacity>0?demand/capacity:null,status:demand<=1e-8?'無需求':!ready?'待確認':demand<=capacity*(1+1e-9)?'通過':'超限',reason});
 for(const [name,k,cap]of [['正彎矩','Mplus',c.Mplus],['負彎矩','Mminus',c.Mminus],['剪力','Vabs',c.V]])items.push(row(name,sel(k).value,cap,name==='剪力'?'force':'moment',cap>0&&source&&compatible,!compatible?'載重組合與容量基準不相符':!source?'需填容量來源／規範條文':cap<=0?'需填入經設計的容量':'需求與所輸入容量比對'));
 const hasS=(sel('Mplus').value<=1e-8||m.Splus>0)&&(sel('Mminus').value<=1e-8||m.Sminus>0),stress=hasS?Math.max(m.Splus>0?sel('Mplus').value*1000/m.Splus:0,m.Sminus>0?sel('Mminus').value*1000/m.Sminus:0):null;const bending=row('彎曲彈性應力',stress,c.fb,'MPa',c.fb>0&&source&&compatible&&isService&&hasS,'σ = M / S；須採使用組合及容許應力來源，RC 開裂斷面不直接套用');if(c.fb===0)bending.status='未啟用';else if(!hasS||!isService){bending.status='待確認';bending.ratio=null;}items.push(bending);
 const shear=m.shearFactor>0?sel('Vabs').value*m.shearFactor:null,sh=row('剪應力',shear,c.fv,'MPa',c.fv>0&&source&&compatible&&isService&&m.shearFactor>0,'矩形採 1.5V/A；H 型採 VQ/(Itw)；自訂斷面需提供係數，容許應力採使用組合');if(c.fv===0)sh.status='未啟用';else if(m.shearFactor<=0||!isService){sh.status='待確認';sh.ratio=null;}items.push(sh);
 items.push({...row('使用載重相對撓度',sdef.value,sdef.limit,'mm',Boolean(String(c.defSource||'').trim()),'相對支承弦線／懸臂端切線；參考跨度 '+sdef.span),ratio:sdef.ratio});return {items,compatible,overall:items.some(i=>i.status==='超限')?'輸入條件下有超限':items.some(i=>i.status==='待確認')?'分析完成・檢核資料待補':'所列容量比對通過',stress,shear};
}
function section(kind,p){if(kind==='rectangle'){const {b,h}=p;if(!(b>0&&h>0))throw Error('矩形尺寸須大於零');return {A:b*h,I:b*h**3/12,Splus:b*h*h/6,Sminus:b*h*h/6,shearFactor:15/(b*h)};}if(kind==='h'){const {h,b,tw,tf}=p;if(!(h>2*tf&&b>tw&&tw>0&&tf>0))throw Error('H 型尺寸不合理，請檢查梁深、翼寬、厚度');const hw=h-2*tf,A=2*b*tf+hw*tw,I=(b*h**3-(b-tw)*hw**3)/12,Q=b*tf*(h/2-tf/2)+tw*hw*hw/8;return {A,I,Splus:2*I/h,Sminus:2*I/h,shearFactor:10*Q/(I*tw)};}throw Error('斷面型式不支援');}
function example(name='uniform'){const m={schema:'beam-workbench/1',title:'梁受力分析',length:6,E:200000,I:8000,A:50,Splus:500,Sminus:500,gamma:77,selfWeight:false,sectionKind:'custom',sectionDims:{b:20,h:40,tw:.65,tf:.9},shearFactor:.3,supports:[{x:0,type:'pin',settlement:0},{x:6,type:'roller',settlement:0}],loads:[{name:'全跨均布載重',type:'distributed',group:'D',a:0,b:6,q0:10,q1:10,enabled:true}],combination:'service',factors:{D:1,L:1,X:1},serviceFactors:{D:1,L:1,X:1},vehicle:{enabled:false,position:0,step:.1,impact:0,share:1,reverse:false,axles:[{offset:0,p:80},{offset:3.6,p:120},{offset:4.9,p:120}]},checks:{basis:'service',Mplus:0,Mminus:0,V:0,fb:0,fv:0,capacitySource:'',defMode:'ratio',defDen:360,defAbs:15,defSource:''}};
 if(name==='point'){m.title='跨中集中力範例';m.loads=[{name:'跨中集中力',type:'point',group:'L',x:3,value:20,enabled:true}];}
 if(name==='cantilever'){m.title='懸臂端點集中力範例';m.length=3;m.supports=[{x:0,type:'fixed',settlement:0}];m.loads=[{name:'自由端集中力',type:'point',group:'L',x:3,value:20,enabled:true}];}
 if(name==='fixed'){m.title='兩端固定均布載重範例';m.supports.forEach(s=>s.type='fixed');}
 if(name==='continuous'){m.title='兩跨連續梁範例';m.length=12;m.supports=[{x:0,type:'pin',settlement:0},{x:6,type:'roller',settlement:0},{x:12,type:'roller',settlement:0}];m.loads[0].b=12;}
 if(['three-span','four-span','unequal-span'].includes(name)){const lengths=name==='three-span'?[6,6,6]:name==='four-span'?[6,6,6,6]:[4,6,5];const c=continuousModel(m,lengths);c.title=name==='three-span'?'三跨連續梁範例':name==='four-span'?'四跨連續梁範例':'不等跨連續梁範例（4＋6＋5m）';return c;}
 if(name==='triangle'){m.title='三角分布載重範例';m.loads[0].q0=0;m.loads[0].q1=12;}
 if(name==='moment'){m.title='跨中集中彎矩範例';m.loads=[{name:'逆時針彎矩',type:'moment',group:'L',x:3,value:20,enabled:true}];}
 if(name==='vehicle'){m.title='車行載重範例（自訂示範車）';m.length=12;m.supports[1].x=12;m.loads=[{name:'永久均布載重',type:'distributed',group:'D',a:0,b:12,q0:2,q1:2,enabled:true}];m.vehicle.enabled=true;m.vehicle.position=4;}
 return m;
}
return {VERSION,G,validate,compile,solve,evaluate,summarize,envelope,checks,section,continuousModel,example,loadsFor,roots,spans,stations,scanPositions};
});
