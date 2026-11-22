// Thrust vector control with a movable nozzle on a flexible bearing. The bearing is a stack of thin rubber pads and
// metal shims on concentric spheres round the pivot. It is stiff in compression, so it carries the blow-off load of the
// nozzle, and soft in shear, so the nozzle can turn. This file gives the bearing pad by pad (the load, the pad pressure,
// the shear strains, the shim stress and the spring stiffness), the torque that the actuator must give, and the
// steering authority. Units: mm, MPa, N, N·m, kg, and degrees at the interface. Bonded-layer theory after Gent; the
// torque terms after NASA SP-8114. Shown and derived on /motor/thrust-vector-control/. Screening only.

const RAD = Math.PI / 180;
const G0 = 9.80665;

export interface Bearing {
  ri: number; // inner radius of the pads, normal to the axis, at the middle of the stack (mm)
  ro: number; // outer radius of the pads, the same way (mm)
  R: number; // radius from the pivot to the middle of the stack (mm)
  n: number; // number of rubber pads
  te: number; // thickness of one pad (mm)
  ts: number; // thickness of one shim (mm)
}

/** Compression modulus of a thin bonded pad (MPa): a long strip, 4G(1 + S²) after Gent, in series with the bulk modulus. */
export const compressionModulus = (G: number, S: number, K = Infinity) => 1 / (1 / (4 * G * (1 + S * S)) + 1 / K);

/** Aft load on the movable nozzle (N): the pressure inside the effective seal radius rs (mm), less the thrust F (N). */
export const blowOff = (pc: number, pa: number, rs: number, F: number) => (pc - pa) * Math.PI * rs * rs - F;

/**
 * Spring stiffness of one pad (N·mm per rad): a spherical band at radius R between the polar angles with cosines c1 > c2,
 * turned about a transverse axis through the pivot. The shear strain at a point is Rφ·√(1 − sin²θ cos²ψ)/t, and the
 * integral over the band gives (πGR⁴/t)·[(c1 − c2) + (c1³ − c2³)/3].
 */
export const padStiffness = (G: number, R: number, te: number, c1: number, c2: number) =>
  ((Math.PI * G * R ** 4) / te) * (c1 - c2 + (c1 ** 3 - c2 ** 3) / 3);

/** The geometry of the stack: the polar angles of the band, its height and the middle radius of each pad. */
export function bearingGeometry(b: Bearing) {
  const n = Math.round(b.n);
  const H = n * b.te + (n - 1) * b.ts;
  const valid = n >= 1 && b.te > 0 && b.ts >= 0 && b.ri > 0 && b.ro > b.ri && b.R > b.ro && H < b.R;
  const t1 = Math.asin(Math.min(1, b.ri / b.R)), t2 = Math.asin(Math.min(1, b.ro / b.R));
  const radii = valid ? Array.from({ length: n }, (_, k) => b.R - H / 2 + b.te / 2 + k * (b.te + b.ts)) : [];
  return { n, H, valid, t1, t2, c1: Math.cos(t1), c2: Math.cos(t2), radii, rm: (b.ri + b.ro) / 2, width: b.R * (t2 - t1) };
}

export interface BearingLoad {
  pc: number; // chamber pressure (MPa)
  pa: number; // ambient pressure (MPa)
  F: number; // thrust at that pressure (N); 0 for a pressure test with the throat plugged
  G: number; // shear modulus of the rubber (MPa)
  K: number; // bulk modulus of the rubber (MPa)
  delta: number; // vector angle (deg)
}

/**
 * The bearing under load, pad by pad from the pivot outward. Every pad carries the same axial load and the same torque,
 * but the pads nearer the pivot are smaller: they carry a higher pressure with a lower shape factor, and they turn
 * further. The pad nearest the pivot works hardest.
 */
export function bearing(b: Bearing, L: BearingLoad) {
  const g = bearingGeometry(b);
  const Fax = blowOff(L.pc, L.pa, g.rm, L.F), Ftest = blowOff(L.pc, L.pa, g.rm, 0);
  const proj = Math.PI * (b.ro ** 2 - b.ri ** 2); // the band projected normal to the axis, at the middle radius
  const base = g.radii.map((Rk) => {
    const s = Rk / b.R; // this pad's band is the middle band scaled by s
    const area = 2 * Math.PI * Rk * Rk * (g.c1 - g.c2); // loaded area, on the sphere
    const S = area / (2 * Math.PI * s * (b.ri + b.ro) * b.te); // loaded area / free area at its two edges
    const sigma = Fax / (proj * s * s); // pressure normal to the pad: its axial part over the band is Fax
    const Ec = compressionModulus(L.G, S, L.K);
    const gammaC = (1.5 * S * sigma) / (L.G * (1 + S * S)); // shear at the bonded edges, from the bulge
    return { R: Rk, area, S, sigma, Ec, eps: sigma / Ec, gammaC, k: padStiffness(L.G, Rk, b.te, g.c1, g.c2) / 1000 };
  });
  const K = base.length ? 1 / base.reduce((a, p) => a + 1 / p.k, 0) : NaN; // N·m per rad: the pads in series
  const T = K * L.delta * RAD; // spring torque at the vector angle
  const pads = base.map((p) => {
    const phi = T / p.k; // this pad's share of the rotation, rad
    const gammaR = (p.R * phi) / b.te; // shear strain from the rotation, in the plane of the rotation
    return { ...p, phi, gammaR, gamma: p.gammaC + gammaR };
  });
  // a shim carries the bulge of the pads on both of its faces: 0.75·σ·te/ts from each (the long-strip value)
  const shims = pads.slice(1).map((p, i) => (b.ts > 0 ? (0.75 * (pads[i].sigma + p.sigma) * b.te) / b.ts : Infinity));
  const max = (k: 'sigma' | 'gammaC' | 'gammaR' | 'gamma') => Math.max(...pads.map((p) => p[k]));
  const axial = pads.reduce((a, p) => a + p.eps * b.te, 0) / Math.cos((g.t1 + g.t2) / 2); // aft movement of the nozzle
  return {
    g, Fax, Ftest, proj, pads, shims, K, Kdeg: K * RAD, spring: T, axial,
    sigmaMax: max('sigma'), gammaC: max('gammaC'), gammaR: max('gammaR'), gamma: max('gamma'),
    shimMax: shims.length ? Math.max(...shims) : 0, Smin: Math.min(...pads.map((p) => p.S)),
  };
}

export interface Actuation {
  K: number; // spring stiffness of the bearing (N·m per rad)
  delta: number; // vector angle (deg)
  Fax: number; // blow-off load (N)
  e: number; // from the pivot to the centre of pressure, mm: + aft, which pulls the nozzle back to the middle
  m: number; // mass of the parts that move (kg)
  d: number; // their centre of gravity aft of the pivot (mm)
  I: number; // their moment of inertia about the pivot (kg·m²)
  acc: number; // axial acceleration of the vehicle (g)
  amp: number; // sine command: amplitude (deg)
  freq: number; // and frequency (Hz)
  friction: number; // friction or hysteresis torque (N·m)
  arm: number; // actuator moment arm about the pivot (mm)
  slew: number; // slew rate (deg/s)
}

/**
 * The torque that the actuator must give at the vector angle (N·m), and what it means for the actuator. The spring, the
 * offset of the pressure load and the inertial load of the nozzle under acceleration grow with the angle; friction and
 * the inertia of the moving parts come on top. Positive offset and acceleration terms pull the nozzle back to the
 * middle; negative ones push it further out.
 */
export function torqueBudget(a: Actuation) {
  const s = Math.sin(a.delta * RAD);
  const spring = a.K * a.delta * RAD;
  const offset = a.Fax * (a.e / 1000) * s;
  const accel = a.m * G0 * a.acc * (a.d / 1000) * s;
  const alpha = a.amp * RAD * (2 * Math.PI * a.freq) ** 2; // peak angular acceleration of the sine, rad/s²
  const inertia = a.I * alpha;
  const elastic = spring + offset + accel;
  const total = Math.abs(elastic) + a.friction + inertia;
  const force = total / (a.arm / 1000);
  const rate = a.arm * a.slew * RAD; // mm/s at the actuator
  const net = a.K + (a.Fax * a.e) / 1000 + (a.m * G0 * a.acc * a.d) / 1000; // N·m per rad near the middle
  return {
    spring, offset, accel, inertia, friction: a.friction, elastic, total, force, alpha, rate, net,
    stroke: 2 * a.arm * s, power: (force * rate) / 1000, stable: net > 0,
  };
}

/**
 * Steering authority: the side force and the turning moment at the full angle, the axial thrust lost, and the share of
 * the angle that trims out the misalignment. dm is the offset of the thrust line at the centre of gravity (from the
 * alignment stack) and ycg the lateral offset of the centre of gravity, both in mm, taken in line (worst case). L is the
 * distance from the pivot to the centre of gravity.
 */
export function authority(a: { F: number; delta: number; L: number; dm: number; ycg: number }) {
  const s = Math.sin(a.delta * RAD), off = a.dm + a.ycg;
  const side = a.F * s;
  const trim = off < a.L ? Math.asin(off / a.L) / RAD : NaN;
  return {
    side, moment: (side * a.L) / 1000, loss: a.F * (1 - Math.cos(a.delta * RAD)), lossPct: 100 * (1 - Math.cos(a.delta * RAD)),
    disturb: (a.F * off) / 1000, trim, left: a.delta - trim, share: trim / a.delta,
  };
}
