// MIDAS Gen 8.7 text schema, MGT File Quick Reference, TFUNCTION,
// THLDCASE and DYN-NLOAD (manual.midasuser.com/JP/iGen/870).
// The function data type distinguishes a moment about Y from a force along Y.
// See also the English Gen 8.7 Dynamic Nodal Loads manual.
const caseName = 'BL_DYN';
const channelTypes = {FZ: {type: 3, axis: 'Z'}, MY: {type: 4, axis: 'Y'}};

function number(value) {
  if (!Number.isFinite(value)) throw Error('MIDAS Gen 歷時資料包含非有限數值。');
  return String(Number(value.toPrecision(15)));
}

export function writeMgtHistory({dt, steps, alpha, channels}) {
  if (!(dt > 0) || !Number.isInteger(steps) || steps < 1 || !(alpha >= 0))
    throw Error('MIDAS Gen 歷時的步長、步數或阻尼係數無效。');
  const endTime = dt * steps;
  const lines = [
    '; Vehicle-only incremental history; add the permanent static response once.',
    '*TFUNCTION',
  ];
  const assignments = [];
  const names = new Set();
  for (const channel of channels) {
    const {name, node, dof, samples} = channel;
    const kind = channelTypes[dof];
    if (!Object.hasOwn(channelTypes, dof) || !Number.isInteger(node) || node < 1
        || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || names.has(name) || samples.length < 2)
      throw Error('MIDAS Gen 動力節點載重的名稱、節點或函數資料無效。');
    names.add(name);
    lines.push('FUNC='+name+', 1, '+kind.type+', 1, 9.80665,');
    let previous = -Infinity;
    for (const {t,value} of samples) {
      if (!(t >= 0 && t > previous && t <= endTime + Math.max(1e-10, endTime*1e-12)))
        throw Error('MIDAS Gen 動力載重的時間必須遞增且位於分析時段內。');
      lines.push(number(t)+', '+number(value));
      previous=t;
    }
    assignments.push([node,caseName,name,kind.axis,0,1].join(', '));
  }
  // iATYPE=linear, iAMETHOD=direct integration, iTHTYPE=transient.
  // No preceding case, so permanent loads are not applied as an initial impulse.
  // iMDTYPE=2 uses C=alpha*M. iNMM=3 specifies user Newmark gamma and beta.
  lines.push('*THLDCASE', 'NAME='+caseName+', Moving vehicle only',
    ['1','2','1',number(endTime),number(dt),'1','NO','NO','','','NO','NO'].join(', '),
    ['2','1','YES',number(alpha),'NO','0','3','0.5','0.25'].join(', '),
    '*DYN-NLOAD');
  for (const assignment of assignments) lines.push(assignment);
  return lines;
}
