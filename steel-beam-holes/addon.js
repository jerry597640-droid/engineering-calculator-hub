'use strict';
const positionNames={top:'上翼板',bottom:'下翼板',both:'上下翼板',web:'腹板',combined:'翼板＋腹板（合併篩檢）'};
let lastFlangeKind='bolt';
function setOpeningPosition(position,defaults=false){
 if(!Object.hasOwn(positionNames,position))throw Error('開孔位置無效');
 if($('kind').value!=='web')lastFlangeKind=$('kind').value;
 $('opening-position').value=position;
 $('kind').value=position==='web'?'web':lastFlangeKind;if(position==='combined')$('w-design').value='asd';
 const active=position==='combined'?$('combined-flanges').value:position;if(defaults)for(const id of active==='top'?['nt']:active==='bottom'?['nb']:active==='both'?['nt','nb']:[]){if(Number($(id).value)===0)$(id).value=2}
}
$('opening-position').addEventListener('change',()=>{setOpeningPosition($('opening-position').value,true);render()});$('combined-flanges').addEventListener('change',()=>{setOpeningPosition('combined',true);render()});

let compactReport='';
function renderCompact(p){
 try{
  const c=Holes.compactness(p),connected=$('section-connected').checked,web=$('kind').value==='web';
  const verdict=!c.compact?'原梁寬厚比不符合結實限值':connected?'原梁結實性符合（限本表範圍）':'原梁寬厚比符合結實限值；翼腹板連續連接待確認';
  $('compact-status').textContent=verdict;$('compact-status').className=!c.compact?'bad':connected?'good':'';
  const rows=[['翼板（上下相同）',c.b,p.tf,c.flange,c.flangeLimit,c.flangeRatio,c.flangePass,'17/√Fy'],['腹板',c.h,p.tw,c.web,c.webLimit,c.webRatio,c.webPass,'170/√Fy']];
  $('compact-checks').innerHTML='<table><thead><tr><th>受壓肢</th><th>寬／深 cm</th><th>厚度 cm</th><th>實際寬厚比 λ</th><th>結實限值 λp</th><th>λ/λp ≤ 1</th><th>判定</th></tr></thead><tbody>'+rows.map(([name,b,t,v,limit,ratio,ok,formula])=>'<tr><td>'+name+'</td><td>'+f(b)+'</td><td>'+f(t)+'</td><td>'+f(v)+'</td><td>'+formula+' = '+f(limit)+'</td><td>'+f(ratio)+'</td><td class="'+(ok?'good':'bad')+'">'+(ok?'符合':'不符')+'</td></tr>').join('')+'</tbody></table>';
  const prereq=web?'此表為臺灣 ASD 原梁結實性補充檢核；腹板開孔容量仍依 DG2 自身材料、側撐與 T 肢限制，不採本表的0.66Fy。':'ASD 7.2.1 另列：Fy='+f(c.fy,5)+' tf/cm² '+(c.materialPass?'≤':'＞')+' 4.55（'+(c.materialPass?'符合':'不適用自動0.66Fy')+'）；Lb='+f(p.Lb)+' cm，Lc='+f(c.lc)+' cm（'+(p.Lb<=c.lc?'符合':'側向未支撐長度超限，須另核 Fb')+'）。';
  $('compact-prereq').textContent=prereq;
  compactReport='梁斷面結實性｜臺灣 ASD 4.5、表4.5-1（原梁、強軸彎曲、無軸力）\n'+verdict+'\nFy='+f(p.Fy)+' MPa ÷ 98.0665 = '+f(c.fy,5)+' tf/cm²\n翼板 b=B/2='+f(c.b)+' cm；腹板 h=H−2tf='+f(c.h)+' cm\n'+rows.map(([name,b,t,v,limit,ratio,ok,formula])=>name+'：λ='+f(v)+'；λp='+formula+'='+f(limit)+'；λ/λp='+f(ratio)+'；'+(ok?'符合':'不符')).join('\n')+'\n翼板與腹板全長連續連接已確認：'+connected+'\n'+prereq+'\n原梁寬厚比不代表開孔後局部穩定或整體梁通過；未作塑性設計／耐震結實分類。\n來源：https://www.nlma.gov.tw/uploads/files/e7c2c9d73eefc69beecde12336374b9b.pdf\n查核2026-10-17。';
 }catch(e){compactReport='';$('compact-status').textContent='結實性輸入無效：'+e.message;$('compact-status').className='bad';$('compact-checks').textContent='';$('compact-prereq').textContent='請修正 H、B、tw、tf、Fy 後重新檢核。'}
}
const webDefs=[['ho','孔高 hₒ／圓孔直徑 D','cm',20,'孔洞實際淨尺寸；圓孔只使用此直徑'],['ao','矩形孔沿梁長度 aₒ','cm',30,'施工開孔圖；圓孔自動改用等效長度'],['e','孔中心偏心 e','cm',0,'向上正、向下負；自梁高中心量起'],['V','孔中心剪力 V','tf',10,'ASD 工作載重；LRFD 已因數化載重'],['edge','孔邊至最近支承淨距','cm',100,'任一側孔邊至支承，取較小值'],['radius','矩形孔角半徑 r','cm',2.1,'須≥max(2tw,1.5875cm)'],['Z','原梁塑性斷面模數 Zx','cm³',0,'0＝三矩形計算；可填型鋼表值，勿填彈性 Sx']];
$('web-fields').textContent='';for(const [id,name,unit,v,hint]of webDefs){const l=document.createElement('label');const title=document.createElement('span');title.id='label-w-'+id;title.textContent=name+' ('+unit+')';l.append(title);const i=document.createElement('input');Object.assign(i,{id:'w-'+id,type:'number',value:v,step:'any'});if(id!=='e')i.min='0';l.append(i);const s=document.createElement('small');s.id='hint-w-'+id;s.textContent=hint;l.append(s);$('web-fields').append(l)}
function webInputs(){const w=Object.fromEntries(webDefs.map(([id])=>[id,$('w-'+id).value.trim()===''?NaN:Number($('w-'+id).value)]));return {...w,M:$('M').value.trim()===''?NaN:Number($('M').value),shape:$('w-shape').value,design:$('w-design').value,braced:$('w-braced').checked,conditions:$('w-conditions').checked,teeVerified:$('w-tee').checked}}
function syncMode(){
 const pos=$('opening-position').value;setOpeningPosition(pos,false);
 const combined=pos==='combined',web=pos==='web',hasWeb=web||combined,active=combined?$('combined-flanges').value:pos,lrfd=web&&$('w-design').value==='lrfd';
 $('web-input').hidden=!hasWeb;$('combined-flanges-label').hidden=!combined;$('combined-example').hidden=!combined;
 for(const id of ['d','Lb','Fb'])$(id).closest('label').hidden=web;
 $('nt').closest('label').hidden=web||active==='bottom';$('nb').closest('label').hidden=web||active==='top';
 $('kind').closest('label').hidden=web;$('mode').closest('p').hidden=web;$('confirm').closest('label').hidden=web;$('flange-scope-hint').hidden=web;
 $('w-design').closest('p').hidden=combined;$('w-conditions').closest('p').hidden=combined;
 $('position-summary').textContent=combined?'同一臨界斷面合併扣除翼板孔及腹板孔；僅提供彈性斷面篩檢，聯合承載力維持待覆核。':web?'腹板單孔：矩形或圓孔，檢核剪力及彎剪交互作用。':positionNames[pos]+'開孔：只計入此位置的同排孔數；切換位置預設2孔，可自行調整。';
 $('position-result').textContent='目前檢核：'+positionNames[pos]+(combined?'｜ASD 工作載重；純腹板 DG2 僅為對照模型':web?'｜AISC DG2 無補強單孔彎剪檢核':'｜臺灣 ASD 翼板孔截面彎曲篩檢');
 $('input-unit-hint').textContent=hasWeb?'梁與腹板孔尺寸用 cm，翼板孔徑用 mm，彎矩用 tf·m，剪力用 tf。':'尺寸用 cm、孔徑用 mm、彎矩用 tf·m。';
 $('label-M').textContent=lrfd?'已因數化彎矩 Mu (tf·m)':'使用載重彎矩 M (tf·m)';$('hint-M').textContent=(lrfd?'LRFD 已因數化組合':'ASD 使用載重組合')+'；正：上壓，負：下壓';
 $('label-w-V').textContent=lrfd?'已因數化剪力 Vu (tf)':'使用載重剪力 V (tf)';$('hint-w-V').textContent=lrfd?'孔中心剪力；LRFD 已因數化組合':'孔中心剪力；ASD 使用載重組合';
 $('guide-link').setAttribute('href',combined?'#position-guide':web?'#web-guide':'#guide');$('sources-link').setAttribute('href',web?'#web-sources':'#sources');
 const labels=document.querySelectorAll('.viz .metric span');labels[0].textContent=web?'純剪容量／未開孔塑性剪力':'淨斷面模數保留率';labels[1].textContent=web?'此彎矩下可用剪力 tf':'淨斷面彎矩參考值 tf·m';labels[2].textContent=web?'彎剪交互作用 R':combined?'彎矩參考使用比（非聯合R）':'使用比 |M|／參考值';
 $('viewer-title').textContent=combined?'翼板＋腹板合併淨斷面':web?'腹板開孔與剪力容量':'即時斷面與彎矩保留率';
 if(hasWeb){const circle=$('w-shape').value==='circle';$('w-ao').closest('label').hidden=circle;$('w-radius').closest('label').hidden=circle}
}
function renderCombined(p){
 const w={...webInputs(),design:'asd'},r=Holes.calcCombined(p,w),reference=WebHoles.calcWeb(p,{...w,conditions:true});
 current={p,r,w,combined:true};draw(p,r);
 const scale=150/p.H,top=25+(p.H/2-w.e-w.ho/2)*scale;
 $('diagram').innerHTML=$('diagram').innerHTML.replace('<line x1="40"',`<rect x="${210-p.tw*scale/2}" y="${top}" width="${p.tw*scale}" height="${w.ho*scale}" fill="#fff" stroke="#c95234" stroke-width="2"/><line x1="40"`);
 $('ret').textContent=f(r.r*100,2)+'%';$('capacity').textContent=f(r.mn);$('util').textContent=f(r.ratio);
 const exceeded=(r.ratio!==null&&r.ratio>1)||reference.interaction>1;
 $('status').textContent=(exceeded?'參考篩檢值超限；':'')+'翼板＋腹板同區開孔：整體承載力待另案覆核，不能由兩項單獨檢核合併判定通過。';$('status').className=exceeded?'bad':'';
 $('comparison').innerHTML='<table><thead><tr><th>斷面模型</th><th>A cm²</th><th>形心 cm</th><th>Ix cm⁴</th><th>S上 cm³</th><th>S下 cm³</th><th>彎矩參考 tf·m</th></tr></thead><tbody>'+[['未開孔',r.g,r.m0],['僅翼板孔對照',r.flange.n,r.flange.mn],['翼板＋腹板合併淨斷面',r.n,r.mn]].map(([n,s,m])=>'<tr><td>'+n+'</td>'+[s.A,s.y,s.I,s.St,s.Sb,m].map(v=>'<td>'+f(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table><p class="notice">純腹板 DG2 對照（假設翼板無孔）：R='+f(reference.interaction)+'，該彎矩下可用剪力 '+f(reference.shearAtM)+' tf。此數值不是合併孔洞的剪力設計容量。'+(reference.reasons.length?'對照模型另有適用限制：'+reference.reasons.join('；'):'')+'</p>';
 const text='開孔位置：翼板＋腹板；翼板位置：'+positionNames[$('combined-flanges').value]+'\n合併模式僅採 ASD 工作載重；不是經驗證之聯合強度法。\n'+defs.map(([id,n,u])=>n+'='+p[id]+' '+u).join('\n')+'\n上／下翼板有效孔數='+p.nt+'／'+p.nb+'；翼板扣孔寬 dh='+f(r.dh)+' cm\n腹板孔高/圓孔直徑='+w.ho+' cm；e='+w.e+' cm；孔長='+reference.length+' cm；V='+w.V+' tf\n假設翼板及腹板孔穿越同一臨界橫斷面。圓孔取孔中心最大高度 D。\n分成上、下翼板及腹板孔上下兩個殘餘矩形：\nA=Σbi ti；ȳ=ΣAi yi/A；Ix=Σ[bi ti³/12+Ai(yi−ȳ)²]\nA='+f(r.n.A)+' cm²；ȳ='+f(r.n.y)+' cm；Ix='+f(r.n.I)+' cm⁴\nS上='+f(r.n.St)+'；S下='+f(r.n.Sb)+' cm³\n彎矩參考=經核定 Fb×min(S上,S下)/100='+f(r.mn)+' tf·m；參考使用比='+f(r.ratio)+'\nFb='+f(r.fb===null?null:r.fb*1000)+' kgf/cm²；'+(r.auto?'僅依原梁短梁條件取得的參考應力，未證明開孔後穩定。':'須另案驗證 Fb。')+'\n純腹板 DG2 對照：假設翼板完整，ASD需求×1.7，φ=1；R='+f(reference.interaction)+'；可用剪力='+f(reference.shearAtM)+' tf。不得作合併工況設計容量。\n結論：聯合彎剪、孔邊/T肢局部穩定、斷裂與補強須另案分析；此模式永不自動顯示設計通過。\n\n'+compactReport;
 $('steps').textContent=text;report=text;
}

function drawWeb(p,w,r){const scale=130/p.H,top=30,left=35,width=335,tf=Math.max(3,p.tf*scale),cx=left+width/2,cy=top+(p.H/2-w.e)*scale;const cw=r.length*scale,ch=r.height*scale;let opening=w.shape==='circle'?`<circle cx="${cx}" cy="${cy}" r="${ch/2}" fill="white" stroke="#c65a35" stroke-width="2"/>`:`<rect x="${cx-cw/2}" y="${cy-ch/2}" width="${cw}" height="${ch}" rx="${Math.min(w.radius*scale,ch/2,cw/2)}" fill="white" stroke="#c65a35" stroke-width="2"/>`;
$('diagram').innerHTML=`<svg viewBox="0 0 620 220" role="img" aria-label="腹板開孔立面圖，孔洞尺寸及上下T形肢"><rect x="${left}" y="${top}" width="${width}" height="130" fill="#d5e3ed"/><rect x="${left}" y="${top}" width="${width}" height="${tf}" fill="#547b95"/><rect x="${left}" y="${top+130-tf}" width="${width}" height="${tf}" fill="#547b95"/>${opening}<line x1="25" x2="385" y1="95" y2="95" stroke="#218b93" stroke-dasharray="5 4"/><g fill="#203d53" font-family="system-ui" font-size="14"><text x="400" y="45">H = ${f(p.H,2)} cm</text><text x="400" y="72">hₒ = ${f(r.height,2)} cm</text><text x="400" y="99">${w.shape==='circle'?'D':'aₒ'} = ${f(r.length,2)} cm</text><text x="400" y="126">e = ${f(w.e,2)} cm</text><text x="400" y="153">${w.M>=0?'上 T 肢受壓':'下 T 肢受壓'}</text><text x="40" y="191">上 T 肢 ${f(r.st,2)} cm ／ 下 T 肢 ${f(r.sb,2)} cm</text><text x="40" y="212">單孔立面示意；支承距離依輸入值另核</text></g></svg>`}
function renderWeb(p){const w=webInputs(),r=WebHoles.calcWeb(p,w);if(!$('section-connected').checked){r.reasons.push('翼板與腹板連續連接尚未確認');r.applicable=false;r.pass=false}current={p,r,w};drawWeb(p,w,r);$('ret').textContent=f(100*r.Vm/r.Vp,2)+'%';$('capacity').textContent=f(r.shearAtM);$('util').textContent=f(r.interaction);let verdict=r.interaction>1?'腹板開孔彎剪容量不符':r.applicable?'腹板開孔彎剪檢核符合（限本模組範圍）':'容量數值符合，適用條件待覆核';$('status').textContent=verdict+(r.reasons.length?'：'+r.reasons.join('；'):'。');$('status').className=r.interaction>1?'bad':r.applicable?'good':'';
const rows=[['上 T 形肢',r.top],['下 T 形肢',r.bottom]];let table='<table><thead><tr><th>項目</th><th>等效深度 cm</th><th>ν=a/s</th><th>αᵥ</th><th>Vp tf</th><th>Vm tf</th></tr></thead><tbody>'+rows.map(([name,t])=>'<tr><td>'+name+'</td>'+[t.s,t.nu,t.alpha,t.Vp,t.Vm].map(x=>'<td>'+f(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table><p><b>純剪可用值 '+f(r.Vallow)+' tf；此彎矩下可用剪力 '+f(r.shearAtM)+' tf。</b></p><table><thead><tr><th>適用條件</th><th>計算</th><th>限制</th><th>結果</th></tr></thead><tbody>'+r.checks.map(([name,ok,value,limit])=>'<tr><td>'+name+'</td><td>'+f(value)+'</td><td>'+f(limit)+'</td><td class="'+(ok?'good':'bad')+'">'+(ok?'符合':'不符')+'</td></tr>').join('')+'</tbody></table>';$('comparison').innerHTML=table;
const lines=`開孔位置：腹板\n腹板開孔｜AISC DG2 補充方法（1990／2003 修訂），不是臺灣 ASD 0.66Fy 公式\n設計模式：${w.design==='asd'?'DG2 §3.8 ASD 轉換：工作載重 ×1.7，φ=1.00':'DG2 LRFD：已因數化需求，φ=0.90'}\n\n輸入：H=${p.H}、B=${p.B}、tw=${p.tw}、tf=${p.tf} cm；Fy=${p.Fy} MPa\n孔形=${w.shape==='rect'?'矩形':'圓形'}；hₒ/D=${w.ho}；實孔長=${r.length}；e=${w.e} cm\nM=${w.M} tf·m；V=${w.V} tf；最近支承淨距=${w.edge} cm\n孔角r=${w.radius} cm（圓孔不使用）；指定Z=${w.Z} cm³（0=自算）\n確認：充分側撐=${w.braced}；無補強單孔等條件=${w.conditions}；T肢另核=${w.teeVerified}\n\n1. Fy=${f(r.fy,5)} tf/cm²=${f(r.fyksi,5)} ksi\n2. 實際 T 肢深度 st=H/2−hₒ/2−e=${f(r.st)}；sb=H/2−hₒ/2+e=${f(r.sb)} cm\n   圓孔剪力等效：h_s=0.9D、a_s=0.45D；矩形：h_s=hₒ、a_s=aₒ\n   h_s=${f(r.hs)}；a_s=${f(r.as)} cm\n3. Z幾何=B tf(H−tf)+tw(H−2tf)²/4=${f(r.Zgeom)} cm³\n   採用Z=${f(r.Z)} cm³；Mp=Fy Z/100=${f(r.Mp)} tf·m\n   Mm=Fy[Z−hₒ tw(hₒ/4+|e|)]/100=${f(r.Mm)} tf·m（DG2 3-6）\n4. 各 T 肢：ν=a_s/s；Vp=Fy tw s/√3；αᵥ=min[1,√6/(ν+√3)]\n   上肢：s=${f(r.top.s)}；ν=${f(r.top.nu)}；αᵥ=${f(r.top.alpha,5)}；Vp=${f(r.top.Vp)}；Vm=${f(r.top.Vm)} tf\n   下肢：s=${f(r.bottom.s)}；ν=${f(r.bottom.nu)}；αᵥ=${f(r.bottom.alpha,5)}；Vp=${f(r.bottom.Vp)}；Vm=${f(r.bottom.Vm)} tf\n   Vm原值=Vm上+Vm下=${f(r.VmRaw)} tf（DG2 3-12、3-13，含次彎矩影響）\n5. 腹板h/tw=${f(r.webSlender)}；${r.stocky?'厚實':'較薄'}腹板\n   Vp全腹板=Fy tw H/√3=${f(r.Vp)} tf\n   Vm上限=${r.stocky?'2/3':'0.45'}Vp=${f(r.Vlimit)} tf；採用Vm=${f(r.Vm)} tf\n6. 設計需求 Md=${r.loadFactor}×|M|=${f(r.Md)} tf·m；Vd=${r.loadFactor}×|V|=${f(r.Vd)} tf\n   φ=${r.phi}；rm=Md/(φMm)=${f(r.rm,5)}；rv=Vd/(φVm)=${f(r.rv,5)}\n   R=(rm³+rv³)^(1/3)=${f(r.interaction,5)}，須≤1.00（DG2 3-3）\n7. 純剪可用值=φVm/載重轉換倍數=${f(r.Vallow)} tf\n   此彎矩下剪力=φVm/倍數 ×[max(0,1−rm³)]^(1/3)=${f(r.shearAtM)} tf\n\n${verdict}\n${r.reasons.join('；')}\n\n適用條件逐項：\n${r.checks.map(([n,ok,v,l])=>n+'：'+f(v)+'；限制'+f(l)+'；'+(ok?'符合':'不符')).join('\n')}\n\n本模組：單一無補強腹板孔、等翼板H形鋼、無複合梁貢獻、無同區翼板孔及軸力。\nT肢ν>4之壓屈、梁整體穩定、疲勞、塑鉸、撓度及載重附近承壓須另核；不是整體設計通過。\n來源：AISC Design Guide 2 §3.4–3.8、例1／1A；查核2026-10-17。\nhttps://www.aisc.org/aisc/publications/design-guides/design-guide-summary/`;
$('steps').textContent=lines;report=lines+'\n\n'+compactReport;}
let pinned=true;try{pinned=localStorage.getItem('steel-beam-holes.pin.v1')!=='false'}catch{}
function setPin(v){pinned=Boolean(v);$('viewer').setAttribute('data-pinned',String(pinned));$('pin-view').setAttribute('aria-pressed',String(pinned));$('pin-view').textContent=pinned?'取消釘選':'釘選圖形';$('pin-hint').textContent=pinned?'圖形已釘選；可取消以閱讀下方結果。':'圖形未釘選，隨頁面一起捲動。';try{localStorage.setItem('steel-beam-holes.pin.v1',String(pinned))}catch{}}
$('pin-view').onclick=()=>setPin(!pinned);setPin(pinned);
for(const id of [...webDefs.map(([id])=>'w-'+id),'w-shape','w-design','w-braced','w-conditions','w-tee'])$(id).addEventListener('input',render);
$('web-example').onclick=()=>{const vals={H:50,B:20,tw:1,tf:1.6,Fy:325,M:20};Object.entries(vals).forEach(([id,v])=>$(id).value=v);Object.entries({ho:20,ao:30,e:0,V:10,edge:100,radius:2.1,Z:0}).forEach(([id,v])=>$('w-'+id).value=v);setOpeningPosition('web',false);$('w-shape').value='rect';$('w-design').value='asd';$('w-braced').checked=true;$('w-conditions').checked=true;$('w-tee').checked=false;$('section-connected').checked=true;render()};
$('web-case').onclick=()=>{Object.entries({H:23.6*2.54,B:7.01*2.54,tw:.395*2.54,tf:.505*2.54,Fy:36*6.894757293168,M:3470*.01152124619879058}).forEach(([id,v])=>$(id).value=v);Object.entries({ho:25.4,ao:50.8,e:-5.08,V:12*.45359237,edge:(12*12-10)*2.54,radius:2.1,Z:134*2.54**3}).forEach(([id,v])=>$('w-'+id).value=v);setOpeningPosition('web',false);$('w-shape').value='rect';$('w-design').value='lrfd';$('w-braced').checked=true;$('w-conditions').checked=true;$('w-tee').checked=false;$('section-connected').checked=true;render()};
$('save').onclick=()=>{if(!current)return alert('請先修正輸入');download(new Blob([JSON.stringify({version:3,openingPosition:$('opening-position').value,combinedFlanges:$('combined-flanges').value,inputs:current.p,kind:$('kind').value,confirmed:$('confirm').checked,sectionConnected:$('section-connected').checked,web:webInputs(),pinned},null,2)],{type:'application/json'}),'steel-beam-holes-input-v1.3.json')};
$('load').onchange=async e=>{
 try{
  const j=JSON.parse(await e.target.files[0].text());
  if(![1,2,3].includes(j.version)||!j.inputs||defs.some(([id])=>!Number.isFinite(j.inputs[id])))throw Error('檔案格式不正確');
  const position=j.version===3?j.openingPosition:j.kind==='web'?'web':j.inputs.nt>0&&j.inputs.nb>0?'both':j.inputs.nb>0?'bottom':j.inputs.nt>0?'top':'both';
  if(!Object.hasOwn(positionNames,position))throw Error('開孔位置無效');
  if(j.version===3&&position==='combined'&&!['top','bottom','both'].includes(j.combinedFlanges))throw Error('合併工況翼板位置不正確');
  if(['web','combined'].includes(position)&&!j.web)throw Error('檔案未包含腹板孔尺寸，請重新填入');
  if(j.web){
   if(webDefs.some(([id])=>!Number.isFinite(j.web[id]))||!['rect','circle'].includes(j.web.shape)||!['asd','lrfd'].includes(j.web.design))throw Error('腹板資料不正確');
   if(position==='combined'&&j.web.design!=='asd')throw Error('合併工況僅接受ASD工作載重');
  }
  // Validate the complete import before changing any control.
  for(const [id]of defs)$(id).value=j.inputs[id];
  $('mode').value=j.inputs.add===0?'0':'1.5';$('kind').value=['bolt','empty'].includes(j.kind)?j.kind:'bolt';
  $('combined-flanges').value=['top','bottom','both'].includes(j.combinedFlanges)?j.combinedFlanges:'both';setOpeningPosition(position,false);
  $('confirm').checked=false;$('section-connected').checked=false;
  for(const id of ['braced','conditions','tee'])$('w-'+id).checked=false;
  if(j.web){for(const [id]of webDefs)$('w-'+id).value=j.web[id];$('w-shape').value=j.web.shape;$('w-design').value=j.web.design}
  if(typeof j.pinned==='boolean')setPin(j.pinned);render();
 }catch(err){alert('載入失敗：'+err.message)}finally{e.target.value=''}
};

$('combined-example').onclick=()=>{$('web-example').onclick();$('nt').value=2;$('nb').value=2;$('Lb').value=100;$('Fb').value=0;$('combined-flanges').value='both';$('kind').value='bolt';setOpeningPosition('combined',false);$('w-conditions').checked=false;render()};
for(const button of document.querySelectorAll('[data-video-time]'))button.addEventListener('click',()=>{
 const video=$('tutorial-video'),time=Number(button.getAttribute('data-video-time'));
 const seek=()=>{video.currentTime=Math.min(time+.8,Number.isFinite(video.duration)?Math.max(0,video.duration-.05):time+.8);$('video-status').textContent='已定位 '+button.textContent+'，按播放觀看。'};
 if(video.readyState>=1)seek();else{video.addEventListener('loadedmetadata',seek,{once:true});video.load()}
});
$('tutorial-video').addEventListener('error',()=>{$('video-status').textContent='影片尚未載入。離線使用請確認已完整解壓並保留media資料夾，或使用上方MP4下載連結。'});
$('offline').textContent='下載完整離線 ZIP';$('offline').onclick=()=>{if(location.protocol==='file:')return alert('目前已使用離線版；請保留index.html與media資料夾。');const a=document.createElement('a');a.href='steel-beam-holes-offline-v1.3.zip';a.download='steel-beam-holes-offline-v1.3.zip';a.click()};
render();
