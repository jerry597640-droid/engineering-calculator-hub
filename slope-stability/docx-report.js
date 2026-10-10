/* Native OOXML document export. ZIP STORE + CRC32; no remote library. */
(function(root){
'use strict';
const E=s=>String(s??'').replace(/[<>&"']/g,x=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[x]));
const n=(v,d=6)=>Number.isFinite(v)?v.toFixed(d):'—';
const encoder=new TextEncoder(),names={normal:'常時',rain:'暴雨最高水位',seismic:'地震'};
function zip(files){const tab=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;tab[i]=c>>>0;}const parts=[],central=[];let offset=0;const header=(length)=>{const a=new Uint8Array(length);return [a,new DataView(a.buffer)];};for(const [name,data]of Object.entries(files)){const path=encoder.encode(name),bytes=typeof data==='string'?encoder.encode(data):data;let crc=0xffffffff;for(const b of bytes)crc=tab[(crc^b)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;const [a,v]=header(30+path.length);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x5d4b,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,path.length,true);a.set(path,30);parts.push(a,bytes);const [c,w]=header(46+path.length);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,0x5d4b,true);w.setUint32(16,crc,true);w.setUint32(20,bytes.length,true);w.setUint32(24,bytes.length,true);w.setUint16(28,path.length,true);w.setUint32(42,offset,true);c.set(path,46);central.push(c);offset+=a.length+bytes.length;}const clen=central.reduce((a,b)=>a+b.length,0),[end,ev]=header(22);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,clen,true);ev.setUint32(16,offset,true);const all=[...parts,...central,end],out=new Uint8Array(offset+clen+22);let p=0;for(const a of all){out.set(a,p);p+=a.length;}return out;}
function create(out,options={}){
const m=out.model,force=m.units==='tf'?'tf/m':'kN/m',stress=m.units==='tf'?'tf/m²':'kPa',weight=m.units==='tf'?'tf/m³':'kN/m³',f=m.units==='tf'?9.80665:1;
let body='',imageNum=0;const images={},imageRels=[];
function para(text,style='Normal'){body+='<w:p><w:pPr><w:pStyle w:val="'+style+'"/></w:pPr><w:r><w:t xml:space="preserve">'+E(text)+'</w:t></w:r></w:p>';}
function heading(t){para(t,'Heading1');}
function table(head,rows,widths){widths=widths||head.map(()=>Math.floor(10200/head.length));body+='<w:tbl><w:tblPr><w:tblW w:w="10200" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(k=>'<w:'+k+' w:val="single" w:sz="4" w:color="D9D9D9"/>').join('')+'</w:tblBorders><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>';for(const [ri,row]of [head,...rows].entries()){body+='<w:tr><w:trPr><w:cantSplit/>'+(ri===0?'<w:tblHeader/>':'')+'</w:trPr>';for(let i=0;i<head.length;i++)body+='<w:tc><w:tcPr><w:tcW w:w="'+widths[i]+'" w:type="dxa"/><w:vAlign w:val="center"/><w:shd w:fill="'+(ri===0?'DDE8EC':ri%2?'FFFFFF':'F5F7F8')+'"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="'+(i===0?'left':'center')+'"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/><w:szCs w:val="17"/>'+(ri===0?'<w:b/>':'')+'</w:rPr><w:t>'+E(row[i])+'</w:t></w:r></w:p></w:tc>';body+='</w:tr>';}body+='</w:tbl>';para('');}
function image(bytes,label){if(!bytes)return;imageNum++;const id='img'+imageNum,path='media/figure'+imageNum+'.png';images['word/'+path]=bytes;imageRels.push('<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="'+path+'"/>');body+='<w:p><w:r><w:drawing><wp:inline><wp:extent cx="6477000" cy="3598333"/><wp:docPr id="'+imageNum+'" name="'+E(label)+'"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+imageNum+'" name="'+E(label)+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="6477000" cy="3598333"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';}
const verdict=r=>!r.best?'無有效結果':!(r.strict?r.best.fs>r.target:r.best.fs>=r.target)?'未達門檻':r.best.negative?'須檢討張裂':'達門檻 僅限本模型';
para('邊坡穩定分析詳細計算書','Title');para(m.name,'Subtitle');
para('本計算書記錄本剖面之輸入、模型假設、三工況圓弧搜尋、逐片受力及迭代。判定以未四捨五入數值為準。'+out.results.map(r=>names[r.scenario]+' '+verdict(r)).join('；')+'。');
para('程式版本 '+(out.version||'1.1.0')+'　計算書產生時間 '+(options.date||new Date().toLocaleString('zh-TW'))+'　單位剖面寬度 1 m');
heading('一 檢核依據與結果');
para(m.profile==='custom'?'自訂依據 '+m.customSource:m.profile==='foundation-global'?'建築物基礎構造設計規範112年版 第7.4.4節 113年1月1日生效。長期FS>1.5、最高水位FS>1.2、地震FS>1.1。本程式僅套用整體穩定門檻，未建模擋土牆自重、牆體與錨力；完整擋土結構需另行分析。':'水土保持技術規範第73條　114年5月7日修正版本。永久性常時1.5、暴雨1.2、地震1.1；臨時性常時1.2、暴雨1.1、地震1.0。其他類別工程須依案件規範另行設定。');
table(['工況','計算 FS','要求 FS','判讀','有效／總候選'],out.results.map(r=>[names[r.scenario],n(r.best?.fs,8),(r.strict?'>':'≥')+n(r.target,2),verdict(r),r.valid+'/'+r.count]),[2100,1700,1500,3000,1900]);
para('方法 '+(m.method==='bishop'?'Bishop簡化法':'Fellenius普通切片法')+'。僅處理二維土坡、水平土層、圓弧滑動及有效應力。Bishop未滿足完整水平力平衡；地震係數採擬靜態簡化，正式設計需按案件規範以完整平衡及適當破壞機制複核。負有效法向力不截零，須另檢討張裂或接觸。');
heading('二 輸入資料與資料來源');
table(['項目','本模型輸入','定義與應採資料來源'],[
['地表',m.ground.length+' 個點；低側在左','x水平距離及y高程，m；測量或CAD剖面，共同高程基準'],
['均布載重','q='+n(m.q/f,4)+' '+stress+'；x='+n(m.qa,3)+'～'+n(m.qb,3)+' m','水平投影之垂直外載；施工設備、堆料、交通或基礎反力'],
['地下水',m.waterMode+'；常時深度 '+m.waterNormal+' m；暴雨深度 '+m.waterRain+' m','深度為地表以下；觀測井、壓力計或設計滲流報告。水位線及ru模式見下列資料'],
['水壓比','常時 ru='+m.ruNormal+'；暴雨 ru='+m.ruRain,'u=ru W/b；無因次。僅ru模式使用，不與靜水壓重複相加'],
['水單位重',n(m.gammaWater/f,6)+' '+weight,'γw；水體密度與單位換算'],
['地震','kh='+m.kh+'；|kv|='+m.kv,'無因次；案件規範及工址地震危害報告。比較±kv，kh向低側；q不含水平慣性'],
['求解','目標 '+m.slices+'片；密度 '+m.density,'幾何轉折、載重與層界會增加實際片數；加密比較確認精度'],
['搜尋','跨度≥'+m.minSpan+' m；深度≤'+m.maxDepth+' m；曲率比 '+m.arcMin+'～'+m.arcMax,'地表端點及圓心距／弦長比網格，三次局部細化；不保證全域最低值'],
['模式',m.mode==='manual'?'指定圓心及半徑':'搜尋圓弧','指定模式僅代表該圓弧；搜尋需擴大範圍及加密複核']],[1900,3100,5200]);
table(['地表點','x m','y m'],m.ground.map((p,i)=>[i+1,...p.map(v=>n(v,4))]),[1800,4200,4200]);
table(['土層','層底 m','c′ '+stress,'φ′ °','γ '+weight,'γsat '+weight],m.layers.map(l=>[l.name,n(l.bottom,4),n(l.c/f,4),n(l.phi,3),n(l.gamma/f,4),n(l.sat/f,4)]),[2500,1540,1540,1540,1540,1540]);
para('層底為高程而非厚度，依鑽探柱狀圖與地質剖面填列。c′有效凝聚力及φ′有效內摩擦角依直剪或三軸試驗及選定之峰值／殘餘強度；γ天然、γsat飽和單位重依土壤試驗。不得混用總應力不排水強度與有效應力孔隙水壓模型。');
if(m.waterMode==='line')for(const [key,label]of [['waterLine','常時水位線'],['rainLine','暴雨水位線']])table([label,'x m','y m'],m[key].map((p,i)=>[i+1,...p.map(v=>n(v,4))]),[1800,4200,4200]);
heading('三 幾何重量與受力公式');
for(const t of [
'yb(x)=cy−√[R²−(x−cx)²]；b=x2−x1；α=asin[(xmid−cx)/R]；l=b/cosα。地表與圓弧相交界定滑動土體；底面材料採切片中點所在層。',
'每片用三點Gauss積分，ξ={−√(3/5),0,+√(3/5)}，w={5/9,8/9,5/9}，xk=xmid+bξk/2。每層於水位分段，ΔW=γ(hi−lo)bwk/2；W=ΣΔW；yG=Σ[ΔW(hi+lo)/2]/W。',
'水位以上用γ、以下用γsat。ru模式全用輸入γ並令u=ru W/b；其餘u=γw max(yw−yb,0)。未把W改為浮單位重，孔隙水力另由u扣除。',
'Q=q max[0,min(x2,q終點)−max(x1,q起點)]；V=(1−kv)W+Q；D=Σ[V sinα+kh W(cy−yG)/R]。FS分子及D皆以力除以單位剖面寬度表示，等於總力矩除以R。',
(m.method==='bishop'?'Bishop：mα=cosα+sinα tanφ′/F；N′=(V−ub−c′l sinα/F)/mα；R抗剪=c′l+N′tanφ′；Fraw=ΣR抗剪/D。每步Fnext=(F+Fraw)/2。收斂條件 |Fraw−F|<10⁻⁸ max(1,F)，最大300步，起始F依次1.5、3、0.5，最終mα<0.2或殘差>10⁻⁶排除。':'Fellenius：N′=Vcosα−khWsinα−ul；R抗剪=c′l+N′tanφ′；FS=ΣR抗剪/D，不需迭代。'),
'收斂殘差=|ΣR抗剪−FS D|/max(1,|FS D|)。每片動員剪力T=R抗剪/FS。本文中R若帶「半徑」指圓弧半徑，R抗剪指抗剪能力；兩者不同。'
])para(t);
for(const r of out.results){const b=r.best;heading('四 '+names[r.scenario]+' 詳細計算');if(!b){para('沒有有效圓弧，不作安全判定。排除紀錄 '+JSON.stringify(r.errors));continue;}
para('FS='+n(b.fs,9)+'；要求 '+(r.strict?'>':'≥')+n(r.target,2)+'；'+verdict(r)+'。圓心 cx='+n(b.circle.cx)+' m、cy='+n(b.circle.cy)+' m；半徑 R='+n(b.circle.r)+' m；出口x='+n(b.circle.a)+' m、入口x='+n(b.circle.b)+' m；最大垂直深度='+n(b.maxDepth)+' m。');
para('本工況 kh='+(r.scenario==='seismic'?m.kh:0)+'、kv='+b.kv+'；實際切片 '+b.rows.length+'；負N′ '+b.negative+'片；力矩相對殘差 '+b.residual.toExponential(6)+'。'+(r.scenario==='seismic'?'同一圓弧±kv結果 '+b.variants.map(v=>'kv='+v.kv+' FS='+n(v.fs,9)).join('；')+'。':''));
image(options.images?.[r.scenario],names[r.scenario]+'圓弧剖面');
const sum=k=>b.rows.reduce((a,s)=>a+(s[k]||0),0),rs=sum('R'),W=sum('W'),Q=sum('Q');
para('重量ΣW='+n(W/f)+' '+force+'；ΣQ='+n(Q/f)+' '+force+'；ΣR抗剪='+n(rs/f,9)+' '+force+'；D='+n(b.D/f,9)+' '+force+'。FS=('+n(rs/f,9)+')/('+n(b.D/f,9)+')='+n(b.fs,9)+'。表內數字四捨五入，程式運算及判定使用完整精度。');
para('代表切片代入','Heading2');const s=b.rows.reduce((a,z)=>z.W>a.W?z:a,b.rows[0]),sin=Math.sin(s.alpha),cos=Math.cos(s.alpha),tan=Math.tan(s.phi*Math.PI/180);
para('第'+s.i+'片：x1='+n(s.x1)+'、x2='+n(s.x2)+'、yb='+n(s.y)+' m；b='+n(s.b)+' m；l='+n(s.l)+' m；α='+n(s.alpha*180/Math.PI)+'°。W='+n(s.W/f)+'、Q='+n(s.Q/f)+' '+force+'；u='+n(s.u/f)+'、c′='+n(s.c/f)+' '+stress+'；φ′='+n(s.phi)+'°。');
para('V=(1−'+b.kv+')×'+n(s.W/f)+'+'+n(s.Q/f)+'='+n(s.V/f)+' '+force+'；sinα='+n(sin,9)+'；cosα='+n(cos,9)+'；tanφ′='+n(tan,9)+'。');
if(m.method==='bishop'){para('mα='+n(cos,9)+'+'+n(sin,9)+'×'+n(tan,9)+'/'+n(b.fs,9)+'='+n(s.m,9)+'。');para('N′=['+n(s.V/f)+'−'+n(s.u/f)+'×'+n(s.b)+'−'+n(s.c/f)+'×'+n(s.l)+'×'+n(sin,9)+'/'+n(b.fs,9)+']/'+n(s.m,9)+'='+n(s.ne/f,9)+' '+force+'。');}else para('N′='+n(s.V/f)+'×'+n(cos,9)+'−'+(r.scenario==='seismic'?m.kh:0)+'×'+n(s.W/f)+'×'+n(sin,9)+'−'+n(s.u/f)+'×'+n(s.l)+'='+n(s.ne/f,9)+' '+force+'。');
para('R抗剪='+n(s.c/f)+'×'+n(s.l)+'+'+n(s.ne/f,9)+'×'+n(tan,9)+'='+n(s.R/f,9)+' '+force+'；T='+n(s.R/f,9)+'/'+n(b.fs,9)+'='+n(s.T/f,9)+' '+force+'。');
if(s.weightParts?.length){para('代表切片重量積分分項','Heading2');table(['xk m','wk','下界 m','上界 m','γ '+weight,'ΔW '+force,'分項重心 m'],s.weightParts.map(p=>[n(p.x,4),n(p.weight,6),n(p.lo,4),n(p.hi,4),n(p.gamma/f,4),n(p.dW/f,6),n(p.y,4)]));para('ΣΔW='+n(s.W/f,9)+' '+force+'；yG='+n(s.yg,9)+' m。全部切片Gauss分項可另匯出JSON完整計算資料。');}
para('切片幾何與重量明細','Heading2');table(['片','x1 m','x2 m','yb m','α °','b m','l m','W '+force],b.rows.map(s=>[s.i,n(s.x1,4),n(s.x2,4),n(s.y,4),n(s.alpha*180/Math.PI,4),n(s.b,4),n(s.l,4),n(s.W/f,4)]),[600,1350,1350,1350,1500,1100,1200,1750]);
para('切片水壓與有效法向力明細','Heading2');table(['片','Q '+force,'u '+stress,'c′ '+stress,'φ′ °','V '+force,'mα','N′ '+force],b.rows.map(s=>[s.i,n(s.Q/f,4),n(s.u/f,4),n(s.c/f,4),n(s.phi,3),n(s.V/f,4),n(s.m,6),n(s.ne/f,4)]),[600,1350,1350,1350,1100,1500,1300,1650]);
para('切片抗剪與驅動力明細','Heading2');table(['片','基底材料','yG m','R抗剪 '+force,'T '+force,'D分項 '+force],b.rows.map(s=>[s.i,s.layer,n(s.yg,4),n(s.R/f,4),n(s.T/f,4),n((s.V*Math.sin(s.alpha)+(r.scenario==='seismic'?m.kh:0)*s.W*(b.circle.cy-s.yg)/b.circle.r)/f,4)]),[600,2200,1500,1950,1800,2150]);
if(b.history?.length){para('迭代收斂紀錄','Heading2');para('本次收斂起始值 '+b.initial+'。ΣR以當步F計算；最後FS採收斂當步Fraw並重新計算N′及ΣR。');table(['步','F當步','ΣR '+force,'Fraw','Fnext','|Fraw−F|'],b.history.map(h=>[h.iteration,n(h.F,9),n(h.sum/f,6),n(h.raw,9),n(h.next,9),h.difference.toExponential(3)]),[650,1850,2000,1850,1850,2000]);}
para('搜尋與排除紀錄','Heading2');para('總候選 '+r.count+'；有效 '+r.valid+'；排除 '+JSON.stringify(r.errors)+'。每個工況各自搜尋。最低值只能代表本次輸入範圍，不保證全域最低。');table(['候選 FS','出口 x m','入口 x m','半徑 m'],r.top.map(t=>[n(t.fs,8),n(t.circle.a,4),n(t.circle.b,4),n(t.circle.r,4)]));}
heading('五 驗證與使用限制');
para('公式核對採用Rocscience官方七切片手算資料：乾坡原表2.113、程式2.112942660；濕坡原表最終計算表1.555、程式1.555196431。濕坡文件前段另有1.553的文字，核對以其最終計算表為準。僅驗證相同切片輸入之公式；不代表已驗證任意工程及所有破壞模式。');
para('網格加密、擴大範圍、地下水與強度敏感度應另複核。非圓弧弱層、傾斜層界、地錨土釘、岩塊、三維效應、液化、暫態滲流、快速洩降及外部積水未實作；不得以本版取代這些檢核。');
para('基礎規範112年版原文 https://www.nlma.gov.tw/ch/legislation/regsearch/962');
para('規範原文 https://law.moa.gov.tw/LawContent.aspx?id=FL014521');para('公式手算來源 https://www.rocscience.com/help/slide2/verification-theory/verification-manuals');
const section='<w:sectPr><w:footerReference w:type="default" r:id="footer"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="960" w:right="1020" w:bottom="960" w:left="1020" w:header="400" w:footer="400"/></w:sectPr>';
const style=(id,size,bold,space)=>'<w:style w:type="paragraph" w:styleId="'+id+'"><w:name w:val="'+id+'"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="'+space+'" w:after="100"/>'+(/Heading/.test(id)?'<w:keepNext/>':'')+'</w:pPr><w:rPr><w:color w:val="000000"/><w:sz w:val="'+size+'"/>'+(bold?'<w:b/>':'')+'</w:rPr></w:style>';
const files={'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
'_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'+body+section+'</w:body></w:document>',
'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="footer" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer.xml"/>'+imageRels.join('')+'</Relationships>',
'word/styles.xml':'<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Noto Sans CJK TC"/><w:sz w:val="21"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="280" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'+style('Title',38,true,0)+style('Subtitle',25,false,80)+style('Heading1',27,true,260)+style('Heading2',23,true,200)+'</w:styles>',
'word/footer.xml':'<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:sz w:val="17"/></w:rPr><w:t>邊坡穩定分析工作台　頁 </w:t></w:r><w:fldSimple w:instr="PAGE"/></w:p></w:ftr>',...images};
return zip(files);
}
root.SlopeDocx={create,zip};if(typeof module!=='undefined'&&module.exports)module.exports=root.SlopeDocx;
})(globalThis);
