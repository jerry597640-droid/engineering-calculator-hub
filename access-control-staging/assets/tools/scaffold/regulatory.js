/* Numeric screening only. Official source checked 2026-10-09. */
(function(root){'use strict';
const fields=[
 ['arrangement','支承型式','select','unknown','確認實際架設方式；啟用托架計算不會自動決定型式。',[['unknown','尚未確認'],['ground','落地直柱式框架'],['cantilever','懸臂／托架支承框架']]],
 ['faceArea','實際施工架立面面積','m²','','依完整施工架立面圖核計，不以遮網實體面積或單支壁連桿分攤面積代替。'],
 ['actualTieX','最大實際壁連座水平間距','m','','由配置圖取最大實際連接間距；與風力等效分攤寬度分開確認。'],
 ['actualTieY','最大實際壁連座垂直間距','m','','由配置圖取最大實際連接间距；不可用平均間距。'],
 ['platformWidth','工作臺實際淨寬','cm','','量測可用工作臺淨寬，不直接採自重估算用的踏板總寬。'],
 ['deckGap','踏板最大縫隙','cm','','量測踏板間最大縫隙；0 表示密接，空白表示尚未確認。'],
 ['topClearance','最高工作臺至立柱頂點高差','m','','立柱頂點高程減最高工作臺高程。'],
 ['accessDistance','至最近上下設備最大步行距離','m','','沿工作臺實際步行路徑量測，不取直線距離。'],
 ['materials','架上是否載有物料','select','unknown','依實際施工使用情境確認。',[['unknown','尚未確認'],['yes','有物料'],['no','無物料']]],
 ['cnsEvidence','CNS／產品文件編號及版本','text','','填產品型號、正式標準版本及試驗／符合性文件編號。此欄不驗證證明有效性。']
];
const documents=[['risk','§3、6：已完成施工規劃與作業前風險評估。'],['design','§40：適用案件已有設計、簽章圖說、強度計算書與查驗機制；變更已重製。'],['supervisor','§41：適用案件已指派施工架組配作業主管。'],['material','§43、59：無顯著損壞、變形或腐蝕；已核對 CNS 4750 同等以上產品證明與標示。'],['stability','§45、58：基底／托架錨定、支撐及連接已覆核；不連接模板支撐或其他臨時構造。'],['horizontal','§61：最上層及每隔五層設水平梁；框架與托架已有防水平滑動措施。'],['platform','§20、48：工作臺強度、支點、固定、滿鋪及護欄／防墜設施已查驗。'],['operation','§42、44、46、47、51：使用前檢查、保養、載重標示、上下設備與惡劣天候停工措施已安排。']];
function defaults(){return Object.fromEntries(fields.map(f=>[f[0],f[3]]).concat(documents.map(d=>[d[0],false])));}
function assess(p,v){const out=[],h=p.top-p.base,num=k=>v[k]===''||v[k]===null?null:Number(v[k]);const row=(title,state,detail,source)=>out.push({title,state,detail,source});
const q=(key,title,test,rule,unit,source)=>{const x=num(key);row(title,x===null?'pending':!Number.isFinite(x)||x<0?'fail':test(x)?'pass':'fail',x===null?'尚未提供實際資料。':`${x} ${unit}；${rule}`,source);};
const area=num('faceArea');if(area!==null&&(!Number.isFinite(area)||area<=0))row('立面面積資料','fail','實際立面面積須為大於零的有效數值。','§40');let design=v.arrangement==='cantilever'||(h>=7&&area!==null&&Number.isFinite(area)&&area>=330);
row('設計、簽章與查驗要求',design?(v.design?'recorded':'pending'):(v.arrangement==='unknown'||h>=7&&area===null?'pending':'info'),`搭設高度 ${h} m；立面面積 ${area===null?'未填':area+' m²'}。懸臂式，或高度 ≥ 7 m 且立面面積 ≥ 330 m² 者，須辦理 §40。未觸發此門檻仍須符合其他設計與安全義務。`,'§40');
row('組配作業主管',h>=5||v.arrangement==='cantilever'?(v.supervisor?'recorded':'pending'):'info','懸臂式或高度 ≥ 5 m 的組配及拆除，應指派作業主管。','§41');
if(v.arrangement==='unknown'){row('壁連座實際間距','pending','先確認支承型式。本引擎限框式施工架，不能套用單管或系統式分類。','§45、59');}
else if(h>=5||v.arrangement==='cantilever'){
 if(h<5){row('未滿 5 m 框架之連接條件','pending','§59 表列框式間距排除高度未滿 5 m 者；採 §45 一般間距作數值篩檢，仍須設計者確認懸臂條件。','§45、59');q('actualTieX','水平連接間距',x=>x>0&&x<=7.5,'一般間距 ≤ 7.5 m','m','§45(3)');q('actualTieY','垂直連接間距',x=>x>0&&x<=5.5,'一般間距 ≤ 5.5 m','m','§45(3)');}
 else{q('actualTieX','框式壁連座水平間距',x=>x>0&&x<8,'原則為 < 8 m（不是 ≤）','m','§59(5)');q('actualTieY','框式壁連座垂直間距',x=>x>0&&x<9,'原則為 < 9 m（不是 ≤）','m','§59(5)');}
}else{q('actualTieX','一般水平連接間距',x=>x>0&&x<=7.5,'≤ 7.5 m；未套用獨立無傾倒例外','m','§45(3)');q('actualTieY','一般垂直連接間距',x=>x>0&&x<=5.5,'≤ 5.5 m；未套用獨立無傾倒例外','m','§45(3)');}
if(p.top>=2){q('platformWidth','工作臺淨寬',x=>x>=40,'≥ 40 cm，另須滿鋪及固定','cm','§48(2)');q('deckGap','踏板縫隙',x=>x<=3,'≤ 3 cm','cm','§48(2)');q('topClearance','最高工作臺上方立柱高差',x=>x>=1,'≥ 1 m','m','§48(4)');}else row('工作臺條件','info','高度未達 2 m；仍需確認強度、固定及作業安全，不作豁免認證。','§48');
q('accessDistance','上下設備步行距離',x=>x<=30,'≤ 30 m','m','§51(2)');
if(h>20||v.materials==='yes'){row('主框架高度與間距',p.step<=2&&p.bay<=185?'pass':'fail',`主框架高 ${p.step} m（≤ 2）；立框間距 ${p.bay} cm（≤ 185）。本工具對高度 > 20 m 或有物料任一條件即採限值篩檢，屬保守適用。`,'§61(3)');}else row('主框架尺寸條件',v.materials==='unknown'?'pending':'info','確認有無物料；高度 > 20 m 或有物料時，本工具保守採主框架 ≤ 2 m、間距 ≤ 1.85 m。','§61(3)');
row('CNS 材料、試驗與製造','pending','計算器無法認證 CNS 4750。請核對正式版本、產品及現場條件。文件紀錄：'+(v.cnsEvidence||'未填'),'§43、59');
return out;}
root.ScaffoldRegulations={fields,documents,defaults,assess};if(typeof module!=='undefined')module.exports=root.ScaffoldRegulations;
})(typeof window!=='undefined'?window:globalThis);
