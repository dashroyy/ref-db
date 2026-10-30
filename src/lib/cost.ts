// Cost of motor hardware: a rough-order-of-magnitude estimate for a machined part (stock, setup, cycle time scaled
// for tolerance, finish and complexity, treatment, inspection, margin), the cost of tightening a tolerance or a finish,
// and the cost of a programme with non-recurring cost and a learning curve. Units £, mm, kg, hours. Screening only.

/** Interpolate y on log(x) between points sorted by x descending (looser first); clamp at the ends. */
function logInterp(pts: { x: number; y: number }[], x: number) {
  if (x >= pts[0].x) return pts[0].y;
  for (let i = 1; i < pts.length; i++) if (x >= pts[i].x) {
    const a = pts[i - 1], b = pts[i], f = Math.log(x / a.x) / Math.log(b.x / a.x);
    return a.y + (b.y - a.y) * f;
  }
  return pts[pts.length - 1].y;
}

/** Cycle-time factor for the tightest tolerance on the part (± mm): ±0.1 and looser is the base. */
export const TOL_STEPS = [{ x: 0.1, y: 1 }, { x: 0.05, y: 1.15 }, { x: 0.025, y: 1.35 }, { x: 0.01, y: 1.8 }, { x: 0.005, y: 2.6 }, { x: 0.002, y: 4 }];
/** Cycle-time factor for the finest finish on the part (Ra µm): Ra 3.2 and rougher is the base. */
export const FINISH_STEPS = [{ x: 3.2, y: 1 }, { x: 1.6, y: 1.1 }, { x: 0.8, y: 1.25 }, { x: 0.4, y: 1.6 }, { x: 0.2, y: 2.2 }, { x: 0.1, y: 3 }];
export const tolFactor = (tol: number) => logInterp(TOL_STEPS, tol);
export const finishFactor = (ra: number) => logInterp(FINISH_STEPS, ra);

export const COMPLEXITY = [
  { key: 'simple', k: 0.75, name: 'Simple: prismatic or plain turned, 1–2 setups' },
  { key: 'moderate', k: 1, name: 'Moderate: several faces, about 3 setups' },
  { key: 'complex', k: 1.45, name: 'Complex: many features, 4 or more setups' },
  { key: 'very', k: 2.2, name: 'Very complex: deep pockets, thin walls, 5-axis' },
] as const;

export type Stock = { shape: 'bar'; d: number; l: number } | { shape: 'block'; l: number; w: number; h: number };
/** Mass of the stock (kg) from its size (mm) and the density (kg/m³). */
export const stockMass = (s: Stock, rho: number) =>
  (s.shape === 'bar' ? (Math.PI / 4) * s.d * s.d * s.l : s.l * s.w * s.h) * 1e-9 * rho;

export interface PartInputs {
  stock: Stock; rho: number; pricePerKg: number;
  qty: number; cycleMin: number; rate: number; setupHours: number;
  tol: number; ra: number; complexity: number; // complexity factor
  treatment: number; inspection: number; margin: number; // £/part, £/part, fraction
}

/** Cost of one part in a batch of qty: material, setup shared over the batch, cycle × factors, treatment, inspection, margin. */
export function partCost(i: PartInputs) {
  const mass = stockMass(i.stock, i.rho), material = mass * i.pricePerKg;
  const k = tolFactor(i.tol) * finishFactor(i.ra) * i.complexity;
  const machining = (i.cycleMin / 60) * i.rate * k, setup = (i.setupHours * i.rate) / Math.max(1, i.qty);
  const base = material + machining + setup + i.treatment + i.inspection, margin = base * i.margin;
  return { mass, material, machining, setup, treatment: i.treatment, inspection: i.inspection, margin, total: base + margin, k, kTol: tolFactor(i.tol), kFinish: finishFactor(i.ra) };
}

// ---------- Programme cost and the learning curve ----------

/** Wright learning curve: the cost of unit n is T1 · n^b, b = log2(learning rate). Each doubling multiplies it by the rate. */
export const unitCost = (t1: number, n: number, lr: number) => t1 * Math.pow(n, Math.log2(lr));

/** Sum of the first n units (exact up to 10 000, then the integral approximation). */
export function cumulativeCost(t1: number, n: number, lr: number) {
  if (n <= 0) return 0;
  const b = Math.log2(lr);
  if (n <= 10000) { let s = 0; for (let k = 1; k <= n; k++) s += Math.pow(k, b); return t1 * s; }
  return t1 * ((Math.pow(n + 0.5, b + 1) - Math.pow(0.5, b + 1)) / (b + 1));
}

/** A programme: non-recurring cost (design, qualification, tooling) plus the recurring cost of n units. */
export function programme(o: { nre: number; t1: number; lr: number; n: number }) {
  const total = cumulativeCost(o.t1, o.n, o.lr);
  return { unitN: unitCost(o.t1, o.n, o.lr), avgUnit: total / o.n, recurring: total, total: total + o.nre, avgWithNre: (total + o.nre) / o.n, nreShare: o.nre / (total + o.nre) };
}
