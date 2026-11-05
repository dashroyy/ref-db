// Motor case closures held by shear joints: a lock ring in matching grooves, radial pins through the case wall, and a
// threaded closure. Each joint carries the pressure end load over the seal diameter. Every check is a stress per unit
// of chamber pressure, so the tool can show it at MEOP and then at proof (against yield) and design burst (against
// ultimate), with the fitting factor on both. Units: MPa, mm, N. Shown and derived on /motor/closures/. Screening only.
import { internalShearArea, externalShearArea } from './threads.ts';

export interface JointMaterial { uts: number; yield: number }

/** End load on a closure sealed at diameter ds, N (p in MPa). */
export const endLoad = (p: number, ds: number) => (p * Math.PI * ds * ds) / 4;

/** Screening allowables: shear ultimate 0.6·Ftu, shear yield 0.577·Fty (von Mises). */
export const shearAllow = (m: JointMaterial) => ({ u: 0.6 * m.uts, y: 0.577 * m.yield });
/** Flat bearing of a ring on a groove face: Ftu and Fty (no credit for confinement). */
export const flatBearingAllow = (m: JointMaterial) => ({ u: m.uts, y: m.yield });
/**
 * Bearing of a pin in a hole, from the usual ratios of MMPDS bearing to tensile values: Fbru ≈ 1.5·Ftu and
 * Fbry ≈ 1.4·Fty at e/D = 1.5, rising to 1.9·Ftu and 1.7·Fty at e/D = 2 (linear between, held outside).
 */
export function pinBearingAllow(m: JointMaterial, eOverD: number) {
  const k = Math.min(1, Math.max(0, (eOverD - 1.5) / 0.5));
  return { u: m.uts * (1.5 + 0.4 * k), y: m.yield * (1.4 + 0.3 * k) };
}
const vonMises = (a: number, h: number) => Math.sqrt(a * a - a * h + h * h);

/**
 * One check of a joint: its stress per MPa of chamber pressure (so stress = s·p) and its allowables. The margin at
 * a pressure p with the fitting factor ff is allowable / (s·p·ff) − 1.
 */
export interface Check { key: string; label: string; part: string; s: number; allow: { u: number; y: number } }

/** Margins of safety of each check, at proof (yield) and design burst (ultimate). Factors null → margins null. */
export function margins(checks: Check[], meop: number, f: { proof: number | null; burst: number | null; fitting: number | null }) {
  const ok = f.proof !== null && f.burst !== null && f.fitting !== null;
  const rows = checks.map((c) => ({
    ...c,
    atMeop: c.s * meop,
    msProof: ok ? c.allow.y / (c.s * meop * f.proof! * f.fitting!) - 1 : null,
    msBurst: ok ? c.allow.u / (c.s * meop * f.burst! * f.fitting!) - 1 : null,
  }));
  const minOf = (r: (typeof rows)[number]) => Math.min(r.msProof ?? Infinity, r.msBurst ?? Infinity);
  const governing = ok ? rows.reduce((a, b) => (minOf(b) < minOf(a) ? b : a)) : null;
  return { rows, governing, ms: governing ? minOf(governing) : null };
}

export interface CaseJoint {
  ds: number; // seal diameter, mm: the pressure acts inside it
  D: number; // case bore at the joint, mm (the closure fits in it)
  t: number; // case wall at the joint (the joint ring), mm
  caseMat: JointMaterial; closureMat: JointMaterial;
}

/**
 * Lock ring (shear ring, segmented key or inserted wire) in a groove of depth g1 in the case bore and g2 in the closure.
 * h is the axial height of the ring, L the case land from the groove to the end of the case, L2 the closure land on
 * the pressure side of its groove. The net section takes the gas pressure at the groove: conservative when the seal is
 * on the pressure side of the ring.
 */
export function lockRing(j: CaseJoint & { h: number; g1: number; g2: number; L: number; L2: number; ringMat: JointMaterial }) {
  const P = endLoad(1, j.ds); // N per MPa
  const R = j.D / 2;
  const axialArea = (Math.PI / 4) * ((j.D + 2 * j.t) ** 2 - (j.D + 2 * j.g1) ** 2);
  const sA = P / axialArea, sH = (R + j.g1) / (j.t - j.g1); // per MPa: axial and hoop at the groove
  const checks: Check[] = [
    { key: 'ring', label: 'Ring shear', part: 'ring', s: P / (Math.PI * j.D * j.h), allow: shearAllow(j.ringMat) },
    { key: 'bc', label: 'Groove bearing, case', part: 'case', s: P / (Math.PI * j.g1 * (j.D + j.g1)), allow: flatBearingAllow(j.caseMat) },
    { key: 'bk', label: 'Groove bearing, closure', part: 'closure', s: P / (Math.PI * j.g2 * (j.D - j.g2)), allow: flatBearingAllow(j.closureMat) },
    { key: 'lc', label: 'Land shear-out, case', part: 'case', s: P / (Math.PI * (j.D + 2 * j.g1) * j.L), allow: shearAllow(j.caseMat) },
    { key: 'lk', label: 'Land shear-out, closure', part: 'closure', s: P / (Math.PI * (j.D - 2 * j.g2) * j.L2), allow: shearAllow(j.closureMat) },
    { key: 'net', label: 'Case net section at the groove', part: 'case', s: vonMises(sA, sH), allow: { u: j.caseMat.uts, y: j.caseMat.yield } },
  ];
  return { P, checks, valid: j.g1 < j.t && j.g2 < j.D / 2 && j.h > 0 && j.L > 0 && j.L2 > 0, sA, sH };
}

/**
 * Radial pins: n pins of diameter d through the case joint ring and the closure skirt (wall t2), in single shear. e and
 * e2 are the distances from the pin centres to the end of the case and of the skirt.
 */
export function radialPins(j: CaseJoint & { n: number; d: number; e: number; t2: number; e2: number; pinMat: JointMaterial }) {
  const P = endLoad(1, j.ds), V = P / j.n; // per pin, N per MPa
  const Dm = j.D + j.t, pitch = (Math.PI * Dm) / j.n;
  const sA = P / ((Math.PI * Dm - j.n * j.d) * j.t); // axial, across the row of holes
  const sH = ((j.D / 2) / j.t) * (pitch / Math.max(pitch - j.d, 1e-9)); // hoop in the ligaments between holes
  const checks: Check[] = [
    { key: 'pin', label: 'Pin shear', part: 'pin', s: V / ((Math.PI * j.d * j.d) / 4), allow: shearAllow(j.pinMat) },
    { key: 'bc', label: 'Bearing, case', part: 'case', s: V / (j.d * j.t), allow: pinBearingAllow(j.caseMat, j.e / j.d) },
    { key: 'bk', label: 'Bearing, closure skirt', part: 'closure', s: V / (j.d * j.t2), allow: pinBearingAllow(j.closureMat, j.e2 / j.d) },
    { key: 'sc', label: 'Shear-out, case', part: 'case', s: V / (2 * (j.e - j.d / 2) * j.t), allow: shearAllow(j.caseMat) },
    { key: 'sk', label: 'Shear-out, closure skirt', part: 'closure', s: V / (2 * (j.e2 - j.d / 2) * j.t2), allow: shearAllow(j.closureMat) },
    { key: 'net', label: 'Case net section at the pins', part: 'case', s: vonMises(sA, sH), allow: { u: j.caseMat.uts, y: j.caseMat.yield } },
  ];
  return { P, V, pitch, checks, valid: j.n >= 1 && j.d > 0 && j.e > j.d / 2 && j.e2 > j.d / 2 && pitch > j.d, sA, sH };
}

/**
 * Threaded closure: the case has the internal thread (major diameter dT, pitch P, 60° form), the closure the external
 * thread, engaged over Le. Basic-size stripping areas (FED-STD-H28 form). The case wall t is measured from the thread
 * major diameter outward. The 30° flanks also push the case outward with F·tan 30°: over the engagement that adds a
 * hoop stress F·tan 30° / (2π·Le·t), on top of the gas pressure (taken to reach the thread, which is conservative).
 */
export function threadedClosure(j: Omit<CaseJoint, 'D'> & { dT: number; pitch: number; Le: number }) {
  const P = endLoad(1, j.ds);
  const th = { d: j.dT, P: j.pitch, d2: j.dT - 0.649519 * j.pitch } as Parameters<typeof internalShearArea>[0];
  const aInt = internalShearArea(th, j.Le), aExt = externalShearArea(th, j.Le);
  const axialArea = (Math.PI / 4) * ((j.dT + 2 * j.t) ** 2 - j.dT ** 2);
  const sFlank = (P * Math.tan(Math.PI / 6)) / (2 * Math.PI * j.Le * j.t);
  const sA = P / axialArea, sH = (j.dT / 2) / j.t + sFlank;
  const checks: Check[] = [
    { key: 'tc', label: 'Thread shear, case (internal)', part: 'case', s: P / aInt, allow: shearAllow(j.caseMat) },
    { key: 'tk', label: 'Thread shear, closure (external)', part: 'closure', s: P / aExt, allow: shearAllow(j.closureMat) },
    { key: 'net', label: 'Case net section at the thread', part: 'case', s: vonMises(sA, sH), allow: { u: j.caseMat.uts, y: j.caseMat.yield } },
  ];
  return { P, aInt, aExt, checks, sFlank, valid: j.pitch > 0 && j.Le > 0 && j.t > 0, threads: j.Le / j.pitch };
}
