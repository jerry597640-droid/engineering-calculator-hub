// Canonical units: E in GPa, mass density in kg/m³. IDs are also usable as
// stable ASCII model labels. Strength, grade verification and load factors
// are outside the elastic beam model.
const steelProduct = 'https://www.csc.com.tw/csc/pd/doc/spec_2025.pdf';
const steelElasticity = 'https://www.nlma.gov.tw/uploads/files/29f814e938f670b39b730db3df30ebcd.pdf';
const woodCode = 'https://www.nlma.gov.tw/uploads/files/c3069fb4ce95f330816455e1f10e5b11.pdf';
const glulamGrades = 'https://www.cwcba-wqac.org.tw/forest-tech/index.php?action=resources-detail&id=74';
const buildingDensity = 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=D0070116&flno=11';

function steel(id, standard, description) {
  return {
    id, name: id + ' ' + description, kind: 'steel', E: 200, density: 7850, standard,
    notes: '線彈性 E 取鋼結構規範 §1.6 的 2,040 tf/cm²，換算約 200 GPa。鋼的靜載計算密度取 7,850 kg/m³。',
    source: steelProduct, modulusSource: steelElasticity,
    densitySource: buildingDensity, densityAssumed: false
  };
}

const woodDensityNote = '密度預設採建築構造編第 11 條針葉樹自重計算下限 500 kg/m³，動力分析宜依實際材密度輸入。';
function softwood(id, species, group, tableValue, lowSpecificGravity = false) {
  // Table 4.4-1 is in 10³ kgf/cm². Section 4.4.1 uses 80% of its value
  // for displacement calculations of a single principal or stiffness-critical member.
  const E = Number((tableValue * 0.0980665 * 0.8).toFixed(7));
  return {
    id, name: species + ' 普通結構材（單梁）', kind: 'wood', E, density: 500,
    standard: '木構造規範 §4.4.1／針葉樹' + group + '類',
    notes: '單獨主要構材變形計算，順紋 E 取表 4.4-1 的 ' + tableValue +
      ',000 kgf/cm² × 0.8。' +
      (lowSpecificGravity ? '此預設適用於氣乾比重大於 0.3，低比重材另乘 0.7。' : '') +
      woodDensityNote,
    source: woodCode, modulusSource: woodCode, densitySource: buildingDensity, densityAssumed: true
  };
}

function glulam(grade, E) {
  return {
    id: 'SUGI_' + grade, name: '柳杉集成材 ' + grade, kind: 'wood', E, density: 500,
    standard: '柳杉同等級結構用集成材／' + grade,
    notes: '同等級柳杉集成材，以分級資料的平均抗彎彈性模數計算，使用時按產品級別選取。' + woodDensityNote,
    source: glulamGrades, modulusSource: glulamGrades, densitySource: buildingDensity, densityAssumed: true
  };
}

export const materialCatalog = [
  steel('SS400', 'CNS 2473', '一般結構用鋼'),
  steel('SN400B', 'CNS 13812', '建築結構用鋼'),
  steel('SN490B', 'CNS 13812', '建築結構用鋼'),
  steel('SM490A', 'CNS 2947', '熔接結構用鋼'),
  steel('SM570', 'CNS 2947', '熔接結構用鋼'),
  steel('A36', 'ASTM A36/A36M', '結構用碳鋼'),
  softwood('SUGI_IV', '柳杉', 'Ⅳ', 70, true),
  softwood('TAIWANIA_IV', '臺灣杉', 'Ⅳ', 70, true),
  softwood('CHINA_FIR_IV', '杉木', 'Ⅳ', 70, true),
  softwood('DFIR_I', '花旗松', 'Ⅰ', 100),
  softwood('HEMLOCK_III', '北美鐵杉', 'Ⅲ', 80),
  glulam('E65-F255', 6.5),
  glulam('E75-F270', 7.5),
  glulam('E85-F300', 8.5)
];
