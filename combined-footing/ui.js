'use strict';
const $=id=>document.getElementById(id),F=Footing;
const fields=[
 ['L','基礎全長 L','m','幾何','基礎左緣至右緣全長。','基礎平面圖／基地可用範圍','continuous'],
 ['b1','左端基礎寬 B₁','m','幾何','長方形為全寬；梯形為左端寬；懸臂型為基腳 1 寬。','基礎平面圖'],
 ['b2','右端基礎寬 B₂','m','幾何','梯形為右端寬；懸臂型為基腳 2 寬。','基礎平面圖','nonrect'],
 ['a1','柱 1 左面邊距 a₁','m','幾何','從基礎左緣量至柱 1 左面，並非柱中心。','柱位與基礎平面圖'],
 ['spacing','柱軸心間距 SL','m','幾何','柱 1 與柱 2 軸心的長向距離。','柱位尺寸／結構平面圖'],
 ['a2','柱 2 右面邊距 a₂','m','幾何','懸臂型從柱 2 右面至基礎最右緣。','柱位與基礎平面圖','strap'],
 ['s1','基腳 1 長 S₁','m','幾何','懸臂型左基腳的長向長度。','基礎平面圖','strap'],
 ['s2','基腳 2 長 S₂','m','幾何','懸臂型右基腳的長向長度。','基礎平面圖','strap'],
 ['h','基腳總厚度 h','cm','幾何','兩側基腳或聯合底板厚度；與連梁厚度獨立。','基礎剖面圖'],
 ['bw1','連梁左端寬 H₁','m','幾何','原程式 H1；連梁在左基腳邊的橫向寬度。','連梁剖面圖','strap'],
 ['bw2','連梁右端寬 H₂','m','幾何','原程式 H2；連梁在右基腳邊的橫向寬度。','連梁剖面圖','strap'],
 ['bh','連梁總厚度 TB','cm','幾何','懸臂型連梁總深度；淨跨至少 4 倍此深度。','連梁剖面圖','strap'],
 ['cx1','柱 1 長向尺寸 cₓ₁','cm','柱尺寸與反力','柱在基礎長向的寬度，原檔 W1。','柱配筋／斷面表'],
 ['cy1','柱 1 短向尺寸 cᵧ₁','cm','柱尺寸與反力','柱在基礎橫向的深度，原檔 D1；勿與靜載 D 混淆。','柱配筋／斷面表'],
 ['cx2','柱 2 長向尺寸 cₓ₂','cm','柱尺寸與反力','柱在基礎長向的寬度，原檔 W2。','柱配筋／斷面表'],
 ['cy2','柱 2 短向尺寸 cᵧ₂','cm','柱尺寸與反力','柱在基礎橫向的深度，原檔 D2。','柱配筋／斷面表'],
 ['D1','柱 1 靜載軸力 D₁','tf','柱尺寸與反力','未乘係數、向下為正；不含本工具自動計算的基腳與連梁自重。','MIDAS／ETABS／SAP 柱底靜載反力'],
 ['Q1','柱 1 活載軸力 L₁','tf','柱尺寸與反力','未乘係數的柱底活載反力；0 為允許值。','結構分析活載工況反力'],
 ['D2','柱 2 靜載軸力 D₂','tf','柱尺寸與反力','與柱 1 同一定義，不可輸入已因素化的總反力。','結構分析靜載工況反力'],
 ['Q2','柱 2 活載軸力 L₂','tf','柱尺寸與反力','柱 2 未乘係數活載反力。','結構分析活載工況反力'],
 ['fc','混凝土強度 f′c','kgf/cm²','材料與地盤','設計抗壓強度；本版範圍 175～700，普通重混凝土 λ＝1。','結構材料表／設計強度'],
 ['fy','鋼筋降伏強度 fy','kgf/cm²','材料與地盤','本版範圍 2800～5500；剪力箍筋計算不高於 4200。','鋼筋材料證明／設計材料表'],
 ['cover','混凝土保護層','cm','材料與地盤','至最外層鋼筋外緣；本版土中澆置至少 7.5 cm。','基礎配筋剖面／施工條件'],
 ['gamma','混凝土單位重 γc','tf/m³','材料與地盤','自重＝γc×h/100；普通混凝土範例 2.4。','材料設計值／配比單位重'],
 ['over','基腳附加均布重','tf/m²','材料與地盤','覆土與基腳上的附加靜載；不含基腳本身。不作用於連梁間隙。','覆土厚度×有效單位重／荷載資料'],
 ['qa','總容許承載力 Qa','tf/m²','材料與地盤','與含基腳自重、覆土的總使用反力比較。不得拿淨 Qa 直接代入。','本工址地質鑽探報告／大地技師核定'],
 ['longBar','長向鋼筋號數','—','配筋','基腳與連梁長向筋號數；D22 直徑 2.22 cm、面積 3.871 cm²。','配筋圖／CNS 560 鋼筋資料','bar'],
 ['longBottom','長向底筋間距','cm','配筋','全長配置；連梁按可容納整數支數計算，不使用小數支數。','配筋圖／試配結果'],
 ['longTop','長向頂筋間距','cm','配筋','全長配置；連梁顶底均採兩者較疏間距作保守檢核。','配筋圖／試配結果'],
 ['shortBar','短向鋼筋號數','—','配筋','短向筋假設放在長向底筋上方，因此短向有效深度較小。','基礎配筋圖','bar'],
 ['shortSpace1','柱 1 短向筋間距','cm','配筋','柱 1 區帶短向底筋；單位寬度為 1 m。','配筋圖／試配結果'],
 ['shortSpace2','柱 2 短向筋間距','cm','配筋','柱 2 區帶短向底筋；應滿足配筋銜接與錨定。','配筋圖／試配結果'],
 ['stirrup','連梁箍筋號數','—','配筋','雙肢箍筋，Av＝2 倍單支面積；本版不含扭力筋。','連梁配筋圖','bar-strap'],
 ['stirrupSpace','連梁箍筋間距','cm','配筋','檢查最小剪力筋面積、沿梁長／梁寬的最大間距。','連梁配筋圖','strap'],
 ['U1','柱 1 自訂因素軸力','tf','其他載重組合','與柱 2 同一載重組合的 Pu；向下為正。僅檢查此一組合。','結構分析組合工況柱底反力','manual'],
 ['U2','柱 2 自訂因素軸力','tf','其他載重組合','自訂時仍以 D＋L 作使用承載力，基礎自重係數固定 1.2。','同一結構分析組合工況柱底反力','manual']
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=3)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const badge=v=>`<span class="badge ${v===false?'bad':v===null?'pending':''}">${v===true?'通過':v===false?'不足':'需專案分析'}</span>`;
let p={...F.defaults},result=null,tab='workspace';try{Object.assign(p,JSON.parse($('initial-data').textContent))}catch{}
const groups=[...new Set(fields.map(f=>f[3]))];
$('input-groups').innerHTML=groups.map((group,i)=>`<details class="input-group" ${i<3?'open':''}><summary>${group}</summary>${group==='其他載重組合'?'<label class="meta"><input type="checkbox" id="manual"> 使用自訂 Pu（單一組合）</label>':''}<div class="inputs">${fields.filter(f=>f[3]===group).map(([key,label,unit,_,help,source,kind])=>`<div class="field" data-key="${key}" data-kind="${kind||''}"><label for="${key}">${label} <span class="unit">${unit}</span><button type="button" data-tip="${key}" aria-label="${label}的說明" aria-expanded="false">ⓘ</button></label>${kind?.startsWith('bar')?`<select id="${key}" title="${esc(help+' 資料來源：'+source)}">${Object.entries(F.bars).map(([k,v])=>`<option value="${k}">${k} · ${v[1]} cm²</option>`).join('')}</select>`:`<input id="${key}" type="number" step="any" inputmode="decimal" title="${esc(help+' 資料來源：'+source)}">`}<div class="tip" id="tip-${key}" hidden>${help}<br><b>來源：</b>${source}</div></div>`).join('')}</div></details>`).join('');
function fill(){for(let [key]of fields)$(key).value=p[key];$('mode').value=p.mode;$('manual').checked=p.manual;showFields();}
function showFields(){for(let f of document.querySelectorAll('[data-kind]')){let k=f.dataset.kind;f.hidden=k==='strap'||k==='bar-strap'?p.mode!=='strap':k==='continuous'?p.mode==='strap':k==='nonrect'?p.mode==='rect':k==='manual'?!p.manual:false;} $('model-note').textContent=p.mode==='strap'?'兩基腳承壓；連梁淨跨不承壓。全長由兩邊距、柱寬與柱距計算。':p.mode==='trap'?'兩端寬度沿長度線性變化；柱均位於橫向中心。':'固定寬度的聯合底板；柱均位於橫向中心。';}
function gather(){for(let [key,,,,,,kind]of fields){const el=$(key);p[key]=kind?.startsWith('bar')?el.value:el.value.trim()===''?NaN:Number(el.value);}p.mode=$('mode').value;p.manual=$('manual').checked;showFields();}
function checkTable(rows){return`<table><thead><tr><th>項目／組合</th><th>需求</th><th>容量／界限</th><th>比值</th><th>結果</th></tr></thead><tbody>${rows.map(v=>`<tr><td>${esc(v.name)}<br><span class="meta">${esc(v.combo||'')}</span></td><td class="num">${n(v.demand)} ${v.unit}</td><td class="num">${v.lower?'≥ ':''}${n(v.capacity)} ${v.unit}</td><td class="num">${v.lower?'—':n(v.demand/v.capacity)}</td><td>${badge(v.pass===undefined?null:v.pass)}</td></tr>`).join('')}</tbody></table>`;}
function run(){gather();result=F.calc(p);let r=result;$('errors').hidden=r.valid;$('errors').className='error';$('errors').innerHTML=r.valid?'':`<b>請先修正輸入</b><ul>${r.errors.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`;
 if(!r.valid){$('status').className='status bad';$('status').textContent='輸入無效，已清除舊結果';for(let id of ['metrics','plan','plots','summary','checks-table','rebar-table','punch-detail','report-content','warnings'])$(id).innerHTML='';return;}
 $('status').className='status '+(r.overall==='範圍內檢核通過'?'':r.overall==='需調整'?'bad':'pending');$('status').innerHTML=`<strong>${r.overall}</strong><span>承載力＋剪力＋配筋 · ${r.checks.filter(v=>v.pass===true).length}/${r.checks.length} 項通過</span>`;
 $('metrics').innerHTML=[['最大使用土壓',n(Math.max(...r.bearing.map(v=>v.max)),2),'tf/m² · Qa '+n(p.qa,1)],['承壓底面積',n(r.g.A,2),'m² · 全長 '+n(r.g.L,2)+' m'],['有效深度 dₓ / dᵧ',n(r.d,1)+' / '+n(r.dy,1),'cm · 沖切平均 '+n(r.dp,1)]].map(([label,num,small])=>`<div class="metric"><div class="meta">${label}</div><span class="num">${num}</span><small>${small}</small></div>`).join('');
 let selected=$('plot-combo').value;$('plot-combo').innerHTML=r.models.map((v,i)=>`<option value="${i}">${v.name}</option>`).join('');$('plot-combo').value=r.models[selected]?selected:'0';drawPlan(r);drawPlots(r);$('checks-table').innerHTML=checkTable(r.checks);
 const nonpasses=r.checks.filter(v=>v.pass!==true);$('summary').innerHTML=`<div class="panel"><div class="panel-head"><h2>${nonpasses.length?'待處理檢核':'檢核摘要'}</h2><button data-go="results">全部檢核</button></div><div class="scroll">${checkTable(nonpasses.length?nonpasses:r.checks.slice(0,4))}</div></div>`;
 $('warnings').innerHTML=r.warnings.map(w=>`<div class="notice">${esc(w)}</div>`).join('');$('rebar-table').innerHTML=r.reinforcement?`<table><thead><tr><th>鋼筋區域</th><th>配置</th><th>As 提供</th><th>As 需求</th><th>d</th><th>φ / εt</th><th>檢核</th></tr></thead><tbody>${r.reinforcement.map(v=>`<tr><td>${v.name}<br><span class="meta">${v.combo}</span></td><td>${v.bar} @ ${v.space} cm${v.beamCount!==null?'<br>'+v.beamCount+' 支／面':''}</td><td class="num">${n(v.As,2)} ${v.b===100?'cm²/m':'cm²'}</td><td class="num">${v.over?'超出拉力控制上限':n(v.required,2)}<br><span class="meta">最小 ${n(v.Asmin,2)}</span></td><td class="num">${n(v.d,2)} cm</td><td class="num">${n(v.phi,2)} / ${n(v.eps,5)}</td><td>${badge(v.pass)}</td></tr>`).join('')}</tbody></table>`:'<p class="panel-body">模型失效，未評定配筋。</p>';
 $('punch-detail').innerHTML=r.punching?`<div class="panel"><div class="panel-head"><h2>沖切臨界區</h2></div><div class="scroll"><table><thead><tr><th>位置</th><th>扣除反力面積</th><th>b₀ / d</th><th>β / αs</th><th>臨界區反力</th><th>狀態</th></tr></thead><tbody>${r.punching.map(v=>`<tr><td>${v.name}</td><td>${n(v.area)} m²</td><td>${n(v.b0,2)} / ${n(v.d,2)} cm</td><td>${n(v.beta,2)} / ${v.alpha}</td><td>${n(v.reaction)} tf</td><td>${badge(v.pass)}<br>${v.reason}</td></tr>`).join('')}</tbody></table></div></div>`:'';
 drawReport(r);
}
function svgWrap(content,h=280){return`<svg viewBox="0 0 700 ${h}" role="img" xmlns="http://www.w3.org/2000/svg" style="font-family:system-ui,sans-serif;font-size:14px">${content}</svg>`;}
function drawPlan(r){let g=r.g,maxB=Math.max(p.b1,p.mode==='rect'?p.b1:p.b2),s=Math.min(610/g.L,140/maxB),X=x=>(700-g.L*s)/2+x*s,Y=y=>140-y*s;let poly=p.mode==='strap'?[[[0,-p.b1/2],[p.s1,-p.b1/2],[p.s1,p.b1/2],[0,p.b1/2]],[[g.L-p.s2,-p.b2/2],[g.L,-p.b2/2],[g.L,p.b2/2],[g.L-p.s2,p.b2/2]],[[p.s1,-p.bw1/2],[g.L-p.s2,-p.bw2/2],[g.L-p.s2,p.bw2/2],[p.s1,p.bw1/2]]]:[g.poly];
 let c=`<line x1="30" y1="140" x2="675" y2="140" stroke="#b4c0cf" stroke-dasharray="6 4"/>`+poly.map(v=>`<polygon points="${v.map(([x,y])=>X(x)+','+Y(y)).join(' ')}" fill="#e7f0fb" stroke="#516b8b" stroke-width="2"/>`).join('');
 for(let i of [1,2]){let x=i===1?g.x1:g.x2,cx=p['cx'+i]/100,cy=p['cy'+i]/100;c+=`<rect x="${X(x-cx/2)}" y="${Y(cy/2)}" width="${cx*s}" height="${cy*s}" fill="#145ccc"/><text x="${X(x)}" y="34" text-anchor="middle" fill="#145ccc">C${i} · ${p['cx'+i]}×${p['cy'+i]} cm</text><line x1="${X(x)}" y1="41" x2="${X(x)}" y2="${Y(cy/2)-5}" stroke="#145ccc"/>`;let v=r.punching?.[i-1];if(v)c+=`<polygon points="${v.poly.map(([a,b])=>X(a)+','+Y(b)).join(' ')}" fill="none" stroke="#d18716" stroke-width="2" stroke-dasharray="5 4"/>`;}
 const dimension=(a,b,y,label)=>`<path d="M${X(a)} ${y-7}v14M${X(a)} ${y}H${X(b)}M${X(b)} ${y-7}v14" fill="none" stroke="#64768b"/><text x="${X((a+b)/2)}" y="${y+21}" text-anchor="middle" fill="#334c68">${label}</text>`;
 c+=dimension(0,g.L,238,'L＝'+n(g.L,2)+' m');c+=dimension(g.x1,g.x2,204,'SL＝'+n(p.spacing,2)+' m');c+=`<text x="${X(0)}" y="96" fill="#334c68">B₁ ${n(p.b1,2)} m</text><text x="${X(g.L)}" y="96" fill="#334c68" text-anchor="end">B₂ ${n(p.mode==='rect'?p.b1:p.b2,2)} m</text>`;$('plan').innerHTML=svgWrap(c,285);
}
function plot(label,fn,r,points,color){const L=r.g.L,vals=points.map(x=>[x,fn(x)]);let vmin=Math.min(0,...vals.map(v=>v[1])),vmax=Math.max(0,...vals.map(v=>v[1]));if(vmax-vmin<1e-6)vmax=vmin+1;let margin=(vmax-vmin)*.1;vmin-=margin;vmax+=margin;const X=x=>65+x/L*585,Y=y=>125-(y-vmin)/(vmax-vmin)*82;let lines='';for(let i=0;i<3;i++){let v=vmin+(vmax-vmin)*i/2;lines+=`<line x1="65" y1="${Y(v)}" x2="650" y2="${Y(v)}" stroke="#e1e8f0"/><text x="56" y="${Y(v)+5}" text-anchor="end" fill="#64768b">${n(v,1)}</text>`;}let d=vals.map(([x,v],i)=>(i?'L':'M')+X(x)+' '+Y(v)).join(' '),extreme=vals.reduce((a,b)=>Math.abs(a[1])>Math.abs(b[1])?a:b);return`<div class="chart-container">${svgWrap(`<text x="18" y="23" font-weight="650" fill="#334c68">${label}</text>${lines}<line x1="65" y1="${Y(0)}" x2="650" y2="${Y(0)}" stroke="#8498b1"/><path d="${d}" stroke="${color}" stroke-width="2.5" fill="none"/><text x="65" y="151" fill="#64768b">x＝0</text><text x="650" y="151" text-anchor="end" fill="#64768b">${n(L,2)} m</text><text x="650" y="23" text-anchor="end" fill="${color}">極值 ${n(extreme[1],2)} @ ${n(extreme[0],2)} m</text>`,165)}</div>`;}
function drawPlots(r){let m=r.models[Number($('plot-combo').value)||0],points=[];for(let i=0;i<=240;i++)points.push(r.g.L*i/240);for(let x of [r.g.x1,r.g.x2,...m.points,p.s1,r.g.L-p.s2])if(x>0&&x<r.g.L)points.push(x-1e-7,x,x+1e-7);points.sort((a,b)=>a-b);const pressure=x=>{let v=r.service.gross.find(v=>x>=v.lo&&x<=v.hi);return v?F.evalpoly(v.q,x):0;};$('plots').innerHTML=plot('使用總土壓 qₛ [tf/m²]',pressure,r,points,'#3d79be')+plot('剪力 V [tf]',m.V,r,points,'#13927b')+plot('彎矩 M [tf·m]',m.M,r,points,'#145ccc');}
function drawReport(r){let p=r.p,g=r.g,content=`<div class="panel"><div class="panel-body"><h2>聯合基礎分析計算書</h2><p>版本 1.0 · ${new Date().toLocaleDateString('zh-TW')} · ${esc($('mode').selectedOptions[0].textContent)}</p><p><b>分析狀態：${r.overall}</b>。只評定本工具列出的軸力模型與強度項目。沉陷、浮力、滑動、完整風震組合、柱底彎矩、錨定與施工圖細節不在此通過範圍。</p><h3>1. 輸入資料</h3><div class="scroll"><table><thead><tr><th>參數</th><th>輸入值</th><th>資料來源</th></tr></thead><tbody>${fields.filter(f=>{let k=f[6];return k==='continuous'?p.mode!=='strap':k==='nonrect'?p.mode!=='rect':k==='strap'||k==='bar-strap'?p.mode==='strap':k==='manual'?p.manual:true;}).map(f=>`<tr><td>${f[1]}</td><td>${esc(p[f[0]])} ${f[2]}</td><td>${f[5]}</td></tr>`).join('')}</tbody></table></div><h3>2. 幾何與有效深度</h3><div class="formula">L＝${n(g.L)} m；x₁＝a₁＋cₓ₁/200＝${n(g.x1)} m；x₂＝x₁＋SL＝${n(g.x2)} m
承壓面積 A＝${n(g.A)} m²${p.mode!=='strap'?'；重心 x̄＝'+n(g.xc)+' m；I＝'+n(g.I)+' m⁴':''}
dₓ＝${p.h}－${p.cover}－${F.bars[p.longBar][0]}/2＝${n(r.d)} cm
dᵧ＝${p.h}－${p.cover}－${F.bars[p.longBar][0]}－${F.bars[p.shortBar][0]}/2＝${n(r.dy)} cm
d,punch＝(dₓ＋dᵧ)/2＝${n(r.dp)} cm
基腳自重＝${p.gamma}×${p.h}/100＝${n(p.gamma*p.h/100)} tf/m²；附加均布重＝${n(p.over)} tf/m²</div><h3>3. 使用載重承載力</h3><div class="formula">P₁＝${p.D1}＋${p.Q1}＝${n(p.D1+p.Q1)} tf；P₂＝${p.D2}＋${p.Q2}＝${n(p.D2+p.Q2)} tf
${r.service.gross.map((v,i)=>`區域 ${i+1}：qₛ(x)＝${v.q.map((c,j)=>n(c,6)+(j?' x':'')).join(' ＋ ')} tf/m²，x＝${n(v.lo)}～${n(v.hi)} m`).join('\n')}
${r.bearing.map(v=>`${v.name}：qmin＝${n(v.min)}；qmax＝${n(v.max)}；Qa＝${p.qa} tf/m²`).join('\n')}</div><h3>4. 因素載重與力／力矩平衡</h3>${r.models.map(m=>`<div class="formula">組合 ${m.name}：Pu₁＝${n(m.P[0])} tf；Pu₂＝${n(m.P[1])} tf
${m.seg.map(v=>`淨長向荷重 w(x)＝${v.c.map((c,j)=>n(c,6)+(j?' x'+(j>1?'^'+j:''):'')).join(' ＋ ')} tf/m，區間 ${n(v.lo)}～${n(v.hi)} m`).join('\n')}
連梁自重（已因素化）＝${n(m.beamW)} tf
V(L)＝${m.balanceV.toExponential(3)} tf；M(L)＝${m.balanceM.toExponential(3)} tf·m
檢查位置：${m.points.map(x=>n(x)).join('、')} m
${m.points.map(x=>'x＝'+n(x)+'：V＝'+n(m.V(x))+' tf，M＝'+n(m.M(x))+' tf·m').join('\n')}</div>`).join('')}`;
 if(!r.invalidContact){content+=`<h3>5. 單向剪力</h3><p>基腳剪力以柱面外 d 為臨界位置；無剪力筋容量依表 22.5.5.1(c)，ρw 以提供鋼筋計算。淺基腳依 13.2.6.2 取 λs＝1；連梁未受土壤支承，另按梁規定。</p>${r.shear.map(v=>`<div class="formula">${v.name}：Vu＝${n(v.demand)} ${v.unit}；b＝${n(v.b)} cm；d＝${n(v.d)} cm
As＝${n(v.As)} cm²；ρw＝${n(v.As/(v.b*v.d),6)}；λs＝${n(v.lambdaS)}
${v.Av?`Av＝${n(v.Av)} cm²；Av,min＝${n(v.AvMin)} cm²；Vs＝${n(v.Vs)} tf
箍筋 s＝${p.stirrupSpace} cm；smax＝${n(v.smax)} cm；橫向肢距＝${n(v.legDistance)} cm；上限＝${n(v.legMax)} cm\n`:''}φVn＝${n(v.capacity)} ${v.unit}；${v.pass?'通過':'不足'}；${v.combo}</div>`).join('')}<h3>6. 沖切剪力</h3><p>臨界線距柱面 dp/2，扣除包圍的全部淨土壤反力；雙向筋採平均有效深度。自由邊與群柱作用需補充專案分析。</p>${r.punching.map(v=>`<div class="formula">${v.name}：臨界區面積＝${n(v.area,6)} m²；b₀＝${n(v.b0)} cm；d＝${n(v.d)} cm
β＝${n(v.beta)}；αs＝${v.alpha}；λs＝1
Vu＝|${n(v.P)}－${n(v.reaction)}|＝${n(v.demand)} tf
三式係數＝${v.coeffs.map(c=>n(c,6)).join('、')}；取最小值
φVc＝${n(v.capacity)} tf；${v.pending?'不評定通過：'+v.reason:v.pass?'通過':'不足'}；${v.combo}</div>`).join('')}<h3>7. 彎矩與配筋</h3><p>基腳長向按正負彎矩除當地全寬取每米包絡。短向採原柱帶分配與直接土壓懸臂法的較大值；以柱面外懸臂計算，並顯示供筋應變。最小筋不低於 0.0018bh，梁另檢查 9.6.1；沖切應力超門檻時追加 8.6.1.2 最小筋。</p>${r.reinforcement.map(v=>`<div class="formula">${v.name}：Mu＝${n(v.Mu)} ${v.b===100?'tf·m/m':'tf·m'}；${v.combo}
${v.band?`柱帶＝x ${n(v.band[0])}～${n(v.band[1])} m；Pu/柱帶面積＝${n(v.sourceQ)} tf/m²；直接淨土壓＝${n(v.soilQ)} tf/m²\n`:''}${v.bar} @ ${v.space} cm${v.beamCount!==null?'，整數 '+v.beamCount+' 支／面':''}：As＝${n(v.As)} ${v.b===100?'cm²/m':'cm²'}；As,min＝${n(v.Asmin)}；As,req＝${n(v.required)}
a＝As fy/(0.85f′c b)＝${n(v.a)} cm；c＝${n(v.c)} cm
εt＝${n(v.eps,6)}；εy＋0.003＝${n(p.fy/2040000+.003,6)}；φ＝${n(v.phi)}
φMn＝φ As fy(d－a/2)/100000＝${n(v.capacity)} ${v.b===100?'tf·m/m':'tf·m'}
淨距＝${n(v.clear)} cm；最大間距＝${n(v.spaceMax)} cm；${v.pass?'通過':'需調整'}</div>`).join('')}`;}
 content+=`<h3>8. 檢核彙整</h3><div class="scroll">${checkTable(r.checks)}</div>${r.warnings.map(w=>`<div class="notice">${esc(w)}</div>`).join('')}<h3>9. 依據與適用界限</h3><p>原始檔 CombinedFooting_20121009_SourceCode.zip／Form1.vb；112 年版基礎構造規範；112 年版混凝土規範（113 年勘誤），表 5.3.1、13.2.6、13.2.7、13.3、表 22.5.5.1、表 22.6.5.2、21.2、7.6、8.6、9.6、9.7。適用向下軸力、普通重混凝土、兩柱橫向置中、完全接觸之剛性基腳模型。沒有完成沉陷、柱底彎矩、自由邊偏心沖切、水平力、浮力、液化、風震完整組合、錨定與施工圖細節。</p></div></div>`;$('report-content').innerHTML=content;
}
function go(t){tab=t;for(let id of ['workspace','results','report','help','verification'])$(id).hidden=id!==t;for(let b of document.querySelectorAll('[data-tab]')){b.classList.toggle('active',b.dataset.tab===t);b.setAttribute('aria-current',b.dataset.tab===t?'page':'false');}window.scrollTo({top:0,behavior:'instant'});}
function notify(s){$('toast').textContent=s;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,4200);}
function download(data,name,type){let url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
document.addEventListener('click',e=>{let b=e.target.closest('[data-tab],[data-go],[data-tip],[data-example]');if(!b)return;if(b.dataset.tab||b.dataset.go)go(b.dataset.tab||b.dataset.go);if(b.dataset.tip){let t=$('tip-'+b.dataset.tip);t.hidden=!t.hidden;b.setAttribute('aria-expanded',!t.hidden);}if(b.dataset.example){p={...F.examples[b.dataset.example]};fill();run();$('examples-dialog').close();notify('已載入範例，尺寸與結果已更新。');}});
$('input-groups').addEventListener('input',run);$('mode').onchange=run;$('plot-combo').onchange=()=>{if(result?.valid)drawPlots(result)};$('example').onclick=()=>$('examples-dialog').showModal();$('close-examples').onclick=()=>$('examples-dialog').close();
$('save').onclick=()=>{if(!result?.valid)return notify('請先修正輸入再儲存。');download(JSON.stringify({schema:'combined-footing.v1',parameters:p},null,2),'聯合基礎_工程參數.json','application/json;charset=utf-8');};
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{try{let f=e.target.files[0];if(!f)return;if(f.size>102400)throw Error('JSON 檔案須小於 100 KB。');let v=JSON.parse(await f.text());if(v.schema!=='combined-footing.v1'||!v.parameters||typeof v.parameters!=='object')throw Error('請選擇本工具匯出的 v1 參數檔。');let next={...F.defaults};for(let k of Object.keys(next)){if(k in v.parameters){if(typeof v.parameters[k]!==typeof next[k])throw Error(k+' 資料型別不符。');next[k]=v.parameters[k];}}let errs=F.validate(next);if(errs.length)throw Error(errs.join('；'));p=next;fill();run();notify('已讀入參數並重新計算。');}catch(err){notify('匯入未完成：'+err.message)}e.target.value='';};
$('offline').onclick=()=>{if(!result?.valid)return notify('請先修正輸入再下載。');let doc=document.documentElement.cloneNode(true);doc.querySelector('#initial-data').textContent=JSON.stringify(p).replace(/</g,'\\u003c');doc.querySelector('#toast').hidden=true;for(let d of doc.querySelectorAll('dialog'))d.removeAttribute('open');download('<!doctype html>\n'+doc.outerHTML,'聯合基礎分析設計_離線版.html','text/html;charset=utf-8');notify('已下載完整離線版，含目前參數與內嵌說明。');};
$('print').onclick=()=>{if(!result?.valid)return notify('請先修正輸入。');window.print();};$('html-report').onclick=()=>{if(!result?.valid)return notify('請先修正輸入。');download('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>聯合基礎計算書</title><style>'+document.querySelector('style').textContent+'</style><body><main class="content read">'+$('report-content').innerHTML+'</main></body></html>','聯合基礎_詳細計算書.html','text/html;charset=utf-8');};
$('field-guide').innerHTML=`<table><thead><tr><th>欄位／單位</th><th>填入內容</th><th>資料來源</th></tr></thead><tbody>${fields.map(f=>`<tr><td>${f[1]}<br><span class="meta">${f[2]}</span></td><td>${f[4]}</td><td>${f[5]}</td></tr>`).join('')}</tbody></table>`;
$('example-table').innerHTML=`<table><thead><tr><th>參數</th><th>1 長方形</th><th>2 梯形</th><th>3 懸臂</th></tr></thead><tbody>${fields.filter(f=>f[6]!=='manual').map(f=>`<tr><td>${f[1]} [${f[2]}]</td>${Object.values(F.examples).map(v=>`<td>${(f[6]==='strap'||f[6]==='bar-strap')&&v.mode!=='strap'||f[6]==='continuous'&&v.mode==='strap'||f[6]==='nonrect'&&v.mode==='rect'?'—':v[f[0]]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function selfTest(){let rows=[],check=(label,v,w,tol=1e-7)=>rows.push({label,pass:Math.abs(v-w)<=tol,actual:v,expected:w});let r=F.calc(F.examples.rect);check('對稱面積 A',r.g.A,15);check('對稱重心 x̄',r.g.xc,3);check('使用總土壓',r.bearing[0].max,13.56);let m=r.models[1];check('因素化淨土壓',m.netQ(3),16);check('中央彎矩 M(3)',m.M(3),-60);check('單剪 x=1.8139',Math.abs(m.V(1.25+r.d/100)),47.444,1e-7);let a=(.5+r.dp/100)**2;check('沖切 Vu',r.punching[0].demand,120-16*a);for(let [key,p]of Object.entries(F.examples)){let v=F.calc(p);rows.push({label:key+'輸入驗證',pass:v.valid});if(v.valid)for(let m of v.models){check(key+' '+m.name+'力平衡',m.balanceV,0);check(key+' '+m.name+'力矩平衡',m.balanceM,0);}}let bad=F.calc({...F.examples.rect,L:2});rows.push({label:'柱超界停止計算',pass:!bad.valid});let nc=F.calc({...F.examples.rect,L:12});rows.push({label:'負土壓停止強度評定',pass:nc.invalidContact===true});return rows;}
$('run-tests').onclick=()=>{let rows=selfTest();$('test-output').textContent=rows.map(v=>(v.pass?'PASS':'FAIL')+'　'+v.label+(v.actual!==undefined?'：'+n(v.actual,6)+'（預期 '+n(v.expected,6)+'）':'')).join('\n')+'\n'+rows.filter(v=>v.pass).length+'/'+rows.length+' 通過';};
$('validation-info').innerHTML='/*VALIDATION*/';
fill();run();
