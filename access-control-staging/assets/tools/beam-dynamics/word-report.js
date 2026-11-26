// Creates an editable Word document using the browser's Blob and TextEncoder APIs.
const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ns = 'http://schemas.openxmlformats.org';
const word = ns + '/wordprocessingml/2006/main';
const od = ns + '/officeDocument/2006/relationships';
const packages = ns + '/package/2006/relationships';
const drawing = ns + '/drawingml/2006';
const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const textWidth = 9706; // A4 minus the two 1,100-twip margins.
const encoder = new TextEncoder();
// Some document viewers drop Chinese glyphs when a requested typeface is unavailable.
// Prefer the installed Taiwan Kai typeface; keep a portable CJK serif for other devices.
function reportTypeface() {
  const canvas = globalThis.document?.createElement('canvas');
  const context = canvas?.getContext('2d');
  if (context) {
    const sample = '梁結構斷面計算報告ABC123';
    const width = family => {
      context.font = '24px ' + family;
      return context.measureText(sample).width;
    };
    for (const family of ['標楷體', 'DFKai-SB', 'BiauKai']) {
      if (['monospace','sans-serif'].some(fallback => width('"' + family + '", ' + fallback) !== width(fallback))) return family;
    }
  }
  return 'Noto Serif CJK TC';
}

const eastFont = reportTypeface();
const font = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="' + eastFont + '" w:cs="Times New Roman"/>';

function escapeXml(text) {
  return String(text ?? '').replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textRun(text) {
  const lines = String(text ?? '').split(/\r\n?|\n/);
  return '<w:r>' + lines.map(line => '<w:t xml:space="preserve">' + escapeXml(line) + '</w:t>').join('<w:br/>') + '</w:r>';
}

function paragraph(text, style = 'Normal', alignment) {
  const align = alignment ? '<w:jc w:val="' + alignment + '"/>' : '';
  return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/>' + align + '</w:pPr>' + textRun(text) + '</w:p>';
}

function paragraphStyle(id, name, paragraphProperties, runProperties = '') {
  return '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>' + paragraphProperties + '</w:pPr><w:rPr>' + runProperties + '</w:rPr></w:style>';
}

const styles = xmlHeader + '<w:styles xmlns:w="' + word + '">' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' + font + '<w:color w:val="263339"/><w:sz w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:widowControl/><w:spacing w:after="85" w:line="275" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:rPr>' + font + '<w:sz w:val="22"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:style>' +
  paragraphStyle('Title','Title','<w:keepNext/><w:keepLines/><w:spacing w:before="20" w:after="160"/>','<w:b/><w:color w:val="000000"/><w:sz w:val="40"/>') +
  paragraphStyle('Heading1','heading 1','<w:keepNext/><w:keepLines/><w:spacing w:before="190" w:after="70"/><w:outlineLvl w:val="0"/>','<w:b/><w:color w:val="173E44"/><w:sz w:val="30"/>') +
  paragraphStyle('Heading2','heading 2','<w:keepNext/><w:keepLines/><w:spacing w:before="140" w:after="45"/><w:outlineLvl w:val="1"/>','<w:b/><w:color w:val="295C59"/><w:sz w:val="24"/>') +
  paragraphStyle('Formula','Calculation','<w:keepLines/><w:spacing w:before="35" w:after="85"/><w:ind w:left="220"/>','<w:color w:val="153B41"/>') +
  paragraphStyle('Cell','Table text','<w:spacing w:before="0" w:after="0" w:line="238" w:lineRule="auto"/>','<w:sz w:val="20"/>') +
  paragraphStyle('CellHead','Table heading','<w:spacing w:before="0" w:after="0" w:line="238" w:lineRule="auto"/>','<w:b/><w:color w:val="163D41"/><w:sz w:val="20"/>') +
  paragraphStyle('Caption','Caption','<w:spacing w:before="15" w:after="100"/>','<w:color w:val="455B62"/><w:sz w:val="19"/>') +
  '</w:styles>';

function columnWidths(count, weights) {
  const sizes = Array.from({length:count}, (_,i) => Number(weights?.[i]) > 0 && Number.isFinite(Number(weights[i])) ? Number(weights[i]) : 1);
  const sum = sizes.reduce((a,b) => a+b, 0);
  const widths = sizes.map(w => Math.floor(textWidth*w/sum));
  widths[widths.length-1] += textWidth - widths.reduce((a,b) => a+b, 0);
  return widths;
}

function table({headers = [],rows = [],widths}) {
  const columns = rows.reduce((n,row) => Math.max(n,row.length),headers.length);
  if (!columns) return '';
  const grid = columnWidths(columns,widths);
  const border = side => '<w:' + side + ' w:val="single" w:sz="4" w:color="CCD8D8"/>';
  const properties = '<w:tblPr><w:tblW w:w="' + textWidth + '" w:type="dxa"/><w:tblBorders>' + ['top','left','bottom','right','insideH','insideV'].map(border).join('') +
    '</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="45" w:type="dxa"/><w:left w:w="65" w:type="dxa"/><w:bottom w:w="45" w:type="dxa"/><w:right w:w="65" w:type="dxa"/></w:tblCellMar></w:tblPr>';
  const makeRow = (values,header) => {
    const cells = grid.map((width,i) => {
      const value = values[i] ?? '';
      const numeric = /^[+−–-]?(?:\d|\.\d)[\d,，.Ee+−–%-]*$/.test(String(value).trim());
      return '<w:tc><w:tcPr><w:tcW w:w="' + width + '" w:type="dxa"/>' +
        (header ? '<w:shd w:val="clear" w:color="auto" w:fill="E5EFEE"/>' : '') + '<w:vAlign w:val="center"/></w:tcPr>' +
        paragraph(value,header ? 'CellHead' : 'Cell', header ? 'left' : (numeric ? 'right' : 'left')) + '</w:tc>';
    }).join('');
    return '<w:tr><w:trPr><w:cantSplit/>' + (header ? '<w:tblHeader/>' : '') + '</w:trPr>' + cells + '</w:tr>';
  };
  return '<w:tbl>' + properties + '<w:tblGrid>' + grid.map(w => '<w:gridCol w:w="' + w + '"/>').join('') + '</w:tblGrid>' +
    (headers.length ? makeRow(headers,true) : '') + rows.map(row => makeRow(row,false)).join('') + '</w:tbl>';
}

function figure(block, pictures) {
  const label = String(block.title || '分析圖');
  const caption = block.description ? paragraph(block.description, 'Caption') : '';
  if (!(block.png instanceof Uint8Array) || block.png.length < 24) return paragraph(label, 'Heading2') + caption;
  const png = new DataView(block.png.buffer,block.png.byteOffset,block.png.byteLength);
  if (png.getUint32(0) !== 0x89504e47 || png.getUint32(12) !== 0x49484452) throw new Error('報告圖檔須為 PNG 格式');
  const width = png.getUint32(16), height = png.getUint32(20);
  if (!(width && height)) throw new Error('報告圖檔尺寸無效');
  const scale = Math.min((textWidth*635)/width, 3450000/height);
  const cx = Math.round(width*scale), cy = Math.round(height*scale);
  const n = pictures.push(block.png), id = 'rPic'+n;
  const props = 'name="' + escapeXml(label) + '" descr="' + escapeXml(block.description || label) + '"';
  const drawingXml = '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+n+'" '+props+'/>' +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic><a:graphicData uri="'+drawing+'/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+n+'" '+props+'/>' +
    '<pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    '</pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
  return paragraph(label,'Heading2') + drawingXml + caption;
}

function relationships(entries) {
  return xmlHeader + '<Relationships xmlns="' + packages + '">' +
    entries.map(([id,type,target]) => '<Relationship Id="'+id+'" Type="'+od+'/'+type+'" Target="'+target+'"/>').join('') + '</Relationships>';
}

function contentTypes(hasPictures) {
  const overrides = {document:'document.main',styles:'styles',footer1:'footer',fontTable:'fontTable'};
  return xmlHeader + '<Types xmlns="' + ns + '/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    (hasPictures ? '<Default Extension="png" ContentType="image/png"/>' : '') +
    Object.entries(overrides).map(([part,type]) => '<Override PartName="/word/'+part+'.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+type+'+xml"/>').join('') + '</Types>';
}

// ZIP method 0 keeps the exporter synchronous and works without a dependency or network request.
const crcTable = Uint32Array.from({length:256}, (_,i) => {
  let n=i;
  for (let bit=0;bit<8;bit++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1);
  return n >>> 0;
});

function checksum(bytes) {
  let value=0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const bodies=[], directory=[];
  let offset=0, dirLength=0;
  for (const [name,data] of files) {
    const path=encoder.encode(name), bytes=typeof data==='string' ? encoder.encode(data) : data;
    const crc=checksum(bytes), size=bytes.byteLength;
    const local=new Uint8Array(30+path.length), l=new DataView(local.buffer);
    l.setUint32(0,0x04034b50,true); l.setUint16(4,20,true); l.setUint16(12,33,true);
    l.setUint32(14,crc,true); l.setUint32(18,size,true); l.setUint32(22,size,true); l.setUint16(26,path.length,true);
    local.set(path,30);
    const central=new Uint8Array(46+path.length), c=new DataView(central.buffer);
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(14,33,true);
    c.setUint32(16,crc,true); c.setUint32(20,size,true); c.setUint32(24,size,true); c.setUint16(28,path.length,true); c.setUint32(42,offset,true);
    central.set(path,46);
    bodies.push(local,bytes); directory.push(central);
    offset+=local.length+size; dirLength+=central.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0,0x06054b50,true); e.setUint16(8,files.length,true); e.setUint16(10,files.length,true);
  e.setUint32(12,dirLength,true); e.setUint32(16,offset,true);
  return new Blob([...bodies,...directory,end],{type:mime});
}

export function wordReport(blocks) {
  const pictures = [];
  const styleByType = {title:'Title',h1:'Heading1',h2:'Heading2',p:'Normal',formula:'Formula'};
  const body = blocks.map(block => {
    if (block.type === 'table') return table(block);
    if (block.type === 'figure') return figure(block,pictures);
    if (block.type === 'page') return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    return paragraph(block.text,styleByType[block.type] || 'Normal');
  }).join('');
  const doc = xmlHeader + '<w:document xmlns:w="'+word+'" xmlns:r="'+od+'" xmlns:wp="'+drawing+'/wordprocessingDrawing" xmlns:a="'+drawing+'/main" xmlns:pic="'+drawing+'/picture"><w:body>'+body+
    '<w:sectPr><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:right="1100" w:bottom="1080" w:left="1100" w:header="430" w:footer="500" w:gutter="0"/></w:sectPr></w:body></w:document>';
  const footer = xmlHeader + '<w:ftr xmlns:w="'+word+'"><w:p><w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="right"/></w:pPr>' +
    textRun('BeamLab　｜　第 ')+'<w:fldSimple w:instr=" PAGE ">'+textRun('1')+'</w:fldSimple>'+textRun(' 頁／共 ')+'<w:fldSimple w:instr=" NUMPAGES ">'+textRun('1')+'</w:fldSimple>'+textRun(' 頁')+'</w:p></w:ftr>';
  const fonts = xmlHeader + '<w:fonts xmlns:w="'+word+'"><w:font w:name="'+eastFont+'"><w:altName w:val="'+(eastFont === 'Noto Serif CJK TC' ? '標楷體' : 'Noto Serif CJK TC')+'"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font><w:font w:name="Times New Roman"><w:altName w:val="Liberation Serif"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font></w:fonts>';
  const rels = [['rStyles','styles','styles.xml'],['rFooter','footer','footer1.xml'],['rFonts','fontTable','fontTable.xml']];
  const media = pictures.map((png,i) => {
    const path = 'media/figure-'+(i+1)+'.png';
    rels.push(['rPic'+(i+1),'image',path]);
    return ['word/'+path,png];
  });
  return zip([['[Content_Types].xml',contentTypes(pictures.length)],['_rels/.rels',relationships([['rDoc','officeDocument','word/document.xml']])],
    ['word/document.xml',doc],['word/styles.xml',styles],['word/footer1.xml',footer],['word/fontTable.xml',fonts],['word/_rels/document.xml.rels',relationships(rels)],...media]);
}

