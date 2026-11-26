// Multipliers convert the solver's fixed units to the selected display units.
const forceScale = { kN: 1, kgf: 1 / 0.00980665, tf: 1 / 9.80665 };
const lengthScale = { m: 1, cm: 100 };
const massScale = { kg: 1, t: 0.001 };
const deflectionScale = { mm: 1, cm: 0.1, m: 0.001 };
export const defaultUnits = { force: 'kN', length: 'm', mass: 'kg', deflection: 'mm' };
export function unitSystem(preferences = {}) {
  const prefs = { ...defaultUnits };
  for (const [key, choices] of Object.entries({force: forceScale, length: lengthScale, mass: massScale, deflection: deflectionScale})) {
    if (Object.hasOwn(choices, preferences?.[key])) prefs[key] = preferences[key];
  }
  const { force, length, mass, deflection } = prefs;
  const f = forceScale[force], l = lengthScale[length];
  const table = {
    m: [length, l], kN: [force, f], mm: [deflection, deflectionScale[deflection]],
    'kN·m': [`${force}·${length}`, f * l], 'kN/m': [`${force}/${length}`, f / l],
    'kg/m': [`${mass}/${length}`, massScale[mass] / l], 'm⁴': [`${length}⁴`, l ** 4],
    GPa: force === 'kN' ? ['GPa', 1] : [`${force}/${length}²`, 1e6 * f / l ** 2],
  };
  return { prefs, label: key => table[key][0], show: (key, value) => value * table[key][1], base: (key, value) => value / table[key][1] };
}
export const resultDimensions = { M: 'kN·m', T: 'kN·m', R: 'kN', V: 'kN', D: 'mm' };
export function displayNumber(value, digits = 2) {
  if (value !== 0 && Math.abs(value) < 10 ** -digits) return Number(value.toPrecision(3)).toString();
  return value.toFixed(digits);
}
