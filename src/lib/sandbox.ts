// Molecular sandbox: a bead-spring polymer model with Langevin dynamics, in reduced units. The bond length is 1, a
// chain bead has mass 1, and the temperature is in units of the thermal energy (k_B T = 1 at temperature 1).
// - Chains of beads joined by springs, with a weak bending stiffness.
// - Soft excluded volume, so that chains cannot pass through one another. Entanglement comes from this: nothing
//   draws it.
// - Permanent crosslinks; small free plasticiser beads; large filler particles bonded to the binder by bonds that
//   break when they are stretched (dewetting); and fixed crystalline blocks that hold the chains that pass them.
// Integrated with the BAOAB splitting of Leimkuhler & Matthews (2013), so the kinetic temperature that the model
// measures is the temperature that you set. A teaching model: the Molecular sandbox page says what it does not show.

export const BEAD = 0, PLAST = 1, FILLER = 2, CRYST = 3;

export interface Preset {
  key: string; name: string;
  chains: number; len: number; // chains, and beads in each chain (in each arm of a star)
  bend: number; // bending stiffness
  cross: number; filler: number; plast: number; cryst: number;
  star?: boolean;
  what: string; see: string; where: string;
}

export const PRESETS: Preset[] = [
  { key: 'linear', name: 'Short linear chains', chains: 14, len: 10, bend: 0.2, cross: 0, filler: 0, plast: 0, cryst: 0,
    what: 'Short chains with no crosslinks. They are too short to entangle.',
    see: 'At a high temperature, push the chains with the cursor. They slide apart and stay where you put them. Nothing holds them together but friction, so the material flows: there is no rubbery plateau.',
    where: 'Low-molecular-weight polymers, waxes, hot-melt adhesives.' },
  { key: 'entangled', name: 'Long entangled chains', chains: 7, len: 26, bend: 0.25, cross: 0, filler: 0, plast: 0, cryst: 0,
    what: 'Long chains that go through the loops of other chains. A chain cannot go through its neighbour.',
    see: 'Push the chains. They resist, then move slowly, because each chain must snake along its own path to get out of the loops (reptation). This delay is the rubbery plateau. Given enough time, the chains get out and the material flows.',
    where: 'Thermoplastics above their glass transition: polyethylene, nylon and PEEK melts; uncured binder prepolymer.' },
  { key: 'elastomer', name: 'Crosslinked elastomer', chains: 8, len: 18, bend: 0.2, cross: 14, filler: 0, plast: 0, cryst: 0,
    what: 'Chains tied together at the red links. The links are permanent chemical bonds.',
    see: 'The links make the chains into one network. The network can deform, but it cannot flow at any temperature. The number of links sets the modulus of the rubbery plateau.',
    where: 'O-rings, EPDM insulation, the cured binder of a composite propellant.' },
  { key: 'thermoset', name: 'Thermoset', chains: 9, len: 14, bend: 0.5, cross: 40, filler: 0, plast: 0, cryst: 0,
    what: 'A dense network with many crosslinks.',
    see: 'The segments between the links are short, so they have almost no room to move. The material is stiff and brittle. A higher temperature changes little until it decomposes.',
    where: 'The epoxy matrix of a carbon-fibre case, phenolic ablatives, adhesives.' },
  { key: 'plasticised', name: 'Stiff chains with plasticiser', chains: 6, len: 20, bend: 0.8, cross: 0, filler: 0, plast: 50, cryst: 0,
    what: 'Stiff chains with small free molecules between them. The small molecules are not bonded to the chains.',
    see: 'Turn on the trails. The small molecules move much faster than the chains. They give the chains room to move, which decreases the glass transition. When they leave (by migration or evaporation over years), the material becomes stiff and brittle.',
    where: 'Double-base propellant (nitrocellulose and its plasticiser), plasticised PVC, a seal that loses plasticiser into a fluid.' },
  { key: 'filled', name: 'Filled binder (composite propellant)', chains: 8, len: 16, bend: 0.15, cross: 8, filler: 5, plast: 0, cryst: 0,
    what: 'Soft crosslinked binder chains, bonded to large rigid particles. The green lines are the bonds between binder and particle.',
    see: 'Push hard near a particle, or push Stretch. The binder pulls away from the particles, first at the ends that point along the stretch. This is dewetting. It opens voids, so the volume increases as the material stretches, and its Poisson\'s ratio decreases. The broken bonds do not heal.',
    where: 'Composite propellant: an HTPB binder with ammonium perchlorate and aluminium particles. Any highly filled elastomer.' },
  { key: 'semicryst', name: 'Semi-crystalline', chains: 8, len: 18, bend: 0.3, cross: 0, filler: 0, plast: 0, cryst: 4, star: false,
    what: 'Chains that pass through rigid crystalline blocks. Between the blocks, the chains are amorphous.',
    see: 'Heat it. Only the chains between the blocks move. The blocks stay rigid above the glass transition, so the material keeps a useful stiffness up to its melting point: two transitions, not one.',
    where: 'PTFE, PEEK, polyethylene and nylon: back-up rings, seats, bearings.' },
  { key: 'star', name: 'Star polymers', chains: 7, len: 7, bend: 0.2, cross: 0, filler: 0, plast: 0, cryst: 0, star: true,
    what: 'Three arms on a centre bead, in place of one linear chain.',
    see: 'A star has no free end to lead with, so it cannot snake along a path. It must pull an arm back before it can move. It relaxes much more slowly than a linear chain of the same mass.',
    where: 'Branched prepolymers, and long-chain branching in plastics processing.' },
];

const R_BEAD = 0.48, R_PLAST = 0.3, R_FILLER = 1.45, R_CRYST = 1.15;
const M_BEAD = 1, M_PLAST = 0.4, M_FILLER = 25;
export const K_BOND = 120, K_CROSS = 160, K_ANCHOR = 140, K_EX = 160, K_WALL = 120, K_TETHER = 200, F_MAX = 300;
/** A bond to a particle breaks when it stays longer than its rest length by more than DEWET for more than HOLD steps. */
export const DEWET = 0.26, HOLD = 30;
const BEND_R0 = 1.7; // the 1–3 distance the bending spring pulls toward (a bond angle of about 116°)

export interface Anchor { a: number; b: number; r0: number; broken: boolean; strong: boolean; over: number }

export interface System {
  n: number;
  x: Float64Array; v: Float64Array; f: Float64Array;
  m: Float64Array; r: Float64Array; kind: Uint8Array; fixed: Uint8Array; chain: Int16Array;
  bonds: Int32Array; bends: Int32Array; kBend: number;
  cross: Int32Array; crossR0: Float64Array;
  anchors: Anchor[];
  chains: number[][]; // the beads of each chain in order (a star: the centre, then each arm)
  box: Float64Array; // half sizes x, y, z
  half: number; // the half size at build
  t: number;
  preset: Preset;
  homes: Float64Array | null; // during a stretch: the positions of the beads when it started
  strain: number; // the stretch along x (0 without one)
}

export interface Params {
  T: number; // temperature
  gamma?: number; // friction rate (1 by default)
  dt?: number; // time step (0.012 by default)
  probe?: { x: number; y: number; z: number; R: number; K: number } | null; // a sphere that pushes
  grab?: { i: number; x: number; y: number; z: number; K: number } | null; // a spring that pulls bead i to a point
}

/** A seeded random number generator (mulberry32): the same seed gives the same material. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal numbers (polar Box–Muller) from a uniform generator. */
export function gaussian(rnd: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0, s = 0;
    do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const k = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * k;
    return u * k;
  };
}

/** Build a material from a preset: place the particles, make the bonds, then let the overlaps relax. */
export function build(preset: Preset, seed = 1, half = 4.4): System {
  const rnd = mulberry32(seed);
  const X: number[] = [], M: number[] = [], RR: number[] = [], K: number[] = [], FX: number[] = [], CH: number[] = [];
  const bonds: number[] = [], bends: number[] = [], chains: number[][] = [];
  const add = (p: number[], kind: number, r: number, m: number, fixed = 0, ch = -1) => {
    X.push(p[0], p[1], p[2]); K.push(kind); RR.push(r); M.push(m); FX.push(fixed); CH.push(ch);
    return K.length - 1;
  };
  const inside = (p: number[], r: number) => p.every((c) => Math.abs(c) <= half - r);
  const clearance = (p: number[], r: number) => {
    let worst = Infinity;
    for (let j = 0; j < K.length; j++) {
      const d = Math.hypot(p[0] - X[3 * j], p[1] - X[3 * j + 1], p[2] - X[3 * j + 2]) / (r + RR[j]);
      if (d < worst) worst = d;
    }
    return worst;
  };
  const randomPoint = (r: number) => [0, 1, 2].map(() => (rnd() * 2 - 1) * (half - r));
  const place = (r: number, need: number, tries = 300) => {
    let best = randomPoint(r), bestC = clearance(best, r);
    for (let k = 0; k < tries && bestC < need; k++) {
      const p = randomPoint(r), c = clearance(p, r);
      if (c > bestC) { best = p; bestC = c; }
    }
    return best;
  };
  const unit = () => { const d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const L = Math.hypot(d[0], d[1], d[2]) || 1; return d.map((c) => c / L); };

  // 1. crystalline blocks and filler particles, spread out
  for (let k = 0; k < preset.cryst; k++) add(place(R_CRYST, 1.35), CRYST, R_CRYST, M_FILLER, 1);
  for (let k = 0; k < preset.filler; k++) add(place(R_FILLER, 1.3), FILLER, R_FILLER, M_FILLER);

  // 2. chains: self-avoiding random walks with some persistence
  const walk = (start: number, n: number, ch: number, dir0: number[]) => {
    const out: number[] = [];
    let prev = start, dir = dir0;
    for (let k = 0; k < n; k++) {
      let best: number[] | null = null, bestC = -1, bestDir = dir;
      for (let tr = 0; tr < 24; tr++) {
        const u = unit(), d = dir.map((c, i) => c * 0.65 + u[i] * 0.9), L = Math.hypot(d[0], d[1], d[2]) || 1;
        const nd = d.map((c) => c / L);
        const p = [0, 1, 2].map((i) => X[3 * prev + i] + nd[i]);
        if (!inside(p, R_BEAD)) continue;
        const c = clearance(p, R_BEAD * 0.9);
        if (c > bestC) { best = p; bestC = c; bestDir = nd; }
        if (c > 1.05) break;
      }
      if (!best) best = [0, 1, 2].map((i) => Math.max(-half + R_BEAD, Math.min(half - R_BEAD, X[3 * prev + i] - dir[i])));
      const id = add(best, BEAD, R_BEAD, M_BEAD, 0, ch);
      bonds.push(prev, id);
      out.push(id);
      prev = id; dir = bestDir;
    }
    return out;
  };
  for (let c = 0; c < preset.chains; c++) {
    const start = add(place(R_BEAD, 1.6), BEAD, R_BEAD, M_BEAD, 0, c);
    if (preset.star) {
      const list = [start];
      for (let arm = 0; arm < 3; arm++) {
        const beads = walk(start, preset.len, c, unit());
        bends.push(start, beads[0], beads[1]);
        for (let k = 2; k < beads.length; k++) bends.push(beads[k - 2], beads[k - 1], beads[k]);
        list.push(...beads);
      }
      chains.push(list);
    } else {
      const beads = [start, ...walk(start, preset.len - 1, c, unit())];
      for (let k = 2; k < beads.length; k++) bends.push(beads[k - 2], beads[k - 1], beads[k]);
      chains.push(beads);
    }
  }

  // 3. crosslinks between beads that are close, at most one on each bead
  const cross: number[] = [], crossR0: number[] = [], linked = new Set<number>();
  const beadIds = K.map((k, i) => (k === BEAD ? i : -1)).filter((i) => i >= 0);
  const dist = (i: number, j: number) => Math.hypot(X[3 * i] - X[3 * j], X[3 * i + 1] - X[3 * j + 1], X[3 * i + 2] - X[3 * j + 2]);
  for (let tries = 0; cross.length / 2 < preset.cross && tries < 20000; tries++) {
    const i = beadIds[Math.floor(rnd() * beadIds.length)], j = beadIds[Math.floor(rnd() * beadIds.length)];
    if (i === j || linked.has(i) || linked.has(j)) continue;
    if (CH[i] === CH[j] && Math.abs(i - j) < 5) continue;
    const d = dist(i, j);
    if (d < 0.8 || d > 1.9) continue;
    cross.push(i, j); crossR0.push(1); linked.add(i); linked.add(j);
  }

  // 4. bonds from each particle or crystal to the binder beads next to it
  const anchors: Anchor[] = [];
  K.forEach((k, a) => {
    if (k !== FILLER && k !== CRYST) return;
    const near = beadIds.map((b) => ({ b, d: dist(a, b) })).filter((o) => o.d < RR[a] + 1.5).sort((p, q) => p.d - q.d).slice(0, k === CRYST ? 10 : 16);
    for (const o of near) anchors.push({ a, b: o.b, r0: Math.max(o.d, RR[a] + R_BEAD + 0.1), broken: false, strong: k === CRYST, over: 0 });
  });

  // 5. free plasticiser
  for (let k = 0; k < preset.plast; k++) add(place(R_PLAST, 1.1, 120), PLAST, R_PLAST, M_PLAST);

  const n = K.length;
  const s: System = {
    n, x: Float64Array.from(X), v: new Float64Array(3 * n), f: new Float64Array(3 * n),
    m: Float64Array.from(M), r: Float64Array.from(RR), kind: Uint8Array.from(K), fixed: Uint8Array.from(FX), chain: Int16Array.from(CH),
    bonds: Int32Array.from(bonds), bends: Int32Array.from(bends), kBend: preset.bend * 30,
    cross: Int32Array.from(cross), crossR0: Float64Array.from(crossR0), anchors, chains,
    box: Float64Array.from([half, half, half]), half, t: 0, preset, homes: null, strain: 0,
  };
  // let the overlaps of the random placement relax, with a low force cap, then cool to the start
  const noise = gaussian(mulberry32(seed * 7919 + 13));
  for (const a of s.anchors) a.strong = true; // nothing breaks while the placement relaxes
  forces(s, { T: 0.3 }, 40);
  for (let k = 0; k < 600; k++) step(s, { T: 0.3, dt: 0.008, gamma: 4 }, noise, 1, 40);
  // the bonds to the particles start at the length they have now
  for (const a of s.anchors) {
    a.strong = s.kind[a.a] === CRYST; a.over = 0;
    a.r0 = Math.max(Math.hypot(s.x[3 * a.b] - s.x[3 * a.a], s.x[3 * a.b + 1] - s.x[3 * a.a + 1], s.x[3 * a.b + 2] - s.x[3 * a.a + 2]), s.r[a.a] + R_BEAD + 0.05);
  }
  s.v.fill(0);
  s.t = 0;
  forces(s, { T: 0.3 });
  return s;
}

/**
 * Forces on every particle. A bond to a particle breaks when it stays stretched by more than DEWET for HOLD steps
 * (dewetting): a sustained pull breaks it, a brief thermal jolt does not.
 */
export function forces(s: System, P: Params, cap = F_MAX) {
  const { x, f, r, n } = s;
  f.fill(0);
  const spring = (i: number, j: number, k: number, r0: number) => {
    const dx = x[3 * j] - x[3 * i], dy = x[3 * j + 1] - x[3 * i + 1], dz = x[3 * j + 2] - x[3 * i + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9, F = (k * (d - r0)) / d;
    f[3 * i] += F * dx; f[3 * i + 1] += F * dy; f[3 * i + 2] += F * dz;
    f[3 * j] -= F * dx; f[3 * j + 1] -= F * dy; f[3 * j + 2] -= F * dz;
    return d;
  };
  const { bonds, bends, cross, crossR0 } = s;
  for (let k = 0; k < bonds.length; k += 2) spring(bonds[k], bonds[k + 1], K_BOND, 1);
  for (let k = 0; k < cross.length; k += 2) spring(cross[k], cross[k + 1], K_CROSS, crossR0[k / 2]);
  if (s.kBend > 0) for (let k = 0; k < bends.length; k += 3) spring(bends[k], bends[k + 2], s.kBend, BEND_R0);
  for (const a of s.anchors) {
    if (a.broken) continue;
    const i = a.a, j = a.b;
    const d = Math.hypot(x[3 * j] - x[3 * i], x[3 * j + 1] - x[3 * i + 1], x[3 * j + 2] - x[3 * i + 2]);
    if (!a.strong) {
      a.over = d > a.r0 + DEWET ? a.over + 1 : 0;
      if (a.over > HOLD) { a.broken = true; continue; }
    }
    spring(i, j, a.strong ? K_ANCHOR * 1.5 : K_ANCHOR, a.r0);
  }
  // excluded volume: a soft repulsion between every pair that overlaps
  for (let i = 0; i < n; i++) {
    const xi = x[3 * i], yi = x[3 * i + 1], zi = x[3 * i + 2], ri = r[i];
    for (let j = i + 1; j < n; j++) {
      const sum = ri + r[j];
      const dx = x[3 * j] - xi; if (dx > sum || dx < -sum) continue;
      const dy = x[3 * j + 1] - yi; if (dy > sum || dy < -sum) continue;
      const dz = x[3 * j + 2] - zi; if (dz > sum || dz < -sum) continue;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= sum * sum || d2 < 1e-12) continue;
      const d = Math.sqrt(d2), F = (K_EX * (sum - d)) / d;
      f[3 * i] -= F * dx; f[3 * i + 1] -= F * dy; f[3 * i + 2] -= F * dz;
      f[3 * j] += F * dx; f[3 * j + 1] += F * dy; f[3 * j + 2] += F * dz;
    }
  }
  // the walls of the box
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) {
      const lim = s.box[k] - r[i], c = x[3 * i + k];
      if (c > lim) f[3 * i + k] -= K_WALL * (c - lim);
      else if (c < -lim) f[3 * i + k] += K_WALL * (-lim - c);
    }
  }
  const pr = P.probe;
  if (pr) {
    for (let i = 0; i < n; i++) {
      const dx = x[3 * i] - pr.x, dy = x[3 * i + 1] - pr.y, dz = x[3 * i + 2] - pr.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9, reach = pr.R + r[i];
      if (d >= reach) continue;
      const F = (pr.K * (reach - d)) / d;
      f[3 * i] += F * dx; f[3 * i + 1] += F * dy; f[3 * i + 2] += F * dz;
    }
  }
  // during a stretch, each chain bead is held where the average stretch puts it (volume kept constant)
  if (s.homes) {
    const ex = 1 + s.strain, el = 1 / Math.sqrt(ex), h = s.homes;
    for (let i = 0; i < n; i++) {
      if (s.kind[i] !== BEAD || s.fixed[i]) continue;
      f[3 * i] += K_TETHER * (h[3 * i] * ex - x[3 * i]);
      f[3 * i + 1] += K_TETHER * (h[3 * i + 1] * el - x[3 * i + 1]);
      f[3 * i + 2] += K_TETHER * (h[3 * i + 2] * el - x[3 * i + 2]);
    }
  }
  const g = P.grab;
  if (g && g.i >= 0 && g.i < n) {
    f[3 * g.i] += g.K * (g.x - x[3 * g.i]); f[3 * g.i + 1] += g.K * (g.y - x[3 * g.i + 1]); f[3 * g.i + 2] += g.K * (g.z - x[3 * g.i + 2]);
  }
  for (let i = 0; i < n; i++) {
    const a = f[3 * i], b = f[3 * i + 1], c = f[3 * i + 2], F = Math.sqrt(a * a + b * b + c * c);
    if (F > cap) { const k = cap / F; f[3 * i] *= k; f[3 * i + 1] *= k; f[3 * i + 2] *= k; }
  }
}

/**
 * Advance the model by nSteps with BAOAB: half a kick, half a drift, the exact Ornstein–Uhlenbeck update of the
 * velocity (friction and noise together), half a drift, new forces, half a kick.
 */
export function step(s: System, P: Params, noise: () => number, nSteps = 1, cap = F_MAX) {
  const dt = P.dt ?? 0.012, g = P.gamma ?? 1, T = Math.max(0, P.T);
  const c1 = Math.exp(-g * dt), c2 = Math.sqrt(1 - c1 * c1), h = 0.5 * dt;
  const { x, v, f, m, fixed, n } = s;
  for (let k = 0; k < nSteps; k++) {
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      const im = 1 / m[i], sd = c2 * Math.sqrt(T * im);
      for (let d = 0; d < 3; d++) {
        const q = 3 * i + d;
        v[q] += h * f[q] * im;
        x[q] += h * v[q];
        v[q] = c1 * v[q] + sd * noise();
        x[q] += h * v[q];
      }
    }
    forces(s, P, cap);
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      const im = 1 / m[i];
      for (let d = 0; d < 3; d++) v[3 * i + d] += h * f[3 * i + d] * im;
    }
    s.t += dt;
  }
}

/**
 * Start a stretch along x. Each chain bead is held, by a stiff spring, at the place where the average stretch puts it:
 * the affine-network assumption. The springs stand in for the rest of the material outside the box. Particles,
 * crystals and plasticiser are not held: they go where the binder and their bonds take them.
 */
export function beginStretch(s: System) { s.homes = s.x.slice(); s.strain = 0; }
/** Set the stretch (0 to 1). The box gets longer with it; the held beads contract sideways, so the volume stays the same. */
export function setStrain(s: System, e: number) { s.strain = Math.max(0, Math.min(1, e)); s.box[0] = s.half * (1 + s.strain); }
/** End the stretch: the beads are free again. Bonds that broke stay broken. */
export function endStretch(s: System) { s.homes = null; s.strain = 0; s.box[0] = s.half; }

/** The kinetic temperature: the mean of m v² / 3 over the particles that can move. */
export function kineticTemperature(s: System) {
  let sum = 0, count = 0;
  for (let i = 0; i < s.n; i++) {
    if (s.fixed[i]) continue;
    const a = s.v[3 * i], b = s.v[3 * i + 1], c = s.v[3 * i + 2];
    sum += s.m[i] * (a * a + b * b + c * c); count++;
  }
  return count ? sum / (3 * count) : 0;
}

/** Root-mean-square displacement of one kind of particle since a snapshot of the positions. */
export function rmsDisplacement(s: System, snap: Float64Array, kind: number) {
  let sum = 0, count = 0;
  for (let i = 0; i < s.n; i++) {
    if (s.kind[i] !== kind || s.fixed[i]) continue;
    const a = s.x[3 * i] - snap[3 * i], b = s.x[3 * i + 1] - snap[3 * i + 1], c = s.x[3 * i + 2] - snap[3 * i + 2];
    sum += a * a + b * b + c * c; count++;
  }
  return count ? Math.sqrt(sum / count) : NaN;
}

/** Bonds between binder and particles: how many there are, how many broke, and how many of those were at the poles. */
export function dewetting(s: System) {
  let total = 0, broken = 0, poles = 0, polesTotal = 0;
  for (const a of s.anchors) {
    if (a.strong) continue;
    total++;
    const dx = s.x[3 * a.b] - s.x[3 * a.a], dy = s.x[3 * a.b + 1] - s.x[3 * a.a + 1], dz = s.x[3 * a.b + 2] - s.x[3 * a.a + 2];
    const pole = Math.abs(dx) / (Math.hypot(dx, dy, dz) || 1) > Math.SQRT1_2; // within 45° of the stretch direction
    if (pole) polesTotal++;
    if (a.broken) { broken++; if (pole) poles++; }
  }
  return { total, broken, poles, polesTotal };
}

/** Bond lengths: the mean and the longest. */
export function bondStats(s: System) {
  let sum = 0, max = 0;
  const b = s.bonds;
  for (let k = 0; k < b.length; k += 2) {
    const i = b[k], j = b[k + 1];
    const d = Math.hypot(s.x[3 * j] - s.x[3 * i], s.x[3 * j + 1] - s.x[3 * i + 1], s.x[3 * j + 2] - s.x[3 * i + 2]);
    sum += d; if (d > max) max = d;
  }
  return { mean: sum / (b.length / 2), max };
}
