// The report reads the solved state; the equations below also expose independent equilibrium checks.
import {mv, shape, vehicleLength} from './solver.js';

const number = value => value === 0 ? '0' : Number(value.toPrecision(8)).toString();
const vector = values => '[' + Array.from(values, number).join(', ') + ']';
const block = (type, text) => ({type, text});
const table = (headers, rows) => ({type:'table', headers, rows});
const sum = values => values.reduce((a, b) => a + b, 0);
const dot = (a, b) => a.reduce((v, n, i) => v + n * b[i], 0);
const labels = ['vᵢ', 'θᵢ', 'vⱼ', 'θⱼ'];

function indexAt(model, x, side) {
  const index = model.els.findIndex(e => side < 0 ? x <= e.b + 1e-9 : x < e.b - 1e-9);
  return index < 0 ? model.els.length - 1 : index;
}

function gauss3(a, b, f) {
  if (b <= a) return 0;
  const half = (b - a) / 2, mid = (a + b) / 2, delta = Math.sqrt(3 / 5) * half;
  return half * (5 * f(mid - delta) + 8 * f(mid) + 5 * f(mid + delta)) / 9;
}

function lineAt(load, x) {
  return load.w1 + (load.w2 - load.w1) * (x - load.a) / (load.b - load.a);
}

function elementExample(model, result, x, dynamicMode) {
  // Prefer a loaded element at the chosen station, then the closest loaded element.
  let index = indexAt(model, x, 1), distance = Infinity;
  model.els.forEach((e, i) => {
    const gap = Math.max(0, x - e.b, e.a - x);
    if (result.load.elLoads[i].length && gap < distance) {index = i; distance = gap;}
  });
  const e = model.els[index], spanIndex = model.ss.findIndex((v, i) => i > 0 && (e.a + e.b) / 2 < v) - 1;
  const span = model.c.spans[spanIndex];
  const blocks = [
    block('h1','有限元素組裝與求解'),
    block('p','以下列式採 kN、m、s。位移 v 向上為正，轉角 θ 逆時針為正。元素自由度依序為左端 vᵢ、θᵢ，右端 vⱼ、θⱼ。垂直自由度的力為 kN，轉動自由度的力矩為 kN·m。'),
    block('h2','元素剛度與等效節點力'),
    block('p',`取第 ${index + 1} 元素，起點 ${number(e.a)} m、終點 ${number(e.b)} m，長度 h = ${number(e.h)} m。其四個整體自由度編號為 ${e.ids.map(i=>i+1).join('、')}。`),
    block('formula',`EI = E × I = ${number(span.E)} GPa × 10⁶ × ${number(span.I)} m⁴ = ${number(e.EI)} kN·m²`),
    block('formula',`k₁₁ = 12EI/h³ = 12 × ${number(e.EI)} / ${number(e.h)}³ = ${number(e.ke[0][0])} kN/m`),
    block('p','下表為此元素實際剛度矩陣。平移對平移項的單位為 kN/m，平移與轉角的交叉項為 kN，轉角對轉角項為 kN·m。轉角以 rad 計。'),
    table(['kₑ',...labels],e.ke.map((r,i)=>[labels[i],...r.map(number)])),
    block('formula','r = s/h，N = [1 − 3r² + 2r³, h(r − 2r² + r³), 3r² − 2r³, h(−r² + r³)]'),
    block('formula','fₑ = −Σ NᵀP − ∫ Nᵀw ds + Σ (dN/ds)ᵀM₀'),
    block('p','P、w 向下為正，外加力偶 M₀ 逆時針為正。s 自元素左端起算。分布載重在實際重疊區間採三點 Gauss 積分。')
  ];
  const loads = result.load.elLoads[index];
  if (loads.length) {
    const rows = loads.map(l => {
      let nodal, detail;
      if (l.type === 'line') {
        const a = Math.max(e.a, l.a), b = Math.min(e.b, l.b);
        nodal = labels.map((_,j)=>-gauss3(a,b,z=>lineAt(l,z)*shape(z-e.a,e.h)[j]));
        detail = `x = ${number(a)} 至 ${number(b)} m；w = ${number(lineAt(l,a))} 至 ${number(lineAt(l,b))} kN/m`;
      } else {
        const s = Math.max(0,Math.min(e.h,l.x-e.a)), r = s / e.h;
        const N = l.type === 'moment' ? [(-6*r+6*r*r)/e.h,1-4*r+3*r*r,(6*r-6*r*r)/e.h,-2*r+3*r*r] : shape(s,e.h);
        nodal = N.map(v=>v*l.p*(l.type==='moment'?1:-1));
        detail = `x = ${number(l.x)} m，${l.type === 'moment' ? 'M₀' : 'P'} = ${number(l.p)} ${l.type === 'moment' ? 'kN·m' : 'kN'}`;
      }
      return [detail,...nodal.map(number)];
    });
    rows.push(['元素合計',...Array.from(result.load.efs[index],number)]);
    blocks.push(table(['載重與作用範圍','Fᵢ (kN)','Mᵢ (kN·m)','Fⱼ (kN)','Mⱼ (kN·m)'],rows));
  } else blocks.push(block('formula','本工況元素外載重向量 fₑ = [0, 0, 0, 0]。'));
  if (dynamicMode) {
    blocks.push(block('p',`一致質量矩陣以 μh/420 為係數，μ = ${number(e.mu)} t/m。與剛度矩陣相同的列、欄順序分別產生 t、t·m 及 t·m² 三種耦合單位。`),
      block('formula',`m₁₁ = 156μh/420 = 156 × ${number(e.mu)} × ${number(e.h)} / 420 = ${number(e.me[0][0])} t`),
      table(['mₑ',...labels],e.me.map((r,i)=>[labels[i],...r.map(number)])));
  }
  const j = index===model.els.length-1 ? e.ids[0] : e.ids[2];
  const sharedK = [], sharedF = [];
  for (const [i,el] of model.els.entries()) {
    const k = el.ids.indexOf(j);
    if (k < 0) continue;
    sharedK.push(el.ke[k][k]); sharedF.push(result.load.efs[i][k]);
  }
  blocks.push(block('h2','整體矩陣與邊界條件'),
    block('p',`依元素自由度對應逐項相加。以整體垂直自由度 ${j+1} 為例，元素交界的兩側均納入同一個方程。`),
    block('formula',`K[${j+1},${j+1}] = ${sharedK.map(number).join(' + ')} = ${number(model.K[j][j])} kN/m`),
    block('formula',`F[${j+1}] = ${sharedF.map(number).join(' + ')} = ${number(result.load.F[j])} kN`),
    block('p',`共 ${model.xs.length} 個節點、${model.n} 個自由度。令受約束自由度 ${model.constrained.map(i=>i+1).join('、')} 為零，保留 ${model.free.length} 個自由度。下標 f 代表未約束自由度，c 代表受約束自由度。`),
    block('formula',dynamicMode?'Mff a + Cff u̇ + Kff u = Ff；平移以 m 表示，轉角以 rad 表示。':'Kff uf = Ff；以 Cholesky 分解 Kff = LLᵀ，依序解 Ly = Ff、Lᵀuf = y。'));
  return blocks;
}

function movingMethod(model,analysis,frame) {
  const c=model.c, speed=c.speed/3.6, direction=c.direction===1?'d − 偏距':'L − d + 偏距';
  const blocks = [block('h2','車軸位置與移動載重'),
    block('formula',`行進速率 = ${number(c.speed)} / 3.6 = ${number(speed)} m/s。前軸行程 d = ${number(frame.front)} m，t = ${number(frame.t)} s。`),
    block('p',`每軸座標 x = ${direction}，僅列入落在梁上之軸重。各軸作用力 = 輸入軸重 × ${number(c.factor)}。此步梁上車軸共有 ${frame.result.load.loads.filter(l=>l.vehicle).length} 個。`)];
  if(c.mode==='moving') {
    const distance=model.L+vehicleLength(c);
    blocks.push(block('p',`總行程 ${number(distance)} m，均分基本步長 ${number(analysis.step)} m，另加入車軸通過支承與全梁中央的位置。共求解 ${analysis.frames.length} 個逐位置靜力工況。各斷面固定取樣位置在全部工況中分別取最大與最小值。`));
  }
  return blocks;
}

function timeIntegration(model,analysis,frameIndex) {
  const i=Math.max(1,frameIndex), a=analysis.frames[i-1].result, b=analysis.frames[i].result;
  const dt=analysis.dt, alpha=analysis.alpha, a0=4/dt**2, a1=2/dt;
  // Take the vertical free DOF with the largest magnitude acceleration in this update.
  const free=model.free.filter(k=>k%2===0);
  const j=free.reduce((best,k)=>Math.abs(b.acc[k])>Math.abs(b.acc[best])?k:best,free[0]);
  const du=b.u[j]-a.u[j], h=dt;
  const massPredict=a.u.map((v,k)=>a0*v+4/h*a.v[k]+a.acc[k]);
  const dampPredict=a.u.map((v,k)=>alpha*(a1*v+a.v[k]));
  const inertiaRhs=dot(model.M[j],massPredict), dampRhs=dot(model.M[j],dampPredict);
  const c=model.c, periods=2*Math.PI/model.omega, minH=Math.min(...model.els.map(e=>e.h));
  return [block('h2','Newmark 動力歷時逐步積分'),
    block('p',`取 β = 1/4、γ = 1/2。由 Kφ = ω²Mφ 求得 ω₁ = ${number(model.omega)} rad/s，T₁ = ${number(periods)} s。C = αM，α = 2 × ${number(c.damping/100)} × ${number(model.omega)} = ${number(alpha)} s⁻¹。`),
    block('formula',`Δt 上限 = min(輸入上限、T₁/60、h最短/(10 × 車速)) = min(${number(c.dt)}, ${number(periods/60)}, ${number(minH/(10*c.speed/3.6))}) s`),
    block('p',`將總歷時 ${number(analysis.frames.at(-1).t)} s 等分為 ${analysis.frames.length-1} 個時間間隔。實際 Δt = ${number(dt)} s。初始位移取常駐靜載平衡解、初速為零，進入梁上的車軸依初始平衡式 Mff a₀ = Ff(0) − Kff u₀ 求初始加速度。`),
    block('formula',`A₀ = 4/Δt² = ${number(a0)} s⁻²，A₁ = 2/Δt = ${number(a1)} s⁻¹。Keff = Kff + A₀ Mff + A₁ Cff。`),
    block('formula','F* = Fₙ₊₁ + M(A₀uₙ + 4vₙ/Δt + aₙ) + C(A₁uₙ + vₙ)，解 Keff uₙ₊₁ = F*。'),
    block('p',`代入步次 ${i-1} 至 ${i}（t = ${number(analysis.frames[i-1].t)} 至 ${number(analysis.frames[i].t)} s），取節點 ${j/2+1} 垂直自由度。`),
    block('formula',`F*[${j+1}] = (${number(b.load.F[j])}) + (${number(inertiaRhs)}) + (${number(dampRhs)}) = ${number(b.load.F[j]+inertiaRhs+dampRhs)} kN`),
    block('formula',`uₙ = ${number(a.u[j])} m，uₙ₊₁ = ${number(b.u[j])} m，Δu = ${number(du)} m`),
    block('formula',`aₙ₊₁ = A₀Δu − 4vₙ/Δt − aₙ = (${number(a0*du)}) − (${number(4*a.v[j]/dt)}) − (${number(a.acc[j])}) = ${number(b.acc[j])} m/s²`),
    block('formula',`vₙ₊₁ = vₙ + Δt(aₙ + aₙ₊₁)/2 = (${number(a.v[j])}) + ${number(h)} × [(${number(a.acc[j])}) + (${number(b.acc[j])})]/2 = ${number(b.v[j])} m/s`)];
}

function sectionWork(model,result,x,alpha) {
  const blocks=[block('h2','查詢斷面的剪力彎矩與撓度'),
    block('p',`斷面位於 x = ${number(x)} m。先計算元素端力 gₑ = kₑuₑ + mₑ(aₑ + αvₑ) − fₑ，再由左元素端至切面累計荷重。以下將向下的分布力、集中力及慣性與阻尼項計為正，力偶逆時針為正。`),
    block('formula','V = g₁ − Q，M = −g₂ + g₁s − B，δ = N uₑ。Q 為至切面之向下合力，B 為各向下力對切面的力臂乘積加外加力偶。')];
  const sides=x<=0?[1]:x>=model.L?[-1]:[-1,1];
  const rows=[];
  for(const side of sides) {
    const i=indexAt(model,x,side),e=model.els[i],s=Math.max(0,Math.min(e.h,x-e.a)),cut=e.a+s,y=result.at(x,side);
    let force=0,bending=0;
    for (const l of result.load.elLoads[i]) {
      if(l.type==='line') {
        const a=Math.max(e.a,l.a),b=Math.min(cut,l.b);
        force+=gauss3(a,b,z=>lineAt(l,z));
        bending+=gauss3(a,b,z=>lineAt(l,z)*(cut-z));
      } else if(l.x<cut-1e-9 || (side>0 && l.x<=cut+1e-9)) {
        if(l.type==='moment')bending+=l.p;
        else {force+=l.p;bending+=l.p*(cut-l.x);}
      }
    }
    const dv=e.ids.map(id=>result.acc[id]+alpha*result.v[id]);
    const inertia=z=>e.mu*dot(shape(z,e.h),dv);
    force+=gauss3(0,s,inertia);
    bending+=gauss3(0,s,z=>inertia(z)*(s-z));
    const g=result.ends[i];
    rows.push([side===1?'右極限':'左極限',String(i+1),number(s),number(g[0]),number(g[1]),number(force),number(bending)]);
    if(side===sides[0]){
      const u=e.ids.map(j=>result.u[j]);
      const kPart=dot(e.ke[0],u), dPart=dot(e.me[0],dv);
      blocks.push(block('formula',`元素端力 g₁ = (kₑuₑ)₁ + [mₑ(aₑ + αvₑ)]₁ − (fₑ)₁ = (${number(kPart)}) + (${number(dPart)}) − (${number(result.load.efs[i][0])}) = ${number(g[0])} kN`),
        block('formula',`${side<0?'左側':'右側'} V = (${number(g[0])}) − (${number(force)}) = ${number(y.V)} kN`),
        block('formula',`${side<0?'左側':'右側'} M = −(${number(g[1])}) + (${number(g[0])}) × ${number(s)} − (${number(bending)}) = ${number(y.M)} kN·m`),
        block('formula',`δ = ${vector(shape(s,e.h))} · ${vector(e.ids.map(j=>result.u[j]))} = ${number(dot(shape(s,e.h),e.ids.map(j=>result.u[j])))} m`));
    } else {
      blocks.push(block('formula',`右側 V = (${number(g[0])}) − (${number(force)}) = ${number(y.V)} kN，M = −(${number(g[1])}) + (${number(g[0])}) × ${number(s)} − (${number(bending)}) = ${number(y.M)} kN·m`));
    }
  }
  blocks.push(table(['切面','元素','s (m)','g₁ (kN)','g₂ (kN·m)','Q (kN)','B (kN·m)'],rows));
  return blocks;
}

function appliedResultants(result) {
  let applied=0,appliedMoment=0;
  for(const l of result.load.loads) {
    if(l.type==='line'){
      const h=l.b-l.a, force=h*(l.w1+l.w2)/2;
      applied-=force;
      appliedMoment-=l.a*force+h*h*(l.w1+2*l.w2)/6;
    }else if(l.type==='moment')appliedMoment+=l.p;
    else {applied-=l.p;appliedMoment-=l.p*l.x;}
  }
  return {applied,appliedMoment};
}

function balance(model,result,alpha,dynamicMode) {
  const {applied,appliedMoment}=appliedResultants(result);
  const Macc=mv(model.M,result.acc), Cvel=mv(model.M,result.v).map(v=>v*alpha), Ku=mv(model.K,result.u);
  function rigidSum(vec) {
    let force=0,moment=0;
    model.xs.forEach((x,i)=>{force+=vec[2*i];moment+=x*vec[2*i]+vec[2*i+1];});
    return [force,moment];
  }
  const [inertia,inertiaMoment]=rigidSum(Macc),[damping,dampingMoment]=rigidSum(Cvel);
  const R=sum(result.reactions.map(p=>p.R)),T=sum(result.reactions.map(p=>p.T+p.x*p.R));
  const epsF=R+applied-inertia-damping, epsM=T+appliedMoment-inertiaMoment-dampingMoment;
  const row=(title,a,b)=>[title,number(a),number(b)];
  const rows=[row('支承合力及對梁左端力矩',R,T),row('外載重及對梁左端力矩',applied,appliedMoment)];
  if(dynamicMode)rows.push(row('慣性項 Ma',inertia,inertiaMoment),row('阻尼項 C u̇',damping,dampingMoment));
  rows.push(row('平衡差',epsF,epsM));
  const residual=model.free.map(i=>Math.abs(Ku[i]+Macc[i]+Cvel[i]-result.load.F[i]));
  const maxBy=(parity)=>Math.max(0,...residual.filter((_,r)=>model.free[r]%2===parity));
  const blocks=[block('h2','支承反力與整體平衡'),
    block('formula',dynamicMode?'r = Ku + Ma + C u̇ − F，受約束垂直自由度給出支承反力，轉動自由度給出反力矩。':'r = Ku − F，受約束垂直自由度給出支承反力，轉動自由度給出反力矩。')];
  const k=model.constrained[0],su=result.reactions.find(p=>Math.abs(p.x-model.xs[k/2])<1e-7);
  blocks.push(block('formula',`${su.label} 支承反力 = (${number(Ku[k])}) + (${number(Macc[k])}) + (${number(Cvel[k])}) − (${number(result.load.F[k])}) = ${number(su.R)} kN`),
    block('p','垂直向上與逆時針取正。以原輸入載重積分求外力與對左端的力矩。線性分布載重作用範圍 [a,b]，h = b − a，其向下合力 W = h(w₁ + w₂)/2，對左端的順時針力矩 = aW + h²(w₁ + 2w₂)/6。'));
  if(dynamicMode)blocks.push(block('p','慣性與阻尼項採一致質量矩陣。對節點廣義力 f，同時按 Σf垂直 與 Σ(xᵢ f垂直 + f轉角) 加總。'));
  blocks.push(table(['量值','垂直力 (kN)','對左端力矩 (kN·m)'],rows),
    block('formula',`ΣFy 平衡差 = (${number(R)}) + (${number(applied)}) − (${number(inertia)}) − (${number(damping)}) = ${number(epsF)} kN`),
    block('formula',`ΣM₀ 平衡差 = (${number(T)}) + (${number(appliedMoment)}) − (${number(inertiaMoment)}) − (${number(dampingMoment)}) = ${number(epsM)} kN·m`),
    block('p',`本步未約束自由度最大絕對殘差為垂直力 ${number(maxBy(0))} kN、節點力矩 ${number(maxBy(1))} kN·m。平衡差使用未四捨五入的運算值，本表顯示八位有效數字。`));
  return blocks;
}

export function traceBlocks(model,analysis,frameIndex,x) {
  const frame=analysis.frames[frameIndex], dynamicMode=model.c.mode==='dynamic';
  if(!Number.isFinite(x) || x<0 || x>model.L)throw Error('計算明細的斷面座標超出梁長。');
  const blocks=elementExample(model,frame.result,x,dynamicMode);
  if(model.c.mode!=='static')blocks.push(...movingMethod(model,analysis,frame));
  if(dynamicMode)blocks.push(...timeIntegration(model,analysis,frameIndex));
  blocks.push(...sectionWork(model,frame.result,x,analysis.alpha||0),...balance(model,frame.result,analysis.alpha||0,dynamicMode));
  return blocks;
}
