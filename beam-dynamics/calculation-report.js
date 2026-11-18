import {evaluateSection} from './section-geometry.js';
import {traceBlocks} from './report-trace.js';
import {unitSystem} from './units.js';

const modes = {static:'靜力分析',moving:'車輛移動包絡',dynamic:'車輛動力歷時'};
const supports = {pin:'鉸支承',roller:'滾動支承',fixed:'固定端',free:'自由節點'};
const components = [['M','彎矩','kN·m'],['V','剪力','kN'],['D','撓度','mm']];
const h1 = text => ({type:'h1',text});
const h2 = text => ({type:'h2',text});
const p = text => ({type:'p',text});
const formula = text => ({type:'formula',text});
const table = (headers, rows, widths) => ({type:'table',headers,rows,widths});
const supportId = i => String.fromCharCode(65+i);
const fmt = n => n === 0 ? '0' : Number(n.toPrecision(7)).toString();
const coord = (m,f) => m.c.direction === 1 ? f.front : m.L-f.front;
const hasVehicle = m => m.c.mode !== 'static';

function inputs(m, units, q) {
  const c = m.c, u = x=>units.label(x);
  const rows = [
    h1('模型與載重'),
    p('座標從梁左端起算。外加集中力及線載重向下為正，外加偶矩逆時針為正。支承反力向上為正，支承反力矩逆時針為正，正彎矩使下緣受拉，撓度向上為正。'),
    table(['跨','跨長 ('+u('m')+')','E ('+u('GPa')+')','I ('+u('m⁴')+')','線質量 ('+u('kg/m')+')'],
      c.spans.map((s,i)=>[supportId(i)+'–'+supportId(i+1),q(s.L,'m'),q(s.E,'GPa'),q(s.I,'m⁴'),q(s.mass,'kg/m')])),
    table(['節點','位置 ('+u('m')+')','支承','垂直位移','轉角'],c.supports.map((s,i)=>[supportId(i),q(m.ss[i],'m'),supports[s],s==='free'?'自由':'約束',s==='fixed'?'約束':'自由'])),
    p('每跨基本細分 '+c.mesh+' 個元素，並在靜載集中點及分布載重起訖處設置節點。實際共有 '+m.xs.length+' 個節點、'+m.els.length+' 個元素和 '+m.free.length+' 個未約束自由度。內支承維持梁的轉角連續。')
  ];
  if(c.spans.some(s=>s.section)) {
    const l=units.show('m',1),length=u('m');
    rows.push(h2('各跨斷面與彎曲軸'),table(['跨','斷面','面積 ('+length+'²)','Iₕ ('+length+'⁴)','Iᵥ ('+length+'⁴)','採用軸'],c.spans.map((s,i)=>{
      if(!s.section)return [String(i+1),'直接輸入 I',s.A?fmt(s.A*l*l):'—','—','—','指定 I'];
      const v=evaluateSection(s.section);
      return [String(i+1),s.section.name,fmt(v.A*l*l),fmt(v.Ih*l**4),fmt(v.Iv*l**4),s.section.axis==='v'?'形心垂直軸':'形心水平軸'];
    }),[.65,2.3,1.5,1.5,1.5,1.3]));
    for(const [i,s] of c.spans.entries())if(s.section){
      const sec=s.section, dims=Object.entries(sec.dims||{}).map(([key,val])=>key+' = '+fmt(val*l)+' '+length).join('，');
      rows.push(p('第 '+(i+1)+' 跨 '+sec.name+'。'+(dims?dims+'。':'')+(evaluateSection(sec).source==='table'?'斷面性質採型錄值。':sec.type==='general'?'面積及慣性矩採使用者輸入值。':'以輸入尺寸計算斷面性質，忽略圓角。')));
    }
  }
  if(c.spans.some(s=>s.material)){
    const lscale=units.show('m',1);
    rows.push(h2('各跨梁材質'),table(['跨','材質或等級','E ('+u('GPa')+')','密度 (kg/m³)','面積 ('+u('m')+'²)'],c.spans.map((s,i)=>[String(i+1),s.material?.name||'手動剛度',q(s.E,'GPa'),s.material?fmt(s.material.density):'—',s.A?fmt(s.A*lscale*lscale)+(s.areaEstimated?'（推定）':''):'—'])));
    const seen=new Set();
    for(const s of c.spans){
      if(!s.material)continue;
      const mat=s.material;
      const note=[mat.name,mat.standard,mat.notes,mat.densityAssumed?'密度採參考值，工程採用時請依材料批次核對。':''].filter(Boolean).join('。');
      if(!seen.has(note)){seen.add(note);rows.push(p(note));}
    }
  }
  const loads = c.loads.map((l,i) => {
    const n=String(i+1);
    if(l.type==='line')return [n,'線性分布',q(l.a,'m')+' 至 '+q(l.b,'m'),q(l.w1,'kN/m')+' 至 '+q(l.w2,'kN/m')+' '+u('kN/m')];
    const k=l.type==='moment'?'kN·m':'kN';
    return [n,l.type==='moment'?'集中彎矩':'集中力',q(l.x,'m'),q(l.p,k)+' '+u(k)];
  });
  rows.push(h2('常駐載重'));
  if(loads.length) rows.push(table(['編號','類型','位置 ('+u('m')+')','載重或起訖強度'],loads,[1,1.6,2,3.5]));
  else rows.push(p('未輸入常駐集中力、線載重或集中彎矩。'));
  rows.push(p(c.selfWeight?'自重已計入。取 g = 9.80665 m/s²，各跨自重線載重如下。':'本模型未勾選自重，線質量僅供質量矩陣使用。'));
  if(c.selfWeight)rows.push(table(['跨','自重 ('+u('kN/m')+')'],c.spans.map((s,i)=>[String(i+1),q(s.mass*9.80665/1000,'kN/m')])));
  if(hasVehicle(m)) rows.push(h2('移動車輛'),p('行進方向'+(c.direction===1?'由左至右':'由右至左')+'，車速 '+fmt(c.speed)+' km/h。軸距由最前軸沿車長向後量取，軸重為分配至本梁的整軸荷重。'),
    table(['軸','距前軸 ('+u('m')+')','輸入軸重 ('+u('kN')+')','倍率','作用軸重 ('+u('kN')+')'],c.axles.map((a,i)=>[String(i+1),q(a.offset,'m'),q(a.p,'kN'),fmt(c.factor),q(a.p*c.factor,'kN')])));
  return rows;
}

function handCheck(m,r) {
  const c=m.c, rows=[], mm=m.L, EI=c.spans[0].E*1e6*c.spans[0].I;
  if(c.mode!=='static') return rows;
  const pp=c.loads.filter(l=>l.type==='point'), lines=c.loads.filter(l=>l.type==='line');
  const rect=lines.length===1&&lines[0].a===0&&Math.abs(lines[0].b-mm)<1e-8&&lines[0].w1===lines[0].w2;
  const simple=c.supports.every(s=>s==='roller'||s==='pin');
  if(c.spans.length===1){
    const rightFixed=c.supports[1]==='fixed'&&c.supports[0]==='free', leftFixed=c.supports[0]==='fixed'&&c.supports[1]==='free';
    if(!simple&&!leftFixed&&!rightFixed)return [];
    let W=0,Q=0,T=0;
    for(const l of r.load.loads){
      if(l.type==='line'){const d=l.b-l.a,w=d*(l.w1+l.w2)/2; W+=w;Q+=w*l.a+d*d*(l.w1+2*l.w2)/6;}
      else if(l.type==='point'){W+=l.p;Q+=l.p*l.x;}
      else T+=l.p;
    }
    rows.push(h2('單跨梁獨立平衡驗算'),p('下列式以 kN、m 為基準。W 為向下合力，Q 為向下載重對左端的一次矩，T 為逆時針外加偶矩總和。'),formula('W = '+fmt(W)+' kN，Q = '+fmt(Q)+' kN·m，T = '+fmt(T)+' kN·m。'));
    if(simple){
      const rb=(Q-T)/mm;
      rows.push(formula('Rᴮ = (Q − T) / L = ('+fmt(Q)+' − '+fmt(T)+') / '+fmt(mm)+' = '+fmt(rb)+' kN。'),formula('Rᴬ = W − Rᴮ = '+fmt(W)+' − '+fmt(rb)+' = '+fmt(W-rb)+' kN。'));
      if(rect&&!pp.length&&c.loads.length===1){
        const w=lines[0].w1+(c.selfWeight?c.spans[0].mass*9.80665/1000:0);
        rows.push(formula('跨中 M = wL²/8 = '+fmt(w)+' × '+fmt(mm)+'² / 8 = '+fmt(w*mm**2/8)+' kN·m。'),formula('跨中 δ = −5wL⁴/(384EI) = '+fmt(-5*w*mm**4/(384*EI)*1000)+' mm；有限元素解 '+fmt(r.at(mm/2).D)+' mm。'));
      }
    }else{
      const x=rightFixed?mm:0;
      rows.push(formula('固定端 R = W = '+fmt(W)+' kN。'),formula('固定端反力矩 = Q − T − R × x固定端 = '+fmt(Q)+' − '+fmt(T)+' − '+fmt(W)+' × '+fmt(x)+' = '+fmt(Q-T-W*x)+' kN·m。'));
    }
  }else if(c.spans.length===2&&simple&&rect&&!c.selfWeight&&pp.length<=1&&c.loads.length===1+pp.length&&(!pp.length||Math.abs(pp[0].x-c.spans[0].L/2)<1e-8)){
    const [s1,s2]=c.spans,L1=s1.L,L2=s2.L,E1=EI,E2=s2.E*1e6*s2.I,w=lines[0].w1,P=pp[0]?.p||0;
    const a=(w*L1**3/24+P*L1**2/16)/E1,b=w*L2**3/(24*E2);
    const MB=-3*(a+b)/(L1/E1+L2/E2);
    rows.push(h2('兩跨連續梁三彎矩驗算'),p('兩端簡支、支承無沉陷。以 kN、m 為基準，令 w 為全長均布載重，P 為第一跨跨中集中力。A、C 端彎矩均為零。'),
      formula('A₁ = (wL₁³/24 + PL₁²/16) / EI₁ = '+fmt(a)+'，A₂ = wL₂³/(24EI₂) = '+fmt(b)+'（均為無因次）。'),
      formula('Mᴮ = −3(A₁+A₂) / (L₁/EI₁+L₂/EI₂) = −3 × ('+fmt(a)+' + '+fmt(b)+') / ('+fmt(L1/E1)+' + '+fmt(L2/E2)+') = '+fmt(MB)+' kN·m。'),
      formula('Rᴬ = wL₁/2 + P/2 + Mᴮ/L₁ = '+fmt(w*L1/2+P/2+MB/L1)+' kN。Rᶜ = wL₂/2 + Mᴮ/L₂ = '+fmt(w*L2/2+MB/L2)+' kN。'),
      formula('Rᴮ = w(L₁+L₂) + P − Rᴬ − Rᶜ = '+fmt(w*(L1+L2)+P-(w*L1/2+P/2+MB/L1)-(w*L2/2+MB/L2))+' kN。有限元素解 Mᴮ = '+fmt(r.at(L1).M)+' kN·m。'));
  }
  return rows;
}

function extrema(model,analysis,r,units,q) {
  const envelope=analysis.envelope, out=[];
  for(const [key,name,dim] of components){
    for(const [direction,label] of [['min','最小'],['max','最大']]){
      const field=envelope?key+direction:key;
      const pts=envelope?envelope.rows:r.points;
      const best=pts.reduce((a,b)=>(direction==='min'?a[field]<=b[field]:a[field]>=b[field])?a:b);
      const f=envelope?analysis.frames[best[field+'Frame']]:null;
      out.push([name+label,q(best[field],dim)+' '+units.label(dim),q(best.x,'m'),f?fmt(f.t):'—',f?q(coord(model,f),'m'):'—']);
    }
  }
  return out;
}

function appendix(m,analysis,frameIndex,units,q) {
  const u=d=>units.label(d),r=analysis.frames[frameIndex].result,dyn=m.c.mode==='dynamic';
  const rows=[h1('數值附錄'),h2('節點解與等效外力'),p('本節採求解器基準單位。節點 i 的平移、轉角自由度編號分別為 2i−1、2i。矩陣中的位移以 m、轉角以 rad，廣義力以 kN 或 kN·m 記錄。')];
  rows.push(table(['節點','x (m)','v (m)','θ (rad)','Fᵥ (kN)','Fθ (kN·m)'],m.xs.map((v,i)=>[String(i+1),fmt(v),fmt(r.u[2*i]),fmt(r.u[2*i+1]),fmt(r.load.F[2*i]),fmt(r.load.F[2*i+1])])));
  if(dyn)rows.push(table(['節點','v̇ (m/s)','θ̇ (rad/s)','v̈ (m/s²)','θ̈ (rad/s²)'],m.xs.map((_,i)=>[String(i+1),...([r.v[2*i],r.v[2*i+1],r.acc[2*i],r.acc[2*i+1]].map(fmt))])));
  rows.push(h2('各元素端力'),p('依左端垂直力、左端偶矩、右端垂直力、右端偶矩排列，正向依節點自由度。元素端力與正彎矩下緣受拉的斷面內力使用不同符號約定。'),
    table(['元素','節點 i–j','Vᵢ (kN)','Tᵢ (kN·m)','Vⱼ (kN)','Tⱼ (kN·m)'],m.els.map((e,i)=>[String(i+1),(i+1)+'–'+(i+2),...r.ends[i].map(fmt)])));
  rows.push(h2('組裝矩陣'),p('對稱矩陣僅列主對角與其上方三條對角。下三角由對稱性取得，其餘位置為零。「—」表示已超出矩陣。K 對應廣義力／廣義位移，質量矩陣對應廣義力／廣義加速度。'));
  for(const [name,A] of (dyn?[['K',m.K],['M',m.M]]:[['K',m.K]])){
    rows.push(table(['列 i',...[0,1,2,3].map(j=>name+'(i,'+(j?'i+'+j:'i')+')')],A.map((row,i)=>[String(i+1),...[0,1,2,3].map(j=>i+j<row.length?fmt(row[i+j]):'—')])));
  }
  rows.push(h2('所選步斷面取樣'),p('重複座標保留相鄰元素或集中載重的兩側值，依求解器取樣順序排列。'),
    table(['x ('+u('m')+')','V ('+u('kN')+')','M ('+u('kN·m')+')','δ ('+u('mm')+')'],r.points.map(pt=>[q(pt.x,'m'),q(pt.V,'kN'),q(pt.M,'kN·m'),q(pt.D,'mm')])));
  if(analysis.envelope){
    for(const [k,name,dim] of components){
      rows.push(h2(name+'全程包絡'),table(['x ('+u('m')+')','取值側','最小 ('+u(dim)+')','控制步','最大 ('+u(dim)+')','控制步'],analysis.envelope.rows.map(a=>[q(a.x,'m'),a.side<0?'左':'右',q(a[k+'min'],dim),String(a[k+'minFrame']),q(a[k+'max'],dim),String(a[k+'maxFrame'])])));
    }
  }
  return rows;
}
export function reportBlocks(model,analysis,frameIndex,x,units,options={}) {
  units=units||unitSystem();
  if(!Number.isFinite(x)||x<0||x>model.L)throw Error('報告斷面位置超出梁長。');
  const fr=analysis.frames[frameIndex],r=fr.result,c=model.c, u=d=>units.label(d),q=(v,d)=>fmt(units.show(d,v));
  const vehicles=hasVehicle(model), last=analysis.frames.length-1;
  const meta=[options.project&&'工程名稱　'+options.project,options.engineer&&'計算者　'+options.engineer,'報告日期　'+(options.date||new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))].filter(Boolean);
  const peak=extrema(model,analysis,r,units,q);
  const steps=vehicles?'。全程 '+(last+1)+' 組結果（第 0 至 '+last+' 步），本次列印第 '+frameIndex+' 步，t = '+fmt(fr.t)+' s，前軸座標 '+q(coord(model,fr),'m')+' '+u('m'):'';
  const blocks=[{type:'title',text:'梁結構分析計算報告'},p(meta.join('　／　')),p(modes[c.mode]+'，共 '+c.spans.length+' 跨，梁長 '+q(model.L,'m')+' '+u('m')+'，指定斷面 x = '+q(x,'m')+' '+u('m')+steps+'。'),
    h1('控制值與支承反力'),p(vehicles?'控制值取各取樣斷面全程的最大值與最小值。下列反力另列所選步結果。':'控制值取本載重配置的斷面取樣結果。'),
    table(['控制量','數值','斷面 x ('+u('m')+')','時間 (s)','前軸 x ('+u('m')+')'],peak,[1.5,2.5,1.7,1.4,1.7]),
    table(['支承','位置 ('+u('m')+')','反力 ('+u('kN')+')','反力矩 ('+u('kN·m')+')'],r.reactions.filter(a=>a.type!=='free').map(a=>[a.label+' '+supports[a.type],q(a.x,'m'),q(a.R,'kN'),q(a.T,'kN·m')])),
  ];
  if(vehicles) {
    const envRows=[];
    r.reactions.forEach((a,i)=>{
      if(a.type==='free')return;
      for(const k of (a.type==='fixed'?['R','T']:['R'])){
        let min=0,max=0;
        for(let j=1;j<=last;j++){const val=analysis.frames[j].result.reactions[i][k];if(val<analysis.frames[min].result.reactions[i][k])min=j;if(val>analysis.frames[max].result.reactions[i][k])max=j;}
        const dim=k==='R'?'kN':'kN·m';
        envRows.push([a.label+' '+k+' ('+u(dim)+')',q(analysis.frames[min].result.reactions[i][k],dim),fmt(analysis.frames[min].t),q(analysis.frames[max].result.reactions[i][k],dim),fmt(analysis.frames[max].t)]);
      }
    });
    blocks.push(h2('支承全程包絡'),table(['支承反應','最小','時間 (s)','最大','時間 (s)'],envRows));
  }
  blocks.push(...inputs(model,units,q));
  if(vehicles) {
    blocks.push(h2('所選步車軸座標'),table(['軸','x ('+u('m')+')','作用狀態','本步作用力 ('+u('kN')+')'],c.axles.map((a,i)=>{
      const axleX=c.direction===1?fr.front-a.offset:model.L-fr.front+a.offset;
      const on=axleX>=-1e-8&&axleX<=model.L+1e-8;
      return [String(i+1),q(axleX,'m'),on?'梁上':'梁外',q(on?a.p*c.factor:0,'kN')];
    })));
    if(c.mode==='dynamic')blocks.push(p('指定阻尼比 '+fmt(c.damping)+'%，輸入時間步長上限 '+fmt(c.dt)+' s，車輛完全離梁後持續計算 '+fmt(c.tail)+' s。'));
    else blocks.push(p('輸入移動步長上限 '+q(c.step,'m')+' '+u('m')+'。'));
  }
  blocks.push(...traceBlocks(model,analysis,frameIndex,x),...handCheck(model,r));
  blocks.push(h2('指定斷面結果'),p('x = '+q(x,'m')+' '+u('m')+'，採目前報告步的內力及位移。'),
    table(['斷面側別','剪力 ('+u('kN')+')','彎矩 ('+u('kN·m')+')','撓度 ('+u('mm')+')'],[-1,1].filter(s=>!(x===0&&s===-1||x===model.L&&s===1)).map(s=>{const a=r.at(x,s);return [s===-1?'左側':'右側',q(a.V,'kN'),q(a.M,'kN·m'),q(a.D,'mm')];})),
    h2('分析適用範圍'),p('本模型採平面線彈性、小變形 Euler–Bernoulli 梁，未納入剪切變形、材料非線性、支承脫離及截面強度檢核。控制值與包絡受空間與時間取樣影響，工程採用時應以網格和步長加密覆核。'),
    ...(c.mode==='dynamic'?[p('動力模型以給定車軸移動力作用於梁，忽略車輛懸吊與路面不平。質量比例阻尼依第一模態校準。')]:[]));
  if(options.figures?.length)blocks.push(h1('模型與分析圖'),...options.figures);
  if(options.detail) blocks.push(...appendix(model,analysis,frameIndex,units,q));
  if(options.history&&vehicles){
    blocks.push(h1('指定斷面逐步歷時'),p('每一步列出 x = '+q(x,'m')+' '+u('m')+' 的斷面值。內部斷面取右側，梁右端取梁內側。'),
      table(['步','時間 (s)','前軸 ('+u('m')+')','V ('+u('kN')+')','M ('+u('kN·m')+')','δ ('+u('mm')+')'],analysis.frames.map((f,i)=>{const a=f.result.at(x,x===model.L?-1:1);return [String(i),fmt(f.t),q(coord(model,f),'m'),q(a.V,'kN'),q(a.M,'kN·m'),q(a.D,'mm')];})));
  }
  return blocks;
}
