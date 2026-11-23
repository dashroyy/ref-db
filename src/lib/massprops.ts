// Mass properties of a solid motor through the burn. A table of parts and a burning grain give the mass, the centre of
// gravity and the moments of inertia at each point of the burn, and a bore that is off the axis of the case gives a
// lateral offset that grows until the web burns through. Also the reduction of the measurements: weighing on two
// supports, the lateral offset by turning the motor 180°, and the moments of inertia by a filar or a compound pendulum.
// Units: kg, mm, kg·m² and s unless stated. Shown and derived on /motor/mass-properties/.

export const G0 = 9.80665;

/**
 * One line of the mass properties table: the mass, the centre of gravity on the axis (x, mm from the forward reference,
 * aft positive), its lateral offset y (mm), and the radii of gyration about its own centre of gravity: kr about an axis
 * parallel to the motor axis (roll) and kp about a transverse axis (pitch), mm.
 */
export interface Part { name?: string; m: number; x: number; y?: number; kr: number; kp: number }

/** Mass properties of a set of parts: Ir in roll and Ip in pitch, both about the combined centre of gravity, kg·m². */
export interface Props { m: number; x: number; y: number; Ir: number; Ip: number }

/** Combine parts: the moments of the masses, and the parallel-axis theorem for the inertias. */
export function combine(parts: Part[]): Props {
  const m = parts.reduce((s, p) => s + p.m, 0);
  if (!(m > 0)) return { m: 0, x: NaN, y: NaN, Ir: 0, Ip: 0 };
  const x = parts.reduce((s, p) => s + p.m * p.x, 0) / m;
  const y = parts.reduce((s, p) => s + p.m * (p.y ?? 0), 0) / m;
  const Ir = parts.reduce((s, p) => s + p.m * (p.kr * p.kr + ((p.y ?? 0) - y) ** 2), 0) * 1e-6;
  const Ip = parts.reduce((s, p) => s + p.m * (p.kp * p.kp + (p.x - x) ** 2 + ((p.y ?? 0) - y) ** 2), 0) * 1e-6;
  return { m, x, y, Ir, Ip };
}

/** A set of parts as one line of the table, with the radii of gyration that give its inertias about its own CG. */
export function asPart(name: string, parts: Part[]): Part {
  const c = combine(parts);
  return { name, m: c.m, x: c.x, y: c.y, kr: Math.sqrt((c.Ir * 1e6) / c.m), kp: Math.sqrt((c.Ip * 1e6) / c.m) };
}

// ---------------------------------------------------------------------------
// Shapes: radii of gyration about the part's own centre of gravity (mm)
// ---------------------------------------------------------------------------

/** A thin cylindrical shell of radius R and length L. */
export const shellCylinder = (R: number, L: number) => ({ kr: R, kp: Math.sqrt((R * R) / 2 + (L * L) / 12) });

/** A thick tube: bore radius a, outer radius b, length L (a = 0 for a solid cylinder). */
export const tube = (a: number, b: number, L: number) => ({
  kr: Math.sqrt((a * a + b * b) / 2),
  kp: Math.sqrt((a * a + b * b) / 4 + (L * L) / 12),
});

/**
 * A thin dome: half an ellipsoid of revolution with radius R at its base and depth h (h = R is a hemisphere, h = R/2 a
 * 2:1 ellipsoidal head). Integrated along the meridian: c is the distance of its centre of gravity from the base plane,
 * kr and kp its radii of gyration about its own centre of gravity, and area its surface area (mm²).
 */
export function domeShell(R: number, h: number, n = 4000) {
  let A = 0, Az = 0, Ar2 = 0, Az2 = 0;
  const dphi = Math.PI / 2 / n;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) * dphi, r = R * Math.sin(f), z = h * Math.cos(f);
    const dA = 2 * Math.PI * r * Math.hypot(R * Math.cos(f), h * Math.sin(f)) * dphi;
    A += dA; Az += dA * z; Ar2 += dA * r * r; Az2 += dA * z * z;
  }
  const c = Az / A;
  // a ring of radius r about the axis: r²; about a transverse axis through the CG: r²/2 + (z − c)²
  return { c, kr: Math.sqrt(Ar2 / A), kp: Math.sqrt(Ar2 / A / 2 + Az2 / A - c * c), area: A };
}

// ---------------------------------------------------------------------------
// The grain as it burns
// ---------------------------------------------------------------------------

export interface Grain {
  kind: 'radial' | 'end'; // a tube that burns from its bore (inhibited ends), or an end burner that burns from its aft face
  R: number; // outer radius, mm
  a0: number; // bore radius as cast, mm (radial)
  L: number; // length, mm
  x0: number; // forward end of the grain, mm from the forward reference
  rho: number; // density, kg/m³
  e: number; // offset of the bore from the axis of the case, mm (radial)
}

/**
 * The part of a disc (radius R, centred on the axis) that lies outside a circle of radius a whose centre is e off the
 * axis: its area (mm²), its first moment about the axis toward the side of the offset (mm³; negative, because the hole
 * is on that side), and the length of the arc of the circle inside the disc, which is the burning perimeter (mm). Exact:
 * the overlap of the two circles is a segment of each, cut by their common chord.
 */
export function discLessCircle(R: number, a: number, e: number) {
  const s = e < 0 ? -1 : 1, d = Math.abs(e);
  if (!(a > 0)) return { area: Math.PI * R * R, mom: 0, arc: 0 };
  if (a + d <= R) return { area: Math.PI * (R * R - a * a), mom: d > 0 ? -s * Math.PI * a * a * d : 0, arc: 2 * Math.PI * a };
  if (a >= R + d) return { area: 0, mom: 0, arc: 0 };
  if (a + R <= d) return { area: Math.PI * R * R, mom: 0, arc: 0 };
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const xc = (d * d + R * R - a * a) / (2 * d); // the common chord, from the axis toward the centre of the circle
  const t0 = Math.acos(clamp(xc / R)), t1 = Math.acos(clamp((d - xc) / a));
  const S0 = R * R * (t0 - Math.sin(t0) * Math.cos(t0)), M0 = (2 / 3) * R ** 3 * Math.sin(t0) ** 3;
  const S1 = a * a * (t1 - Math.sin(t1) * Math.cos(t1)), M1 = S1 * d - (2 / 3) * a ** 3 * Math.sin(t1) ** 3;
  return { area: Math.PI * R * R - (S0 + S1), mom: -s * (M0 + M1), arc: 2 * a * t1 };
}

/** The web: to the first contact with the case, and to the last propellant (mm). */
export function webOf(g: Grain) {
  if (g.kind === 'end') return { web: g.L, burnout: g.L };
  const d = Math.abs(g.e);
  return { web: Math.max(0, g.R - d - g.a0), burnout: g.R + d - g.a0 };
}

/** The propellant after a web y has burned, as one line of the table, with its burning area (mm²). */
export function grainAt(g: Grain, y: number): Part & { area: number; burning: number } {
  const k = (g.rho * 1e-9); // kg/mm³
  if (g.kind === 'end') {
    const Lr = Math.max(0, g.L - y), A = Math.PI * g.R * g.R;
    return { name: 'propellant', m: k * A * Lr, x: g.x0 + Lr / 2, y: 0, ...tube(0, g.R, Lr), area: A, burning: Lr > 0 ? A : 0 };
  }
  const a = g.a0 + Math.max(0, y), s = discLessCircle(g.R, a, g.e);
  // inertias: the concentric tube of the same section area (exact with no offset; the offset is small)
  const aEq = Math.sqrt(Math.max(0, g.R * g.R - s.area / Math.PI));
  return {
    name: 'propellant', m: k * s.area * g.L, x: g.x0 + g.L / 2, y: s.area > 0 ? s.mom / s.area : 0,
    ...tube(aEq, g.R, g.L), area: s.area, burning: s.arc * g.L,
  };
}

export interface BurnPoint {
  y: number; // web burned, mm
  burned: number; // fraction of the propellant burned
  grain: Part;
  motor: Props;
  vehicle: Props | null;
}

export interface BurnOptions {
  payload?: Part[]; // the parts above the motor, for the vehicle
  n?: number;
}

/** Mass properties from ignition to burnout, with the instant at which the web first burns through. */
export function throughBurn(inert: Part[], g: Grain, o: BurnOptions = {}) {
  const n = o.n ?? 200, w = webOf(g);
  const ys = Array.from({ length: n + 1 }, (_, i) => (w.burnout * i) / n);
  if (w.web > 0 && w.web < w.burnout && !ys.includes(w.web)) ys.push(w.web);
  ys.sort((a, b) => a - b);
  const m0 = grainAt(g, 0).m;
  const at = (y: number): BurnPoint => {
    const gp = grainAt(g, y);
    return {
      y, burned: m0 > 0 ? 1 - gp.m / m0 : 0, grain: gp,
      motor: combine([...inert, gp]),
      vehicle: o.payload && o.payload.length ? combine([...inert, gp, ...o.payload]) : null,
    };
  };
  const points = ys.map(at);
  const ref = (p: BurnPoint) => p.vehicle ?? p.motor;
  const peak = points.reduce((a, b) => (Math.abs(ref(b).y) > Math.abs(ref(a).y) ? b : a), points[0]);
  // ignition, the instant the web first burns through, the end, and the largest lateral offset; web lengths in mm
  return { points, ignition: points[0], webOut: at(w.web), end: points[points.length - 1], peak, web: w.web, burnout: w.burnout };
}

/**
 * Steering: the trim angle (degrees) that holds a thrust line offset d at the centre of gravity and a lateral offset y
 * of the centre of gravity, on the same side, with the pivot a distance arm aft of the centre of gravity:
 * δ = asin((d + |y|)/arm), as on the Thrust vector control page.
 */
export const trimAngle = (d: number, y: number, arm: number) => (arm > 0 ? (Math.asin(Math.min(1, (Math.abs(d) + Math.abs(y)) / arm)) * 180) / Math.PI : NaN);

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/** Weighing on two supports at x1 and x2 (readings net of the fixture, kg): the mass and the axial CG. */
export function weighTwo(r1: number, x1: number, r2: number, x2: number) {
  const m = r1 + r2;
  return { m, x: (r1 * x1 + r2 * x2) / m };
}

/** The reversal method: an offset read with the motor at 0° and again turned 180° about its axis. The error of the
 * fixture is the same in both and cancels: half the difference is the motor, half the sum is the fixture. */
export const flip180 = (y0: number, y180: number) => ({ y: (y0 - y180) / 2, fixture: (y0 + y180) / 2 });

/** A filar (bifilar or trifilar) torsion pendulum: I = m·g·r²·T²/(4π²·h), with r the radius of the wires from the
 * axis and h their length (m), m the suspended mass (kg) and T the period (s). kg·m². */
export const filar = (m: number, r: number, h: number, T: number) => (m * G0 * r * r * T * T) / (4 * Math.PI ** 2 * h);

/** The period of a filar pendulum, to plan a measurement. */
export const filarPeriod = (I: number, m: number, r: number, h: number) => 2 * Math.PI * Math.sqrt((I * h) / (m * G0 * r * r));

/** A compound pendulum swung about a pivot a distance d (m) from the CG: I about the CG = m·g·d·T²/(4π²) − m·d². */
export const compound = (m: number, d: number, T: number) => (m * G0 * d * T * T) / (4 * Math.PI ** 2) - m * d * d;

export interface FilarRun {
  m: number; mf: number; // motor and fixture mass, kg
  r: number; h: number; // m
  T: number; Tf: number; // period with the motor on the fixture, and of the fixture alone, s
  uT: number; uTf: number; ur: number; uh: number; um: number; // standard uncertainties, in the same units
}

/**
 * The inertia of the motor from two swings of a filar pendulum: the motor on its fixture, and the fixture alone. The
 * uncertainty combines the partial derivatives of I = K·(m + mf)·T² − K·mf·Tf², K = g·r²/(4π²·h), root-sum-square.
 * The period enters squared, so it is the term to watch, and the subtraction makes a heavy fixture expensive.
 */
export function filarMotor(f: FilarRun) {
  const K = (G0 * f.r * f.r) / (4 * Math.PI ** 2 * f.h);
  const It = K * (f.m + f.mf) * f.T * f.T, If = K * f.mf * f.Tf * f.Tf, I = It - If;
  const terms = {
    T: 2 * K * (f.m + f.mf) * f.T * f.uT,
    Tf: 2 * K * f.mf * f.Tf * f.uTf,
    r: ((2 * I) / f.r) * f.ur,
    h: (I / f.h) * f.uh,
    m: K * f.T * f.T * f.um, // the motor mass enters only the first swing
    mf: K * Math.abs(f.T * f.T - f.Tf * f.Tf) * f.um,
  };
  const u = Math.hypot(...Object.values(terms));
  return { I, It, If, u, rel: u / I, terms };
}
