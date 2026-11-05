// Filament-wound composite motor cases: netting analysis of the cylinder (helical and hoop layers), the geodesic
// isotensoid dome (the shape in which every helical fibre carries the same stress), the mass, volume and PV/W of the
// case, its growth under pressure and what that growth does to a case-bonded grain. Netting analysis: the fibres carry
// all the load and the resin only holds them in place. Units: MPa, mm, kg, g/cm³, GPa for fibre moduli.
// Screening only: the Composite cases page says what the method leaves out.
import { sizeCase } from './pv.ts';
import { caseStrains, boreStrainFromCase, type GrainStructInputs } from './grain.ts';

export interface Fibre { key: string; name: string; strength: number; E: number; rho: number; basis: string; note: string }

/** Fibre classes: published strength (MPa), fibre modulus (GPa) and density (g/cm³). Typical values for screening. */
export const FIBRES: Fibre[] = [
  { key: 't700', name: 'Carbon, T700S class', strength: 4900, E: 230, rho: 1.8, basis: 'Toray data sheet, impregnated strand',
    note: 'Standard-modulus carbon with a high strain to failure (2.1%): the usual fibre for motor cases and pressure vessels.' },
  { key: 't800', name: 'Carbon, T800S class', strength: 5880, E: 294, rho: 1.8, basis: 'Toray data sheet, impregnated strand',
    note: 'Intermediate-modulus carbon: more strength and stiffness than T700, at a higher price.' },
  { key: 't1000', name: 'Carbon, T1000G class', strength: 6370, E: 294, rho: 1.8, basis: 'Toray data sheet, impregnated strand',
    note: 'High-strength intermediate-modulus carbon, for the highest case efficiency.' },
  { key: 'im7', name: 'Carbon, IM7 class', strength: 5516, E: 276, rho: 1.78, basis: 'Hexcel data sheet, impregnated strand',
    note: 'Intermediate-modulus carbon, used in large motor cases.' },
  { key: 'aramid', name: 'Aramid, Kevlar 49 class', strength: 3600, E: 124, rho: 1.44, basis: 'typical published value',
    note: 'Light and tough, but weak in compression and across the fibre. It absorbs moisture, degrades in UV light and creeps under a sustained load.' },
  { key: 's2', name: 'S-2 glass', strength: 4000, E: 86.9, rho: 2.46, basis: 'AGY data sheets give 3700–4300 for the impregnated strand',
    note: 'Tough and low in cost, but heavy and flexible: the case grows about three times as much as a carbon case.' },
];
export const RESIN_RHO = 1.2; // g/cm³, epoxy
const G = 9.80665;

const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;

/**
 * Netting analysis of a cylinder under pressure p (MPa) at radius R (mm), with helical fibres at ±α to the axis and hoop
 * fibres at 90°, all at the fibre stress σ (MPa). Thicknesses are of fibre alone (mm): divide by the fibre volume
 * fraction for the composite. The axial load sets the helicals; the hoops carry the rest of the hoop load. Up to
 * α = 54.7° (tan²α = 2) the total is 1.5·p·R/σ whatever the angle. Above it the helicals alone carry more than the hoop
 * load, and the axial load sets them (a real laminate then needs axial fibres or the resin to stop it scissoring).
 */
export function netting(p: number, R: number, alphaDeg: number, sigma: number) {
  const a = rad(alphaDeg), c2 = Math.cos(a) ** 2, t2 = Math.tan(a) ** 2;
  const helical = (p * R) / (2 * sigma * c2);
  const hoop = t2 <= 2 ? ((p * R) / (2 * sigma)) * (2 - t2) : 0;
  return { helical, hoop, total: helical + hoop };
}

/** The helical angle at the cylinder of a geodesic winding that turns at the polar opening: R sin α = r0 (Clairaut). */
export const geodesicAngle = (R: number, r0: number) => deg(Math.asin(Math.min(1, r0 / R)));

/** The fibre angle to the meridian at radius ratio ρ = r/R on a geodesic path, for a polar opening ratio ρ0. */
export const angleAt = (rho: number, rho0: number) => deg(Math.asin(Math.min(1, rho0 / rho)));

/** The PV/W of any netting vessel: W = 3·p·V·ρ/σ, whatever its shape or size (m). σ is the fibre stress, MPa. */
export const idealPvw = (sigma: number, vf: number, rhoComposite: number) => (sigma * 1e6 * vf) / (3 * G * rhoComposite * 1000);

/**
 * The geodesic isotensoid dome for a polar opening ratio ρ0 = r0/R. In netting analysis with geodesic helicals at equal
 * stress, the meridian satisfies dz/dρ = ρ³·√(1−ρ0²) / √D, with D = ρ² − ρ0² − ρ⁶(1−ρ0²). It leaves the cylinder (ρ = 1)
 * parallel to the axis, and turns parallel to the axis again at ρc, just outside the polar opening, where the boss sits.
 * Returns the height (×R), the integrals for the mass (×2π R² t_R √(1−ρ0²)) and the volume (×π R³), the helical
 * thickness build-up t/t_R, and the profile z(ρ) from the equator (×R), for a drawing.
 */
export function isotensoid(rho0: number, n = 400) {
  const k = 1 - rho0 * rho0, sk = Math.sqrt(k);
  const D = (r: number) => r * r - rho0 * rho0 - r ** 6 * k;
  // ρc: the root of D between ρ0 (where D < 0) and the maximum of D
  let hi = Math.min(0.999999, (3 * k) ** -0.25), lo = Math.max(rho0, 1e-9);
  if (D(hi) <= 0) hi = 0.999999;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (D(m) > 0) hi = m; else lo = m; }
  const rc = hi;
  // ρ = ρc + (1 − ρc)(1 − cos θ)/2 removes the 1/√D end singularities: the integrand in θ is smooth and finite at
  // both ends, with the end values below (the limits as D → 0). Simpson on θ.
  const at = (th: number) => rc + ((1 - rc) * (1 - Math.cos(th))) / 2;
  const dr = (th: number) => ((1 - rc) * Math.sin(th)) / 2;
  const dD = (r: number) => 2 * r - 6 * k * r ** 5;
  const end0 = rc > 1e-6 && dD(rc) > 0 ? Math.sqrt((1 - rc) / dD(rc)) : 0;
  const end1 = dD(1) < 0 ? Math.sqrt((1 - rc) / -dD(1)) : 0;
  const integ = (f: (r: number) => number) => {
    const N = n % 2 ? n + 1 : n, h = Math.PI / N;
    let s = f(rc) * end0 + f(1) * end1;
    for (let i = 1; i < N; i++) {
      const th = i * h, r = at(th), d = D(r);
      s += (i % 2 ? 4 : 2) * (d > 0 ? (f(r) / Math.sqrt(d)) * dr(th) : 0);
    }
    return (s * h) / 3;
  };
  const height = sk * integ((r) => r ** 3);
  const massInt = integ((r) => r); // × 2π R² t_R √k
  const volume = sk * integ((r) => r ** 5); // × π R³
  // profile: z(ρ) from the equator inward, by the midpoint rule on θ from π (ρ = 1) to 0 (ρ = ρc), scaled to the height
  const fz = (th: number) => { const r = at(th), d = D(r); return d > 0 ? ((sk * r ** 3) / Math.sqrt(d)) * dr(th) : 0; };
  const pts: { rho: number; z: number }[] = [{ rho: 1, z: 0 }];
  const M = 160;
  let z = 0, prev = Math.PI;
  for (let i = M - 1; i >= 0; i--) {
    const th = (i / M) * Math.PI;
    z += fz((th + prev) / 2) * (prev - th);
    pts.push({ rho: at(th), z });
    prev = th;
  }
  const scale = z > 0 ? height / z : 1;
  const profile = pts.map((p) => ({ rho: p.rho, z: p.z * scale }));
  const buildUp = (r: number) => sk / Math.sqrt(Math.max(r * r - rho0 * rho0, 1e-12)); // t/t_R
  return { rho0, rhoC: rc, height, massInt, volume, profile, buildUp, alphaCyl: deg(Math.asin(Math.min(1, rho0))) };
}

/**
 * A geodesic fibre path over the isotensoid dome, from the cylinder to where the dome turns axial (ρc): the azimuth
 * it has turned, φ(ρ) = ∫ ρ0 / (ρ√D) dρ, with the profile z(ρ) (×R). For a small opening the fibre goes nearly over
 * the pole, and turns π/2 on the way up. Used for drawings of the winding pattern.
 */
export function domeGeodesic(rho0: number, m = 120) {
  const d = isotensoid(rho0), k = 1 - rho0 * rho0, rc = d.rhoC;
  const D = (r: number) => r * r - rho0 * rho0 - r ** 6 * k;
  const at = (th: number) => rc + ((1 - rc) * (1 - Math.cos(th))) / 2;
  const dr = (th: number) => ((1 - rc) * Math.sin(th)) / 2;
  const f = (th: number) => { const r = at(th), v = D(r); return v > 0 ? (rho0 / (r * Math.sqrt(v))) * dr(th) : 0; };
  const pts: { rho: number; z: number; phi: number }[] = [{ rho: 1, z: 0, phi: 0 }];
  let phi = 0, prev = Math.PI;
  for (let i = m - 1; i >= 0; i--) {
    const th = (i / m) * Math.PI;
    phi += f((th + prev) / 2) * (prev - th);
    prev = th;
    const rho = at(th);
    // z at this radius from the dome profile (monotonic in ρ)
    const pr = d.profile, j = pr.findIndex((p) => p.rho <= rho);
    const z = j <= 0 ? 0 : pr[j - 1].z + ((pr[j].z - pr[j - 1].z) * (pr[j - 1].rho - rho)) / (pr[j - 1].rho - pr[j].rho || 1);
    pts.push({ rho, z, phi });
  }
  return { pts, turn: phi, height: d.height };
}

export interface CaseInputs {
  idMm: number; lengthMm: number; meop: number; burstFactor: number;
  r0Mm: number; // polar opening radius
  fibre: { strength: number; E: number; rho: number }; // MPa, GPa, g/cm³
  efficiency: number; // delivered fibre strength in a burst ÷ the published strength
  vf: number; // fibre volume fraction
  resinRho?: number;
  boreMm?: number; bulkK?: number; // a case-bonded grain with a circular bore: its bore strain from pressurisation
}

/** A filament-wound case sized by netting at the design burst pressure: walls, mass, volume, PV/W and growth at MEOP. */
export function compositeCase(i: CaseInputs) {
  const R = i.idMm / 2, rho0 = i.r0Mm / R;
  const sigma = i.efficiency * i.fibre.strength; // delivered fibre stress at burst
  const pB = i.meop * i.burstFactor;
  const alpha = geodesicAngle(R, i.r0Mm);
  const net = netting(pB, R, alpha, sigma);
  const helical = net.helical / i.vf, hoop = net.hoop / i.vf, wall = helical + hoop; // composite, mm
  const rhoC = i.vf * i.fibre.rho + (1 - i.vf) * (i.resinRho ?? RESIN_RHO); // g/cm³
  const dome = isotensoid(rho0);
  const cylMass = rhoC * 1e-6 * 2 * Math.PI * (R + wall / 2) * i.lengthMm * wall;
  const domeMass = rhoC * 1e-6 * 2 * Math.PI * R * R * helical * Math.sqrt(1 - rho0 * rho0) * dome.massInt; // each
  const mass = cylMass + 2 * domeMass;
  const volume = Math.PI * R * R * i.lengthMm + 2 * Math.PI * R ** 3 * dome.volume; // mm³
  // In netting every fibre is at the same stress, so the cylinder strains equally in the hoop and axial directions.
  const sigmaMeop = sigma / i.burstFactor;
  const strain = sigmaMeop / (i.fibre.E * 1000);
  const m2 = i.boreMm && i.boreMm > 0 && i.boreMm < i.idMm ? (i.idMm / i.boreMm) ** 2 : NaN;
  return {
    R, rho0, alpha, sigma, pB, net, helical, hoop, wall, rhoC, dome, cylMass, domeMass, mass, volume,
    pvw: (pB * 1e6 * volume * 1e-9) / (mass * G), // m
    pvwIdeal: idealPvw(sigma, i.vf, rhoC),
    sigmaMeop, strain, growthRadial: strain * R, growthAxial: strain * i.lengthMm,
    domeHeight: dome.height * R, overall: i.lengthMm + 2 * dome.height * R,
    boreStrain: boreStrainFromCase(m2, strain, strain, i.meop, i.bulkK ?? Infinity),
  };
}

export interface MetalAlloy { uts: number; yield: number; density: number; E: number; nu: number; kic?: number }

/**
 * The same case in metal, for comparison: Lamé wall for the same burst factor (no yield at MEOP), hemispherical domes,
 * and its strains at MEOP from the thin-wall closed cylinder (as the grain screen). E in MPa.
 */
export function metalCase(i: { idMm: number; lengthMm: number; meop: number; burstFactor: number; weldEff: number; boreMm?: number; bulkK?: number }, m: MetalAlloy) {
  const s = sizeCase({ idMm: i.idMm, lengthMm: i.lengthMm, meop: i.meop, proofFactor: 1, burstFactor: i.burstFactor, weldEff: i.weldEff, dome: 'hemi', material: m });
  const c = caseStrains({ pressure: i.meop, od: i.idMm, caseE: m.E, caseNu: m.nu, caseT: s.t } as GrainStructInputs);
  const m2 = i.boreMm && i.boreMm > 0 && i.boreMm < i.idMm ? (i.idMm / i.boreMm) ** 2 : NaN;
  return {
    wall: s.t, mass: s.mass, volume: s.volume, pvw: s.pvw, governs: s.governs, hoopStrain: c.hoop, axialStrain: c.axial,
    growthRadial: c.hoop * i.idMm / 2, growthAxial: c.axial * i.lengthMm, overall: i.lengthMm + i.idMm,
    boreStrain: boreStrainFromCase(m2, c.hoop, c.axial, i.meop, i.bulkK ?? Infinity),
  };
}
