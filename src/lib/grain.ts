// Propellant grain: burn-back geometry, 0-D ballistics over the burn, and
// closed-form structural screening for a case-bonded cylindrical grain.
// Units: mm, MPa, s, N unless stated. Shown and derived on /motor/propellant-grain/.

import { equilibriumPressure } from './ballistics.ts';

// ---------------------------------------------------------------------------
// Port cross-sections
// ---------------------------------------------------------------------------

export type Port =
  | { kind: 'circular'; d: number }
  | { kind: 'star'; points: number; tipD: number; valleyD: number }
  | { kind: 'slots'; slots: number; coreD: number; slotW: number; slotD: number }
  | { kind: 'end' }; // end burner: no port, burns from one face

export interface GrainGeometry {
  od: number; // grain outer diameter (bonded to case)
  length: number; // length of one segment
  segments: number;
  burningEnds: 0 | 1 | 2; // per segment
  port: Port;
}

/** True if (x, y) lies inside the initial port (gas) region. */
export function inPort(port: Port, x: number, y: number): boolean {
  const r = Math.hypot(x, y);
  switch (port.kind) {
    case 'circular':
      return r <= port.d / 2;
    case 'star': {
      // Straight-sided star: tips at tipD/2, valleys at valleyD/2, alternating.
      const n = port.points;
      const seg = Math.PI / n; // angle from tip to valley
      let th = Math.atan2(y, x);
      th = ((th % (2 * seg)) + 2 * seg) % (2 * seg); // 0 = tip, seg = valley, 2seg = tip
      const phi = th <= seg ? th : 2 * seg - th; // angle from nearest tip, 0..seg
      const rt = port.tipD / 2, rv = port.valleyD / 2;
      // Polar line through tip (rt, 0) and valley (rv·cos seg, rv·sin seg).
      const x1 = rt, y1 = 0, x2 = rv * Math.cos(seg), y2 = rv * Math.sin(seg);
      const px = r * Math.cos(phi), py = r * Math.sin(phi);
      // Point is inside if it is on the origin side of the tip–valley edge.
      const cross = (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1);
      return cross >= 0;
    }
    case 'slots': {
      if (r <= port.coreD / 2) return true;
      const n = port.slots;
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const u = x * Math.cos(a) + y * Math.sin(a); // along the slot
        const v = -x * Math.sin(a) + y * Math.cos(a); // across the slot
        if (u >= 0 && u <= port.slotD / 2 && Math.abs(v) <= port.slotW / 2) return true;
      }
      return false;
    }
    case 'end':
      return false;
  }
}

// ---------------------------------------------------------------------------
// Burn-back: the burning surface moves normal to itself at uniform speed, so
// the surface after burning a distance y is the set of points at distance y
// from the initial port (Huygens / "grass fire").
//
// Method: a grid Euclidean distance transform finds, for every cell, the
// nearest port cell; the distance is then measured exactly to densely sampled
// points on the true port outline near that cell. The second step removes the
// staircase error of a pixelated port, which otherwise inflates the burning
// area at ignition.
// ---------------------------------------------------------------------------

const FAR = 1e12; // "no port here": finite so the parabola algebra stays exact

/** 1-D squared distance transform with argmin (Felzenszwalb & Huttenlocher 2012). */
function edt1d(f: Float64Array, n: number, d: Float64Array, arg: Int32Array, v: Int32Array, z: Float64Array) {
  const sep = (q: number, p: number) => (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = sep(q, v[k]);
    while (s <= z[k]) {
      k--;
      s = sep(q, v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) ** 2 + f[v[k]];
    arg[q] = v[k];
  }
}

/** Points along the true port outline, spaced at most `ds` apart. */
export function portOutline(port: Port, ds: number): [number, number][] {
  const pts: [number, number][] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, keep: (x: number, y: number) => boolean = () => true) => {
    const k = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / ds));
    for (let i = 0; i < k; i++) {
      const x = x1 + ((x2 - x1) * i) / k, y = y1 + ((y2 - y1) * i) / k;
      if (keep(x, y)) pts.push([x, y]);
    }
  };
  const circle = (r: number, keep: (x: number, y: number) => boolean = () => true) => {
    const k = Math.max(16, Math.ceil((2 * Math.PI * r) / ds));
    for (let i = 0; i < k; i++) {
      const a = (2 * Math.PI * i) / k, x = r * Math.cos(a), y = r * Math.sin(a);
      if (keep(x, y)) pts.push([x, y]);
    }
  };
  switch (port.kind) {
    case 'circular':
      circle(port.d / 2);
      break;
    case 'star': {
      const n = port.points, seg = Math.PI / n;
      for (let k = 0; k < 2 * n; k++) {
        const r1 = k % 2 ? port.valleyD / 2 : port.tipD / 2, r2 = k % 2 ? port.tipD / 2 : port.valleyD / 2;
        line(r1 * Math.cos(k * seg), r1 * Math.sin(k * seg), r2 * Math.cos((k + 1) * seg), r2 * Math.sin((k + 1) * seg));
      }
      break;
    }
    case 'slots': {
      const rc = port.coreD / 2, L = port.slotD / 2, w = port.slotW / 2, n = port.slots;
      const inSlot = (x: number, y: number, skip: number) => {
        for (let k = 0; k < n; k++) {
          if (k === skip) continue;
          const a = (2 * Math.PI * k) / n;
          const u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
          if (u > 0 && u < L && Math.abs(v) < w) return true;
        }
        return false;
      };
      circle(rc, (x, y) => !inSlot(x, y, -1));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n, c = Math.cos(a), s = Math.sin(a);
        const P = (u: number, v: number): [number, number] => [u * c - v * s, u * s + v * c];
        const keep = (x: number, y: number) => Math.hypot(x, y) > rc && !inSlot(x, y, k);
        for (const v of [-w, w]) line(...P(0, v), ...P(L, v), keep);
        line(...P(L, -w), ...P(L, w), keep);
      }
      break;
    }
    case 'end':
      break;
  }
  return pts;
}

export interface BurnMap {
  n: number; // grid cells per side
  h: number; // cell size, mm
  /** Distance from the initial port to each cell centre, mm. NaN outside the grain OD; 0 in the port. */
  dist: Float64Array;
}

export function burnMap(od: number, port: Port, n = 400): BurnMap {
  const R = od / 2, h = od / n, N = n * n;
  const cx = (i: number) => -R + (i + 0.5) * h;
  const f = new Float64Array(N);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++)
      f[j * n + i] = inPort(port, cx(i), cx(j)) && Math.hypot(cx(i), cx(j)) <= R ? 0 : FAR;
  const inside = Float64Array.from(f);

  // Feature transform: nearest port cell (si, sj) for every cell.
  const col = new Float64Array(n), out = new Float64Array(n), arg = new Int32Array(n);
  const v = new Int32Array(n), z = new Float64Array(n + 1);
  const rowOf = new Int32Array(N), seed = new Int32Array(N);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) col[j] = f[j * n + i];
    edt1d(col, n, out, arg, v, z);
    for (let j = 0; j < n; j++) { f[j * n + i] = out[j]; rowOf[j * n + i] = arg[j]; }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) col[i] = f[j * n + i];
    edt1d(col, n, out, arg, v, z);
    for (let i = 0; i < n; i++) { f[j * n + i] = out[i]; seed[j * n + i] = rowOf[j * n + arg[i]] * n + arg[i]; }
  }

  // Bucket outline samples by grid cell (compressed rows).
  const pts = portOutline(port, h / 4);
  const start = new Int32Array(N + 1);
  const cell = (x: number, y: number) => {
    const i = Math.min(n - 1, Math.max(0, Math.floor((x + R) / h)));
    const j = Math.min(n - 1, Math.max(0, Math.floor((y + R) / h)));
    return j * n + i;
  };
  for (const [x, y] of pts) start[cell(x, y) + 1]++;
  for (let k = 0; k < N; k++) start[k + 1] += start[k];
  const fill = start.slice(0, N), px = new Float64Array(pts.length), py = new Float64Array(pts.length);
  for (const [x, y] of pts) { const k = fill[cell(x, y)]++; px[k] = x; py[k] = y; }

  const dist = new Float64Array(N);
  const SEARCH = 2;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i, x = cx(i), y = cx(j);
      if (Math.hypot(x, y) > R) { dist[k] = NaN; continue; }
      if (inside[k] === 0) { dist[k] = 0; continue; }
      if (f[k] >= FAR) { dist[k] = Infinity; continue; }
      const si = seed[k] % n, sj = (seed[k] / n) | 0;
      let best = Infinity;
      for (let b = Math.max(0, sj - SEARCH); b <= Math.min(n - 1, sj + SEARCH); b++)
        for (let a = Math.max(0, si - SEARCH); a <= Math.min(n - 1, si + SEARCH); a++) {
          const c = b * n + a;
          for (let p = start[c]; p < start[c + 1]; p++) {
            const d2 = (px[p] - x) ** 2 + (py[p] - y) ** 2;
            if (d2 < best) best = d2;
          }
        }
      // Fall back to the grid distance if no outline sample was near the seed.
      dist[k] = best < Infinity ? Math.sqrt(best) : Math.max(0, Math.sqrt(f[k]) * h - h / 2);
    }
  return { n, h, dist };
}

export interface BurnStep {
  y: number; // web burned, mm
  perimeter: number; // burning perimeter of the port cross-section, mm
  portArea: number; // mm²
  burnArea: number; // total burning surface, all segments, mm²
}

export interface BurnBack {
  steps: BurnStep[];
  web: number; // distance to first case contact, mm
  burnout: number; // distance at which all propellant is gone, mm
  caseArea: number; // mm²
  portArea0: number; // mm²
  propVolume: number; // mm³
  volumetricLoading: number;
  sliverFraction: number; // propellant (by area) left at first case contact
  map: BurnMap | null;
}

export function burnBack(g: GrainGeometry, steps = 160, n = 400): BurnBack {
  const R = g.od / 2;
  const caseArea = Math.PI * R * R;

  if (g.port.kind === 'end') {
    const web = g.length * g.segments; // segments stacked, burning from one face
    const out: BurnStep[] = [];
    for (let i = 0; i <= steps; i++) {
      const y = (web * i) / steps;
      out.push({ y, perimeter: 0, portArea: 0, burnArea: i < steps ? caseArea : 0 });
    }
    return {
      steps: out, web, burnout: web, caseArea, portArea0: 0,
      propVolume: caseArea * web, volumetricLoading: 1, sliverFraction: 0, map: null,
    };
  }

  const map = burnMap(g.od, g.port, n);
  const cellA = map.h * map.h;
  // Histogram of cell distances → burned area as a function of web.
  let maxD = 0, web = Infinity, portCells = 0, gridCells = 0;
  const ds: number[] = [];
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const d = map.dist[j * n + i];
      if (Number.isNaN(d)) continue;
      gridCells++;
      if (d === 0) { portCells++; continue; }
      ds.push(d);
      if (d > maxD) maxD = d;
      const x = -R + (i + 0.5) * map.h, y = -R + (j + 0.5) * map.h;
      const r = Math.hypot(x, y);
      // extend cells next to the case out to the case wall
      if (r > R - map.h) web = Math.min(web, d + (R - r));
    }
  ds.sort((a, b) => a - b);
  // Scale cell counts so the grid circle has exactly the true case area.
  const scale = caseArea / (gridCells * cellA);
  const portArea0 = portCells * cellA * scale;
  const burned = (y: number) => {
    let lo = 0, hi = ds.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ds[mid] <= y) lo = mid + 1; else hi = mid; }
    return portArea0 + lo * cellA * scale;
  };

  const ends = g.burningEnds;
  const burnout = ends > 0 ? Math.min(maxD, g.length / ends) : maxD;
  const dy = burnout / steps;
  const win = Math.max(dy, 6 * map.h); // differentiate over several cells to average out pixel aliasing
  const central = (y: number) => (burned(y + win / 2) - burned(y - win / 2)) / win;
  const out: BurnStep[] = [];
  for (let s = 0; s <= steps; s++) {
    const y = s * dy;
    let perimeter = 0;
    if (s < steps) {
      // A centred difference can't straddle either end of the burn (y = 0 or the
      // last propellant at maxD), so near the ends extrapolate linearly from inside.
      const lo = win / 2, hi = maxD - win / 2;
      // Least-squares line through five centred estimates between ya and yb (averages out pixel noise).
      const extrap = (ya: number, yb: number) => {
        const xs = [0, 1, 2, 3, 4].map((k) => ya + ((yb - ya) * k) / 4), ps = xs.map(central);
        const mx = xs.reduce((a, b) => a + b) / 5, mp = ps.reduce((a, b) => a + b) / 5;
        const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
        const slope = sxx > 0 ? xs.reduce((a, x, k) => a + (x - mx) * (ps[k] - mp), 0) / sxx : 0;
        return Math.max(0, mp + slope * (y - mx));
      };
      if (hi <= lo) perimeter = central(Math.min(Math.max(y, lo), maxD));
      else if (y < lo) perimeter = extrap(lo, Math.min(4 * lo, hi));
      else if (y > hi) perimeter = extrap(Math.max(hi - 3 * lo, lo), hi);
      else perimeter = central(y);
    }
    const portArea = burned(y);
    const len = Math.max(0, g.length - ends * y);
    const face = Math.max(0, caseArea - portArea);
    const burnArea = s === steps || len === 0 ? 0 : g.segments * (perimeter * len + ends * face);
    out.push({ y, perimeter, portArea, burnArea });
  }

  const propArea0 = caseArea - portArea0;
  return {
    steps: out,
    web: Math.min(web, burnout),
    burnout,
    caseArea,
    portArea0,
    propVolume: propArea0 * g.length * g.segments,
    volumetricLoading: propArea0 / caseArea,
    sliverFraction: Number.isFinite(web) ? Math.max(0, (caseArea - burned(web + map.h)) / propArea0) : 0,
    map,
  };
}

// ---------------------------------------------------------------------------
// Ballistics over the burn (quasi-steady, no erosive burning or transients)
// ---------------------------------------------------------------------------

export interface Propellant {
  rhoP: number; // kg/m³
  a: number; // mm/s per MPaⁿ
  n: number;
  cStar: number; // m/s
}

export interface TracePoint { t: number; y: number; p: number; F: number; kn: number; }

export interface Performance {
  trace: TracePoint[];
  throatD: number; // mm
  burnTime: number; // s
  mainBurnTime: number; // s, until the flame first reaches the case
  pMax: number; pAvg: number; // MPa; average over the main burn
  fMax: number; fAvg: number; // N; average over the main burn
  impulse: number; // N·s
  propMass: number; // kg
  isp: number; // s, delivered = I / (m·g0)
  knMin: number; knMax: number;
  progressivity: number; // A_b,max / A_b,min over the main burn (before sliver tail-off)
  profile: 'progressive' | 'neutral' | 'regressive' | 'progressive-regressive';
  portToThroat: number; // initial port area / throat area
}

/** Throat diameter (mm) that gives a chosen peak chamber pressure. */
export function throatForPeak(bb: BurnBack, prop: Propellant, pPeak: number) {
  const abMax = Math.max(...bb.steps.map((s) => s.burnArea));
  // p^(1−n) = ρ a c* Kn / 1e9  →  Kn = 1e9 p^(1−n) / (ρ a c*)
  const kn = (1e9 * Math.pow(pPeak, 1 - prop.n)) / (prop.rhoP * prop.a * prop.cStar);
  return 2 * Math.sqrt(abMax / kn / Math.PI);
}

export function performance(bb: BurnBack, prop: Propellant, throatD: number, cf: number): Performance {
  const at = (Math.PI * throatD * throatD) / 4; // mm²
  const trace: TracePoint[] = [];
  let t = 0, impulse = 0, pInt = 0, fInt = 0, tMain = 0, prev: TracePoint | null = null;
  // Main burn: up to first contact with the case. After that is sliver tail-off.
  const active = bb.steps.filter((s) => s.burnArea > 0 && s.y <= bb.web + 1e-9);
  for (const s of bb.steps) {
    const kn = s.burnArea / at;
    const p = s.burnArea > 0 ? equilibriumPressure({ ...prop, kn }) : 0;
    if (prev) {
      // time to burn this web increment at the average burn rate across it
      const rPrev = prop.a * Math.pow(prev.p, prop.n);
      const rNow = p > 0 ? prop.a * Math.pow(p, prop.n) : rPrev;
      const dt = (s.y - prev.y) / ((rPrev + rNow) / 2);
      t += dt;
    }
    const F = cf * p * at; // MPa·mm² = N
    if (prev) {
      impulse += ((F + prev.F) / 2) * (t - prev.t);
      if (s.y <= bb.web + 1e-9) {
        pInt += ((p + prev.p) / 2) * (t - prev.t);
        fInt += ((F + prev.F) / 2) * (t - prev.t);
        tMain = t;
      }
    }
    prev = { t, y: s.y, p, F, kn };
    trace.push(prev);
  }
  const burnTime = t;
  const abs = active.map((s) => s.burnArea);
  const first = abs[0] ?? 0, last = abs[abs.length - 1] ?? 0;
  const abMax = Math.max(...abs), abMin = Math.min(...abs);
  const rel = (v: number) => v / first;
  let profile: Performance['profile'] = 'neutral';
  const peakIdx = abs.indexOf(abMax);
  if (rel(abMax) > 1.15 && rel(last) < 0.87 * rel(abMax) && peakIdx > 0 && peakIdx < abs.length - 1) profile = 'progressive-regressive';
  else if (rel(last) > 1.15) profile = 'progressive';
  else if (rel(last) < 0.87) profile = 'regressive';
  const propMass = bb.propVolume * 1e-9 * prop.rhoP;
  return {
    trace,
    throatD,
    burnTime,
    pMax: Math.max(...trace.map((x) => x.p)),
    mainBurnTime: tMain,
    pAvg: tMain > 0 ? pInt / tMain : 0,
    fMax: Math.max(...trace.map((x) => x.F)),
    fAvg: tMain > 0 ? fInt / tMain : 0,
    impulse,
    propMass,
    isp: propMass > 0 ? impulse / (propMass * 9.80665) : 0,
    knMin: abMin / at,
    knMax: abMax / at,
    progressivity: abMax / abMin,
    profile,
    portToThroat: bb.portArea0 / at,
  };
}

// ---------------------------------------------------------------------------
// Structural screening: long case-bonded cylindrical grain, incompressible
// propellant, generalised plane strain (axial strain = case axial strain).
// a = bore radius, b = grain outer (bond) radius, m = b/a.
// ---------------------------------------------------------------------------

/**
 * Propellant classes for the structural screen, carried over from REF·DB v1. Illustrative, not measured data:
 * α in µm/m·K, relaxed modulus E in MPa, strain capability in % on the warm and cold plateaus, Tg in °C.
 */
export const PROPELLANT_CLASSES = [
  { key: 'comp', name: 'Composite (HTPB type)', alpha: 100, E: 3.6, capWarm: 42, capCold: 10, tg: -70 },
  { key: 'cmdb', name: 'Composite-modified double-base', alpha: 85, E: 105, capWarm: 25, capCold: 3, tg: -5 },
  { key: 'db', name: 'Double-base', alpha: 80, E: 180, capWarm: 22, capCold: 2, tg: 5 },
] as const;
export type PropellantClass = (typeof PROPELLANT_CLASSES)[number];

/** Illustrative strain capability (%) at temperature T: a smooth step from the warm to the cold plateau through Tg. */
export const strainCapability = (T: number, p: { capWarm: number; capCold: number; tg: number }) =>
  p.capCold + (p.capWarm - p.capCold) / (1 + Math.exp(-(T - p.tg) / 12));

export interface GrainStructInputs {
  boreD: number; // mm
  od: number; // mm
  alphaP: number; // propellant CTE, 1/K
  alphaC: number; // case CTE, 1/K
  dT: number; // service temperature − stress-free temperature, K (negative when cold)
  eRelaxed: number; // propellant relaxation modulus for slow thermal loads, MPa
  bulkK: number; // propellant bulk modulus, MPa
  pressure: number; // MPa
  caseE: number; // MPa
  caseNu: number;
  caseT: number; // case wall, mm
  kt: number; // strain concentration factor at the bore (1 for a circular port)
}

/** Bore hoop strain from cooling (positive = tensile). */
export function thermalBoreStrain(i: GrainStructInputs) {
  const m2 = (i.od / i.boreD) ** 2;
  return i.dT * (((3 * i.alphaP - i.alphaC) / 2) * (1 - m2) + m2 * i.alphaC);
}

/** Case strains at the bond under internal pressure (thin closed cylinder). */
export function caseStrains(i: GrainStructInputs) {
  const s = (i.pressure * (i.od / 2)) / (i.caseE * i.caseT);
  return { hoop: s * (1 - i.caseNu / 2), axial: s * (0.5 - i.caseNu) };
}

/** Bore hoop strain from pressurisation: the case dilation, amplified by m². */
export function pressureBoreStrain(i: GrainStructInputs) {
  const m2 = (i.od / i.boreD) ** 2;
  const c = caseStrains(i);
  return m2 * c.hoop + ((m2 - 1) / 2) * (c.axial + i.pressure / i.bulkK);
}

/** Radial tensile stress at the case bond from cooling, MPa. */
export function thermalBondStress(i: GrainStructInputs) {
  const m2 = (i.od / i.boreD) ** 2;
  return i.eRelaxed * (m2 - 1) * (i.alphaP - i.alphaC) * -i.dT;
}

export function grainStructure(i: GrainStructInputs) {
  const m = i.od / i.boreD;
  const thermal = i.kt * thermalBoreStrain(i);
  const press = i.kt * pressureBoreStrain(i);
  return {
    m,
    webFraction: 1 - i.boreD / i.od,
    thermal,
    pressure: press,
    combined: thermal + press,
    bond: thermalBondStress(i),
    caseHoop: caseStrains(i).hoop,
  };
}
