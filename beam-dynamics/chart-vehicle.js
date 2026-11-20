import {vehicleDrawing,vehicleDescription} from './vehicle-models.js?v=1.11.0';
// Reserve label lanes using the whole vehicle so playback never changes chart height.
export function vehicleLabelLayout(config, length, left, right, quantity) {
  const scale = (right - left) / length;
  const lanes = [];
  const labels = config.axles.map((axle, index) => {
    const text = (index + 1) + '軸 · ' + quantity(axle.p * config.factor, 'kN', 1);
    const width = Math.min(right - left, [...text].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 13 : 7.5), 8));
    return {index, text, width, position: config.direction * -axle.offset * scale};
  }).sort((a, b) => a.position - b.position);
  for (const label of labels) {
    // Extra spacing permits labels to clamp inward at either beam end.
    let lane = lanes.findIndex(end => end + 8 <= label.position - label.width);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = label.position + label.width;
    label.lane = lane;
  }
  return {labels, height: 138 + lanes.length * 22};
}

const escapeText = value => String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export function vehicleChartOverlay({layout, wheels, left, right, bottom, X, Y, result, key, quantity, time, config, front}) {
  const rail = layout.height - 5;
  const labelByIndex = new Map(layout.labels.map(label => [label.index, label]));
  const caption = vehicleDescription(config)+' · t = ' + time.toFixed(3) + ' s' + (wheels.length ? '' : ' · 輪軸均在梁外');
  let svg = '<g class="chart-vehicle" pointer-events="none"><text x="' + left + '" y="13" fill="#96530f" font-size="12">' + escapeText(caption) + '</text>';
  const frontX=X(config.direction===1?front:result.length-front);
  const drawing=vehicleDrawing(config,{frontX,scale:(right-left)/result.length,maxHeight:70,wheelY:94});
  svg+=`<defs><clipPath id="vehicle-clip-${key}"><rect x="${left}" y="20" width="${right-left}" height="96"/></clipPath></defs><g clip-path="url(#vehicle-clip-${key})">`+drawing.svg;
  for(const wheel of wheels)svg+=`<path d="M${frontX-config.direction*config.axles[wheel.axleIndex].offset*drawing.scale},${94+drawing.radius}L${X(wheel.x)},112" fill="none" stroke="#ce9b60" stroke-dasharray="3 4"/>`;
  svg+='</g>';
  svg += '<path d="M' + left + ',' + rail + 'H' + right + '" stroke="#e6c5a0" fill="none"/>';
  for (const wheel of wheels) {
    const label = labelByIndex.get(wheel.axleIndex);
    const x = X(wheel.x);
    const cx = Math.max(left + label.width / 2, Math.min(right - label.width / 2, x));
    const y = 133 + label.lane * 22;
    svg += '<g data-result-axle="' + wheel.axleIndex + '" data-x="' + wheel.x + '" data-force="' + wheel.p + '">';
    svg += '<title>' + escapeText(label.text + '，x = ' + quantity(wheel.x, 'm', 3)) + '</title>';
    svg += '<path d="M' + x + ',' + rail + 'V' + bottom + '" stroke="#cc7829" stroke-dasharray="3 4" opacity=".5"/>';
    svg += '<path d="M' + cx + ',' + (y + 3) + 'L' + x + ',' + (rail - 10) + 'V' + rail + '" stroke="#c8782b" fill="none"/>';
    svg += '<path d="M' + (x - 4) + ',' + (rail - 7) + 'L' + x + ',' + rail + 'L' + (x + 4) + ',' + (rail - 7) + 'Z" fill="#c8782b"/>';
    // Both faces remain visible where an axle or support produces a shear jump.
    const sides = wheel.x <= 0 ? [1] : wheel.x >= result.length ? [-1] : [-1, 1];
    for (const side of sides) {
      const value = result.at(wheel.x, side)[key];
      svg += '<circle cx="' + x + '" cy="' + Y(value) + '" r="3" fill="#fff7ed" stroke="#bc681f" stroke-width="1.4"/>';
    }
    svg += '<rect x="' + (cx - label.width / 2) + '" y="' + (y - 12) + '" width="' + label.width + '" height="16" rx="3" fill="#fff7ed"/>';
    svg += '<text x="' + cx + '" y="' + y + '" text-anchor="middle" fill="#96530f" font-size="12">' + escapeText(label.text) + '</text></g>';
  }
  return svg + '</g>';
}

