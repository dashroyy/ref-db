// Criticality and DFMEA: a screening classification of a part by the consequence of its failure (with the
// pressure-vessel definition of the fracture-control standards), FMEA scoring, and the value of a redundant pair of
// seals with and without a test of each seal, with common-cause failure.
import { MEDIA, gasEnergy, liquidEnergy, TNT_J_PER_KG } from './proof.ts';

export const CONSEQUENCES = [
  { key: 'cat', name: 'Catastrophic: injury, loss of life, vehicle or facility', rank: 3 },
  { key: 'crit', name: 'Critical: loss of the mission', rank: 2 },
  { key: 'marg', name: 'Marginal: degraded performance', rank: 1 },
  { key: 'neg', name: 'Negligible', rank: 0 },
] as const;
export const consequence = (k: string) => CONSEQUENCES.find((c) => c.key === k) ?? CONSEQUENCES[3];

/** Pressure-vessel definition used by NASA-STD-5019 and AIAA S-080: stored energy, design pressure, hazardous fluid. */
export const PV_ENERGY = 19310; // J (14 240 ft·lbf)
export const PV_PRESSURE = 0.69; // MPa (100 psi)

/** Energy released by the fluid at gauge pressure p (MPa) in volume V (L). */
export function fluidEnergy(p: number, V: number, medium: string) {
  const m = MEDIA.find((x) => x.key === medium) ?? MEDIA[0];
  const E = m.kind === 'gas' ? gasEnergy(p, V, m.gamma) : liquidEnergy(p, V, m.bulk);
  return { E, tnt: E / TNT_J_PER_KG, medium: m };
}

export const CLASSES = {
  A: { name: 'Class A: safety-critical', basis: 'A-basis; damage tolerance where fracture-critical', inspect: '100% NDT, first-article inspection, serialised and traceable', approve: 'Independent check and design authority' },
  B: { name: 'Class B: mission-critical', basis: 'A- or B-basis by load path', inspect: 'NDT of critical features, first-article inspection', approve: 'Design authority' },
  C: { name: 'Class C: standard', basis: 'B-basis or specification minimum', inspect: 'Sample inspection', approve: 'Normal release route' },
} as const;

/**
 * Screening classification. Class follows the consequence; a part is fracture-critical when its failure is
 * catastrophic and it is not shown to be fail-safe (or it is a pressure vessel whose burst is catastrophic).
 */
export function classify(i: { cons: string; failSafe: boolean; pressurised: boolean; p?: number; V?: number; medium?: string; hazardous?: boolean }) {
  const c = consequence(i.cons);
  const fl = i.pressurised && i.p && i.V ? fluidEnergy(i.p, i.V, i.medium ?? 'n2') : null;
  const pvWhy: string[] = [];
  if (i.pressurised) {
    if (fl && fl.E >= PV_ENERGY) pvWhy.push('stored energy');
    if ((i.p ?? 0) > PV_PRESSURE) pvWhy.push('pressure');
    if (i.hazardous) pvWhy.push('hazardous contents');
  }
  const pv = pvWhy.length > 0;
  const cls: keyof typeof CLASSES = c.rank >= 3 ? 'A' : c.rank === 2 ? 'B' : 'C';
  const fracture = c.rank >= 3 && (!i.failSafe || pv);
  return { c, cls, info: CLASSES[cls], fracture, pv, pvWhy, energy: fl };
}

export interface FmeaRow { mode: string; s: number; o: number; d: number }
/**
 * FMEA scoring: RPN = S·O·D. Rows with severity 9 or 10 need a named control whatever their RPN. Returns the rows in
 * the order to act on (severity first, then RPN) and in plain RPN order, to show the difference.
 */
export function fmea(rows: FmeaRow[], threshold?: number) {
  const r = rows.filter((x) => x.mode && x.s >= 1 && x.o >= 1 && x.d >= 1).map((x) => ({
    ...x, rpn: x.s * x.o * x.d, sev: x.s >= 9, over: threshold !== undefined && x.s * x.o * x.d >= threshold,
  }));
  const act = [...r].sort((a, b) => b.s - a.s || b.rpn - a.rpn), byRpn = [...r].sort((a, b) => b.rpn - a.rpn);
  return { rows: r, act, byRpn, actions: r.filter((x) => x.sev || x.over).length };
}

/**
 * A pair of seals. Each seal fails by a random failure q or by an assembly defect d that its test did not find
 * (coverage c). Without a test port between the seals, the joint test passes when either seal holds, so a defect in
 * one seal is never found (coverage 0). Common cause by the β-factor: Q_pair = ((1 − β)Q)² + βQ.
 */
export function sealPair(i: { q: number; d: number; c: number; beta: number; port: boolean }) {
  const single = i.q + i.d * (1 - i.c); // one seal, tested by the joint test
  const Q = i.q + i.d * (1 - (i.port ? i.c : 0));
  const indep = ((1 - i.beta) * Q) ** 2, ccf = i.beta * Q, pair = indep + ccf;
  return { single, Q, indep, ccf, pair, gain: single / pair };
}
