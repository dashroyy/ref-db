// Reliability of single-shot hardware such as a solid motor. What a set of pass/fail tests demonstrates (the binomial
// lower bound of Clopper and Pearson), what a margin with a known scatter predicts (stress–strength interference and
// the reliability index), the motor as a chain of failure modes, and what a lot acceptance plan can catch (its
// operating characteristic). Shown and derived on /verify/reliability/.

/** Complementary error function (Numerical Recipes erfcc): fractional error below 1.2e-7 for every x, tails included. */
export function erfc(x: number) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806
    + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** Standard normal CDF Φ(z), with a small relative error far into both tails. */
export const phi = (z: number) => 0.5 * erfc(-z / Math.SQRT2);

/** Inverse of Φ (Acklam's rational approximation, then one Halley step). */
export function phiInv(p: number) {
  if (!(p > 0 && p < 1)) return p <= 0 ? -Infinity : Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const tail = (q: number) => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  let x: number;
  if (p < 0.02425) x = tail(Math.sqrt(-2 * Math.log(p)));
  else if (p > 1 - 0.02425) x = -tail(Math.sqrt(-2 * Math.log(1 - p)));
  else {
    const q = p - 0.5, r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const e = phi(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

// ---------- Pass/fail tests: the binomial ----------

/** P(f or fewer failures in n trials) when each trial succeeds with probability R. Sums f + 1 terms in logarithms. */
export function cdfFailures(n: number, f: number, R: number) {
  if (f >= n) return 1;
  if (f < 0) return 0;
  if (R >= 1) return 1;
  if (R <= 0) return 0;
  let lt = n * Math.log(R), s = 0; // log of the probability of exactly i failures, from i = 0
  const step = Math.log((1 - R) / R);
  for (let i = 0; i <= f; i++) {
    s += Math.exp(lt);
    lt += Math.log((n - i) / (i + 1)) + step;
  }
  return Math.min(1, s);
}

/**
 * One-sided lower confidence bound on the reliability after f failures in n trials (Clopper–Pearson): the R at which
 * f or fewer failures would occur with probability 1 − C. With no failures it is the success-run bound (1 − C)^(1/n).
 */
export function lowerBound(n: number, f: number, C: number) {
  if (!(n >= 1) || f >= n || !(C > 0 && C < 1)) return 0;
  if (f <= 0) return Math.pow(1 - C, 1 / n);
  let lo = 0, hi = 1;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (cdfFailures(n, f, mid) < 1 - C) lo = mid; else hi = mid;
  }
  return lo;
}

/** Fewest trials that demonstrate reliability R at confidence C if f failures occur. With f = 0: ln(1 − C) / ln R. */
export function trialsNeeded(R: number, C: number, f = 0) {
  if (!(R > 0 && R < 1 && C > 0 && C < 1)) return NaN;
  if (f <= 0) return Math.ceil(Math.log(1 - C) / Math.log(R) - 1e-9);
  let lo = f + 1, hi = f + 1;
  while (lowerBound(hi, f, C) < R) { lo = hi; hi *= 2; if (hi > 1e9) return Infinity; }
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (lowerBound(mid, f, C) >= R) hi = mid; else lo = mid; }
  return lowerBound(lo, f, C) >= R ? lo : hi;
}

// ---------- Margin and scatter: stress–strength interference ----------

export type Dist = 'normal' | 'lognormal';

/**
 * The load L and the capability S of one failure mode, each with a mean and a coefficient of variation. The mode
 * fails when L > S. Normal: β = (μS − μL) / √(σS² + σL²). Lognormal: β = ln(S̃/L̃) / √(σlnS² + σlnL²), with the
 * medians S̃ = μS/√(1 + VS²) and σln = √ln(1 + V²). The probability of failure is Φ(−β).
 */
export function interference(muL: number, covL: number, muS: number, covS: number, dist: Dist = 'lognormal') {
  let beta: number;
  if (dist === 'normal') beta = (muS - muL) / Math.hypot(muS * covS, muL * covL);
  else {
    const sL = Math.sqrt(Math.log(1 + covL * covL)), sS = Math.sqrt(Math.log(1 + covS * covS));
    const medL = muL / Math.sqrt(1 + covL * covL), medS = muS / Math.sqrt(1 + covS * covS);
    beta = Math.log(medS / medL) / Math.hypot(sS, sL);
  }
  const pf = phi(-beta);
  return { beta, pf, R: 1 - pf, central: muS / muL };
}

/** The central factor μS/μL that gives the reliability index β, for the two scatters. */
export function factorForBeta(beta: number, covL: number, covS: number, dist: Dist = 'lognormal') {
  if (dist === 'lognormal') {
    const sL = Math.sqrt(Math.log(1 + covL * covL)), sS = Math.sqrt(Math.log(1 + covS * covS));
    return Math.exp(beta * Math.hypot(sS, sL)) * Math.sqrt(1 + covS * covS) / Math.sqrt(1 + covL * covL);
  }
  // normal: (k − 1)² = β²(k²VS² + VL²), the larger root; no solution once β·VS ≥ 1
  const A = 1 - beta * beta * covS * covS, Cq = 1 - beta * beta * covL * covL;
  if (A <= 0) return Infinity;
  return (1 + Math.sqrt(Math.max(0, 1 - A * Cq))) / A;
}

/** The reliability index that a probability of failure needs: β = −Φ⁻¹(pf). */
export const betaFor = (pf: number) => -phiInv(pf);

// ---------- The motor as a chain ----------

/** Independent failure modes in series: the motor works only if every mode does. */
export const series = (Rs: number[]) => Rs.reduce((p, r) => p * r, 1);

/** Equal allocation: the reliability that each of m modes needs for the motor to reach R. */
export const allocate = (R: number, m: number) => Math.pow(R, 1 / m);

// ---------- Lot acceptance: the operating characteristic ----------

/** Probability that a lot with a fraction p defective passes a plan that tests n units and accepts c or fewer failures. */
export const acceptance = (n: number, c: number, p: number) => cdfFailures(n, c, 1 - p);

/** The fraction defective that the plan accepts with probability Pa. */
export function defectiveAt(n: number, c: number, Pa: number) {
  if (c >= n) return 1;
  let lo = 0, hi = 1;
  for (let k = 0; k < 100; k++) {
    const mid = (lo + hi) / 2;
    if (acceptance(n, c, mid) > Pa) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
