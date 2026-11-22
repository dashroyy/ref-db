// Handling and transport of a motor: the motor as a beam on two supports, the local stresses in a thin case at a cradle
// (Zick's analysis of a horizontal cylinder on saddles), the slings of a lift, and the shock response of a part to a
// half-sine pulse. Units: mm, N, MPa, kg, g and s. Shown and derived on /verify/handling-and-transport/. Screening only.
import { G, drop } from './duty.ts';
import { sigmaClassical, kdBending } from './buckling.ts';

export { drop };
const rad = (d: number) => (d * Math.PI) / 180;

export interface Supports {
  mass: number; // kg
  L: number; // overall length, mm
  A: number; // from each end to its support, mm
  n: number; // load factor, g
}

/**
 * The motor as a uniform beam of length L on two supports, each at A from its end, under n g. The weight per unit length
 * is w = n·m·g/L. Each support carries Q = W/2. The moment over a support is w·A²/2 (hogging), at midspan
 * w·(L − 2A)²/8 − w·A²/2, and the shear just inside a support is w·(L − 2A)/2.
 */
export function beamOnSupports(s: Supports) {
  const W = s.mass * G * s.n, w = W / s.L, span = s.L - 2 * s.A;
  const Msup = (w * s.A * s.A) / 2, Mmid = (w * span * span) / 8 - Msup;
  return { W, w, Q: W / 2, span, Msup, Mmid, V: (w * span) / 2, Mmax: Math.max(Msup, Math.abs(Mmid)), valid: s.L > 0 && s.A >= 0 && 2 * s.A < s.L };
}

/** The support position that makes the moment over the supports equal to the moment at midspan: A = (√2 − 1)·L/2. */
export const bestOverhang = (L: number) => ((Math.SQRT2 - 1) * L) / 2;

/**
 * Zick's coefficients for a saddle of contact angle theta (radians), for a shell with no ring at the saddle and the
 * saddle at least R/2 from the end. K1: the effective part of the section over the saddle (the arc ±Δ from the top,
 * Δ = π/6 + 5θ/12), as a fraction of the full section modulus. K2: the tangential shear, concentrated near the horns
 * (α = 0.95(π − θ/2)). K6: the circumferential bending at the horn of the saddle (β = π − θ/2).
 */
export function zickK1(theta: number) {
  const D = Math.PI / 6 + (5 * theta) / 12, s = Math.sin(D), c = Math.cos(D);
  return (D + s * c - (2 * s * s) / D) / (Math.PI * (s / D - c));
}
export function zickK2(theta: number) {
  const a = 0.95 * (Math.PI - theta / 2);
  return Math.sin(a) / (Math.PI - a + Math.sin(a) * Math.cos(a));
}
export function zickK6(theta: number) {
  const b = Math.PI - theta / 2, s = Math.sin(b), c = Math.cos(b), r = s / b;
  const D = r * r - 0.5 - Math.sin(2 * b) / (4 * b);
  const num = 0.75 * c * r * r - (5 * s * c * c) / (4 * b) + c ** 3 / 2 - s / (4 * b) + c / 4 - b * s * D;
  return num / (2 * Math.PI * D);
}

export interface Shell {
  R: number; // mean radius, mm
  t: number; // wall, mm
  theta: number; // saddle contact angle, degrees
  b: number; // saddle width, mm
  E: number; // MPa
  nu: number;
}

/**
 * The stresses in the case at the supports and between them (MPa). Longitudinal: at midspan on the full section, over
 * a saddle on Zick's effective section. Tangential shear at the saddle. Circumferential at the horn of the saddle: the
 * direct load spread over b + 1.56√(Rt), and the ring bending (3K6·Q/2t² for L ≥ 8R, else 12K6·Q·R/(L·t²)), both
 * compressive. The shell is taken as empty: a bonded grain stiffens it against ovalisation, so for a loaded motor these
 * are upper bounds for the case, and the load goes into the grain instead.
 */
export function cradleStresses(beam: ReturnType<typeof beamOnSupports>, sh: Shell, L: number, A: number) {
  const th = rad(sh.theta), K1 = zickK1(th), K2 = zickK2(th), K6 = zickK6(th);
  const Z = Math.PI * sh.R * sh.R * sh.t;
  const eff = sh.b + 1.56 * Math.sqrt(sh.R * sh.t);
  const direct = beam.Q / (4 * sh.t * eff);
  const ring = L >= 8 * sh.R ? (3 * K6 * beam.Q) / (2 * sh.t * sh.t) : (12 * K6 * beam.Q * sh.R) / (L * sh.t * sh.t);
  const buckle = sigmaClassical(sh.E, sh.t, sh.R, sh.nu) * kdBending(sh.R, sh.t);
  return {
    K1, K2, K6, Z,
    mid: Math.abs(beam.Mmid) / Z,
    saddle: beam.Msup / (K1 * Z),
    shear: (K2 * beam.V) / (sh.R * sh.t),
    direct, ring, horn: direct + ring, eff, buckle,
    nearEnd: A < sh.R, // the dome stiffens the shell over the saddle: Zick's unstiffened values are then conservative
  };
}

/** A two-point lift with slings at beta degrees from horizontal: the tension in each leg and the axial push into the motor. */
export function slings(Q: number, beta: number) {
  const b = rad(beta);
  return { tension: Q / Math.sin(b), axial: Q / Math.tan(b) };
}

/**
 * The shock response of a part: the peak absolute acceleration of a single-degree-of-freedom system with the natural
 * frequency fn (Hz) and the damping ratio zeta, on a base that sees a half-sine pulse of unit peak and duration tau (s).
 * It integrates z'' + 2ζω·z' + ω²·z = −a(t) through the pulse and one and a half periods after it (RK4).
 */
export function halfSineResponse(fn: number, tau: number, zeta: number) {
  const w = 2 * Math.PI * fn, tEnd = tau + 1.5 / fn;
  const N = Math.ceil(tEnd / Math.min(tau / 400, 1 / (fn * 200))), dt = tEnd / N;
  const a = (t: number) => (t < tau ? Math.sin((Math.PI * t) / tau) : 0);
  const f = (t: number, z: number, v: number) => -a(t) - 2 * zeta * w * v - w * w * z;
  let z = 0, v = 0, peak = 0;
  for (let i = 0; i < N; i++) {
    const t = i * dt;
    const k1z = v, k1v = f(t, z, v);
    const k2z = v + 0.5 * dt * k1v, k2v = f(t + 0.5 * dt, z + 0.5 * dt * k1z, v + 0.5 * dt * k1v);
    const k3z = v + 0.5 * dt * k2v, k3v = f(t + 0.5 * dt, z + 0.5 * dt * k2z, v + 0.5 * dt * k2v);
    const k4z = v + dt * k3v, k4v = f(t + dt, z + dt * k3z, v + dt * k3v);
    z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
    v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    peak = Math.max(peak, Math.abs(2 * zeta * w * v + w * w * z));
  }
  return peak;
}

/** The shock response spectrum of the half-sine: the response ratio at log-spaced frequencies from f0 to f1. */
export function shockSpectrum(tau: number, zeta: number, f0: number, f1: number, n = 60) {
  return Array.from({ length: n }, (_, k) => {
    const fq = f0 * (f1 / f0) ** (k / (n - 1));
    return { f: fq, r: halfSineResponse(fq, tau, zeta) };
  });
}
