// Bolted joints: torque and preload, bolt and member stiffness, the joint diagram and load factor, separation,
// tightening stress, the change of preload with temperature, and margins. Methods after VDI 2230 and Shigley,
// simplified to one bolt, concentric axial load and one clamped material. Units: mm, N, MPa, °C.
// Factors and preload uncertainty are always inputs — they come from the programme's requirements.
import { withProps } from './materials.ts';
import { THREAD_DB } from './threaddb.ts';

/** name is the thread library key ("M10", "M10x1.25", "1/4-28 UNF"); label is for display. */
export interface Thread { name: string; label?: string; family?: string; d: number; P: number; d2: number; d3: number; As: number }

/** ISO metric thread: pitch and minor diameters, and the tensile stress area. */
export function metricThread(name: string, d: number, P: number): Thread {
  const d2 = d - 0.649519 * P, d3 = d - 1.226869 * P;
  return { name, d, P, d2, d3, As: (Math.PI / 4) * ((d2 + d3) / 2) ** 2 };
}
/** Every thread of the thread library (src/lib/threaddb.ts): metric coarse and fine, MJ, UNC, UNF, UNJC, UNJF. */
export const THREADS: Thread[] = THREAD_DB.map((t) => ({ name: t.key, label: t.label, family: t.family, d: t.d, P: t.P, d2: t.d2, d3: t.d3, As: t.As }));

/** Bolt property classes and stainless grades: minimum yield (or 0.2% proof) and tensile strength, MPa (ISO 898-1, ISO 3506). */
export const GRADES = [
  { key: '8.8', name: 'Class 8.8 (d ≤ 16)', Rp: 640, Rm: 800 },
  { key: '10.9', name: 'Class 10.9', Rp: 940, Rm: 1040 },
  { key: '12.9', name: 'Class 12.9', Rp: 1100, Rm: 1220 },
  { key: 'A4-70', name: 'Stainless A4-70', Rp: 450, Rm: 700 },
  { key: 'A4-80', name: 'Stainless A4-80', Rp: 600, Rm: 800 },
] as const;

/** Elastic modulus (MPa) and expansion coefficient (1/°C) at room temperature: the metals of the material library. */
export const MATERIALS = withProps(['E', 'alpha'], ['metal']).map((m) => ({ key: m.key, name: m.name, family: m.family, E: m.E!, alpha: m.alpha!, nu: m.nu }));

/**
 * Torque to preload, long form: T = F·[P/2π + μt·d2/(2 cos 30°) + μb·Dkm/2].
 * Returns the preload and how the torque divides between stretching the bolt and the two friction surfaces.
 */
export function torquePreload(T: number, t: Thread, muThread: number, muHead: number, dw: number, dh: number) {
  const pitch = t.P / (2 * Math.PI);
  const thread = (muThread * t.d2) / (2 * Math.cos(Math.PI / 6));
  const head = (muHead * (dw + dh)) / 4;
  const sum = pitch + thread + head;
  const F = T / sum;
  return { F, K: T / (F * t.d), split: { pitch: pitch / sum, thread: thread / sum, head: head / sum }, threadTorque: F * (pitch + thread) };
}

/** Bolt stiffness (N/mm): head, unthreaded shank, threaded length in the grip, engaged thread and nut (VDI 2230 end allowances). */
export function boltStiffness(t: Thread, E: number, grip: number, shank: number) {
  const Ad = (Math.PI / 4) * t.d ** 2, A3 = (Math.PI / 4) * t.d3 ** 2;
  const ls = Math.min(Math.max(shank, 0), grip), lt = grip - ls;
  const c = (0.5 * t.d) / Ad + ls / Ad + lt / A3 + (0.5 * t.d) / A3 + (0.4 * t.d) / Ad;
  return E / c;
}

/** Clamped-member stiffness (N/mm): two 30° pressure cones from the bearing faces meeting mid-grip (Shigley). */
export function memberStiffness(d: number, dw: number, grip: number, E: number) {
  const ta = Math.tan(Math.PI / 6);
  const ratio = ((grip * ta + dw - d) * (dw + d)) / ((grip * ta + dw + d) * (dw - d));
  return (Math.PI * E * d * ta) / (2 * Math.log(ratio));
}

/** Load factor Φ: the share of an external axial load that reaches the bolt while the joint stays closed. */
export const loadFactor = (kb: number, km: number) => kb / (kb + km);

/** Bolt load and clamp force under an external axial load P; after separation the bolt carries all of P. */
export function jointState(F: number, P: number, phi: number) {
  const Psep = F / (1 - phi);
  return P < Psep ? { bolt: F + phi * P, clamp: F - (1 - phi) * P, separated: false, Psep } : { bolt: P, clamp: 0, separated: true, Psep };
}

/** Preload change for a temperature change: positive when the members expand more than the bolt. */
export function thermalPreload(dT: number, alphaMember: number, alphaBolt: number, grip: number, kb: number, km: number) {
  return (alphaMember - alphaBolt) * dT * grip * ((kb * km) / (kb + km));
}

/** Von Mises stress in the bolt while tightening: tension on As plus thread torsion on the stress-area diameter. */
export function tighteningStress(F: number, threadTorque: number, t: Thread) {
  const ds = (t.d2 + t.d3) / 2;
  const sigma = F / t.As, tau = (16 * threadTorque) / (Math.PI * ds ** 3);
  return { sigma, tau, vm: Math.sqrt(sigma * sigma + 3 * tau * tau) };
}

export interface MarginInputs {
  Fmin: number; Fmax: number; P: number; phi: number; As: number; Rp: number; Rm: number;
  fsSep: number | null; fsYield: number | null; fsUlt: number | null; special: number; // special: fitting factor etc., multiplies yield and ultimate
}

/** Separation, yield and ultimate margins. Null where the user has not entered the factor. */
export function boltMargins(m: MarginInputs) {
  const sep = m.fsSep === null ? null : m.Fmin / (m.fsSep * (1 - m.phi) * m.P) - 1;
  const at = (fs: number | null, allow: number) => {
    if (fs === null) return null;
    const s = jointState(m.Fmax, fs * m.special * m.P, m.phi);
    return { load: s.bolt, separated: s.separated, ms: (allow * m.As) / s.bolt - 1 };
  };
  return { sep, yield: at(m.fsYield, m.Rp), ult: at(m.fsUlt, m.Rm) };
}
