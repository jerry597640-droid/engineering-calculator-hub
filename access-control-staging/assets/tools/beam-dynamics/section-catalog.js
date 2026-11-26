// Catalog dimensions are entered in millimetres, areas in cm², and second
// moments in cm⁴ as published. Consumers receive SI units throughout.
const hSource = 'https://www.tunghosteel.com/Files/papp/400/%E6%9D%B1%E5%92%8CH%E5%9E%8B%E9%8B%BC%E5%9E%8B%E9%8C%84%28%E7%B2%BE%E7%B0%A1%E7%89%88%29.pdf';
const channelSource = 'https://www.tunghosteel.com/Files/papp/400/%E5%9E%8B%E9%8B%BC%E7%B0%A1%E6%98%93%E9%9B%BB%E5%AD%90%E5%9E%8B%E9%8C%84%282025%E7%89%88%29.pdf';
const angleSource = 'https://www.jfe-steel.co.jp/products/building/assets/pdf/shapes/angle-danmen.pdf';
const angleProduct = 'https://www.industry.gov.au/sites/default/files/adc/public-record/584_-_feng_hsin_-_exhibit_a-2.11-b_product_catalogue.pdf';
const tubeSource = 'https://www.shinyangsteel.com.tw/upload/catalog_web/CNS4435_G3102%28TW%29.pdf';

const sectionKinds = {
  i: {prefix: 'H', source: hSource, notes: '東和鋼鐵 CNS 1490／JIS G 3192 熱軋 H 型鋼，採含根部圓角的表列性質。'},
  channel: {prefix: 'C', source: channelSource, notes: '東和鋼鐵漸變翼厚熱軋槽鋼，採含翼緣斜度及圓角的表列性質。'},
  angle: {prefix: 'L', source: angleSource, notes: '豐興鋼鐵同尺寸等邊角鋼。性質採 JFE 表列值，兩軸平行角肢且通過重心。平面分析假設側向彎曲及扭轉受拘束。'},
  tube: {prefix: 'CHS', source: tubeSource, notes: '鑫陽鋼鐵 CNS 4435 表六。以公稱外徑、壁厚按理想同心圓環公式計算斷面性質。'}
};

function entry(type, mm, properties) {
  const {prefix, source, notes} = sectionKinds[type];
  const dimensions = Object.values(mm);
  const dims = Object.fromEntries(Object.entries(mm).map(([key, value]) => [key, value / 1000]));
  const section = {
    id: prefix + '_' + dimensions.join('x').replaceAll('.', 'p'),
    name: prefix + ' ' + dimensions.join('×') + ' mm',
    type, dims, source, notes
  };
  if (properties) {
    const [areaCm2, horizCm4, vertCm4] = properties;
    section.tab = {A: areaCm2 / 1e4, Ih: horizCm4 / 1e8, Iv: vertCm4 / 1e8, dims: {...dims}};
  }
  if (type === 'angle') section.productSource = angleProduct;
  return section;
}

export const sectionCatalog = [
  entry('i', {h: 100, b: 100, tw: 6, tf: 8}, [21.59, 378, 134]),
  entry('i', {h: 200, b: 100, tw: 5.5, tf: 8}, [26.67, 1810, 134]),
  entry('i', {h: 200, b: 200, tw: 8, tf: 12}, [63.53, 4720, 1600]),
  entry('i', {h: 250, b: 125, tw: 6, tf: 9}, [36.97, 3960, 294]),
  entry('i', {h: 300, b: 150, tw: 6.5, tf: 9}, [46.78, 7210, 508]),
  entry('i', {h: 350, b: 175, tw: 7, tf: 11}, [62.91, 13500, 984]),
  entry('channel', {h: 150, b: 75, tw: 6.5, tf: 10}, [23.71, 861, 117]),
  entry('channel', {h: 200, b: 80, tw: 7.5, tf: 11}, [31.33, 1950, 168]),
  entry('channel', {h: 250, b: 90, tw: 9, tf: 13}, [44.07, 4180, 294]),
  entry('angle', {h: 40, b: 40, t: 5}, [3.755, 5.42, 5.42]),
  entry('angle', {h: 50, b: 50, t: 5}, [4.802, 11.1, 11.1]),
  entry('angle', {h: 65, b: 65, t: 6}, [7.527, 29.4, 29.4]),
  entry('tube', {d: 60.5, t: 3.2}),
  entry('tube', {d: 114.3, t: 4.5}),
  entry('tube', {d: 165.2, t: 6})
];
