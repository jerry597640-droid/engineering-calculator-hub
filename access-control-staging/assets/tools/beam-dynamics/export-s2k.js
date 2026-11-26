// SAP2000 25.2 tabular text schema. Field names were checked against CSI
// Analysis Examples 1-001 / 1-022 as exported by SAP2000 25.2.0.
// CSI Analysis Reference, "Geometric Properties and Section Stiffnesses":
// zero shear areas suppress transverse shear deformation in a General section.
const num = value => {
  if (!Number.isFinite(value)) throw Error('SAP2000 匯出值必須為有限數。');
  return String(Number(value.toPrecision(15))).replace('e', 'E');
};
const flag = value => value ? 'Yes' : 'No';
function caseLabel(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_. -]*$/.test(name)) {
    throw Error('SAP2000 荷載案例名稱須使用英文、數字、空格或底線。');
  }
  return name.includes(' ') ? '"' + name + '"' : name;
}

function materialLabel(span) {
  return caseLabel(span.materialName || ('BLMAT' + span.id));
}

function rectangleTorsion(width, height) {
  const a = Math.max(width, height), b = Math.min(width, height);
  // Saint-Venant rectangular-section series; the two out-of-plane properties
  // are provided for the native General section. Only I33 acts in this plane.
  let sum = 0;
  for (let n = 1; n <= 31; n += 2) sum += Math.tanh(n*Math.PI*a/(2*b)) / n**5;
  return a*b**3 * (1/3 - 64*b*sum/(Math.PI**5*a));
}

const nativeShapes = {
  i:'"I/Wide Flange"', channel:'Channel', angle:'Angle', rect:'Rectangular',
  box:'Box/Tube', circle:'Circle', tube:'Pipe'
};
const normalMods = '   FromFile=No   AMod=1   A2Mod=1   A3Mod=1   JMod=1   I2Mod=1   I3Mod=1   MMod=1   WMod=1';
const beamMods = '   FromFile=No   AMod=1   A2Mod=0   A3Mod=0   JMod=1   I2Mod=1   I3Mod=1   MMod=1   WMod=1';
const sectionId = s => s.sectionName || ('BLSEC' + s.id);
const isVerticalAxis = s => s.section?.axis === 'v';

export function s2kSectionMode(span) {
  if (!span.section) return 'equivalent';
  if (span.sectionProperties?.source === 'table' || span.section.type === 'general') return 'properties';
  return nativeShapes[span.section.type] && span.section.dims ? 'shape' : 'equivalent';
}

function originalShapeRow(span, name) {
  const {type,dims} = span.section;
  const circular = type === 'circle' || type === 'tube';
  let row = 'SectionName=' + caseLabel(name) + '   Material=' + materialLabel(span) +
    '   Shape=' + nativeShapes[type] + '   t3=' + num(circular ? dims.d : dims.h);
  if (!circular) row += '   t2=' + num(dims.b);
  if (type === 'tube') row += '   tw=' + num(dims.t);
  if (type === 'box' || type === 'angle') row += '   tf=' + num(dims.t) + '   tw=' + num(dims.t);
  if (type === 'channel' || type === 'i') {
    row += '   tf=' + num(dims.tf) + '   tw=' + num(dims.tw);
    if (type === 'i') row += '   t2b=' + num(dims.b) + '   tfb=' + num(dims.tf);
    row += '   FilletRadius=0';
  }
  if (span.sectionProperties?.source === 'geometry') {
    const {A,Ih,Iv}=span.sectionProperties;
    row += '   Area=' + num(A) + '   I33=' + num(Ih) + '   I22=' + num(Iv);
  }
  return row + beamMods;
}

function generalRow(s, equivalent) {
  const p = s.sectionProperties;
  // Original general/catalog properties are in the physical section axes;
  // rotate the frame below for weak-axis bending as one would a real profile.
  const h = equivalent ? s.height ?? s.side : p.h ?? Math.sqrt(12*p.Ih/p.A);
  const b = equivalent ? s.width ?? s.side : p.b ?? p.A/h;
  const i33 = equivalent ? s.I : p.Ih;
  const i22 = equivalent ? (s.width == null || s.height == null ? s.I : h*b**3/12) : p.Iv;
  // Torsion and strength properties are not supplied by an A/I catalog.
  // Torsion is restrained in the BeamLab vertical-plane model.
  const J = equivalent ? rectangleTorsion(b,h) : 0;
  return 'SectionName=' + caseLabel(sectionId(s)) + '   Material=' + materialLabel(s) +
    '   Shape=General   t3=' + num(h) + '   t2=' + num(b) + '   Area=' + num(s.area) +
    '   TorsConst=' + num(J) + '   I33=' + num(i33) + '   I22=' + num(i22) +
    '   I23=0   AS2=0   AS3=0' + normalMods;
}

export function writeS2k({nodes, spans, elements, cases, history}) {
  const lines = ['File BeamLab.s2k - planar XZ beam model'];
  function table(name, records, format) {
    if (!records.length) return;
    lines.push('', 'TABLE:  "' + name + '"');
    for (const row of records) lines.push('   ' + format(row));
  }
  // History channels are unit joint patterns scaled by signed functions.
  // Only the static position cases are assigned standalone LinStatic cases.
  const channels = history?.channels || [];
  const unitPatterns = channels.map(ch => {
    if (ch.dof !== 'FZ' && ch.dof !== 'MY') throw Error('SAP2000 歷時通道只接受 FZ 或 MY。');
    return {name: ch.name, nodal:[{node:ch.node,fz:ch.dof==='FZ'?1:0,my:ch.dof==='MY'?1:0}],line:[],point:[]};
  });
  const patterns = cases.concat(unitPatterns);

  function caseTable(name, key, format) {
    let started = false;
    for (const c of patterns) {
      if (!c[key].length) continue;
      if (!started) {
        lines.push('', 'TABLE:  "' + name + '"');
        started = true;
      }
      const pattern = caseLabel(c.name);
      for (const row of c[key]) lines.push('   ' + format(row, pattern));
    }
  }

  table('PROGRAM CONTROL', [1], () => 'ProgramName=SAP2000   Version=25.2.0   CurrUnits="KN, m, C"');
  table('ACTIVE DEGREES OF FREEDOM', [1], () => 'UX=Yes   UY=No   UZ=Yes   RX=No   RY=Yes   RZ=No');
  table('COORDINATE SYSTEMS', [1], () => 'Name=GLOBAL   Type=Cartesian   X=0   Y=0   Z=0   AboutZ=0   AboutY=0   AboutX=0');
  table('MATERIAL PROPERTIES 01 - GENERAL', spans, s =>
    'Material=' + materialLabel(s) + '   Type=Other   SymType=Isotropic   TempDepend=No');
  table('MATERIAL PROPERTIES 02 - BASIC MECHANICAL PROPERTIES', spans, s => {
    const E = s.E * 1e6;
    const nu = 0.3;
    return 'Material=' + materialLabel(s) + '   UnitWeight=' + num(s.density * 9.80665) + '   UnitMass=' + num(s.density) +
      '   E1=' + num(E) + '   G12=' + num(E/(2*(1+nu))) + '   U12=' + nu + '   A1=0';
  });
  table('MASS SOURCE', [1], () => 'MassSource=BLMASS   Elements=Yes   Masses=No   Loads=No   IsDefault=Yes');
  const spanMap = new Map(spans.map(s => [s.id,s]));
  const sections = [];
  for (const span of spans) {
    const mode = s2kSectionMode(span);
    if (mode === 'shape') {
      sections.push(originalShapeRow(span,sectionId(span)));
    } else {
      sections.push(generalRow(span,mode === 'equivalent'));
      // Dimension-only inspection shape for catalog profiles. The loaded
      // frames retain the tabulated A, Ih, Iv rather than sharp-corner values.
      if (mode === 'properties' && nativeShapes[span.section.type] && span.section.dims) {
        sections.push(originalShapeRow(span,sectionId(span) + '_GEO'));
      }
    }
  }
  table('FRAME SECTION PROPERTIES 01 - GENERAL', sections, row => row);
  table('JOINT COORDINATES', nodes, n =>
    'Joint=' + n.id + '   CoordSys=GLOBAL   CoordType=Cartesian   XorR=' + num(n.x) + '   Y=0   Z=0   SpecialJt=No');
  table('CONNECTIVITY - FRAME', elements, e =>
    'Frame=' + e.id + '   JointI=' + e.i + '   JointJ=' + e.j + '   IsCurved=No');
  table('FRAME SECTION ASSIGNMENTS', elements, e =>
    'Frame=' + e.id + '   AutoSelect=N.A.   AnalSect=' + caseLabel(sectionId(spanMap.get(e.span))) + '   MatProp=Default');
  const rotated = elements.filter(e => isVerticalAxis(spanMap.get(e.span)));
  table('FRAME LOCAL AXES ASSIGNMENTS 1 - TYPICAL', rotated, e => 'Frame=' + e.id + '   Angle=90');
  table('FRAME AUTO MESH ASSIGNMENTS', elements, e =>
    'Frame=' + e.id + '   AutoMesh=No   AtJoints=No   AtFrames=No   NumSegments=0   MaxLength=0   MaxDegrees=0');
  table('FRAME OUTPUT STATION ASSIGNMENTS', elements, e =>
    'Frame=' + e.id + '   StationType=MinNumSta   MinNumSta=5   AddAtElmInt=Yes   AddAtPtLoad=Yes');
  table('JOINT RESTRAINT ASSIGNMENTS', nodes, n =>
    'Joint=' + n.id + '   U1=' + flag(n.ux) + '   U2=Yes   U3=' + flag(n.uz) +
    '   R1=Yes   R2=' + flag(n.ry) + '   R3=Yes');

  table('LOAD PATTERN DEFINITIONS', patterns, c =>
    'LoadPat=' + caseLabel(c.name) + '   DesignType=Other   SelfWtMult=0');
  const caseRows = cases.map(c => ({name:c.name, type:'LinStatic'}));
  if (history) caseRows.push({name:'BL_DYN',type:'LinDirHist'});
  table('LOAD CASE DEFINITIONS', caseRows, c =>
    'Case=' + caseLabel(c.name) + '   Type=' + c.type + '   InitialCond=Zero   DesignType=Other   RunCase=Yes');
  table('CASE - STATIC 1 - LOAD ASSIGNMENTS', cases, c => {
    const name = caseLabel(c.name);
    return 'Case=' + name + '   LoadType="Load pattern"   LoadName=' + name + '   LoadSF=1';
  });
  caseTable('JOINT LOADS - FORCE', 'nodal', (q, pat) =>
    'Joint=' + q.node + '   LoadPat=' + pat + '   CoordSys=GLOBAL   F1=0   F2=0   F3=' + num(q.fz) +
    '   M1=0   M2=' + num(q.my) + '   M3=0');
  caseTable('FRAME LOADS - DISTRIBUTED', 'line', (q, pat) =>
    'Frame=' + q.element + '   LoadPat=' + pat + '   CoordSys=GLOBAL   Type=Force   Dir=Z   DistType=RelDist' +
    '   RelDistA=0   RelDistB=1   FOverLA=' + num(q.w1) + '   FOverLB=' + num(q.w2));
  caseTable('FRAME LOADS - POINT', 'point', (q, pat) =>
    'Frame=' + q.element + '   LoadPat=' + pat + '   CoordSys=GLOBAL   Type=Force   Dir=Z   DistType=RelDist' +
    '   RelDist=' + num(q.ratio) + '   Force=' + num(q.fz));
  if (history) {
    table('CASE - DIRECT HISTORY 1 - GENERAL', [history], h =>
      'Case=BL_DYN   OutSteps=' + num(h.steps) + '   StepSize=' + num(h.dt));
    table('CASE - DIRECT HISTORY 2 - LOAD ASSIGNMENTS', channels, ch => {
      const name = caseLabel(ch.name);
      return 'Case=BL_DYN   LoadType="Load pattern"   LoadName=' + name + '   Function=' + name +
        '   LoadSF=1   TimeFactor=1   ArrivalTime=0';
    });
    table('CASE - DIRECT HISTORY 3 - VISCOUS PROPORTIONAL DAMPING', [history], h =>
      'Case=BL_DYN   SpecifyType=Direct   MassCoeff=' + num(h.alpha) + '   StiffCoeff=0');
    // HHT alpha=0 gives Newmark average acceleration.
    table('CASE - DIRECT HISTORY 4 - INTEGRATION PARAMETERS', [history], () =>
      'Case=BL_DYN   IntMethod=HilberHughesTaylor   Gamma=0.5   Beta=0.25   Alpha=0');
    if (channels.length) {
      lines.push('', 'TABLE:  "FUNCTION - TIME HISTORY - USER"');
      for (const ch of channels) {
        const name = caseLabel(ch.name);
        for (const sample of ch.samples) {
          lines.push('   Name=' + name + '   Time=' + num(sample.t) + '   Value=' + num(sample.value));
        }
      }
    }
  }
  lines.push('', 'END TABLE DATA', '');
  return lines.join('\r\n');
}
