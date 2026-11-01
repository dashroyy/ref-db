// The material datasheet: everything the site knows about one library material in one place. Properties come from
// the material library; designations and the spec builder are matched by alloy name; the galvanic index comes from the
// family and the alloy; derived figures are computed here. Units as in the library: MPa, kg/m³, 1/K, W/m·K, J/kg·K.
import type { Material } from './materials.ts';
import { metal } from './galvanic.ts';
import { baseFatigueStrength } from './fatigue.ts';

/** The alloy codes in a name, normalised: "Al 7075-T6" → ["7075t6", "7075"]; "Ti-6Al-4V (Gr 5)" → ["ti6al4v", "ti"]. */
export function alloyKeys(name: string) {
  const base = name.replace(/\(.*?\)/g, ' ');
  const keys: string[] = [];
  for (const tok of base.split(/[\s/,]+/)) {
    if (!/\d/.test(tok)) continue;
    const whole = tok.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (whole.length >= 3) keys.push(whole);
    const first = tok.split('-').find((p) => /\d/.test(p))?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (first && first.length >= 3 && first !== whole) keys.push(first);
  }
  return [...new Set(keys)];
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** True if a register entry (designations, spec builder) is the same alloy as a library material. */
export function sameAlloy(m: { name: string; family: string }, other: { name: string; family?: string }) {
  if (other.family && other.family !== m.family) return false;
  const keys = alloyKeys(m.name), o = norm(other.name);
  if (!keys.length) return norm(m.name) === o;
  // the whole code first ("ti6al4v"); a shorter part only when it is a plain number of 3 or more digits ("7075")
  return keys.some((k, i) => (i === 0 || /^\d{3,}[a-z]?$/.test(k)) && o.includes(k));
}

/** The anodic index row (src/lib/galvanic.ts) for a library material, from its family and alloy. */
export function galvanicKey(m: { name: string; family: string }) {
  const n = m.name.toLowerCase();
  switch (m.family) {
    case 'steel': return 'steel';
    case 'ss': return /\b(410|440|416|420)\b|440c/.test(n) ? 'ss12' : 'ss18';
    case 'al': return /\b2\d{3}\b/.test(n) ? 'al2' : 'al';
    case 'ti': return 'ti';
    case 'ni': return /monel/.test(n) ? 'silver' : 'cu';
    case 'mg': return 'mg';
    case 'cu': return /brass|bronze/.test(n) ? 'brass' : 'cu';
    case 'comp': return /carbon|cfrp|graphite/.test(n) ? 'cfrp' : null;
    case 'cc': return /carbon|graphite/.test(n) ? 'cfrp' : null;
    default: return null;
  }
}

/** Figures derived from the library values. Each is undefined where a property is missing. */
export function derived(m: Material) {
  const has = (...v: (number | undefined)[]) => v.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0);
  const out: Record<string, number | undefined> = {};
  if (has(m.Fty, m.rho)) out.specStrength = (m.Fty! * 1e6) / m.rho! / 1000; // kN·m/kg
  if (has(m.E, m.rho)) out.specStiffness = m.E! / m.rho!; // MJ/kg (MPa per kg/m³ = MJ/kg)
  if (has(m.Fty, m.Ftu)) out.yieldRatio = m.Fty! / m.Ftu!;
  if (has(m.k, m.rho, m.cp)) out.diffusivity = (m.k! / (m.rho! * m.cp!)) * 1e6; // mm²/s
  if (has(m.E, m.alpha)) out.thermalStress = m.E! * m.alpha! * 100; // MPa for 100 K fully constrained
  if (has(m.Fty, m.E, m.alpha)) out.shockR = (m.Fty! * (1 - (m.nu ?? 0.3))) / (m.E! * m.alpha!); // K
  if (has(m.kic, m.Fty)) {
    const s = 0.6 * m.Fty!;
    out.critCrack = (1 / Math.PI) * (m.kic! / (1.12 * s)) ** 2 * 1000; // mm, surface crack at 60% of yield
  }
  if (m.kind === 'metal' && has(m.Ftu)) {
    const b = baseFatigueStrength(m.family, m.Ftu!);
    out.endurance = b.se; out.enduranceCycles = b.nE;
  }
  return out;
}

/** The anodic index (V) and its row name, or null. */
export function galvanicFor(m: { name: string; family: string }) {
  const k = galvanicKey(m), row = k ? metal(k) : null;
  return row ? { key: row.key, name: row.name, index: row.index } : null;
}
