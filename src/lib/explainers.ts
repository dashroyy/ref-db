// The state functions of the explainer animations (Explainer.astro, src/lib/explainer.ts). Each one turns the
// progress of its stages into SVG attributes, keyed by the data-k attribute of each element. All the geometry is
// schematic. The random grain and atom positions use a fixed seed, so the server and the browser draw the same picture.

import { attrs, clamp01, ease, lerp, r2, seg, type State } from './explainer.ts';

export { attrs };

const rng = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const frac = (x: number) => x - Math.floor(x);
/** The stage that the progress list is in: the last stage that has started. */
export const stageOf = (p: number[]) => {
  let k = 0;
  p.forEach((u, i) => {
    if (u > 0) k = i;
  });
  return k;
};

// ---------------------------------------------------------------------------------------------------------------------
// 1. Why a cylinder splits along its length (motor/case-sizing)
// ---------------------------------------------------------------------------------------------------------------------
export const CYL = {
  ms: [2400, 2200, 2400, 2400],
  body: 'M130,95 L390,95 A70,70 0 0 1 390,235 L130,235 A70,70 0 0 1 130,95 Z',
  cy: 165,
  el: { x: 200, half: 13, hoop: 42 },
  dome: { x: 420, half: 13 },
  crack: { x: 318, len: 60, open: 8 },
  dial: { x: 650, y: 108, r: 58 },
  bar: { x: 540, w: 260 },
};

/** The pressure as a fraction of the burst pressure. Burst is when the hoop stress gets to the strength. */
export const cylPressure = ([u1 = 1, , u3 = 1]: number[]) => 0.55 * ease(u1) + 0.45 * ease(u3);

export function cylinder(p: number[]): State {
  const [, u2 = 1, u3 = 1, u4 = 1] = p;
  const { cy, el, dome, crack, dial, bar } = CYL;
  const pr = cylPressure(p);
  const h = el.hoop * pr; // the hoop arrows
  const a = h / 2; // the axial arrows, and the dome arrows in both directions
  const th = Math.PI * (1 - pr);
  const L = crack.len * ease(seg(u4, 0, 0.6));
  const o = crack.open * ease(seg(u4, 0.35, 1));
  const hit = u3 > 0.97;
  const arc = Math.PI * dial.r;
  const pct = Math.round(100 * pr);
  return {
    needle: { x2: r2(dial.x + (dial.r - 10) * Math.cos(th)), y2: r2(dial.y - (dial.r - 10) * Math.sin(th)) },
    parc: { 'stroke-dasharray': `${r2(arc * pr)} ${r2(arc)}` },
    pval: { text: `${pct} % of burst` },
    hbar: { width: r2(bar.w * pr) },
    abar: { width: r2((bar.w / 2) * pr) },
    hval: { text: `σh = ${pct} % of the strength` },
    aval: { text: `σa = ${Math.round(pct / 2)} % of the strength` },
    slim: { stroke: hit ? 'var(--rd-accent)' : 'var(--rd-muted)' },
    slab: { fill: hit ? 'var(--rd-accent)' : 'var(--rd-muted)' },
    arrows: { opacity: pr > 0.03 ? 1 : 0 },
    eh1: { y2: r2(cy - el.half - h) },
    eh2: { y2: r2(cy + el.half + h) },
    ea1: { x2: r2(el.x - el.half - a) },
    ea2: { x2: r2(el.x + el.half + a) },
    ed1: { y2: r2(cy - dome.half - a) },
    ed2: { y2: r2(cy + dome.half + a) },
    ed3: { x2: r2(dome.x - dome.half - a) },
    ed4: { x2: r2(dome.x + dome.half + a) },
    elab: { opacity: r2(seg(u2, 0, 0.6)) },
    hl: { opacity: r2(Math.sin(Math.PI * clamp01(u2))) },
    crack: {
      d: `M${r2(crack.x - L)},${cy} Q${crack.x},${r2(cy - o)} ${r2(crack.x + L)},${cy} Q${crack.x},${r2(cy + o)} ${r2(crack.x - L)},${cy} Z`,
      opacity: L > 0.5 ? 1 : 0,
    },
    clab: { opacity: r2(seg(u4, 0.55, 1)) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Peripheral coarse grain (materials/specification)
// ---------------------------------------------------------------------------------------------------------------------
const pcgGeometry = () => {
  const R = rng(11);
  // the coarse grains: one row of large cells from the surface (y 90) down to an irregular front
  const xs: number[] = [432];
  while (xs[xs.length - 1] < 846) xs.push(xs[xs.length - 1] + 46 + 30 * R());
  const top = xs.map((x) => r2(x + (R() - 0.5) * 10));
  const bot = xs.map((x) => r2(x + (R() - 0.5) * 24));
  const dep = xs.map(() => r2(126 + 16 * R()));
  const cells = xs.slice(0, -1).map((_, i) => {
    const mx = r2((bot[i] + bot[i + 1]) / 2);
    const my = r2((dep[i] + dep[i + 1]) / 2 + 5 * (R() - 0.3));
    return { d: `M${top[i]},90 L${top[i + 1]},90 L${bot[i + 1]},${dep[i + 1]} L${mx},${my} L${bot[i]},${dep[i]} Z`, op: r2(0.14 + 0.22 * R()), my };
  });
  const front = xs
    .map((_, i) => `${bot[i]},${dep[i]}${i < cells.length ? ` ${r2((bot[i] + bot[i + 1]) / 2)},${cells[i].my}` : ''}`)
    .join(' ');
  const deepest = Math.max(...dep, ...cells.map((c) => c.my));
  // the fine, fibrous core: rows of long, thin grains
  const fib: { x1: number; x2: number; y: number }[] = [];
  for (let y = 94; y <= 296; y += 8) {
    let x = 440 - 40 * R();
    while (x < 840) {
      const len = 26 + 40 * R();
      fib.push({ x1: r2(x), x2: r2(x + len), y });
      x += len + 6 + 8 * R();
    }
  }
  // the coarse ring on the etched slice: radial grain boundaries
  const ring = Array.from({ length: 14 }, (_, i) => r2(((i + 0.6 * R()) / 14) * 2 * Math.PI));
  return { cells, front, deepest, fib, ring };
};
const PG = pcgGeometry();

export const PCG = {
  ms: [2800, 2800, 2600, 2400],
  ...PG,
  stock: Math.ceil(PG.deepest) + 10, // the machined surface: deeper than the deepest coarse grain
};

export function pcg(p: number[]): State {
  const [u1 = 1, u2 = 1, u3 = 1, u4 = 1] = p;
  const e1 = ease(u1);
  const ramX = 46 + 54 * e1;
  const barLen = 138 * e1;
  const det = ease(seg(u1, 0.35, 0.85));
  const heat = Math.sin(Math.PI * clamp01(u2));
  const grow = ease(u2);
  const cut = ease(u3);
  const toolX = lerp(850, 430, cut);
  const fin = ease(seg(u4, 0, 0.6));
  return {
    rod: { width: r2(ramX - 20) },
    ram: { x: r2(ramX) },
    billet: { x: r2(ramX + 20), width: r2(230 - ramX) },
    pat: { patternTransform: `translate(${r2(ramX - 46)} 0)` },
    bar: { transform: `translate(${r2(barLen - 138)} 0)` },
    barlab: { opacity: r2(seg(u1, 0.5, 1)) },
    skin: { opacity: r2(1 - cut) },
    skinW: { opacity: r2(0.9 * e1 * (1 - grow)) },
    skinP: { opacity: r2(0.9 * grow) },
    barfin: { opacity: r2(cut) },
    furn: { opacity: r2(0.3 * heat) },
    furnlab: { opacity: r2(heat) },
    det: { opacity: r2(det) },
    reveal: { height: r2((PCG.deepest - 86) * grow) },
    shear: { opacity: r2(1 - ease(seg(u2, 0.25, 0.9))) },
    shearlab: { opacity: r2(det * (1 - ease(seg(u2, 0, 0.45)))) },
    pcglab: { opacity: r2(ease(seg(u2, 0.5, 1)) * (1 - ease(seg(u3, 0, 0.3)))) },
    dheat: { opacity: r2(0.16 * heat) },
    cutR: { x: r2(toolX), width: r2(Math.max(0, 840 - toolX)) },
    newS: { x1: r2(Math.min(840, toolX)) },
    tool: { transform: `translate(${r2(toolX)} 0)`, opacity: u3 > 0 && u3 < 1 ? 1 : 0 },
    ghost: { opacity: r2(fin) },
    finlab: { opacity: r2(ease(seg(u4, 0.4, 1))) },
    slice: { opacity: r2(fin) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 3. Hydrogen embrittlement and the bake (materials/coatings)
// ---------------------------------------------------------------------------------------------------------------------
const HB_BAR = { x0: 50, x1: 370, top: 110, bot: 200, cx: 210, half: 16, tip: 146 };
const hbCrack = [
  [0, 146],
  [5, 158],
  [-3, 170],
  [4, 182],
  [-2, 192],
  [2, 200],
] as const;
const hbAtoms = () => {
  const R = rng(5);
  const { x0, x1, top, bot, cx } = HB_BAR;
  return Array.from({ length: 28 }, (_, i) => {
    const up = i % 5 < 3; // three of five atoms come in at the top face
    let x = x0 + 10 + (x1 - x0 - 20) * R();
    if (up && Math.abs(x - cx) < 24) x += x < cx ? -26 : 26;
    const d = 8 + 26 * R();
    const p0 = { x, y: up ? top - 8 - 14 * R() : bot + 8 + 14 * R() };
    const p1 = { x: x + (R() - 0.5) * 10, y: up ? top + d : bot - d };
    const th = Math.PI * (0.12 + 0.76 * R());
    const rr = 5 + 16 * R();
    const p3 = { x: cx + rr * Math.cos(th), y: HB_BAR.tip + 2 + rr * Math.sin(th) };
    return { p0, p1, out: up ? -42 : 42, p3, ph: R(), stays: i < 3 };
  });
};
const HB_ATOMS = hbAtoms();
const hbLen = hbCrack.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - hbCrack[i][0], y - hbCrack[i][1]), 0);

export const HBAKE = {
  ms: [3000, 2800, 2600, 2600],
  bar: HB_BAR,
  atoms: HB_ATOMS.length,
  crackLen: r2(hbLen),
  /** The outline of an intact bar, shifted by ox. */
  outline: (ox: number) => {
    const { x0, x1, top, bot, cx, half, tip } = HB_BAR;
    return `M${x0 + ox},${top} L${cx - half + ox},${top} L${cx + ox},${tip} L${cx + half + ox},${top} L${x1 + ox},${top} L${x1 + ox},${bot} L${x0 + ox},${bot} Z`;
  },
  /** The two halves of the bar that cracks, split along the crack path. */
  halves: (ox: number) => {
    const { x0, x1, top, bot, cx, half } = HB_BAR;
    const path = hbCrack.map(([dx, y]) => `${cx + dx + ox},${y}`);
    return {
      left: `M${x0 + ox},${top} L${cx - half + ox},${top} L${path.join(' L')} L${x0 + ox},${bot} Z`,
      right: `M${cx + half + ox},${top} L${x1 + ox},${top} L${x1 + ox},${bot} L${[...path].reverse().join(' L')} Z`,
      leftPlate: `M${cx + ox},${hbCrack[0][1]} L${cx - half + ox},${top} L${x0 + ox},${top} L${x0 + ox},${bot} L${cx + hbCrack[5][0] + ox},${bot}`,
      rightPlate: `M${cx + ox},${hbCrack[0][1]} L${cx + half + ox},${top} L${x1 + ox},${top} L${x1 + ox},${bot} L${cx + hbCrack[5][0] + ox},${bot}`,
      crack: `M${path.join(' L')}`,
    };
  },
};

const HB_TEXT = {
  a: ['Plating: hydrogen goes in', 'Baking: the hydrogen goes out', 'Under a sustained load', 'Baked: no crack'],
  b: ['Plating: hydrogen goes in', 'Not baked: the hydrogen stays', 'Hydrogen moves to the notch root', 'Not baked: cracked, later'],
};

export function hbake(p: number[]): State {
  const [u1 = 1, u2 = 1, u3 = 1, u4 = 1] = p;
  // the result shows when the crack has grown, not when its stage starts
  const k = stageOf(p) === 3 && u4 < 0.5 ? 2 : stageOf(p);
  const B = 430;
  const { x0, x1, cx } = HB_BAR;
  const inn = ease(seg(u1, 0.3, 1));
  const show = seg(u1, 0, 0.25);
  const bakeOut = ease(seg(u2, 0.1, 0.9));
  const gather = ease(u3);
  const grow = ease(seg(u4, 0, 0.6));
  const gap = 10 * ease(seg(u4, 0.6, 1));
  const load = 26 * ease(u3);
  const s: State = {
    bathA: { opacity: r2(0.16 * seg(u1, 0, 0.15) * (1 - seg(u1, 0.8, 1))) },
    bathB: { opacity: r2(0.16 * seg(u1, 0, 0.15) * (1 - seg(u1, 0.8, 1))) },
    bathlab: { opacity: r2(seg(u1, 0, 0.15) * (1 - seg(u1, 0.8, 1))) },
    plateA: { 'stroke-width': r2(5 * ease(seg(u1, 0, 0.6))) },
    plateBL: { 'stroke-width': r2(5 * ease(seg(u1, 0, 0.6))) },
    plateBR: { 'stroke-width': r2(5 * ease(seg(u1, 0, 0.6))) },
    heat: { opacity: r2(0.32 * Math.sin(Math.PI * clamp01(u2))) },
    heatlab: { opacity: r2(Math.sin(Math.PI * clamp01(u2))) },
    glowA: { opacity: r2(0.55 * gather) },
    glowB: { opacity: r2(0.55 * gather) },
    loadA: { opacity: load > 0.5 ? 1 : 0 },
    la1: { x2: r2(x0 - 6 - load) },
    la2: { x2: r2(x1 + 6 + load) },
    loadB: { opacity: load > 0.5 ? 1 : 0 },
    lb1: { x1: r2(x0 + B - 6 - gap / 2), x2: r2(x0 + B - 6 - load - gap / 2) },
    lb2: { x1: r2(x1 + B + 6 + gap / 2), x2: r2(x1 + B + 6 + load + gap / 2) },
    halfL: { transform: `translate(${r2(-gap / 2)} 0)` },
    halfR: { transform: `translate(${r2(gap / 2)} 0)` },
    // one fill while the part is whole, two when it has come apart (two touching fills show a seam)
    wholeB: { opacity: gap > 0.01 ? 0 : 1 },
    fillL: { opacity: gap > 0.01 ? 1 : 0 },
    fillR: { opacity: gap > 0.01 ? 1 : 0 },
    crack: {
      'stroke-dasharray': `${r2(HBAKE.crackLen * grow)} ${r2(HBAKE.crackLen + 10)}`,
      opacity: grow > 0 ? r2(1 - ease(seg(u4, 0.62, 0.8))) : 0,
    },
    statA: { text: HB_TEXT.a[k], fill: k === 3 ? 'var(--rd-ok)' : 'var(--rd-ink)' },
    statB: { text: HB_TEXT.b[k], fill: k === 3 ? 'var(--rd-accent)' : 'var(--rd-ink)' },
  };
  HB_ATOMS.forEach((a, i) => {
    // panel A: in, then out with the bake (three stay)
    let x = lerp(a.p0.x, a.p1.x, inn);
    let y = lerp(a.p0.y, a.p1.y, inn);
    let op = show;
    if (!a.stays) {
      y += a.out * bakeOut;
      op *= 1 - ease(seg(u2, 0.35, 0.9));
    }
    s[`ha${i}`] = { cx: r2(x), cy: r2(y), opacity: r2(op) };
    // panel B: in, about in place while it waits, then to the notch root under load
    const j = 2.2 * Math.sin(Math.PI * clamp01(u2));
    x = lerp(a.p0.x, a.p1.x, inn) + j * Math.sin(2 * Math.PI * (3 * u2 + a.ph));
    y = lerp(a.p0.y, a.p1.y, inn) + j * Math.cos(2 * Math.PI * (3 * u2 + a.ph));
    x = lerp(x, a.p3.x, gather);
    y = lerp(y, a.p3.y, gather);
    x += (x < cx ? -1 : 1) * (gap / 2);
    s[`hb${i}`] = { cx: r2(x + B), cy: r2(y), opacity: r2(show) };
  });
  return s;
}

// ---------------------------------------------------------------------------------------------------------------------
// 4. Leak before break, or burst (verify/leak-before-break)
// ---------------------------------------------------------------------------------------------------------------------
// The face of the crack: the wall is 100 units thick (y 120 outside to 220 inside). The crack grows by a Paris law
// with m = 3, so at a constant rate of cycles the growth rate increases with the depth.
const LB_A0 = 12;
const LB_K = Math.sqrt(100 / LB_A0) - 1;
/** The crack depth (0 to 100) after the fraction tau of the cycles to breakthrough. */
export const lbDepth = (tau: number) => 100 / (Math.sqrt(100 / LB_A0) - LB_K * tau) ** 2;
/** The half-length of the crack: it becomes more semicircular as it grows, and longer near the back face. */
export const lbHalf = (a: number) => 26 + 0.8 * (a - LB_A0) + 40 * Math.max(0, (a - 70) / 30) ** 2;
const LB_CRIT = 55; // the critical depth in the low-toughness wall
/** The fraction of the cycles at which the crack in the low-toughness wall gets to its critical size. */
export const LB_TAU_B = (Math.sqrt(100 / LB_A0) - Math.sqrt(100 / LB_CRIT)) / LB_K;
const LB_N = 2000;
const LB_MARKS = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];

/** A crack shape on the inner surface (y 220): depth a, half-length c, and a flat top of half-length cOut. */
export const lbShape = (cx: number, a: number, c: number, cOut = 0) => {
  const k = 0.5523;
  const y = 220 - a;
  return (
    `M${r2(cx - c)},220 C${r2(cx - c)},${r2(220 - k * a)} ${r2(cx - cOut - k * (c - cOut))},${r2(y)} ${r2(cx - cOut)},${r2(y)} ` +
    `L${r2(cx + cOut)},${r2(y)} C${r2(cx + cOut + k * (c - cOut))},${r2(y)} ${r2(cx + c)},${r2(220 - k * a)} ${r2(cx + c)},220 Z`
  );
};

export const LBB = {
  ms: [1800, 3800, 2800, 2800],
  cxA: 225,
  cxB: 645,
  crit: { a: LB_CRIT, c: r2(lbHalf(LB_CRIT)) },
  marks: LB_MARKS.map((tau) => ({ tau, a: r2(lbDepth(tau)), c: r2(lbHalf(lbDepth(tau))) })),
  through: r2(0.75 * lbHalf(100)),
  critLen: 150,
  puffs: [
    { dx: -10, ph: 0, r: 5 },
    { dx: 8, ph: 0.25, r: 6.5 },
    { dx: -2, ph: 0.5, r: 4.5 },
    { dx: 12, ph: 0.75, r: 5.5 },
  ],
};

export function lbb(p: number[]): State {
  const [u1 = 1, u2 = 1, u3 = 1, u4 = 1] = p;
  const { cxA, cxB } = LBB;
  const flaw = ease(u1);
  const tau = LB_TAU_B * u2 + (1 - LB_TAU_B) * u3; // panel A
  const tauB = LB_TAU_B * u2; // panel B, until it bursts
  const aA = u2 > 0 ? lbDepth(tau) : LB_A0 * flaw;
  const cA = u2 > 0 ? lbHalf(aA) : lbHalf(LB_A0) * flaw;
  const cOut = LBB.through * ease(seg(u4, 0, 0.35));
  const ff = ease(seg(u3, 0, 0.35)); // fast fracture in panel B
  const aB0 = u2 > 0 ? lbDepth(tauB) : LB_A0 * flaw;
  const cB0 = u2 > 0 ? lbHalf(aB0) : lbHalf(LB_A0) * flaw;
  const aB = lerp(aB0, 170, ff);
  const cB = lerp(cB0, 240, ff);
  const presA = 1 - 0.85 * ease(seg(u4, 0.25, 1));
  const presB = 1 - ease(seg(u3, 0.05, 0.2));
  const s: State = {
    crackA: { d: lbShape(cxA, Math.min(aA, 100), cA, cOut), opacity: flaw > 0.01 ? 1 : 0 },
    crackB: { d: lbShape(cxB, Math.min(aB0, 100), cB0), opacity: flaw > 0.01 ? 1 : 0 },
    ffB: { d: lbShape(cxB, aB, cB), opacity: ff > 0 ? 1 : 0 },
    flawlab: { opacity: r2(seg(u1, 0.4, 1) * (1 - seg(u2, 0, 0.2))) },
    critB: { opacity: r2(1 - seg(u3, 0, 0.2)) },
    burst: { opacity: r2(seg(u3, 0.2, 0.5)) },
    leak: { opacity: r2(seg(u4, 0.3, 0.7)) },
    bracket: { opacity: r2(seg(u4, 0.4, 0.8)) },
    presA: { width: r2(120 * presA) },
    presB: { width: r2(120 * presB) },
    nA: { text: `${Math.round(LB_N * tau)} cycles` },
    nB: { text: `${Math.round(LB_N * tauB)} cycles` },
  };
  LB_MARKS.forEach((m, i) => {
    s[`mA${i}`] = { opacity: tau >= m ? 0.6 : 0 };
    s[`mB${i}`] = { opacity: tauB >= m ? 0.6 : 0 };
  });
  LBB.puffs.forEach((f, i) => {
    const z = frac(1.6 * u4 + f.ph);
    s[`puff${i}`] = { cy: r2(116 - 54 * z), opacity: r2(seg(u4, 0.3, 0.45) * (1 - z) * 0.8) };
  });
  return s;
}

// ---------------------------------------------------------------------------------------------------------------------
// 5. Preload and the joint diagram (joints/bolted-joints)
// ---------------------------------------------------------------------------------------------------------------------
// Forces in units of the preload Fi. The load factor and the loads are for this example only.
const BJ_PHI = 0.2;
const BJ_P1 = 0.8; // the working load
const BJ_POVER = 1.5; // the overload, above the separation load
/** The bolt force and the clamp force at a preload s (0 to 1 of Fi) and an external load P. */
export const boltForces = (s: number, P: number, phi = BJ_PHI) => {
  const sep = s / (1 - phi);
  return P < sep ? { fb: s + phi * P, fc: s - (1 - phi) * P, open: false } : { fb: P, fc: 0, open: true };
};
const BJ_D = { ox: 480, oy: 280, sx: 200, sy: 120 }; // the joint diagram: origin, px per bolt stretch at Fi, px per Fi
export const BOLT = {
  ms: [2400, 2400, 3200, 2800],
  phi: BJ_PHI,
  p1: BJ_P1,
  pover: BJ_POVER,
  psep: 1 / (1 - BJ_PHI),
  diagram: BJ_D,
  /** The width of a force bar (the track is 300 px for 1.6 Fi). */
  barW: (f: number) => r2((300 * f) / 1.6),
};
/** The external load and the preload at each moment. */
export const boltLoad = ([u1 = 1, u2 = 1, u3 = 1, u4 = 1]: number[]) => {
  const s = ease(u1);
  let P = 0;
  if (u4 > 0) P = lerp(BJ_P1, BJ_POVER, ease(u4));
  else if (u3 > 0) P = (BJ_P1 * (1 + Math.cos(4 * Math.PI * u3))) / 2;
  else P = BJ_P1 * ease(u2);
  return { s, P };
};
const BJ_TEXT = ['Tightening', 'Working load', 'Load cycles', 'Joint open'];

export function bolt(p: number[]): State {
  const [, , u3 = 1, u4 = 1] = p;
  const { s, P } = boltLoad(p);
  const { fb, fc, open } = boltForces(s, P);
  const { ox, oy, sx, sy } = BJ_D;
  const k = stageOf(p);
  // the gap in the section, exaggerated
  const g = open ? Math.min(8, (8 * (P - s / (1 - BJ_PHI))) / (BJ_POVER - 1 / (1 - BJ_PHI))) : 0;
  const lp = (36 * P) / BJ_POVER;
  // the diagram: the preload point A and the zero point B of the clamped parts, scaled by the preload while tightening
  const xA = ox + sx * s;
  const yA = oy - sy * s;
  const xB = ox + sx * s * (1 + BJ_PHI / (1 - BJ_PHI));
  const x = ox + sx * fb; // the bolt stretch is proportional to the bolt force
  const yb = oy - sy * fb;
  const yc = oy - sy * fc;
  const range = seg(u3, 0, 0.3);
  return {
    top: { transform: `translate(0 ${r2(-g / 2)})` },
    bot: { transform: `translate(0 ${r2(g / 2)})` },
    shankBase: { y: r2(120 - g / 2), height: r2(80 + g) },
    shank: { y: r2(120 - g / 2), height: r2(80 + g), 'fill-opacity': r2(0.15 + (0.6 * fb) / 1.6) },
    conesT: { 'fill-opacity': r2(0.08 + 0.6 * Math.max(0, fc)) },
    conesB: { 'fill-opacity': r2(0.08 + 0.6 * Math.max(0, fc)) },
    parr: { opacity: P > 0.03 ? 1 : 0 },
    pa1: { y1: r2(120 - g / 2), y2: r2(120 - g / 2 - lp) },
    pa2: { y1: r2(120 - g / 2), y2: r2(120 - g / 2 - lp) },
    pa3: { y1: r2(200 + g / 2), y2: r2(200 + g / 2 + lp) },
    pa4: { y1: r2(200 + g / 2), y2: r2(200 + g / 2 + lp) },
    pt1: { y: r2(120 - g / 2 - lp + 4) },
    pt2: { y: r2(200 + g / 2 + lp + 4) },
    fbBar: { width: BOLT.barW(fb) },
    fcBar: { width: BOLT.barW(Math.max(0, fc)) },
    fbLab: { text: `BOLT FORCE Fb = ${fb.toFixed(2)} Fi` },
    fcLab: { text: `CLAMP FORCE Fc = ${Math.max(0, fc).toFixed(2)} Fi` },
    stat: { text: BJ_TEXT[k], fill: open ? 'var(--rd-accent)' : 'var(--rd-muted)' },
    // the diagram
    triB: { x2: r2(xA), y2: r2(yA), opacity: s > 0.01 ? 1 : 0 },
    triM: { x1: r2(xA), y1: r2(yA), x2: r2(xB), y2: oy, opacity: s > 0.01 ? 1 : 0 },
    fiLine: { x2: r2(Math.max(xA, x) + 6), y1: r2(yA), y2: r2(yA), opacity: s > 0.01 ? 1 : 0 },
    fiLab: { y: r2(yA + 4), opacity: s > 0.3 ? 1 : 0 },
    ext: { opacity: P > 0.03 || k > 0 ? 1 : 0 },
    ptB: { cx: r2(x), cy: r2(yb), opacity: s > 0.01 ? 1 : 0 },
    ptC: { cx: r2(x), cy: r2(yc), opacity: s > 0.01 ? 1 : 0 },
    pSeg: { x1: r2(x), x2: r2(x), y1: r2(yc), y2: r2(yb), opacity: P > 0.03 ? 1 : 0 },
    pLab: { x: r2(x + 8), y: r2((yb + yc) / 2 + 4), opacity: P > 0.15 ? 1 : 0 },
    rangeB: { opacity: r2(range) },
    rangeC: { opacity: r2(range) },
    sepLab: { opacity: r2(open ? 1 : 0) },
    openLab: { opacity: r2(seg(u4, 0.6, 1)) },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 6. O-ring squeeze, pressure and extrusion (seals/o-ring-design)
// ---------------------------------------------------------------------------------------------------------------------
/** The gamma function (Lanczos approximation), for the area of a superellipse. */
export const gamma = (z: number): number => {
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const x0 = z - 1;
  let a = c[0];
  const t = x0 + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x0 + i);
  return Math.sqrt(2 * Math.PI) * t ** (x0 + 0.5) * Math.exp(-t) * a;
};
/** The area of one half (x >= 0) of a superellipse with semi-axes a, b and exponent n, divided by a b. */
export const kappa = (n: number) => (2 * gamma(1 + 1 / n) ** 2) / gamma(1 + 2 / n);

export const OR = {
  ms: [2400, 2600, 2600, 3200],
  r: 50, // the free section radius
  bottom: 180, // the groove bottom
  land: 106, // the top of the piston lands
  left: 130, // the groove wall on the pressure side
  wall: 260, // the wall on the low-pressure side (the back-up ring is beyond it in panel B)
  B: 440, // the offset of panel B
  cut: [0.25, 0.75], // the moments in stage 4 when the closing gap cuts a piece from ring A
};
/** The pressure (0 to 1) and the bottom of the housing at each moment. */
export const oringLoad = ([u1 = 1, u2 = 1, u3 = 1, u4 = 1]: number[]) => {
  let pr = 0;
  if (u4 > 0) pr = 0.6 + 0.4 * Math.cos(4 * Math.PI * u4);
  else if (u3 > 0) pr = 0.5 + 0.5 * ease(u3);
  else pr = 0.5 * ease(u2);
  const yb = u2 > 0 ? 100 - 5 * pr : lerp(70, 100, ease(u1));
  return { pr, yb, push: ease(u2) };
};
/** The section of the ring: a superellipse with a flatter right side when the pressure pushes it to the wall. */
export const oringShape = (yb: number, push: number) => {
  const { r, bottom, wall, left } = OR;
  const g = bottom - yb;
  const b = Math.min(r, g / 2);
  const cy = bottom - b;
  const sq = clamp01((2 * r - g) / (0.4 * r)); // 1 at a squeeze of 20%
  const nL = 2 + 0.6 * sq;
  const nR = nL + 1.4 * push;
  const area = Math.PI * r * r;
  const aSym = area / (b * 2 * kappa(nL));
  const aR = lerp(aSym, 0.9 * aSym, push);
  const aL = (area / b - aR * kappa(nR)) / kappa(nL);
  const cx = lerp((left + wall) / 2, wall - aR, push);
  const pts: [number, number][] = [];
  for (let i = 0; i < 72; i++) {
    const th = (2 * Math.PI * i) / 72;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const n = c >= 0 ? nR : nL;
    const a = c >= 0 ? aR : aL;
    pts.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / n), cy + b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return { pts, cx, cy, b, aL, aR, nL, nR, squeeze: Math.max(0, (2 * r - g) / (2 * r)), leftX: cx - aL };
};
/** The area of a polygon (shoelace). */
export const polyArea = (pts: [number, number][]) =>
  Math.abs(pts.reduce((s, [x, y], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    return s + x * y2 - x2 * y;
  }, 0)) / 2;
const ptsPath = (pts: [number, number][], dx = 0) => `M${pts.map(([x, y]) => `${r2(x + dx)},${r2(y)}`).join(' L')} Z`;

/** The pressure fluid: the clearance on the pressure side and the groove up to the ring. */
const fluid = (yb: number, leftX: number, dx: number) => {
  const { left, bottom, land } = OR;
  const x = Math.max(left, leftX + 8);
  return [
    [20, yb],
    [x, yb],
    [x, bottom],
    [left, bottom],
    [left, land],
    [20, land],
  ]
    .map(([a, b]) => `${r2(a + dx)},${r2(b)}`)
    .join(' ');
};

export function oring(p: number[]): State {
  const [, , u3 = 1, u4 = 1] = p;
  const { pr, yb, push } = oringLoad(p);
  const sh = oringShape(yb, push);
  const { B, wall, land, cut } = OR;
  const k = stageOf(p);
  const c = land - yb; // the clearance gap
  // panel A: the rubber flows into the gap at high pressure; the closing gap cuts it twice in stage 4
  const L = u3 > 0 ? 24 * clamp01((pr - 0.55) / 0.45) : 0;
  const tongue = L > 0.5
    ? `M${wall - 8},${r2(yb)} L${r2(wall + L - c / 2)},${r2(yb)} Q${r2(wall + L)},${r2(yb)} ${r2(wall + L)},${r2(yb + c / 2)} Q${r2(wall + L)},${land} ${r2(wall + L - c / 2)},${land} L${wall - 8},${land} Z`
    : 'M0,0 Z';
  const cuts = cut.filter((m) => u4 >= m).length;
  const sqStress = 0.4 * (sh.squeeze / 0.2);
  const contact = sqStress + pr;
  const s: State = {
    hsgA: { height: r2(yb - 40) },
    hsgB: { height: r2(yb - 40) },
    ringA: { d: ptsPath(sh.pts) },
    ringB: { d: ptsPath(sh.pts, B) },
    tongue: { d: tongue },
    notch: {
      points: `${wall},${r2(yb)} ${r2(wall - 7 * cuts)},${r2(yb)} ${wall},${r2(yb + 7 * cuts)}`,
      opacity: cuts ? 1 : 0,
    },
    bur: { y: r2(yb), height: r2(180 - yb) },
    fluidA: { points: fluid(yb, sh.leftX, 0), opacity: r2(0.4 * clamp01(pr / 0.3)) },
    fluidB: { points: fluid(yb, sh.leftX, B), opacity: r2(0.4 * clamp01(pr / 0.3)) },
    parrA: { y1: r2((yb + land) / 2), y2: r2((yb + land) / 2), opacity: pr > 0.05 ? 1 : 0 },
    parrB: { y1: r2((yb + land) / 2), y2: r2((yb + land) / 2), opacity: pr > 0.05 ? 1 : 0 },
    prA: { width: r2((200 * pr) / 1.5) },
    prB: { width: r2((200 * pr) / 1.5) },
    csA: { width: r2((200 * contact) / 1.5) },
    csB: { width: r2((200 * contact) / 1.5) },
    sqLab: { text: `squeeze ${Math.round(100 * sh.squeeze)} %`, opacity: sh.squeeze > 0.01 ? 1 : 0 },
    statA: { text: cuts ? 'Nibbled: it will leak' : (k === 2 && L > 2) || k === 3 ? 'Extruding into the gap' : '', fill: 'var(--rd-accent)' },
    statB: { text: k >= 2 ? 'Sealed' : '', fill: 'var(--rd-ok)' },
  };
  cut.forEach((m, i) => {
    // a cut piece moves out along the gap and stays there
    const v = ease(seg(u4, m, m + 0.15));
    s[`flake${i}`] = {
      cx: r2(lerp(wall + 6, 300 + 34 * i, v)),
      cy: r2((yb + land) / 2),
      ry: r2(Math.max(2, c / 2 - 1)),
      opacity: u4 >= m ? 1 : 0,
    };
  });
  return s;
}
// ---------------------------------------------------------------------------------------------------------------------
// 7. A galvanic cell at a joint, and how to stop it (materials/galvanic)
// ---------------------------------------------------------------------------------------------------------------------
const GV_MS = [2000, 3000, 3000, 2600];
/** The integral of the smoothstep from 0 to x (x from 0 to 1). */
const S1 = (x: number) => x ** 3 - x ** 4 / 2;
/** The integral of ease(seg(v, a, b)) for v from 0 to u. */
const easeInt = (u: number, a: number, b: number) => (b - a) * S1(seg(u, a, b)) + Math.max(0, u - b);
/** The corrosion current (relative) at each moment: 0 dry, 1 with a small film, 4 with four times the wet cathode. */
export const galvCurrent = ([, u2 = 1, u3 = 1, u4 = 1]: number[]) => {
  if (u4 > 0) return 4 * (1 - ease(seg(u4, 0.15, 0.55)));
  if (u3 > 0) return 1 + 3 * ease(u3);
  return ease(seg(u2, 0, 0.35));
};
/** The charge so far: the integral of the current over the time, in current x ms. */
export const galvCharge = ([, u2 = 1, u3 = 1, u4 = 1]: number[]) =>
  GV_MS[1] * easeInt(u2, 0, 0.35) + GV_MS[2] * (u3 + 3 * S1(u3)) + GV_MS[3] * 4 * (u4 - easeInt(u4, 0.15, 0.55));
const GV_QMAX = galvCharge([1, 1, 1, 1]);
export const GALV = {
  ms: GV_MS,
  qmax: GV_QMAX,
  join: 420, // the contact between the two plates
  top: 150, // the top surface of the plates
  pit: 392, // the centre of the attack on the aluminium
  electrons: 10,
  ions: 5,
  oh: 6,
};
const GV_TEXT = ['Dry: no cell', 'Wet: the cell works', 'More wet steel: more current', 'Sealed: no current'];
/** A point at the fraction f along a polyline. */
const along = (pts: [number, number][], f: number): [number, number] => {
  const lens = pts.slice(1).map(([x, y], i) => Math.hypot(x - pts[i][0], y - pts[i][1]));
  let d = f * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const t = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)];
    }
    d -= lens[i];
  }
  return pts[pts.length - 1];
};

export function galv(p: number[]): State {
  const [, u2 = 1, u3 = 1, u4 = 1] = p;
  const { join, top, pit } = GALV;
  const I = galvCurrent(p);
  const Q = galvCharge(p);
  const q = Q / GV_QMAX;
  const k = stageOf(p) === 3 && u4 < 0.55 ? 2 : stageOf(p);
  const film = ease(seg(u2, 0, 0.35));
  const wl = 70 * film;
  const wr = 70 * film + 270 * ease(u3);
  const h = 16 * film;
  const seal = ease(seg(u4, 0, 0.5));
  const pw = 4 + 20 * q;
  const pd = 22 * q;
  const xc = join + Math.max(30, wr / 2);
  const path: [number, number][] = [
    [pit, top + 16],
    [pit, top + 46],
    [xc, top + 46],
    [xc, top + 16],
  ];
  const phase = Q / 1000;
  const on = r2(clamp01(2 * I));
  const s: State = {
    film: {
      d: `M${r2(join - wl)},${top} C${r2(join - wl + 14)},${r2(top - h)} ${r2(join + wr - 14)},${r2(top - h)} ${r2(join + wr)},${top} Z`,
      opacity: film > 0.01 ? 1 : 0,
    },
    pitBase: { d: `M${r2(pit - pw)},${top} A${r2(pw)},${r2(Math.max(0.1, pd))} 0 0 0 ${r2(pit + pw)},${top} Z`, opacity: q > 0.002 ? 1 : 0 },
    seal: {
      d: `M${r2(join - 86 * seal)},${top} C${r2(join - 60 * seal)},${r2(top - 34 * seal)} ${r2(join + 60 * seal)},${r2(top - 34 * seal)} ${r2(join + 86 * seal)},${top} Z`,
      opacity: seal > 0.01 ? 1 : 0,
    },
    curBar: { width: r2((220 * I) / 4) },
    lossBar: { width: r2(220 * q) },
    stat: { text: GV_TEXT[k], fill: k === 3 ? 'var(--rd-ok)' : k === 0 ? 'var(--rd-muted)' : 'var(--rd-accent)' },
    anLab: { opacity: r2(film * (1 - seal)) },
    caLab: { opacity: r2(film * (1 - seal)), x: r2(Math.min(640, Math.max(560, join + wr * 0.55))) },
    sealLab: { opacity: r2(seg(u4, 0.3, 0.6)) },
    eLab: { opacity: on },
  };
  for (let i = 0; i < GALV.electrons; i++) {
    const [x, y] = along(path, frac(phase + i / GALV.electrons));
    s[`e${i}`] = { cx: r2(x), cy: r2(y), opacity: on };
  }
  for (let j = 0; j < GALV.ions; j++) {
    const f = frac(0.7 * phase + j / GALV.ions);
    s[`ion${j}`] = { cx: r2(pit - 10 + 5 * j), cy: r2(top - 3 - 12 * f), opacity: r2(on * (1 - f) * (1 - seal)) };
  }
  for (let j = 0; j < GALV.oh; j++) {
    const f = frac(0.5 * phase + j / GALV.oh);
    s[`oh${j}`] = {
      cx: r2(join + 14 + (Math.max(56, wr) - 24) * ((j + 0.5) / GALV.oh)),
      cy: r2(top - 3 - 9 * f),
      opacity: r2(on * (1 - f)),
    };
  }
  return s;
}

// ---------------------------------------------------------------------------------------------------------------------
// 8. Bonus tolerance at MMC (drawing/gdt): the numbers of the worked example on that page
// ---------------------------------------------------------------------------------------------------------------------
const MM_PHI = Math.atan2(0.21, 0.18);
const MM_E = Math.hypot(0.18, 0.21);
export const MMC = {
  ms: [2800, 2600, 2600, 2600],
  t: 0.5,
  mmc: 11.0,
  lmc: 11.2,
  vc: 10.5,
  left: { cx: 210, cy: 182, r0: 84, k: 130 }, // clearances x 130 px/mm about a 11.0 hole drawn 84 px in radius
  right: { cx: 640, cy: 182, k: 300 }, // the position zone at 300 px/mm
};
/** The hole size, and the offset of its axis from true position (radius e at the angle phi), at each moment. */
export const mmcAt = ([u1 = 1, u2 = 1, u3 = 1, u4 = 1]: number[]) => {
  let d = MMC.mmc;
  let e = MM_E;
  let phi = MM_PHI;
  if (u4 > 0) d = lerp(11.0, 11.15, ease(u4));
  else if (u3 > 0) {
    d = lerp(11.2, 11.0, ease(u3));
    e = lerp(0.35, MM_E, ease(u3));
  } else if (u2 > 0) {
    d = lerp(11.0, 11.2, ease(u2));
    e = (d - MMC.vc) / 2;
  } else {
    e = 0.25 * ease(seg(u1, 0, 0.3));
    phi = MM_PHI + 2 * Math.PI * ease(seg(u1, 0.3, 1));
  }
  const allowed = MMC.t + (d - MMC.mmc);
  return { d, e, phi, dx: e * Math.cos(phi), dy: e * Math.sin(phi), allowed, measured: 2 * e, ok: 2 * e <= allowed + 1e-9 };
};

export function mmc(p: number[]): State {
  const { d, dx, dy, allowed, measured, ok } = mmcAt(p);
  const { left: L, right: R } = MMC;
  const hx = L.cx + L.k * dx;
  const hy = L.cy - L.k * dy;
  const ax = R.cx + R.k * dx;
  const ay = R.cy - R.k * dy;
  const col = ok ? 'var(--rd-ok)' : 'var(--rd-accent)';
  return {
    hole: { cx: r2(hx), cy: r2(hy), r: r2(L.r0 + L.k * (d / 2 - 5.5)) },
    hAxis: { transform: `translate(${r2(hx)} ${r2(hy)})` },
    pin: { fill: col },
    zone: { r: r2((R.k * allowed) / 2) },
    axis: { cx: r2(ax), cy: r2(ay), fill: col },
    vec: { x2: r2(ax), y2: r2(ay) },
    holeLab: { text: `hole ⌀${d.toFixed(2)}` },
    zoneLab: { text: `permitted ⌀${allowed.toFixed(2)}`, y: r2(R.cy - (R.k * allowed) / 2 - 8) },
    readout: { text: `bonus ${(d - MMC.mmc).toFixed(2)}  ·  axis ⌀${measured.toFixed(3)}` },
    verdict: { text: ok ? 'CONFORMS' : 'REJECT', fill: col },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 9. Char, erosion and soak-back (motor/insulation): one-dimensional conduction, nondimensional
// ---------------------------------------------------------------------------------------------------------------------
// The insulation is 1 thick with a diffusivity of 1. During the burn the surface is at 1 and erodes at v. After
// burnout the face radiates (linearised, hs). The bondline node carries the capacity of a thin case (cc) and loses heat
// to the outside (hb). Temperatures are fractions of the surface rise. Solved once, on first use.
export const INS = {
  ms: [2400, 3000, 3000, 3600],
  N: 40,
  v: 0.8,
  tb: 0.06,
  tEnd: 1.0,
  thp: 0.36, // the pyrolysis level: (450 - 20) / (1200 - 20) in the worked example
  hs: 3,
  hb: 0.4,
  cc: 0.25,
  times: [0, 0.015, 0.06, 0.2, 1.0], // the physical time at the start of each stage, and the end
  sec: { x0: 90, x1: 380, gas: 40, case: 410 }, // the section: insulation from x0 to x1, case to `case`
  prof: { top: 62, bot: 172 }, // the profile chart over the section: temperature 1 at top, 0 at bot
  plot: { x0: 480, x1: 830, y0: 250, y1: 70, tMax: 1.0, thMax: 0.15 }, // the bondline history
};
type InsModel = { t: number[]; th: Float32Array[]; mx: Float32Array[]; bond: number[]; peak: { t: number; th: number } };
let insCache: InsModel | null = null;
export const insulModel = (): InsModel => {
  if (insCache) return insCache;
  const { N, v, tb, tEnd, hs, hb, cc } = INS;
  const dx = 1 / N;
  const dt = 0.4 * dx * dx;
  let th = new Float64Array(N + 1);
  let nt = new Float64Array(N + 1);
  const mx = new Float64Array(N + 1);
  const out: InsModel = { t: [], th: [], mx: [], bond: [], peak: { t: 0, th: 0 } };
  const save = (t: number) => {
    out.t.push(t);
    out.th.push(Float32Array.from(th));
    out.mx.push(Float32Array.from(mx));
    out.bond.push(th[N]);
    if (th[N] > out.peak.th) out.peak = { t, th: th[N] };
  };
  const gap = (t: number) => (t < tb ? 0.001 : t < 0.2 ? 0.0025 : 0.01);
  let t = 0;
  let last = 0;
  save(0);
  while (t < tEnd - 1e-12) {
    const js = Math.min(N - 1, Math.floor((v * Math.min(t, tb)) / dx));
    for (let j = js + 1; j < N; j++) nt[j] = th[j] + (dt * (th[j - 1] - 2 * th[j] + th[j + 1])) / (dx * dx);
    nt[N] = th[N] + (dt * ((th[N - 1] - th[N]) / dx - hb * th[N])) / (dx / 2 + cc);
    if (t < tb) for (let j = 0; j <= js; j++) nt[j] = 1;
    else {
      nt[js] = th[js] + (dt * ((th[js + 1] - th[js]) / dx - hs * th[js])) / (dx / 2);
      for (let j = 0; j < js; j++) nt[j] = 0;
    }
    [th, nt] = [nt, th];
    t += dt;
    for (let j = js; j <= N; j++) if (th[j] > mx[j]) mx[j] = th[j];
    if (t - last >= gap(last) - 1e-12) {
      save(t);
      last = t;
    }
  }
  insCache = out;
  return out;
};
/** The physical time at each moment of the animation. */
export const insulTime = (p: number[]) => {
  const k = stageOf(p);
  return lerp(INS.times[k], INS.times[k + 1], p[k] ?? 1);
};
/** The temperatures, the largest temperatures so far and the bondline temperature at the time t (interpolated). */
export const insulAt = (t: number) => {
  const m = insulModel();
  let i = 0;
  while (i < m.t.length - 2 && m.t[i + 1] < t) i++;
  const w = clamp01((t - m.t[i]) / (m.t[i + 1] - m.t[i]));
  const mix = (a: Float32Array, b: Float32Array) => Array.from(a, (x, j) => x + (b[j] - x) * w);
  return { th: mix(m.th[i], m.th[i + 1]), mx: mix(m.mx[i], m.mx[i + 1]), bond: lerp(m.bond[i], m.bond[i + 1], w), i };
};
/** The depth of the char front: the deepest point that got hotter than the pyrolysis level. */
export const charDepth = (mx: number[]) => {
  let x = 0;
  for (let j = 0; j < mx.length - 1; j++) {
    if (mx[j] >= INS.thp && mx[j + 1] < INS.thp) x = (j + (mx[j] - INS.thp) / (mx[j] - mx[j + 1])) / INS.N;
    else if (mx[j + 1] >= INS.thp) x = (j + 1) / INS.N;
  }
  return x;
};
export const insulLimit = () => r2(insulModel().peak.th * 1.15 * 1000) / 1000;
const INS_TEXT = ['Ignition', 'Burning: the surface erodes', 'Burnout: the heat goes both ways', 'Soak-back'];

export function insul(p: number[]): State {
  const { sec, prof, plot, tb, v } = INS;
  const t = insulTime(p);
  const { th, mx, bond } = insulAt(t);
  const m = insulModel();
  const X = (x: number) => sec.x0 + (sec.x1 - sec.x0) * x;
  const Yp = (q: number) => prof.bot - (prof.bot - prof.top) * q;
  const PX = (tt: number) => plot.x0 + ((plot.x1 - plot.x0) * tt) / plot.tMax;
  const PY = (q: number) => plot.y0 - ((plot.y0 - plot.y1) * q) / plot.thMax;
  const s = v * Math.min(t, tb); // the eroded depth
  const xc = Math.max(s, charDepth(mx));
  const burning = t < tb;
  // the profile from the current surface to the bondline
  const js = Math.floor(s * INS.N);
  const pts = [`${r2(X(s))},${r2(Yp(burning ? 1 : th[Math.min(js, INS.N)]))}`];
  for (let j = js + 1; j <= INS.N; j++) pts.push(`${r2(X(j / INS.N))},${r2(Yp(th[j]))}`);
  // the bondline history up to t
  const hist = [`${r2(PX(0))},${r2(PY(0))}`];
  for (let i = 1; i < m.t.length && m.t[i] <= t; i++) hist.push(`${r2(PX(m.t[i]))},${r2(PY(m.bond[i]))}`);
  hist.push(`${r2(PX(t))},${r2(PY(bond))}`);
  const k = stageOf(p);
  const after = t > m.peak.t + 0.02;
  return {
    flame: { opacity: r2(burning ? 1 : 1 - clamp01((t - tb) / 0.02)) },
    gasR: { width: r2(X(s) - sec.gas) },
    voidR: { width: r2(X(s) - sec.gas) },
    char: { x: r2(X(s)), width: r2(Math.max(0, X(xc) - X(s))) },
    front: { x1: r2(X(xc)), x2: r2(X(xc)), opacity: xc > s + 0.005 ? 1 : 0 },
    prof: { points: pts.join(' ') },
    hist: { points: hist.join(' ') },
    dot: { cx: r2(PX(t)), cy: r2(PY(bond)) },
    peak: { opacity: after ? 1 : 0 },
    stat: { text: INS_TEXT[k] },
    bondLab: { text: `bondline ${Math.round(bond * 1000) / 10} % of the surface rise` },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// 10. A sine sweep through a resonance (verify/random-vibration)
// ---------------------------------------------------------------------------------------------------------------------
/** The absolute transmissibility of a base-excited single mode at the frequency ratio r. */
export const transmissibility = (r: number, zeta: number) =>
  Math.sqrt((1 + (2 * zeta * r) ** 2) / ((1 - r * r) ** 2 + (2 * zeta * r) ** 2));
/** The phase lag of the response behind the base. */
export const phaseLag = (r: number, zeta: number) => Math.atan2(2 * zeta * r ** 3, 1 - r * r + (2 * zeta * r) ** 2);
export const VIB = {
  ms: [2200, 3200, 3200, 3600],
  sweep: [
    [0.1, 0.5],
    [0.5, 1.0],
    [1.0, 3.0],
    [0.1, 3.0],
  ] as const,
  zeta: [0.05, 0.05, 0.05, 1 / 6], // Q = 10, then Q = 3
  Y: 3.5, // the base amplitude, px
  plot: { x0: 400, x1: 830, y0: 286, y1: 58, rMax: 3, lo: -1, hi: Math.log10(20) },
  rest: 150, // the top of the part at rest
};
const vbX = (r: number) => VIB.plot.x0 + ((VIB.plot.x1 - VIB.plot.x0) * r) / VIB.plot.rMax;
const vbY = (T: number) => VIB.plot.y0 - ((VIB.plot.y0 - VIB.plot.y1) * (Math.log10(T) - VIB.plot.lo)) / (VIB.plot.hi - VIB.plot.lo);
export const vibPlot = { X: vbX, Y: vbY };
const vbCurve = (zeta: number, r1: number) => {
  const pts: string[] = [];
  for (let r = 0.1; r < r1; r += 0.01) pts.push(`${r2(vbX(r))},${r2(vbY(transmissibility(r, zeta)))}`);
  pts.push(`${r2(vbX(r1))},${r2(vbY(transmissibility(r1, zeta)))}`);
  return pts.join(' ');
};
/** The frequency ratio, the damping and the phase of the drawn oscillation at each moment. */
export const vibAt = (p: number[]) => {
  const k = stageOf(p);
  const u = p[k] ?? 1;
  const [r0, r1] = VIB.sweep[k];
  const r = lerp(r0, r1, u);
  // the drawn oscillation: 0.8 Hz plus 1.2 Hz for each unit of r, integrated over the linear sweep of each stage
  let cyc = 0;
  VIB.sweep.forEach(([a, b], i) => {
    const w = p[i] ?? 0;
    cyc += (VIB.ms[i] / 1000) * (0.8 * w + 1.2 * (a * w + ((b - a) * w * w) / 2));
  });
  return { k, r, zeta: VIB.zeta[k], psi: 2 * Math.PI * cyc };
};
const VB_TEXT = ['Below fn: moves with the base', 'At fn: Q times the input', 'Above √2 fn: isolated', 'Q = 3: lower and wider'];
const zigzag = (x: number, y0: number, y1: number) => {
  const n = 8;
  const pts = [`${x},${r2(y0)}`];
  for (let i = 1; i < n; i++) pts.push(`${x + (i % 2 ? -10 : 10)},${r2(lerp(y0, y1, i / n))}`);
  pts.push(`${x},${r2(y1)}`);
  return pts.join(' ');
};

export function vib(p: number[]): State {
  const { k, r, zeta, psi } = vibAt(p);
  const T = transmissibility(r, zeta);
  const lag = phaseLag(r, zeta);
  const yb = VIB.Y * Math.sin(psi); // the base, up is positive
  const x = T * VIB.Y * Math.sin(psi - lag);
  const top = VIB.rest - x; // the top of the part
  const bot = top + 40;
  const baseTop = 262 - yb;
  const [, , u3 = 1] = p;
  return {
    base: { y: r2(baseTop) },
    part: { y: r2(top) },
    partLab: { y: r2(top + 25) },
    spring: { points: zigzag(140, baseTop, bot) },
    cyl: { y: r2(baseTop - 60) },
    rod: { y1: r2(bot), y2: r2(Math.min(bot + 50, baseTop - 4)) },
    pis: { y: r2(Math.min(bot + 50, baseTop - 4) - 3) },
    env: { y1: r2(VIB.rest + 20 - T * VIB.Y), y2: r2(VIB.rest + 20 + T * VIB.Y) },
    curveA: { points: vbCurve(0.05, k < 3 ? Math.max(0.1, r) : 3) },
    curveB: { points: k === 3 ? vbCurve(1 / 6, Math.max(0.1, r)) : '', opacity: k === 3 ? 1 : 0 },
    cur: { cx: r2(vbX(r)), cy: r2(vbY(T)), fill: k === 3 ? 'var(--rd-blue)' : 'var(--rd-accent)' },
    iso: { opacity: r2(k > 2 ? 1 : k === 2 ? seg(u3, 0.25, 0.6) : 0) },
    q10: { opacity: k >= 2 || (k === 1 && r > 0.98) ? 1 : 0 },
    q3: { opacity: k === 3 && r > 1.2 ? 1 : 0 },
    rLab: { text: `f / fn = ${r.toFixed(2)}` },
    tLab: { text: `response ÷ input = ${T >= 10 ? T.toFixed(1) : T.toFixed(2)}` },
    stat: { text: VB_TEXT[k] },
  };
}

export const STATES = { cylinder, pcg, hbake, lbb, bolt, oring, galv, mmc, insul, vib };
