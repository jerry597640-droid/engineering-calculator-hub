/* Offline editable DOCX export. Uses uncompressed ZIP and native OOXML; no network dependency. */
const SlabReport=(()=>{
const esc=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num=(n,d=4)=>n===null||!Number.isFinite(n)?'無法計算':Number(n.toFixed(d)).toString();
const status=b=>b?'通過':'未通過';
const pos=['短向連續端負彎矩','短向不連續端負彎矩','短向跨中正彎矩','長向連續端負彎矩','長向不連續端負彎矩','長向跨中正彎矩'];
function p(text,style='Normal',breakBefore=false){return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${breakBefore?'<w:pageBreakBefore/>':''}</w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;}
function table(rows,widths){return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(x=>`<w:${x} w:val="single" w:sz="4" w:color="D9D9D9"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((r,i)=>`<w:tr><w:trPr><w:cantSplit/>${i===0?'<w:tblHeader/>':''}</w:trPr>${r.map((v,j)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[j]}" w:type="dxa"/><w:vAlign w:val="center"/>${i===0?'<w:shd w:fill="E7EEF5"/>':''}</w:tcPr>${p(v,i===0?'TableHeader':'TableText')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`;}
function reportBody(o,meta={}){
const v=o.p,{short:S,long:L,h,cover,fc,fy,dead,live,dsl,dss,bar}=v,{d,r,index,wu,selfWeight,totalDead}=o;
const m1=fy/fc/.8499999,amax=Math.max(...o.rows.filter(x=>x.req!==null).map(x=>x.req)),generalMin=.0018*100*h;
let s=p('樓板分析設計計算書','Title');
s+=p(`工程名稱：${meta.project||'未填寫'}　　樓板編號：${meta.slab||'1S1'}`);
s+=p(`計算日期：${meta.date||new Date().toISOString().slice(0,10)}　　計算方式：USD 原碼公式＋自動板自重`);
s+=p(`本計算書針對均布載重樓板，列出附件原程式的彎矩、配筋、最小板厚及剪力計算。原碼範圍判定：${o.pass?'通過':'有未通過項目'}。現行規範整體判定：需修正與補算，尚不能認定完整符合。`);
s+=p('一 設計輸入與結果摘要','Heading1');
s+=table([['項目','輸入值','項目','輸入值'],['短跨 S',`${num(S)} m`,'長跨 L',`${num(L)} m`],['板厚 h',`${num(h)} cm`,'原碼保護層 c',`${num(cover)} cm`],['混凝土 f′c',`${num(fc)} kgf/cm²`,'鋼筋 fy',`${num(fy)} kgf/cm²`],['額外靜載重 D',`${num(dead)} tf/m²`,'活載重 Lₗ',`${num(live)} tf/m²`],['長邊不連續數 DSL',dsl,'短邊不連續數 DSS',dss],['鋼筋號數',`#${bar}`,'單筋面積 Ab',`${num(BARS[bar][0])} cm²`],['原碼間距常數 AAA',num(BARS[bar][1]),'計算板帶寬 b','100 cm']], [2300,2380,2300,2380]);
s+=p('D 為額外靜載重；本版以板厚 × 2.4 tf/m³ 自動加算板自重。原碼以 d = h − c 處理，未另扣鋼筋半徑及雙向鋼筋層位。');
s+=table([['檢核項目','原碼數值','判定'],['最小板厚',`h = ${num(h)} ${o.thicknessPass?"≥":"<"} hmin = ${num(o.hmin)} cm`,status(o.thicknessPass)],['剪應力',`vu = ${num(o.vu)}；vc = ${num(o.vc)} kgf/cm²`,status(o.shearPass)],['六處實配鋼筋',`最大所需 As = ${num(amax)} cm²/m`,status(o.rows.every(x=>x.pass))]],[2300,5300,1760]);
s+=p('來源：Slab_20121009_SourceCode.zip 內 Form1.vb。tf 為公噸力，kgf 為公斤力；彎矩以每公尺板帶表示，負彎矩欄列絕對值。','Small');
s+=p('二 載重組合與彎矩計算','Heading1',true);
s+=p(`樓板自重 = h / 100 × 2.4 = ${num(h)} / 100 × 2.4 = ${num(selfWeight,6)} tf/m²`,'Formula');
s+=p(`總靜載重 D總 = 樓板自重 + 額外 D = ${num(selfWeight,6)} + ${num(dead)} = ${num(totalDead,6)} tf/m²`,'Formula');
s+=p(`wᵤ = 1.2D總 + 1.6Lₗ = 1.2 × ${num(totalDead)} + 1.6 × ${num(live)} = ${num(wu,6)} tf/m²`,'Formula');
s+=p(`r = S / L = ${num(S)} / ${num(L)} = ${num(r,6)}；${o.one?'r < 0.5，採單向板分支。':'r ≥ 0.5，採雙向板分支。'}`);
if(o.one){s+=p(`依 DSL = ${dsl}，短向三個係數 C = ${o.rows.slice(0,3).map(x=>num(x.coef,8)).join('、')}，長向係數皆為零，改以最小分布筋配置。`);}else{
s+=p(`j = floor[floor(100r) / 2] − 24 = floor[floor(${num(100*r,6)}) / 2] − 24 = ${index}`,'Formula');
s+=p(`查表跨比級距 = 0.48 + 0.02j = ${num(.48+.02*index,2)}。按每 0.02 向下取級，不內插。長向固定取第 26 欄。`);
const D1=dsl+dss+1;s+=p(`D1 = DSL + DSS + 1 = ${dsl} + ${dss} + 1 = ${D1}。${D1===1?'採 S(1,j)、0、S(2,j)。':D1===5?'採 0、S(12,j)、S(13,j)。':`由列 i = 3 + (D1−2)×3 = ${3+(D1-2)*3} 起取三列，並依邊界將不適用端係數歸零。`}`);}
s+=p('各位置均使用短跨 S²。原碼彎矩向下截位至 0.001 tf·m/m。');
s+=p('Mu = floor(C × S² × wᵤ × 1000) / 1000','Formula');
s+=table([['位置','C','C × S² × wᵤ','截位 Mu'],...o.rows.map((x,i)=>[pos[i],num(x.coef,8),`${num(x.coef,8)} × ${num(S)}² × ${num(wu,6)}`,`${num(x.mu,3)} tf·m/m`])],[2600,1600,3400,1760]);
s+=p(`現行純 D、L 重力比較（D 指 D總）：1.4D = ${num(1.4*totalDead,6)}；1.2D + 1.6Lₗ = ${num(wu,6)}；兩組包絡 = ${num(Math.max(1.4*totalDead,wu),6)} tf/m²。上表仍採原碼 wᵤ，未因規範比較而覆寫。`);
s+=p('原碼對應：標號 630 至 980 為載重與係數選取，1050 至 1100 為彎矩計算。','Small');
for(let dir=0;dir<2;dir++){
s+=p(dir===0?'三 短向鋼筋詳細計算':'四 長向鋼筋詳細計算','Heading1',true);
s+=p(`d = h − c = ${num(h)} − ${num(cover)} = ${num(d)} cm；b = 100 cm。`);
s+=p(`m₁ = fy / (0.8499999f′c) = ${num(fy)} / (0.8499999 × ${num(fc)}) = ${num(m1,6)}`,'Formula');
s+=p(`ρmin = ${num(o.rho)}；As,min = ρmin × 100h = ${num(o.rho)} × 100 × ${num(h)} = ${num(o.amin)} cm²/m。`);
for(let i=dir*3;i<dir*3+3;i++){
const x=o.rows[i],m2=x.mu*1000/d**2/.9000001;
s+=p(`${i%3+1} ${pos[i]}`,'Heading2');
s+=p(`m₂ = Mu × 1000 / (0.9000001d²) = ${num(x.mu,3)} × 1000 / (0.9000001 × ${num(d)}²) = ${num(m2,6)}`,'Formula');
s+=p(`Δ = 1 − 2m₂m₁/fy = 1 − 2 × ${num(m2,6)} × ${num(m1,6)} / ${num(fy)} = ${num(x.disc,8)}`,'Formula');
if(x.flex===null){s+=p('Δ < 0，反算式無實數解，原斷面無法由此式求得所需配筋，判定未通過。');}
else{s+=p(`As,flex = (1 − √Δ) / m₁ × 100d = (1 − √${num(x.disc,8)}) / ${num(m1,6)} × 100 × ${num(d)} = ${num(x.flex,5)} cm²/m`,'Formula');
s+=p(o.one&&i>=3?`單向板長向採分布筋：As,req = As,min = ${num(x.req)} cm²/m。`:x.req===0?'原碼此位置 Mu = 0，As,req = 0；不代表可省略構造鋼筋。':`As,req = max(As,flex, As,min) = max(${num(x.flex,5)}, ${num(o.amin)}) = ${num(x.req,5)} cm²/m。`);}
if(x.suggested!==null){s+=p(`s上限 = ${o.one&&i>=3?'45':'2h'} = ${num(x.maxSpacing)} cm；s建議 = min[floor(${num(BARS[bar][1])}/${num(x.req,6)} × 10)/10, ${num(x.maxSpacing)}] = ${num(x.suggested,1)} cm。`);}else{s+=p('原碼建議間距：無需求或無法計算，不提供建議值。');}
s+=p(`實配 #${bar}@${num(x.spacing)} cm：As,prov = 100Ab/s = 100 × ${num(BARS[bar][0])} / ${num(x.spacing)} = ${num(x.provided,5)} cm²/m。`);
s+=p(x.active?`判定：${x.req===null?'As,req 無法計算':`As,prov ${x.provided>=x.req?'≥':'<'} As,req`}；s ${x.spacing<=x.maxSpacing?'≤':'>'} s上限。結果：${status(x.pass)}。`:'判定：原碼此處無需求；未就構造配筋作合格判定。');
}
s+=p('原碼對應：shun 標號 1620 至 1770；weishun 標號 2130 至 2175。建議間距用 AAA，實配面積用 Ab，兩者常數略有差異。','Small');}
s+=p('五 最小板厚與剪力詳細計算','Heading1',true);
s+=p('最小板厚','Heading2');
if(o.one){s+=p(`hmin,raw = 100S / ${[28,24,20][dsl]} = 100 × ${num(S)} / ${[28,24,20][dsl]} = ${num(S*100/[28,24,20][dsl],6)} cm`,'Formula');}
else{const A=L*(800+.0712*fy)*100,B=o.bts,D=36000+5000*L/S*(1+B);s+=p(`B = [(2−DSL)L + (2−DSS)S] / [2(S+L)] = [(2−${dsl})×${num(L)} + (2−${dss})×${num(S)}] / [2×(${num(S)}+${num(L)})] = ${num(B,6)}`,'Formula');s+=p(`A = 100L(800+0.0712fy) = 100 × ${num(L)} × (800+0.0712×${num(fy)}) = ${num(A,6)}`,'Formula');s+=p(`H₁ = A / [36000+5000(L/S)(1+B)] = ${num(A,6)} / ${num(D,6)} = ${num(A/D,6)} cm`,'Formula');s+=p(`H₂ = A / 36000 = ${num(A/36000,6)} cm；hmin,raw = min(H₁,H₂)。`,'Formula');}
s+=p(`hmin = floor(hmin,raw × 100)/100 = ${num(o.hmin,2)} cm；實際 h = ${num(h)} cm。原碼板厚判定：${status(o.thicknessPass)}。`);
s+=p('剪力及剪應力','Heading2');
if(o.one){s+=p(`V = wᵤ(S/2 − d/100)L${dsl===1?' × 1.15':''} = ${num(wu,6)} × (${num(S)}/2 − ${num(d)}/100) × ${num(L)}${dsl===1?' × 1.15':''} = ${num(o.V,6)} tf`,'Formula');}
else{const sa=S-d/100,la=L-d/100;s+=p(`S′ = S − d/100 = ${num(sa,6)} m；L′ = L − d/100 = ${num(la,6)} m。`);s+=p(`V = wᵤ(S′L′/2 − S′²/4) = ${num(wu,6)} × (${num(sa,6)} × ${num(la,6)}/2 − ${num(sa,6)}²/4) = ${num(o.V,6)} tf`,'Formula');}
s+=p(`vu,raw = V/L/d × 10/0.8499999 = ${num(o.V,6)}/${num(L)}/${num(d)} × 10/0.8499999 = ${num(o.V/L/d*10/.8499999,6)} kgf/cm²`,'Formula');
s+=p(`vu = floor(vu,raw × 100)/100 = ${num(o.vu,2)} kgf/cm²。`);
s+=p(`vc,raw = 0.53√f′c = 0.53√${num(fc)} = ${num(.53*Math.sqrt(fc),6)} kgf/cm²`,'Formula');
s+=p(`vc = floor(vc,raw × 100)/100 = ${num(o.vc,2)} kgf/cm²。vu ${o.shearPass?'≤':'>'} vc，原碼剪力判定：${status(o.shearPass)}。`);
s+=p('CPS 固定為 0，原碼扣除 d 計算剪力。vu 已除以約 0.85 的原碼折減因數，不是未折減的 Vu/(bd)。最小板厚檢核不能替代撓度計算。原碼對應：標號 1790 至 2000。','Small');
s+=p('六 現行規範核對與待補算事項','Heading1',true);
s+=p('比對依據：臺灣建築物混凝土結構設計規範 112 年版，自 113 年 1 月 1 日生效，含 113 年 2 月 19 日勘誤。本網頁規範查核日為 2026 年 10 月 2 日。');
const active=o.rows.filter(x=>x.active),minOK=active.every(x=>x.provided>=generalMin),spOK=o.rows.every((x,i)=>!x.active||x.spacing<=Math.min(45,h*(o.one?(i<3?3:5):2)));
s+=table([['項目及依據','本次數值核對','狀態'],['純 D L 組合 表5.3.1',`原碼 ${num(wu)}；兩組包絡 ${num(Math.max(wu,1.4*totalDead))} tf/m²`,wu>=1.4*totalDead?'本項符合':'原碼不足'],['一般最少筋 7.6.1 8.6.1 24.4.3',`0.0018 × 100h = ${num(generalMin)} cm²/m`,active.length?(minOK?'本項符合':'本項不足'):'待確認構造筋'],['最大間距 7.7.2 8.7.2 24.4.3',o.one?`主筋 ${num(Math.min(3*h,45))}；分布筋 ${num(Math.min(5*h,45))} cm`:`臨界截面 ${num(Math.min(2*h,45))} cm`,active.length?(spOK?'本項符合':'本項不足'):'待確認構造筋'],['剪力 φ 表21.2.1','原碼約0.85；現行一般剪力0.75','須修正重算'],['板厚及強度','梁板勁度、實際d、分析適用性等','待補資料及補算']],[2950,4650,1760]);
s+=p('上述本項符合僅限明示數值與原碼有需求位置；不代表全部構造配筋或整片樓板符合規範。');
s+=p('分析及撓曲','Heading2');s+=p('係數表出處及適用條件不完整。6.5簡法另需均勻斷面、均布載重、L≤3D、至少兩跨及相鄰跨差異小於20%。原碼φ≈0.90未核驗拉力控制；應依表21.2.2確認εt≥εty+0.003，並依鋼筋半徑及層位確認有效深度。');
s+=p('剪力及使用性','Heading2');s+=p('無足量剪力筋時，現行表22.5.5.1(c)的Vc含縱筋比、尺寸效應、輕質修正及軸力，不能一律採0.53√f′c bd。單向板厚表值須納入fy修正；雙向板厚需梁板勁度、淨跨與外邊梁資料。尚需依24.2評估適用的即時及長期撓度。');
s+=p('構造及適用範圍','Heading2');s+=p('仍缺沖切、不平衡彎矩、角隅補強、開孔、錨定、續接、耐久保護層、最小淨間距及收縮溫度束制等檢核。雙向板8.6.1.2可能另控制最小筋；單向板最大間距尚受24.3裂縫控制。');
if(o.warnings.length)s+=p('本次原碼提醒：'+o.warnings.join(' '));
s+=p('原碼S(4,19)=15及S(13,18)=64有非平順值，均予保留。fy>4200時原碼最終覆寫ρmin為0.0018。原碼VB Single與網頁浮點在截位邊界可能有末位差異。','Small');
s+=p('官方版本公告：https://www.nlma.gov.tw/ch/legislation/regsearch/6874','Small');
s+=p('規範全文：https://www.nlma.gov.tw/uploads/files/011d9249cac7d6c5547786aa348e352a.pdf','Small');
s+=p('條文定位：5.3.1載重；7.3.1及8.3.1板厚；7.6.1、8.6.1及24.4.3最少筋；7.7.2及8.7.2間距；21.2折減因數；22.5及22.6剪力。','Small');
if(typeof modernReportLines==='function'){s+=p('現行規範斷面複核（獨立輸入內力）','Heading1',true);for(const line of modernReportLines())s+=p(line);}
return s;
}
const prefix='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
function files(o,meta){return {
'[Content_Types].xml':prefix+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
'_rels/.rels':prefix+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
'word/_rels/document.xml.rels':prefix+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
'word/document.xml':prefix+'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'+reportBody(o,meta)+'<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1000" w:right="1440" w:bottom="1000" w:left="1440" w:header="360" w:footer="500"/></w:sectPr></w:body></w:document>',
'word/footer1.xml':prefix+'<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>樓板分析設計計算書  第 </w:t></w:r><w:fldSimple w:instr="PAGE"/><w:r><w:t> 頁</w:t></w:r></w:p></w:ftr>',
'word/styles.xml':prefix+`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Noto Sans CJK TC"/><w:sz w:val="21"/><w:color w:val="000000"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="50" w:line="250" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="220"/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="36"/></w:rPr></w:style>${[['Heading1','28','200'],['Heading2','23','140']].map(([id,size,before],i)=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${before}" w:after="100"/><w:outlineLvl w:val="${i}"/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="${size}"/></w:rPr></w:style>`).join('')}<w:style w:type="paragraph" w:styleId="Formula"><w:name w:val="Formula"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="40" w:line="245" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="260" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="19"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/><w:basedOn w:val="TableText"/><w:rPr><w:b/><w:color w:val="000000"/></w:rPr></w:style></w:styles>`};}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(a){let c=0xffffffff;for(const b of a)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(entries){const enc=new TextEncoder(),parts=[],central=[];let offset=0;for(const [name,xml]of Object.entries(entries)){const n=enc.encode(name),data=enc.encode(xml),c=crc(data),head=new Uint8Array(30+n.length),h=new DataView(head.buffer);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,33,true);h.setUint32(14,c,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,n.length,true);head.set(n,30);parts.push(head,data);const cd=new Uint8Array(46+n.length),v=new DataView(cd.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);v.setUint32(16,c,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);cd.set(n,46);central.push(cd);offset+=head.length+data.length;}const size=central.reduce((s,a)=>s+a.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);const out=new Uint8Array(offset+size+22);let at=0;for(const a of [...parts,...central,end]){out.set(a,at);at+=a.length;}return out;}
return {build:(o,meta)=>zip(files(o,meta)),files};
})();
if(typeof document!=='undefined'){
const dateField=document.getElementById('report-date');if(dateField){const now=new Date();dateField.value=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');}
const button=document.getElementById('export-word');if(button)button.addEventListener('click',()=>{const msg=document.getElementById('export-status');try{const o=calculate(values()),meta={project:document.getElementById('report-project').value.trim(),slab:document.getElementById('report-slab').value.trim()||'1S1',date:dateField.value};const data=SlabReport.build(o,meta),blob=new Blob([data],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`樓板計算書_${meta.slab}_${meta.date||'未填日期'}.docx`.replace(/[\\/:*?"<>|]/g,'_');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);msg.textContent='已匯出可編輯 Word 計算書，內容依目前輸入值產生。';}catch(e){msg.textContent='無法匯出：'+e.message;}});}
