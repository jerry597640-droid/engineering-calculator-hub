import {build,statics,moving,dynamic} from './solver.js?v=1.9.0';
import {traceBlocks} from './report-trace.js?v=1.9.0';
import {evaluateSection} from './section-geometry.js';

export const steelSources=[
  ['規範發布及修正紀錄','https://www.nlma.gov.tw/ch/legislation/regsearch/7176'],
  ['第二章 載重','https://www.nlma.gov.tw/uploads/files/c75f99b48037077e10f4bac06e23c8e5.pdf'],
  ['第四章 斷面分類','https://www.nlma.gov.tw/uploads/files/b351ab2a1d12a0d2d61a54488cada7f9.pdf'],
  ['第七章 撓曲與剪力','https://www.nlma.gov.tw/uploads/files/a82acdd7ebb8a190d073398d15468bc2.pdf']
];
export const steelCode='臺灣鋼結構極限設計法，96年發布、99年修正';
export function combinations(fullLive=false) {
  const l=fullLive?1:.5;
  const rows=[
    ['S-DL','使用載重 D + L',1,1,0,0,'service'],
    ['S-L','使用載重 L',0,1,0,0,'service'],
    ['U-D','1.4D',1.4,0,0,0,'strength'],
    ['U-DL','1.2D + 1.6L',1.2,1.6,0,0,'strength']
  ];
  for(const [group,d,live] of [['DL',1.2,l],['D',.9,0]]){
    for(const [kind,factor] of [['W',1.6],['E',1]]){
      for(const sign of [1,-1])rows.push([
        'U-'+group+kind+(sign>0?'+':'-'),
        d+'D'+(live?' + '+live+'L':'')+(sign>0?' + ':' − ')+factor+kind,
        d,live,kind==='W'?sign*factor:0,kind==='E'?sign*factor:0,'strength'
      ]);
    }
  }
  return rows.map(([id,name,D,L,W,E,kind])=>({id,name,D,L,W,E,kind}));
}

export function combinationConfig(config,combination) {
  const c=structuredClone(config);
  c.loads=c.loads.map((load,i)=>{
    if(!['D','L','W','E'].includes(load.loadCase))throw Error('請指定第 '+(i+1)+' 筆載重的 D／L／W／E 類別。');
    const factor=combination[load.loadCase];
    return load.type==='line'?{...load,w1:load.w1*factor,w2:load.w2*factor}:{...load,p:load.p*factor};
  });
  // Mass remains physical. Gravity and moving-force factors are independent.
  c.gravityFactor=combination.D;
  c.vehicleFactor=combination.L;
  return c;
}

function capacity(span,parameters,cantilever) {
  const unavailable=reason=>({available:false,reason});
  if(span.material?.kind!=='steel')return unavailable('請選擇鋼材材質。');
  if(!Number.isFinite(parameters?.fy)||parameters.fy<=0)return unavailable('請輸入依材質、板厚確認的 Fy。');
  if(!Number.isFinite(parameters.lb)||parameters.lb<0)return unavailable('請輸入有效側向無支撐長度 Lb。');
  const section=span.section;
  if(section?.type!=='i'||section.axis==='v')return unavailable('本版自動強度適用強軸 H／I 型鋼。此斷面需專項檢核。');
  if(cantilever&&parameters.lb>0)return unavailable('未連續側撐的懸臂梁需另依實際端部束制檢核。');
  if(!['rolled','welded'].includes(parameters.fabrication)||!['centroid','top'].includes(parameters.loadHeight))
    return unavailable('請指定製作方式及載重作用高度。');
  const {h,b,tf,tw}=section.dims;
  const g=evaluateSection({...section,id:null});
  if(g.Ih<g.Iv)return unavailable('此斷面的水平軸為弱軸，需專項檢核。');
  const fy=parameters.fy/98.0665,E=span.E*1000/98.0665,G=E/2.6;
  const d=h*100,bf=b*100,t=tf*100,web=tw*100,clear=d-2*t;
  const A=g.A*1e4,Ix=g.Ih*1e8,Iy=g.Iv*1e8,S=Ix/(d/2);
  const Z=bf*t*(d-t)+web*clear**2/4,J=(2*bf*t**3+clear*web**3)/3,ry=Math.sqrt(Iy/A);
  const lambdaF=bf/(2*t),lambdaW=clear/web,limitF=17/Math.sqrt(fy),limitW=170/Math.sqrt(fy);
  const dimensions={A,Ix,Iy,S,Z,J,ry,lambdaF,lambdaW,limitF,limitW,fy,E,G};
  if(lambdaF>limitF||lambdaW>limitW)return {...unavailable('寬厚比超出結實斷面範圍，需依附錄或板梁條文補驗局部挫屈。'),...dimensions};
  if(lambdaW>=260)return {...unavailable('腹板寬厚比超出本版剪力檢核範圍。'),...dimensions};
  const Fr=parameters.fabrication==='rolled'?.7:1.16,FL=fy-Fr;
  if(FL<=0)return unavailable('Fy 須大於所採殘留應力。');
  const Cw=parameters.loadHeight==='top'?0:Iy*(d-t)**2/4;
  const X1=Math.PI/S*Math.sqrt(E*G*J*A/2),X2=4*Cw/Iy*(S/(G*J))**2;
  const Lp=80*ry/Math.sqrt(fy),Lr=ry*X1/FL*Math.sqrt(1+Math.sqrt(1+X2*FL**2));
  const Lb=parameters.lb*100,Mp=fy*Z,Mr=FL*S;
  let Mn=Mp,limit='降伏';
  if(Lb>Lp&&Lb<=Lr){Mn=Math.min(Mp,Mp-(Mp-Mr)*(Lb-Lp)/(Lr-Lp));limit='非彈性側向扭轉挫屈';}
  if(Lb>Lr){Mn=Math.min(Mp,Math.PI/Lb*Math.sqrt(E*Iy*G*J+(Math.PI*E/Lb)**2*Iy*Cw));limit='彈性側向扭轉挫屈';}
  const kv=5,threshold1=50*Math.sqrt(kv/fy),threshold2=62*Math.sqrt(kv/fy),Aw=d*web;
  let Vn=.6*fy*Aw,shearLimit='剪力降伏';
  if(lambdaW>threshold1&&lambdaW<=threshold2){Vn*=threshold1/lambdaW;shearLimit='非彈性剪力挫屈';}
  if(lambdaW>threshold2){Vn=1860*kv*Aw/lambdaW**2;shearLimit='彈性剪力挫屈';}
  return {available:true,...dimensions,Fr,FL,Cw,X1,X2,Lp:Lp/100,Lr:Lr/100,Lb:parameters.lb,
    Mp:Mp*.0980665,Mr:Mr*.0980665,Mn:Mn*.0980665,Vn:Vn*9.80665,
    phiM:.9*Mn*.0980665,phiV:.9*Vn*9.80665,Aw,kv,threshold1,threshold2,limit,shearLimit};
}
export {capacity as steelCapacity};

export function spanDemands(model,analysis) {
  const rows=model.c.spans.map(()=>({M:null,V:null,D:null}));
  analysis.frames.forEach((frame,step)=>{
    frame.result.points.forEach(point=>{
      let span=model.ss.findIndex((end,i)=>i>0&&(point.side<0?point.x<=end+1e-9:point.x<end-1e-9))-1;
      if(span<0)span=rows.length-1;
      for(const key of ['M','V','D']){
        const prev=rows[span][key];
        if(!prev||Math.abs(point[key])>Math.abs(prev.value))rows[span][key]={value:point[key],x:point.x,side:point.side,step,t:frame.t,front:model.c.direction===1?frame.front:model.L-frame.front};
      }
    });
  });
  return rows;
}

export async function runSteelDesign(config,settings,progress=()=>{}) {
  const selected=combinations(settings.fullLive).filter(row=>settings.selected.includes(row.id));
  if(!selected.length)throw Error('請至少選擇一項載重組合。');
  const capacities=config.spans.map((span,i)=>capacity(span,settings.spans[i],config.supports[i]==='free'||config.supports[i+1]==='free'));
  const cases=[];
  for(const [i,combo] of selected.entries()){
    progress(i/selected.length,combo.name);
    const caseConfig=combinationConfig(config,combo);
    if(combo.L===0)caseConfig.mode='static';
    const model=build(caseConfig);
    let analysis;
    if(combo.L===0||config.mode==='static')analysis={frames:[{t:0,front:0,result:statics(model)}]};
    else analysis=await (config.mode==='dynamic'?dynamic(model,p=>progress((i+p)/selected.length,combo.name)):moving(model,p=>progress((i+p)/selected.length,combo.name)));
    const demands=spanDemands(model,analysis);
    const control=demands.map(d=>d.M).reduce((a,b)=>Math.abs(a.value)>=Math.abs(b.value)?a:b);
    const trace=traceBlocks(model,analysis,control.step,control.x);
    cases.push({combo,demands,mode:caseConfig.mode,control,trace,steps:analysis.frames.length,dt:analysis.dt??null,step:analysis.step??null});
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return {code:steelCode,settings:structuredClone(settings),capacities,cases,loads:structuredClone(config.loads),selfWeight:config.selfWeight,vehicleFactor:config.factor,sources:steelSources};
}

const f=n=>Number.isFinite(n)?Number(n.toPrecision(7)).toString():'—';
export function steelReportBlocks(result,units,includeTrace=true) {
  if(!result)return [];
  const q=(n,unit)=>f(units.show(unit,n)),h=text=>({type:'h2',text}),p=text=>({type:'p',text});
  const table=(headers,rows)=>({type:'table',headers,rows});
  const blocks=[{type:'h1',text:'鋼梁強度與使用載重組合檢核'},p(result.code),
    p('自動強度適用無開孔、等斷面、雙軸對稱、強軸彎曲之結實 H／I 型鋼。Cb = 1.0，腹板 kv = 5.0，強度折減係數 φb = φv = 0.90。各跨採使用者輸入的最長有效側撐間距，正負彎矩均按此間距檢核。'),
    p('需求以已選組合逐一重新求解，保留各工況正負號後搜尋全程控制斷面。車軸歸類 L，自重歸類 D。動力分析維持原物理質量與阻尼，載重係數僅作用於外力。'),
    p('E、W 為使用者輸入的面內梁等效作用。地震 E 的來源須依耐震規範並採 αy = 1.0。接合、局部承壓、開孔、疲勞、軸力／扭矩互制及耐震細部需另行檢核。'),
    table(['載重編號','類別','原始特徵載重（kN、m）'],result.loads.map((l,i)=>[String(i+1),l.loadCase,l.type==='line'?('q₁='+f(l.w1)+'，q₂='+f(l.w2)+' kN/m；x='+f(l.a)+'～'+f(l.b)+' m'):(l.type==='moment'?'M=':'P=')+f(l.p)+(l.type==='moment'?' kN·m':' kN')+'；x='+f(l.x)+' m'])),
    p('梁自重：'+(result.selfWeight?'計入 D':'未計入')+'；車軸外力倍率：'+f(result.vehicleFactor)+'（另乘各組合 L 係數）。'),
    table(['組合','用途','D','L','W','E','計算步數'],result.cases.map(a=>[a.combo.name,a.combo.kind==='strength'?'強度':'使用性',...['D','L','W','E'].map(k=>f(a.combo[k])),String(a.steps)]))];
  result.capacities.forEach((cap,i)=>{
    blocks.push(h('第 '+(i+1)+' 跨強度計算'));
    if(!cap.available){blocks.push(p('待補驗 — '+cap.reason));return;}
    const settings=result.settings.spans[i];
    blocks.push(p('Fy = '+f(settings.fy)+' MPa，製作方式 '+(settings.fabrication==='rolled'?'熱軋':'銲接')+'，載重作用 '+(settings.loadHeight==='top'?'上翼板，側扭計算取 Cw = 0':'形心軸')+'。斷面強度性質採公稱尺寸之直角幾何，省略型鋼圓角。'),
      table(['參數','數值'],[['A (cm²)',f(cap.A)],['Sx (cm³)',f(cap.S)],['Zx (cm³)',f(cap.Z)],['Iy (cm⁴)',f(cap.Iy)],['J (cm⁴)',f(cap.J)],['Cw (cm⁶)',f(cap.Cw)],['ry (cm)',f(cap.ry)],['翼板 b/(2tf)／λp',f(cap.lambdaF)+'／'+f(cap.limitF)],['腹板 h/tw／λp',f(cap.lambdaW)+'／'+f(cap.limitW)],['Lp (m)',f(cap.Lp)],['Lr (m)',f(cap.Lr)],['Lb (m)',f(cap.Lb)],['Mp ('+units.label('kN·m')+')',q(cap.Mp,'kN·m')],['Mr ('+units.label('kN·m')+')',q(cap.Mr,'kN·m')],['Mn ('+units.label('kN·m')+')',q(cap.Mn,'kN·m')],['Vn ('+units.label('kN')+')',q(cap.Vn,'kN')]]),
      p('計算式（tf、cm）：Mp = Fy Zx；Mr = (Fy − Fr) Sx；Lp = 80 ry / √Fy；X₁ = (π/Sx)√(EGJA/2)；X₂ = (4Cw/Iy)(Sx/GJ)²；Lr = (ry X₁/FL)√[1 + √(1 + X₂ FL²)]。'),
      p('Lb ≤ Lp：Mn = Mp；Lp < Lb ≤ Lr：Mn = min{Mp, Cb[Mp − (Mp − Mr)(Lb − Lp)/(Lr − Lp)]}；Lb > Lr：Mn = min{Mp, (Cbπ/Lb)√[EIyGJ + (πE/Lb)²IyCw]}。'),
      p('代入：E = '+f(cap.E)+' tf/cm²，G = '+f(cap.G)+' tf/cm²，Fy = '+f(cap.fy)+' tf/cm²，Fr = '+f(cap.Fr)+' tf/cm²，FL = '+f(cap.FL)+' tf/cm²，X₁ = '+f(cap.X1)+'，X₂ = '+f(cap.X2)+'。'),
      p('彎矩依 §7.2-1 至 §7.2-11，控制 '+cap.limit+'，φMn = 0.90 × '+q(cap.Mn,'kN·m')+' = '+q(cap.phiM,'kN·m')+' '+units.label('kN·m')+'。'),
      p('剪力依 §7.3-1 至 §7.3-3，Aw = d tw = '+f(cap.Aw)+' cm²，kv = 5，h/tw = '+f(cap.lambdaW)+'，界限 '+f(cap.threshold1)+'、'+f(cap.threshold2)+'。控制 '+cap.shearLimit+'，φVn = 0.90 × '+q(cap.Vn,'kN')+' = '+q(cap.phiV,'kN')+' '+units.label('kN')+'。'));
  });
  const summary=[];
  for(let i=0;i<result.capacities.length;i++)for(const key of ['M','V','D']){
    const candidates=result.cases.filter(a=>(a.combo.kind==='service')===(key==='D'));
    if(!candidates.length)continue;
    const a=candidates.reduce((a,b)=>Math.abs(a.demands[i][key].value)>=Math.abs(b.demands[i][key].value)?a:b);
    const cap=result.capacities[i],limit=key==='D'?result.settings.spans[i]?.deflection:cap.available?(key==='M'?cap.phiM:cap.phiV):null;
    const ratio=limit>0?Math.abs(a.demands[i][key].value)/limit:null;
    summary.push([String(i+1),key,a.combo.name,ratio==null?'—':f(ratio),ratio==null?'待補驗':ratio<=1?'本項符合':'超限']);
  }
  blocks.splice(2,0,h('控制組合摘要'),table(['跨','項目','控制組合','需求／容量比','結果'],summary));
  const rows=[];
  result.cases.forEach(({combo,demands})=>demands.forEach((d,i)=>{
    const cap=result.capacities[i],param=result.settings.spans[i]||{};
    for(const key of (combo.kind==='strength'?['M','V']:['D'])){
      const demand=d[key],dim=key==='M'?'kN·m':key==='V'?'kN':'mm';
      const capacity=key==='D'?(param.deflection>0?param.deflection:null):(cap.available?(key==='M'?cap.phiM:cap.phiV):null);
      const ratio=capacity?Math.abs(demand.value)/capacity:null;
      rows.push([String(i+1),combo.name,key,q(demand.value,dim)+' '+units.label(dim),capacity?q(capacity,dim):'待補',ratio==null?'—':f(ratio),ratio==null?'待補驗':ratio<=1?'本項符合':'超限',q(demand.x,'m'),f(demand.t),combo.L===0||result.cases.find(a=>a.combo.id===combo.id).mode==='static'?'—':q(demand.front,'m')]);
    }
  }));
  blocks.push(h('各組合控制斷面與需求／容量比'),table(['跨','組合','項目','帶號需求','容量／限值','比值','結果','x ('+units.label('m')+')','t (s)','前軸 x ('+units.label('m')+')'],rows),
    p('使用性撓度限值由設計者依構材用途及專案規定輸入，使用載重組合的撓度取各跨全程最大絕對位移。連續活載的跨間不利布載由使用者另建工況。'),
    h('規範來源'),...result.sources.map(([name,url])=>p(name+'　'+url)));
  if(includeTrace)for(const a of result.cases){
    blocks.push(h(a.combo.name+'：控制彎矩工況計算展開'),p('控制斷面 x = '+q(a.control.x,'m')+' '+units.label('m')+'，步數 '+a.control.step+'，t = '+f(a.control.t)+' s。以下方程式採 kN、m、s 一致單位。'),...a.trace.map(b=>b.type==='h1'?{...b,type:'h2'}:b));
  }
  return blocks;
}
