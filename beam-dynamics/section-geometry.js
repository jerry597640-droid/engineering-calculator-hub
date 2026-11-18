// Section axes: y right, z up, origin at the lower left of the outer bounds.
// Ih = integral (z-cz)^2 dA; Iv = integral (y-cy)^2 dA.
// Ihv denotes the integral of the product, not its negative inertia-tensor entry.
import {sectionCatalog} from './section-catalog.js';

const fields = {
  rect:['h','b'], circle:['d'], tube:['d','t'], box:['h','b','t'],
  i:['h','b','tw','tf'], channel:['h','b','tw','tf'], angle:['h','b','t']
};
const positive = x => Number.isFinite(x) && x > 0;

function dimensions(section) {
  const type = section?.type, dims = section?.dims;
  if (!Object.hasOwn(fields,type)) throw Error('不支援此斷面形式。');
  if (!dims || fields[type].some(key => !positive(dims[key]))) {
    throw Error('斷面尺寸須為有限且大於零的數值。');
  }
  const {h,b,tw,tf,t,d} = dims;
  if ((type === 'i' || type === 'channel') && !(2*tf<h && tw<b))
    throw Error('兩片翼板厚度總和須小於梁高，腹板厚度須小於翼板寬。');
  if (type === 'angle' && !(t<Math.min(b,h))) throw Error('角鋼厚度須小於兩肢長。');
  if (type === 'box' && !(2*t<Math.min(b,h))) throw Error('箱形斷面兩倍壁厚須小於外寬及外高。');
  if (type === 'tube' && !(2*t<d)) throw Error('圓管兩倍壁厚須小於外徑。');
  return dims;
}

// Non-overlapping rectangle components [lower y, lower z, width, height].
function rectangles(type,{b,h,t,tw,tf}) {
  switch (type) {
    case 'rect': return [[0,0,b,h]];
    case 'angle': return [[0,0,b,t],[0,t,t,h-t]];
    case 'box': return [[0,0,b,t],[0,h-t,b,t],[0,t,t,h-2*t],[b-t,t,t,h-2*t]];
    case 'i':
    case 'channel':
      return [[0,0,b,tf],[0,h-tf,b,tf],[type==='i'?(b-tw)/2:0,tf,tw,h-2*tf]];
  }
}

function geometricValues(type, dims) {
  if (type==='circle' || type==='tube') {
    const {d,t}=dims;
    // Factored ring formula avoids subtracting nearly equal fourth powers.
    const dInner = type==='circle' ? 0 : d-2*t;
    const A = type==='circle' ? Math.PI*d*d/4 : Math.PI*t*(d-t);
    const I = A*(d*d+dInner*dInner)/16;
    return {A,Ih:I,Iv:I,Ihv:0,cy:d/2,cz:d/2,h:d,b:d};
  }
  const {b,h}=dims, parts=rectangles(type,dims);
  let A=0, sumY=0, sumZ=0;
  for (const [y,z,w,v] of parts) {
    const a=w*v;
    A+=a; sumY+=a*(y+w/2); sumZ+=a*(z+v/2);
  }
  // Symmetric shapes use exact center coordinates. Channels are symmetric in z only.
  const cy=type==='angle'||type==='channel'?sumY/A:b/2;
  const cz=type==='angle'?sumZ/A:h/2;
  let Ih=0,Iv=0,Ihv=0;
  for (const [y,z,w,v] of parts) {
    const a = w*v, dy = y+w/2-cy, dz = z+v/2-cz;
    Ih+=a*(v*v/12+dz*dz);
    Iv+=a*(w*w/12+dy*dy);
    Ihv+=a*dy*dz;
  }
  return {A,Ih,Iv,Ihv:type==='angle'?Ihv:0,cy,cz,h,b};
}

function checkProperties({A,Ih,Iv}) {
  if (![A,Ih,Iv].every(positive)) throw Error('斷面積與兩向慣性矩必須是有限正數，請確認單位為 m²、m⁴。');
}

export function evaluateSection(section) {
  if (section?.type==='general') {
    const {A,Ih,Iv}=section.props||{};
    checkProperties({A,Ih,Iv});
    return {A,Ih,Iv,Ihv:null,cy:null,cz:null,h:null,b:null,source:'manual'};
  }
  const dims=dimensions(section), result=geometricValues(section.type,dims);
  checkProperties(result);
  if (![result.Ihv,result.cy,result.cz].every(Number.isFinite)) throw Error('斷面尺寸超出計算範圍。');

  // The trusted catalog is the sole source of tabulated properties. Never
  // reuse a cached tab from an edited model JSON or an altered preset.
  const preset = sectionCatalog.find(entry=>entry.id===section.id && entry.type===section.type);
  if (preset?.tab && fields[section.type].every(k=>{
    const reference=preset.dims[k];
    return positive(reference) && Math.abs(dims[k]-reference)<=reference*1e-12;
  })) {
    const {A,Ih,Iv}=preset.tab;
    checkProperties({A,Ih,Iv});
    // Physical upper bounds catch a misplaced cm² or cm⁴ quantity in a
    // catalog row. One percent permits rounding in manufacturer's tables.
    if (A>result.b*result.h*1.01 || Ih>A*result.h**2*.2525 || Iv>A*result.b**2*.2525) {
      throw Error('型錄斷面性質與公尺制尺寸不符。');
    }
    return {...result,A,Ih,Iv,source:'table'};
  }
  return {...result,source:'geometry'};
}

const polygon = vertices => 'M'+vertices.map(([y,z])=>y+' '+z).join(' L')+' Z';
const ring = (cy,cz,r) => 'M'+(cy+r)+' '+cz+' a'+r+' '+r+' 0 1 0 '+(-2*r)+' 0 a'+r+' '+r+' 0 1 0 '+(2*r)+' 0 Z';
const rect = (loY,loZ,hiY,hiZ) => polygon([[loY,loZ],[hiY,loZ],[hiY,hiZ],[loY,hiZ]]);

export function sectionOutline(section) {
  if (section?.type==='general') {evaluateSection(section);return null;}
  const dims=dimensions(section), {tw,tf,t,d}=dims;
  const circular=section.type==='circle'||section.type==='tube';
  const b=circular?d:dims.b, h=circular?d:dims.h;
  let path;
  switch (section.type) {
    case 'circle': path=ring(d/2,d/2,d/2);break;
    case 'tube': path=ring(d/2,d/2,d/2)+' '+ring(d/2,d/2,d/2-t);break;
    case 'rect': path=rect(0,0,b,h);break;
    case 'box': path=rect(0,0,b,h)+' '+rect(t,t,b-t,h-t);break;
    case 'angle': path=polygon([[0,0],[b,0],[b,t],[t,t],[t,h],[0,h]]);break;
    case 'channel':
      path=polygon([[0,0],[b,0],[b,tf],[tw,tf],[tw,h-tf],[b,h-tf],[b,h],[0,h]]);break;
    case 'i': {
      const yl=(b-tw)/2, yr=yl+tw;
      path=polygon([[0,0],[b,0],[b,tf],[yr,tf],[yr,h-tf],[b,h-tf],[b,h],[0,h],[0,h-tf],[yl,h-tf],[yl,tf],[0,tf]]);
      break;
    }
  }
  return {path,width:b,height:h,fillRule:'evenodd',bounds:{minY:0,minZ:0,maxY:b,maxZ:h}};
}
