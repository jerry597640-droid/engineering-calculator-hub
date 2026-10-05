
'use strict';
const EPS=1e-9;
const BARS={D10:.953,D13:1.27,D16:1.59,D19:1.91,D22:2.22,D25:2.54,D29:2.87,D32:3.22,D36:3.58};
const MODES={tensionLap:'搭接長度(Lst)',tension:'伸展長度(Ld)',compressionLap:'受壓搭接長度(Lsc)',compression:'受壓伸展長度(Ldc)',hook:'非耐震接頭區標準彎鉤伸展長度 Ldh'};
const GRADES={2800:1,4200:1,5000:1.08,5600:1.15};
function calculate(p){
 const errors=[],steps=[],warnings=[]; const d=BARS[p.bar],fy=+p.fy,fc=+p.fc;
 const step=(name,formula,value,substitution='')=>steps.push({name,formula,value,substitution});
 if(!MODES[p.mode])errors.push('請選擇計算項目。');
 if(!d)errors.push('僅支援 D10～D36 單支竹節鋼筋。');
 if(!Object.hasOwn(GRADES,fy))errors.push('請使用支援的標稱鋼筋強度。');
 if(!Number.isFinite(fc)||fc<210||fc>700)errors.push('本版僅計算 210 ≤ f′c ≤ 700 kgf/cm²。此為工具範圍，非規範全部適用範圍。');
 if(p.context!=='ordinary')errors.push('本項屬耐震系統／柱／特殊配置，須另依構件與耐震條文檢核，本版不提供數值。');
 if(p.mode==='compressionLap'&&fy>5600)errors.push('fy > 5600 的受壓搭接須同時檢核受拉搭接；本版尚未整合此條件，停止計算。');
 const geom=['tension','tensionLap','hook'].includes(p.mode);
 if(geom){if(!Number.isFinite(+p.agg)||+p.agg<=0)errors.push('粗骨材最大粒徑須為大於 0 的有限數值（cm）。');if(!Number.isFinite(+p.cover)||+p.cover<=0)errors.push('淨保護層須大於 0 cm。');if(!Number.isFinite(+p.spacing)||+p.spacing<=d)errors.push('鋼筋中心間距須大於鋼筋直徑。');}
 if(['tension','tensionLap'].includes(p.mode)||fy>=5600){
  if(p.ktr===''||!Number.isFinite(+p.ktr)||+p.ktr<0)errors.push('Ktr 不得小於 0。');
  if(fy>=5600&&+p.ktr<.5*d-EPS)errors.push('本版 fy = 5600 採梁縱筋保守限制：實際 Ktr 必須 ≥ 0.5db（§9.7.1.4；另見 §25.4.2.2、25.5.1.5）。');
 }
 if(p.mode==='tensionLap'){
  if(!Number.isFinite(+p.ratio)||+p.ratio<1)errors.push('As 配置／需求比須 ≥ 1；配置不足不可由搭接長度補足。');
  if(!Number.isFinite(+p.percent)||+p.percent<=0||+p.percent>100)errors.push('同一搭接範圍續接比例須 > 0 且 ≤ 100%。');
 }
 if(geom&&Number.isFinite(+p.agg)&&+p.agg>0&&(+p.spacing-d)<Math.max(2.5,d,4*(+p.agg)/3)-1e-9)errors.push('同層平行鋼筋淨間距不足：須 ≥ max(2.5 cm, db, 4/3 粗骨材最大粒徑)，請調整配置。');
 if(errors.length)return {errors};
 const lambda=p.lightweight?.75:1,q=Math.min(Math.sqrt(fc),26.5);let raw,length,clause,extra={};
 step('材料與基本參數',`db = ${d} cm；λ = ${lambda}；q = min(√${fc}, 26.5)`,q);
 if(Math.sqrt(fc)>26.5)warnings.push('√f′c 已依 §25.4.1.4 限制為 26.5。');
 if(p.mode==='tension'||p.mode==='tensionLap'){
  const top=p.top?1.3:1,epoxy=p.epoxy?(+p.cover<3*d-EPS||+p.spacing-d<6*d-EPS?1.5:1.2):1,size=d<=1.91?.8:1,combo=Math.min(top*epoxy,1.7);
  const cb=Math.min(+p.cover+d/2,+p.spacing/2),confinement=Math.min((cb+(+p.ktr))/d,2.5);
  raw=fy*combo*size*d/(3.5*lambda*q*confinement);
  step('修正因數',`ψt = ${top}；ψe = ${epoxy}；ψs = ${size}；min(ψtψe,1.7) = ${combo}`,null,`頂層=${!!p.top}；塗層=${!!p.epoxy}；淨保護層 ${+p.cover} < 3db=${3*d}、淨間距 ${+p.spacing-d} < 6db=${6*d}（比較含原EPS=${EPS}）；db=${d} ≤ 1.91 時ψs=0.8；乘积min(${top*epoxy},1.7)=${combo}`);
  step('保護層與圍束',`cb = min(${+p.cover}+db/2, ${+p.spacing}/2) = ${cb.toFixed(4)} cm；R = min((cb+Ktr)/db,2.5)`,confinement,`cb=min(${+p.cover}+${d}/2,${+p.spacing}/2)=${cb} cm；R=min((${cb}+${+p.ktr})/${d},2.5)=${confinement}`);
  step('未套用最小長度之計算值',`Lbase = fy·min(ψtψe,1.7)·ψs·db / (3.5·λ·q·R)`,raw,`${fy} × ${combo} × ${size} × ${d} ÷ (3.5 × ${lambda} × ${q} × ${confinement})`);
  if(p.mode==='tension') {length=Math.max(30,raw);clause='§25.4.2.4';step('伸展長度最小值','Ld = max(30 cm, Lbase)',length,`max(30, ${raw})`);}
  else {const klass=p.lapClass==='B'?'B':+p.ratio>=2&&+p.percent<=50?'A':'B',factor=klass==='A'?1:1.3,g=GRADES[fy];length=Math.max(30,factor*g*raw);clause='§25.5.2.1';extra.klass=klass;step('搭接等級及高強度因數',`${klass} 級：${factor} 倍；ψg = ${g}。A 級需 As比 ≥ 2 且續接比例 ≤ 50%。`,null);step('搭接長度與最小值','Lst = max(30 cm, 級別係數 × ψg × Lbase)',length,`max(30, ${factor} × ${g} × ${raw})`);warnings.push('搭接使用未套用 30 cm 下限的 Lbase；不使用超額配筋折減。');}
  extra={...extra,cb,confinement,top,epoxy,size,combo};
 } else if(p.mode==='compression'){
  const a=.075*fy*d/(lambda*q),b=.0044*fy*d;raw=Math.max(a,b);length=Math.max(20,raw);clause='§25.4.9';step('受壓伸展兩項計算',`0.075fy·db/(λq) = ${a.toFixed(4)} cm；0.0044fy·db = ${b.toFixed(4)} cm`,null);step('受壓第一項完整值','0.075fy·db/(λq)',a,`0.075 × ${fy} × ${d} ÷ (${lambda} × ${q})`);step('受壓第二項完整值','0.0044fy·db',b,`0.0044 × ${fy} × ${d}`);step('最小長度檢核','Ldc = max(20 cm, 以上兩項)；ψr = 1.0',length,`max(20, ${a}, ${b})`);warnings.push('未採圍束或超額配筋折減。彎鉤與錨頭不可用來發展受壓鋼筋強度。');
 } else if(p.mode==='compressionLap'){
  raw=fy<=4200?.0073*fy*d:(.013*fy-24)*d;const min=Math.max(30,raw),low=fc<210?4/3:1;length=min*low;clause='§25.5.5.1';step('受壓搭接基本長度',fy<=4200?'0.0073fy·db':'(0.013fy − 24)·db',raw,fy<=4200?`0.0073 × ${fy} × ${d}`:`(0.013 × ${fy} − 24) × ${d}`);step('最小值及低強度混凝土','Lsc = max(30 cm, 基本長度) × '+(fc<210?'4/3（f′c < 210）':'1（f′c ≥ 210）'),length);warnings.push('僅適用本頁一般受壓接頭；柱接頭不得僅以受壓內力判定搭接類別。未採柱箍筋或螺箍折減。');
 } else {
  const epoxy=p.epoxy?1.2:1,r=+p.spacing>=6*d-EPS?1:1.6,o=+p.cover>=6*d-EPS?1:1.25,c=fc<420?fc/1050+.6:1;raw=fy*epoxy*r*o*c*d**1.5/(23*lambda*q);length=Math.max(15,8*d,raw);clause='§25.4.3.1';step('彎鉤修正因數',`ψe = ${epoxy}；ψr = ${r}；ψo = ${o}；ψc = ${c.toFixed(4)}`,null,`塗層=${!!p.epoxy}；中心距 ${+p.spacing} ≥ 6db−EPS=${6*d-EPS}；保護層 ${+p.cover} ≥ 6db−EPS=${6*d-EPS}；f′c ${fc}<420時ψc=${fc}/1050+0.6，實際ψc=${c}`);step('標準彎鉤計算值','fy·ψe·ψr·ψo·ψc·db^1.5 / (23·λ·q)',raw,`${fy} × ${epoxy} × ${r} × ${o} × ${c} × ${d}^1.5 ÷ (23 × ${lambda} × ${q})`);step('最小長度檢核',`Ldh = max(15 cm, 8db = ${(8*d).toFixed(2)} cm, 計算值)`,length,`max(15,${8*d},${raw})`);warnings.push('採新式 §25.4.3.1；未採 Ath 圍束折減、柱核心條件或舊式選用公式。');warnings.push('不連續端若兩側與頂／底保護層均 < 6.5 cm，須依 §25.4.3.4 於 Ldh 範圍配置間距 ≤ 3db 箍筋，首道距彎鉤外側 ≤ 2db；長度本身不足以完成檢核。');
 }
 return {errors:[],steps,warnings,length,raw,d,fy,fc,lambda,clause,extra};
}
if(typeof module!=='undefined')module.exports={calculate,BARS,MODES};

// Geometry is a distinct detailing check, never an anchorage length.
const A1_REFERENCE={D10:15.3,D13:20.4,D16:25.5,D19:30.6,D22:35.6,D25:40.7,D29:48.8,D32:54.8,D36:60.9};
function calcGeometry(p){
 const errors=[],db=BARS[p.bar],angle=+p.angle,type=p.type;
 if(!db)errors.push('彎鉤尺寸計算僅支援 D10～D36。');
 if(!['main','tie'].includes(type))errors.push('請選主筋或箍／肋筋。');
 if(type==='main'&&![90,180].includes(angle))errors.push('主筋標準彎鉤僅提供 90°、180°。');
 if(type==='tie'&&![90,135,180].includes(angle))errors.push('箍／肋筋僅提供 90°、135°、180°。');
 if(type==='tie'&&db>2.54)errors.push('箍／肋筋標準尺寸僅支援 D10～D25。');
 if(p.seismic&&(type!=='tie'||![135,180].includes(angle)))errors.push('本模組耐震彎鉤僅提供箍／肋筋 135°、180°；圓形箍筋90°須另行判定。');
 if(p.seismic&&(!p.inward||!p.wrap))errors.push('耐震彎鉤須確認尾端朝向圍束核心內側，且彎鉤包繞縱向鋼筋。');
 if(errors.length)return{errors};
 const bendFactor=type==='main'?(db<=2.54?6:8):(db<=1.59?4:6);
 let tail,tailRule;
 if(angle===180){tail=Math.max(4*db,6.5);tailRule='max(4db, 6.5 cm)';}
 else if(angle===135){tail=Math.max(6*db,7.5);tailRule='max(6db, 7.5 cm)';}
 else if(type==='main'||db>1.59){tail=12*db;tailRule='12db';}
 else {tail=Math.max(6*db,7.5);tailRule='max(6db, 7.5 cm)';}
 if(p.seismic){tail=Math.max(6*db,7.5);tailRule='max(6db, 7.5 cm)（耐震彎鉤）';}
 return{errors:[],db,angle,type,bend:bendFactor*db,bendFactor,tail,tailRule,clause:p.seismic?'§2.3 耐震彎鉤、§25.3.2、25.3.4':type==='main'?'§25.3.1':'§25.3.2',a1:type==='main'&&angle===90?A1_REFERENCE[p.bar]:null,warnings:['尺寸是彎曲內徑與直線尾段，不是 Ldh、搭接長度或下料總長。','箍／肋筋彎鉤須包繞縱向鋼筋；尺寸符合不代表圍束、抗震或構件配筋均已符合。']};
}
function calcSeismicHook(p){
 const errors=[],db=BARS[p.bar],fy=+p.fy,fc=+p.fc,ktr=+p.ktr;
 if(!db)errors.push('耐震 90° 彎鉤僅支援 D10～D36。');
 if(![2800,4200,5000,5600].includes(fy))errors.push('請選支援的鋼筋強度。');
 if(!Number.isFinite(fc)||fc<280||fc>700)errors.push('本版耐震彎鉤混凝土強度範圍為 280～700 kgf/cm²。');
 if(p.lightweight&&fc>350)errors.push('耐震輕質混凝土 f′c > 350 須有試驗依據；本版不計算此範圍（§19.2.1.1）。');
 if(!p.core||!p.direction||!p.material||!p.standard)errors.push('請先由設計圖確認：受圍束核心、彎向接頭內側且延伸至核心遠側、耐震鋼筋材料與標準 90° 彎鉤幾何。');
 if(!Number.isFinite(ktr)||ktr<0||p.ktr==='')errors.push('Ktr 必須為不小於 0 的數值。');
 if(fy>=5600&&ktr<.5*db-EPS)errors.push('fy5600 採梁縱筋限制，Ktr 須 ≥ 0.5db；不能只看接頭彎鉤公式。');
 if(errors.length)return{errors};
 const lambda=p.lightweight?.75:1,q=Math.min(Math.sqrt(fc),26.5),raw=.06*fy*db/(lambda*q),barMin=(p.lightweight?10:8)*db,fixedMin=p.lightweight?19:15,base=Math.max(raw,barMin,fixedMin),epoxy=p.epoxy?1.2:1,length=base*epoxy;
 return{errors:[],db,fy,fc,lambda,q,raw,barMin,fixedMin,base,epoxy,length,clause:'§18.5.5.1、18.5.5.5',warnings:['僅核算特殊抗彎矩構架接頭中的 90° 彎鉤長度；不檢核接頭剪力、柱尺寸、實際可用長度、耐震箍筋或梁搭接位置。','RC03 原表可能採其他包絡條件；表格與公式不一致時，不能自行採較短值。']};
}
if(typeof module!=='undefined')Object.assign(module.exports,{calcGeometry,calcSeismicHook,A1_REFERENCE});

