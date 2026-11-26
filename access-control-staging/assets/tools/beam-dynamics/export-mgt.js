// MIDAS Gen 8.7 MGT. The extended section / beam-load layouts match a Gen
// export. MGT's bSD switch controls shear deformation in the section.
// Reference: Gen MGT File Quick Reference, plus the 8.7 export in the
// CSPFea "Link Revit – Midas Gen" appendix (pp. 35–38).
import {writeMgtHistory} from './export-mgt-history.js';
import {evaluateSection} from './section-geometry.js';

const grav = 9.80665;
function number(value) {
  if (!Number.isFinite(value)) throw Error('MIDAS Gen 匯出資料包含無效數值。');
  return String(Number(value.toPrecision(15)));
}
function row(values) {
  return values.map(v => typeof v === 'number' ? number(v) : v).join(', ');
}

// D1..D4 are relative distances along the i -> j element. The placeholder
// aDir[1] in native files is ignored with eccentric loading switched off.
function beamLoad(element, type, d1, p1, d2, p2) {
  return row([element, 'BEAM', type, 'GZ', 'NO', 'NO', 'aDir[1]', '', '', '',
    d1, p1, d2, p2, 0, 0, 0, 0, '', 'NO', 0, 0, 'NO', '']);
}

// DB/User "Dimension table for User sections", MIDAS Support article
// 35809067039513. B.C is the distance between the web centrelines.
function nativeShape({type,dims}) {
  const {h,b,tw,tf,t,d}=dims;
  switch (type) {
    case 'rect': return ['SB', [h,b]];
    case 'circle': return ['SR', [d]];
    case 'tube': return ['P', [d,t]];
    case 'box': return ['B', [h,b,t,t,b-t,t]];
    case 'i': return ['H', [h,b,tw,tf,b,tf]];
    case 'channel': return ['C', [h,b,tw,tf,b,tf]];
    case 'angle': return ['L', [h,b,t,t]];
  }
}

export function mgtSectionMode(span) {
  const sec=span.section;
  if (!sec?.dims || sec.type==='general') return 'equivalent';
  // Strip the catalog identity so the idealized DBUSER dimensions are
  // compared against the *actual* area and in-plane I used in BeamLab.
  const g=evaluateSection({type:sec.type,dims:sec.dims});
  const area=span.area??span.A;
  const alignedI=sec.axis==='v'?g.Iv:g.Ih;
  const matches=(value,target)=>Math.abs(value-target)<=1e-10*Math.abs(target);
  return matches(g.A,area)&&matches(alignedI,span.I)?'shape':'equivalent';
}

export function writeMgt({nodes,spans,elements,cases,history}) {
  const lines = [
    '; BeamLab | MIDAS Gen model | kN, m, s | X along beam, Z up',
    '; Static cases are independent. Gravity loads, when enabled, are in BEAMLOAD.',
    '; BL sections reproduce vertical bending EI and mass per length.',
    '*VERSION', '8.7.0',
    '*UNIT', 'KN, M, KJ, C',
    // XZ plane, consistent mass, convert material density into element mass
    // in xyz. This option controls dynamic mass, separately from static loads.
    '*STRUCTYPE', '1, 2, 1, NO, YES, 9.80665, 0, NO, NO, NO',
    '*MATERIAL',
  ];
  for (const s of spans) {
    const materialName = s.materialName ?? 'BLMAT'+s.id;
    if (!/^[A-Za-z0-9_-]+$/.test(materialName)) throw Error('MIDAS Gen 材料名稱含有無效字元。');
    lines.push(row([s.id, 'USER', materialName, 0, 0, '', 'C', 'NO', 0,
      2, s.E*1e6, 0.3, 0, s.density*grav, s.density]));
  }
  lines.push('*SECTION');
  const angles=new Map();
  for (const s of spans) {
    const name=s.sectionName??'BLSEC'+s.id;
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw Error('MIDAS Gen 斷面名稱含有無效字元。');
    const native=mgtSectionMode(s)==='shape';
    const [shape,dims]=native?nativeShape(s.section):['SB',[s.height??s.side,s.width??s.side]];
    // +X member, beta = 0 leaves local z vertical. A quarter-turn puts
    // the original horizontal bending axis in the vertical direction.
    angles.set(s.id,native&&s.section.axis==='v'?90:0);
    if (!native) lines.push('; '+name+' equivalent rectangle: same area and selected in-plane I.');
    lines.push(row([s.id,'DBUSER',name,'CC',0,0,0,0,0,0,'NO','NO',shape,2,
      ...dims,...Array(10-dims.length).fill(0)]));
  }
  lines.push('*NODE');
  for (const n of nodes) lines.push(row([n.id,n.x,0,0]));
  lines.push('*ELEMENT');
  for (const e of elements) lines.push(row([e.id,'BEAM',e.span,e.span,e.i,e.j,angles.get(e.span),0]));
  lines.push('*CONSTRAINT');
  for (const n of nodes) {
    const flags=[n.ux,true,n.uz,true,n.ry,true].map(v=>v?'1':'0').join('');
    lines.push(row([n.id,flags,'']));
  }
  lines.push('*STLDCASE');
  for (const c of cases) {
    if (!/^[A-Za-z0-9_-]+$/.test(c.name)) throw Error('MIDAS Gen 荷重案例名稱含有無效字元。');
    const description = Number.isFinite(c.t) && Number.isFinite(c.frontX)
      ? 't=' + number(c.t) + ' s / front X=' + number(c.frontX) + ' m'
      : '';
    lines.push(row([c.name, 'USER', description]));
  }
  for (const c of cases) {
    lines.push('*USE-STLD, '+c.name);
    if (c.nodal.length) {
      lines.push('*CONLOAD');
      for(const f of c.nodal) lines.push(row([f.node,0,0,f.fz,0,f.my,0,'']));
    }
    if (c.line.length || c.point.length) {
      lines.push('*BEAMLOAD');
      for(const f of c.line) lines.push(beamLoad(f.element,'UNILOAD',0,f.w1,1,f.w2));
      for(const f of c.point) lines.push(beamLoad(f.element,'CONLOAD',f.ratio,f.fz,0,0));
    }
  }
  if (history) {
    for (const line of writeMgtHistory(history)) lines.push(line);
  }
  lines.push('*ENDDATA','');
  return lines.join('\r\n');
}
