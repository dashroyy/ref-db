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

export const STATES = { cylinder, pcg, hbake, lbb };
