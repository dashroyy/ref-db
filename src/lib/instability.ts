// Combustion instability in solid motors: the acoustic modes of the chamber (longitudinal) and of the port
// (tangential and radial), how the transverse modes move down in frequency as the port burns out, which of them cross
// the band where the propellant responds most, and the damping by particles in the gas. Screening only.
// Units: m/s, mm, Hz, Pa·s, kg/m³, µm. Shown and derived on /motor/combustion-instability/.

/** Bessel function J_m(x), from Bessel's integral (1/π)∫₀^π cos(mτ − x sin τ) dτ, by Simpson's rule. */
export function besselJ(m: number, x: number, n = 200) {
  const N = n % 2 ? n + 1 : n, h = Math.PI / N;
  let s = 0;
  for (let k = 0; k <= N; k++) {
    const t = k * h, w = k === 0 || k === N ? 1 : k % 2 ? 4 : 2;
    s += w * Math.cos(m * t - x * Math.sin(t));
  }
  return (s * h) / 3 / Math.PI;
}
/** dJ_m/dx = (J_{m−1} − J_{m+1}) / 2, with J_{−1} = −J_1. */
export const besselJPrime = (m: number, x: number) => (m === 0 ? -besselJ(1, x) : (besselJ(m - 1, x) - besselJ(m + 1, x)) / 2);

/** Transverse modes of a rigid circular port: the roots α of J'_m, so f = α·a / (π·D). */
export const TRANSVERSE = [
  { key: '1T', name: 'first tangential', m: 1, alpha: 1.8412 },
  { key: '2T', name: 'second tangential', m: 2, alpha: 3.0542 },
  { key: '1R', name: 'first radial', m: 0, alpha: 3.8317 },
  { key: '3T', name: 'third tangential', m: 3, alpha: 4.2012 },
] as const;

/** Speed of sound of the chamber gas, m/s: √(γ R T / M), T in K and M in kg/mol. */
export const soundSpeed = (g: number, T: number, M: number) => Math.sqrt((g * 8.314462618 * T) / M);

/** Longitudinal mode n of a chamber of acoustic length L (mm), closed at both ends: f = n·a / (2L). */
export const longitudinal = (n: number, a: number, Lmm: number) => (n * a) / (2 * (Lmm / 1000));

/** Transverse mode of a port of diameter D (mm): f = α·a / (π·D). */
export const transverse = (alpha: number, a: number, Dmm: number) => (alpha * a) / (Math.PI * (Dmm / 1000));

/** A combined mode, n longitudinal and one transverse (α): f = (a/2π)·√((nπ/L)² + (2α/D)²). */
export const combined = (n: number, alpha: number, a: number, Lmm: number, Dmm: number) =>
  (a / (2 * Math.PI)) * Math.hypot((n * Math.PI) / (Lmm / 1000), (2 * alpha) / (Dmm / 1000));

/**
 * The modes over the burn of a port that grows from D0 to D1 (the equivalent circular diameter, √(4·A_port/π)), with
 * the web fraction w. For each transverse mode: its frequency at ignition and at burnout, and the part of the burn in
 * which it is inside the band [fLo, fHi] (the frequencies where the propellant responds most, from T-burner data).
 */
export function modeMap(i: { a: number; L: number; D0: number; D1: number; band?: [number, number]; nL?: number }) {
  const Dw = (w: number) => i.D0 + (i.D1 - i.D0) * w;
  const inBand = (f: number) => (i.band ? f >= i.band[0] && f <= i.band[1] : false);
  const trans = TRANSVERSE.map((t) => {
    const f0 = transverse(t.alpha, i.a, i.D0), f1 = transverse(t.alpha, i.a, i.D1);
    let w: [number, number] | null = null;
    if (i.band && i.D1 > i.D0) {
      // f falls as D grows: the mode is in the band while D is between α·a/(π·fHi) and α·a/(π·fLo)
      const dIn = (t.alpha * i.a) / (Math.PI * i.band[1]) * 1000, dOut = (t.alpha * i.a) / (Math.PI * i.band[0]) * 1000;
      const wa = Math.max(0, (dIn - i.D0) / (i.D1 - i.D0)), wb = Math.min(1, (dOut - i.D0) / (i.D1 - i.D0));
      if (wb > wa) w = [wa, wb];
    }
    return { ...t, f0, f1, w };
  });
  const longi = Array.from({ length: i.nL ?? 3 }, (_, k) => {
    const f = longitudinal(k + 1, i.a, i.L);
    return { key: `${k + 1}L`, n: k + 1, f, inBand: inBand(f) };
  });
  return { trans, longi, Dw, freq: (alpha: number, w: number) => transverse(alpha, i.a, Dw(w)) };
}

/**
 * Damping of an acoustic wave by particles in the gas (Temkin and Dobbins; Culick): the decay rate of the amplitude,
 * per unit particle mass loading C_m (particle mass ÷ gas mass), 1/s:
 *   α/C_m = (ω/2)·[ωτ_v/(1 + (ωτ_v)²) + (γ − 1)(c_m/c_p)·ωτ_t/(1 + (ωτ_t)²)],
 * with the velocity relaxation time τ_v = ρ_p·d²/(18μ) and the thermal one τ_t = 1.5·(c_m/c_p)·Pr·τ_v. Particles
 * damp best when ωτ_v ≈ 1: small particles damp high frequencies, large ones low frequencies.
 */
export function particleDamping(i: { f: number; dUm: number; rhoP: number; mu: number; g: number; cmCp: number; Pr: number }) {
  const w = 2 * Math.PI * i.f, d = i.dUm * 1e-6;
  const tv = (i.rhoP * d * d) / (18 * i.mu), tt = 1.5 * i.cmCp * i.Pr * tv;
  const viscous = (w / 2) * ((w * tv) / (1 + (w * tv) ** 2));
  const thermal = (w / 2) * (i.g - 1) * i.cmCp * ((w * tt) / (1 + (w * tt) ** 2));
  return { tv, tt, viscous, thermal, alphaPerCm: viscous + thermal };
}

/** The particle diameter (µm) that damps a frequency best through drag: ω·τ_v = 1, d = √(18μ / (ρ_p·ω)). */
export const optimumDiameter = (f: number, rhoP: number, mu: number) => Math.sqrt((18 * mu) / (rhoP * 2 * Math.PI * f)) * 1e6;
