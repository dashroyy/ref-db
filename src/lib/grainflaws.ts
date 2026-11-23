// Flaws in a grain. The burning area that a void, a crack or an unbond adds, the pressure that follows, and the time
// that the insulation behind a flaw sees the gas; then where in the web a flaw is acceptable: the strain field across
// the web, the concentration at a void (Goodier), and the energy release rate of a crack at the bore. 0-D ballistics of
// a tubular grain with inhibited ends. Units: mm, MPa, s. Shown and derived on /make/grain-flaws/.

import { equilibriumPressure } from './ballistics.ts';

export interface Tube { a0: number; b: number; L: number } // bore radius, outer radius, length, mm
export interface Prop { rhoP: number; a: number; n: number; cStar: number }

export type Flaw =
  | { kind: 'void'; d: number; depth: number; count?: number } // diameter; depth of its centre below the bore surface
  | { kind: 'crack'; c: number; l: number } // a radial crack open to the bore: depth c, length l along the axis
  | { kind: 'unbond'; l: number; arc: number; open: boolean }; // at the case: length l, over an arc in degrees;
// open: connected to the port at ignition, as at a termination

export const webOf = (t: Tube) => t.b - t.a0;

/**
 * The burning area that a flaw adds after a web y has burned, mm² (negative once an unbond slice has gone). By
 * Huygens' construction, a closed void that the flame reaches burns outward ahead of the main front, which then
 * carries a bump as high as the void is wide. The extra area of that bump stays πd², the area of the void, until the
 * bump reaches the case. A crack open to the bore adds its two faces, 2cl, until its tip reaches the case. An unbond
 * open to the port lets the gas burn the outer surface of the grain over its area: the slice then burns from both
 * sides, and at half the web it is gone, with its share of the bore surface.
 */
export function flawArea(f: Flaw, t: Tube, y: number): number {
  const web = webOf(t);
  if (y > web) return 0;
  if (f.kind === 'void') {
    // the bump is as high as the void is wide; the case cuts it off over the last d of the web
    const open = Math.max(0, f.depth - f.d / 2);
    return y >= open ? (f.count ?? 1) * Math.PI * f.d * f.d * Math.min(1, (web - y) / f.d) : 0;
  }
  // the faces of a crack lead the bore by c, and cannot go past the case
  if (f.kind === 'crack') return 2 * f.l * Math.max(0, Math.min(f.c, web - y));
  if (!f.open) return 0;
  const phi = Math.min(1, Math.max(0, f.arc / 360));
  if (y < web / 2) return phi * 2 * Math.PI * (t.b - y) * f.l;
  return -phi * 2 * Math.PI * (t.a0 + y) * f.l;
}

/** When the gas first reaches the insulation behind a flaw, as the web burned at that moment (mm). */
export function reachesCase(f: Flaw, t: Tube) {
  const web = webOf(t);
  if (f.kind === 'void') return Math.max(0, web - f.d);
  if (f.kind === 'crack') return Math.max(0, web - f.c);
  return f.open ? 0 : web;
}

export interface FlawBurn {
  y: number[]; t0: number[]; t: number[]; p0: number[]; p: number[]; // web, times and pressures: nominal and with flaws
  throat: number; // mm, sized for the nominal peak at the end of the burn
  peak0: number; peak: number; tPeak: number; ign0: number; ign: number;
  end: number; // burn time with the flaws, s
  exposure: number[]; // for each flaw: how long the insulation behind it sees the gas, s
}

/**
 * The burn of the tube, with and without its flaws. Every surface regresses at the same rate r = a·pⁿ, so the web
 * burned is a common clock; the pressure is the equilibrium value for the total burning area. The throat is sized so
 * that the nominal grain peaks at pPeak, at the end of its progressive burn.
 */
export function burnWithFlaws(tube: Tube, prop: Prop, pPeak: number, flaws: Flaw[], steps = 800): FlawBurn {
  const web = webOf(tube);
  const Ab0 = (y: number) => 2 * Math.PI * (tube.a0 + y) * tube.L;
  const knPeak = (1e9 * Math.pow(pPeak, 1 - prop.n)) / (prop.rhoP * prop.a * prop.cStar);
  const At = Ab0(web) / knPeak;
  const pOf = (A: number) => (A > 0 ? equilibriumPressure({ ...prop, kn: A / At }) : 0);
  const ys: number[] = [];
  for (let k = 0; k <= steps; k++) ys.push((web * k) / steps);
  // the instants where a flaw opens or ends, so that the steps of the area are on the grid
  for (const f of flaws) for (const v of [f.kind === 'void' ? Math.max(0, f.depth - f.d / 2) : 0, reachesCase(f, tube), web / 2]) if (v > 0 && v < web) ys.push(v, v - 1e-9);
  ys.sort((a, b) => a - b);
  const y = ys.filter((v, i) => i === 0 || v - ys[i - 1] > 1e-12);
  const p0 = y.map((v) => pOf(Ab0(v)));
  const p = y.map((v) => pOf(Ab0(v) + flaws.reduce((s, f) => s + flawArea(f, tube, v), 0)));
  const clock = (ps: number[]) => {
    const out = [0];
    for (let i = 1; i < y.length; i++) {
      const r1 = prop.a * Math.pow(ps[i - 1], prop.n), r2 = prop.a * Math.pow(ps[i], prop.n);
      out.push(out[i - 1] + (y[i] - y[i - 1]) / ((r1 + r2) / 2 || r1 || r2));
    }
    return out;
  };
  const t0 = clock(p0), t = clock(p);
  const end = t[t.length - 1];
  const tAtY = (yy: number) => {
    const i = y.findIndex((v) => v >= yy - 1e-12);
    return i < 0 ? end : t[i];
  };
  const iPk = p.indexOf(Math.max(...p));
  return {
    y, t0, t, p0, p, throat: 2 * Math.sqrt(At / Math.PI),
    peak0: Math.max(...p0), peak: p[iPk], tPeak: t[iPk], ign0: p0[0], ign: p[0], end,
    exposure: flaws.map((f) => end - tAtY(reachesCase(f, tube))),
  };
}

/** The pressure ratio that an added burning area gives at one instant: (1 + ΔA/A)^(1/(1−n)). */
export const areaPressureRatio = (dA: number, A: number, n: number) => Math.pow(1 + dA / A, 1 / (1 - n));

// ---------------------------------------------------------------------------
// Where a flaw is acceptable
// ---------------------------------------------------------------------------

/** Hoop strain at a depth y below the bore surface: ε(y) = ε_bore·(a/(a + y))², the field of an incompressible thick cylinder. */
export const strainAt = (epsBore: number, a: number, y: number) => epsBore * (a / (a + y)) ** 2;

/** The depth below the bore inside which a void is not acceptable: where K·ε(y)·SF is above the capability. */
export const voidFreeDepth = (epsBore: number, a: number, K: number, sf: number, cap: number) =>
  Math.max(0, a * (Math.sqrt((K * sf * epsBore) / cap) - 1));

/**
 * Goodier (1933): the stresses on the surface of a spherical cavity in an elastic solid under a remote uniaxial
 * tension S, as multiples of S. At the equator, along the load and around the cavity; at the poles, in both directions.
 */
export function goodier(nu: number) {
  const k = 2 * (7 - 5 * nu);
  return { meridional: (27 - 15 * nu) / k, hoop: (15 * nu - 3) / k, pole: -(3 + 15 * nu) / k };
}

/**
 * The strain concentration of a spherical void: the largest tangential strain at the cavity over the largest remote
 * principal strain. In uniaxial tension it is at the equator, along the load; in pure shear (±τ), at the pole of the
 * compressive axis, where the two loads add. For an incompressible solid: 23/12 = 1.92 and 5/3 = 1.67.
 */
export function voidConcentration(nu: number) {
  const g = goodier(nu);
  const uniaxial = g.meridional - nu * g.hoop;
  const sx = g.meridional - g.pole, sz = g.hoop - g.pole;
  return { uniaxial, shear: (sx - nu * sz) / (1 + nu) };
}

/**
 * The stress that opens a crack at the bore: the hoop stress of the cool-down (on the relaxed modulus) and of ignition
 * (on the fast modulus), net of the gas pressure on the crack faces. For an incompressible solid in plane strain it is
 * 4G·ε = (4/3)E·ε. MPa.
 */
export const openingStress = (Erel: number, epsTh: number, Efast: number, epsIgn: number) => (4 / 3) * (Erel * epsTh + Efast * epsIgn);

/** Energy release rate of a shallow crack of depth c (mm) at the bore, J/m²: G = 1.1215²·π·σ²·c/E′, E′ = 4E/3 at the fast rate. */
export const crackG = (sigma: number, c: number, Efast: number) => ((1.1215 ** 2 * Math.PI * sigma * sigma * c) / ((4 * Efast) / 3)) * 1000;

/** The crack depth at which G reaches the fracture energy Gc (J/m²), mm. */
export const criticalCrack = (sigma: number, Efast: number, Gc: number) => ((Gc / 1000) * ((4 * Efast) / 3)) / (1.1215 ** 2 * Math.PI * sigma * sigma);

/** Margin on a crack of depth c with a factor on the stress: K grows with √c, so MS = √(c_crit/c)/SF − 1. */
export const crackMargin = (c: number, cCrit: number, sf: number) => Math.sqrt(cCrit / c) / sf - 1;
