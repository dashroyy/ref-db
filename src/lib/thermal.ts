// Transient heat conduction for hardware: lumped capacitance and 1-D conduction (slab, solid cylinder, solid sphere)
// through one or two layers, with a heating phase and an after-phase so soak-back shows up. Implicit finite volume,
// unconditionally stable. Units: SI inside (m, s, W, J, kg); °C for temperatures.

export interface Mat { k: number; rho: number; cp: number } // W/m·K, kg/m³, J/kg·K
export type Geometry = 'slab' | 'cylinder' | 'sphere';
export interface Phase { duration: number; h: number; tEnv: number } // s, W/m²K, °C — conditions on the heated surface

export interface ThermalInputs {
  geometry: Geometry;
  /** Heated side first. Slab: up to two layers. Cylinder and sphere: one layer whose thickness is the radius. */
  layers: { mat: Mat; thickness: number }[];
  t0: number;
  phases: Phase[];
  /** Slab back face: adiabatic unless given. Cylinder and sphere have no back face — the centre is a symmetry point. */
  back?: { h: number; tEnv: number };
  limit?: number; // °C, at the back face or centre
  snapshotTimes?: number[]; // extra times (s) at which to record a through-thickness profile
  cellsPerLayer?: number;
  stepsPerPhase?: number;
}

/** Characteristic length V/A_heated: slab = thickness, cylinder = R/2, sphere = R/3. */
export const characteristicLength = (g: Geometry, L: number) => (g === 'slab' ? L : g === 'cylinder' ? L / 2 : L / 3);

/** Biot number: surface resistance against internal resistance. Below about 0.1 one temperature describes the part. */
export function biot(g: Geometry, layers: { mat: Mat; thickness: number }[], h: number) {
  if (g === 'slab') return h * layers.reduce((s, l) => s + l.thickness / l.mat.k, 0);
  return (h * characteristicLength(g, layers[0].thickness)) / layers[0].mat.k;
}

/** Lumped time constant ρ c V / (h A) for the whole part. */
export function timeConstant(g: Geometry, layers: { mat: Mat; thickness: number }[], h: number) {
  const capPerArea = g === 'slab'
    ? layers.reduce((s, l) => s + l.mat.rho * l.mat.cp * l.thickness, 0)
    : layers[0].mat.rho * layers[0].mat.cp * characteristicLength(g, layers[0].thickness);
  return capPerArea / h;
}

/** Time for a lumped part to go from t0 to tLimit in surroundings at tEnv (null if it never gets there). */
export function lumpedTimeTo(tau: number, t0: number, tEnv: number, tLimit: number) {
  const r = (tEnv - tLimit) / (tEnv - t0);
  return r > 0 && r < 1 ? -tau * Math.log(r) : null;
}

function thomas(a: number[], b: number[], c: number[], d: number[]) {
  const n = b.length, cp = new Array(n), dp = new Array(n), x = new Array(n);
  cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

export function solve(inp: ThermalInputs) {
  const g = inp.geometry, nPer = inp.cellsPerLayer ?? 50, steps = inp.stepsPerPhase ?? 500;
  const layers = g === 'slab' ? inp.layers.filter((l) => l.thickness > 0) : [inp.layers[0]];
  const total = layers.reduce((s, l) => s + l.thickness, 0);
  const radius = (s: number) => (g === 'slab' ? 1 : total - s); // radial position of a depth s below the surface
  const area = (s: number) => (g === 'slab' ? 1 : g === 'cylinder' ? radius(s) : radius(s) ** 2);
  const vol = (s1: number, s2: number) => // between depths s1 < s2
    g === 'slab' ? s2 - s1 : g === 'cylinder' ? (radius(s1) ** 2 - radius(s2) ** 2) / 2 : (radius(s1) ** 3 - radius(s2) ** 3) / 3;

  // Cells: [s0, s1] with a centre and material. Finer near the heated surface, where the gradients are.
  const cells: { s0: number; s1: number; c: number; mat: Mat }[] = [];
  let depth = 0;
  layers.forEach((l, li) => {
    for (let k = 0; k < nPer; k++) {
      const f0 = k / nPer, f1 = (k + 1) / nPer;
      const grade = (f: number) => (li === 0 ? f * f * 0.5 + f * 0.5 : f); // mild clustering at the hot face
      const s0 = depth + grade(f0) * l.thickness, s1 = depth + grade(f1) * l.thickness;
      cells.push({ s0, s1, c: (s0 + s1) / 2, mat: l.mat });
    }
    depth += l.thickness;
  });
  const n = cells.length;
  const C = cells.map((c) => c.mat.rho * c.mat.cp * vol(c.s0, c.s1)); // J/K per unit (area or angle)
  const G = cells.slice(0, -1).map((c, i) => { // conductance between cell i and i+1
    const d = cells[i + 1];
    return area(c.s1) / ((c.s1 - c.c) / c.mat.k + (d.c - d.s0) / d.mat.k);
  });
  const aS = area(0), gIn0 = (cells[0].mat.k / (cells[0].c - cells[0].s0)) * aS; // surface face to first centre
  const last = cells[n - 1];
  const backArea = g === 'slab' ? 1 : 0;
  const gInB = backArea ? (last.mat.k / (last.s1 - last.c)) * backArea : 0;

  let T = new Array(n).fill(inp.t0);
  const capTotal = C.reduce((s, x) => s + x, 0);
  const meanT = (x: number[]) => x.reduce((s, v, i) => s + v * C[i], 0) / capTotal;
  const surfaceT = (x: number[], ph: Phase) => (gIn0 * x[0] + ph.h * aS * ph.tEnv) / (gIn0 + ph.h * aS);
  const backT = (x: number[]) => {
    if (!backArea) return x[n - 1]; // centre: the innermost cell
    if (!inp.back) return x[n - 1];
    return (gInB * x[n - 1] + inp.back.h * inp.back.tEnv) / (gInB + inp.back.h);
  };

  const tau = timeConstant(g, inp.layers.filter((l) => l.thickness > 0), Math.max(1e-9, inp.phases[0].h));
  const out = { t: [0] as number[], surface: [inp.t0] as number[], back: [inp.t0] as number[], mean: [inp.t0] as number[], lumped: [inp.t0] as number[], ifc: [inp.t0] as number[] };
  // the joint between the first two layers of a slab: the conductance-weighted mean of the two cells beside it
  const iA = layers.length > 1 ? nPer - 1 : -1;
  const ifcT = (x: number[]) => {
    if (iA < 0) return NaN;
    const ca = cells[iA], cb = cells[iA + 1];
    const ga = ca.mat.k / (ca.s1 - ca.c), gb = cb.mat.k / (cb.c - cb.s0);
    return (ga * x[iA] + gb * x[iA + 1]) / (ga + gb);
  };
  let time = 0, lumpedT = inp.t0, peak = { T: inp.t0, t: 0 }, tLimit: number | null = null;
  const profiles: { label: string; t: number; s: number[]; T: number[] }[] = [];
  const snap = (label: string) => profiles.push({ label, t: time, s: cells.map((c) => c.c), T: [...T] });
  let peakProfile: number[] = [...T], endHeat = { surface: inp.t0, back: inp.t0, mean: inp.t0 };
  const pending = [...(inp.snapshotTimes ?? [])].sort((x, y) => x - y);
  const extra: typeof profiles = [];

  inp.phases.forEach((ph, pi) => {
    const gS = 1 / (1 / gIn0 + 1 / Math.max(ph.h * aS, 1e-30)); // surface film in series with half a cell
    const gB = backArea && inp.back ? 1 / (1 / gInB + 1 / Math.max(inp.back.h, 1e-30)) : 0;
    const tauPh = timeConstant(g, inp.layers.filter((l) => l.thickness > 0), Math.max(1e-9, ph.h));
    let tPrev = 0;
    for (let k = 1; k <= steps; k++) {
      const tk = ph.duration * (k / steps) ** 2; // small steps first, where things change fastest
      const dt = tk - tPrev; tPrev = tk;
      const a = new Array(n).fill(0), b = new Array(n).fill(0), c = new Array(n).fill(0), d = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        b[i] = C[i] / dt; d[i] = (C[i] / dt) * T[i];
        if (i > 0) { a[i] = -G[i - 1]; b[i] += G[i - 1]; }
        if (i < n - 1) { c[i] = -G[i]; b[i] += G[i]; }
      }
      b[0] += gS; d[0] += gS * ph.tEnv;
      if (gB) { b[n - 1] += gB; d[n - 1] += gB * inp.back!.tEnv; }
      T = thomas(a, b, c, d);
      time += dt;
      lumpedT = ph.tEnv + (lumpedT - ph.tEnv) * Math.exp(-dt / tauPh);
      const tb = backT(T);
      out.t.push(time); out.surface.push(surfaceT(T, ph)); out.back.push(tb); out.mean.push(meanT(T)); out.lumped.push(lumpedT); out.ifc.push(ifcT(T));
      if (tb > peak.T) { peak = { T: tb, t: time }; peakProfile = [...T]; }
      if (tLimit === null && inp.limit !== undefined && tb >= inp.limit) tLimit = time;
      while (pending.length && time >= pending[0] * (1 - 1e-9)) { pending.shift(); extra.push({ label: 'snapshot', t: time, s: cells.map((c) => c.c), T: [...T] }); }
    }
    if (pi === 0) { endHeat = { surface: surfaceT(T, ph), back: backT(T), mean: meanT(T) }; snap('end of heating'); }
  });
  profiles.push({ label: 'back face at its peak', t: peak.t, s: cells.map((c) => c.c), T: peakProfile });
  snap('end');

  return {
    ...out, profiles, snapshots: extra, endHeat, tau,
    biot: biot(g, inp.layers.filter((l) => l.thickness > 0), inp.phases[0].h),
    lc: characteristicLength(g, total),
    peakBack: peak.T, tPeakBack: peak.t, tLimit, total,
    interfaces: layers.slice(0, -1).map((_, i) => layers.slice(0, i + 1).reduce((s, l) => s + l.thickness, 0)),
  };
}
