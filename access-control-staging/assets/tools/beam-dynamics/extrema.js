// Coefficients use the dimensionless element coordinate r = (x - a) / h.
export function hermiteCubic(values, h) {
  const [left, rotationLeft, right, rotationRight] = values;
  const delta = right - left;
  return [left, h * rotationLeft, 3 * delta - h * (2 * rotationLeft + rotationRight),
    -2 * delta + h * (rotationLeft + rotationRight)];
}

export function derivative(c) {
  return c.slice(1).map((value, i) => value * (i + 1));
}

function evaluate(c, r) {
  return c.reduceRight((sum, value) => sum * r + value, 0);
}

// Split at derivative roots so each interval is monotone, including for cubic inertial loading.
export function unitRoots(coefficients) {
  const scale = Math.max(...coefficients.map(Math.abs));
  if (!scale) return [];
  const c = coefficients.map(value => value / scale);
  while (c.length > 1 && Math.abs(c.at(-1)) < 1e-14) c.pop();
  if (c.length === 1) return [];
  if (c.length === 2) {
    const r = -c[0] / c[1];
    return r > 0 && r < 1 ? [r] : [];
  }
  const turns = unitRoots(derivative(c)), bounds = [0, ...turns, 1];
  const roots = turns.filter(r => Math.abs(evaluate(c, r)) < 1e-12);
  for (let i = 1; i < bounds.length; i++) {
    let lo = bounds[i - 1], hi = bounds[i];
    const left = evaluate(c, lo), right = evaluate(c, hi);
    if (left * right >= 0) continue;
    for (let j = 0; j < 40; j++) {
      const mid = (lo + hi) / 2;
      if (left * evaluate(c, mid) > 0) lo = mid;
      else hi = mid;
    }
    roots.push((lo + hi) / 2);
  }
  return roots.sort((a, b) => a - b);
}

export const components = [
  ['M', '彎矩', 'kN·m'], ['V', '剪力', 'kN'], ['D', '撓度', 'mm']
];
const framesCache = new WeakMap(), sweepCache = new WeakMap();

function frameBounds(result) {
  if (framesCache.has(result)) return framesCache.get(result);
  const bounds = {};
  for (const [key] of components) {
    let min = result.points[0], max = min;
    for (const p of result.points) {
      if (p[key] < min[key]) min = p;
      if (p[key] > max[key]) max = p;
    }
    bounds[key] = {min, max};
  }
  framesCache.set(result, bounds);
  return bounds;
}

// A single frame index selects the current step. A null index selects the full solved history.
export function peakSummary(analysis, frameIndex = null) {
  if (frameIndex === null && sweepCache.has(analysis)) return sweepCache.get(analysis);
  const bounds = {};
  const first = frameIndex ?? 0, last = frameIndex ?? analysis.frames.length - 1;
  for (let index = first; index <= last; index++) {
    const current = frameBounds(analysis.frames[index].result);
    for (const [key] of components) {
      const bound = bounds[key] ??= {};
      for (const direction of ['min', 'max']) {
        const pt = current[key][direction], prev = bound[direction];
        if (!prev || (direction === 'min' ? pt[key] < prev.value : pt[key] > prev.value)) {
          bound[direction] = {value:pt[key], x:pt.x, side:pt.side, frame:index};
        }
      }
    }
  }
  for (const [key] of components) {
    const b = bounds[key];
    b.control = Math.abs(b.min.value) > Math.abs(b.max.value) ? b.min : b.max;
  }
  if (frameIndex === null) sweepCache.set(analysis, bounds);
  return bounds;
}

export function peakLocation(model, analysis, key, peak) {
  const {x, side} = peak;
  const node = model.ss.findIndex(s => Math.abs(s - x) < 1e-9);
  const span = node < 0 ? model.ss.findIndex(s => s > x) : Math.max(1, Math.min(model.ss.length - 1, side < 0 ? node : node + 1));
  let label = '第 ' + span + ' 跨';
  let face = '';
  if (x > 1e-9 && x < model.L - 1e-9 && side) {
    const result = analysis.frames[peak.frame].result;
    const a = result.at(x, -1)[key], b = result.at(x, 1)[key];
    if (Math.abs(a-b) > 1e-7*Math.max(1,Math.abs(a),Math.abs(b))) {
      face = side < 0 ? '左側' : '右側';
    }
  }
  if (node > 0 && node < model.ss.length - 1 && !face) label = '第 ' + node + '、' + (node + 1) + ' 跨交界';
  if (node >= 0) label += ' · ' + String.fromCharCode(65 + node) + (model.c.supports[node] === 'free' ? ' 節點' : ' 支點');
  else if (face) label += ' · 斷面';
  return label + face;
}
