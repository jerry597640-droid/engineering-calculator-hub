'use strict';
// Native Office Open XML in a ZIP container; no network dependency or HTML-as-DOC rename.
const WordReport=(()=>{
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const p=(text,style='Normal')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
 function table(rows,widths){return `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:color="D9D9D9"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="85" w:type="dxa"/><w:bottom w:w="85" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map((row,i)=>`<w:tr><w:trPr><w:cantSplit/>${i===0?'<w:tblHeader/>':''}</w:trPr>${row.map((cell,j)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[j]}" w:type="dxa"/><w:vAlign w:val="center"/><w:shd w:fill="${i===0?'DFEAF2':i%2?'FFFFFF':'F5F7F9'}"/></w:tcPr>${p(cell,'TableText')}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>${p('')}`;}
 const utf=s=>new TextEncoder().encode(s);
 function zip(files){
  const pieces=[],central=[];let offset=0;
  const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;};
  const pack=(size,fields)=>{const b=new Uint8Array(size),v=new DataView(b.buffer);for(const [o,n,len]of fields)len===2?v.setUint16(o,n,true):v.setUint32(o,n,true);return b;};
  for(const [path,xml]of Object.entries(files)){const name=utf(path),data=utf(xml),sum=crc(data);const head=pack(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,0x21,2],[14,sum,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);pieces.push(head,name,data);central.push(pack(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,0x21,2],[16,sum,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]),name);offset+=head.length+name.length+data.length;}
  const centralSize=central.reduce((n,b)=>n+b.length,0),count=Object.keys(files).length;pieces.push(...central,pack(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,centralSize,4],[16,offset,4]]));const out=new Uint8Array(pieces.reduce((n,b)=>n+b.length,0));let n=0;for(const b of pieces){out.set(b,n);n+=b.length;}return out;
 }
 function build(m){
  let body=p('鋼柱構材計算報告書','Title')+p(`${m.project||'未填工程名稱'}　${m.member||'未填構材編號'}`,'Subtitle')+p(`計算者：${m.author||'未填'}　匯出時間：${m.time}`)+p(`檢核結論：${m.status}。${m.note}`)+p('本報告為目前輸入之單一 ASD 載重組合構材檢核紀錄。結論僅涵蓋已實作項目；適用範圍、未涵蓋項目及規範依據詳列於報告末。')+p('輸入條件','Heading1')+p(`斷面：${m.section}。${m.preset}`)+table([['項目','數值','單位'],...m.inputs],[3900,3260,2200])+p('逐項檢核結果','Heading1')+p(`控制需求／容量比：${m.ratio}`)+table([['檢核項目','計算值','容許值','比值','結果'],...m.checks],[2760,1500,2300,1300,1500]);
  if(m.warnings.length)body+=p('適用性與計算提示','Heading2')+m.warnings.map(s=>p(s)).join('');
  body+=p('詳細計算過程','Heading1');for(const part of m.calculations){body+=p(part.title,'Heading2');body+=part.lines.map(line=>p(line)).join('');}
  body+=p('規範依據與適用範圍','Heading1')+m.basis.map(s=>p(s)).join('')+p('引用資料','Heading2')+m.sources.map(s=>p(s)).join('')+p('計算版本：Steel Column Lab TW ASD 2026-10-01。數值以完整精度計算，報告顯示值經四捨五入。');
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files={
   '[Content_Types].xml':xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
   '_rels/.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
   'word/_rels/document.xml.rels':xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
   'word/document.xml':xml+`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1100" w:right="1440" w:bottom="1100" w:left="1440"/></w:sectPr></w:body></w:document>`,
   'word/styles.xml':xml+`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Noto Sans CJK TC"/><w:sz w:val="21"/><w:color w:val="000000"/><w:lang w:val="zh-TW" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="300" w:lineRule="auto"/><w:widowControl/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${[['Title',36,200],['Subtitle',24,160],['Heading1',28,180],['Heading2',24,120]].map(([id,size,space])=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="${id==='Title'?0:200}" w:after="${space}"/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="${size}"/></w:rPr></w:style>`).join('')}<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0" w:line="270" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`
  };return zip(files);
 }
 return {build};
})();
if(typeof module!=='undefined')module.exports=WordReport;

