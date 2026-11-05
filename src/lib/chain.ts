// Worked example: one motor through the whole site. Each step calls the function that the tool of its zone uses
// (the MEOP build-up, case sizing, the grain screen, insulation sizing, the mass budget, shell buckling, leak before
// break, proof testing, the bolted joint, NDT and the duty cycle), so the chain cannot drift from the tools. The steps,
// what each one uses and the loops back are data here, and the dependency matrix on the page is drawn from them.
// Units: MPa, mm, kg, °C, MPa·√m, 1/K. Screening only: each step has the limits of the method on its zone page.
// Factors are inputs and start blank (src/lib/factors.ts): a step that needs a missing factor waits for it.

import { sizeCase } from './pv.ts';
import { meopBuildUp } from './propellant.ts';
import { grainStructure, strainCapability, PROPELLANT_CLASSES, type PropellantClass } from './grain.ts';
import { sizeInsulation, LINER_MATERIALS, BACKUP_MATERIALS } from './insulation.ts';
import { motorPerformance, G0 } from './massfraction.ts';
import { bucklingCheck } from './buckling.ts';
import { growToBreakthrough } from './lbb.ts';
import { proofScreen, PARIS_CLASSES } from './proof.ts';
import { screen as ndtScreen, type MatClass } from './ndt.ts';
import { lifeCycle } from './duty.ts';
import { THREADS, GRADES, MATERIALS as BOLT_METALS, torquePreload, boltStiffness, memberStiffness, loadFactor, thermalPreload, boltMargins } from './bolts.ts';
import { MATERIALS, DEFAULTS, has, slug, type Material } from './materials.ts';

// ---------------------------------------------------------------------------
// The steps and how they connect
// ---------------------------------------------------------------------------

export type StepKey = 'duty' | 'material' | 'meop' | 'case' | 'grain' | 'insulation' | 'mass' | 'buckling' | 'lbb' | 'proof'
  | 'ageing' | 'closure' | 'ndt' | 'notes';

/** One step: its zone (a key of ZONE_PLAN in src/data/zones.mjs), what it does, and the earlier steps whose answers it uses. */
export interface StepDef { key: StepKey; zone: string; title: string; short: string; uses: StepKey[]; carries: string }

export const STEPS: StepDef[] = [
  { key: 'duty', zone: 'duty', title: 'Count the pressure cycles', short: 'Duty cycle', uses: [],
    carries: 'the life to show, in MEOP cycles' },
  { key: 'material', zone: 'materials', title: 'Choose the case material', short: 'Material', uses: [],
    carries: 'strength, density, toughness, stiffness, expansion' },
  { key: 'meop', zone: 'propellant', title: 'Build up the MEOP', short: 'MEOP', uses: [],
    carries: 'the design pressure' },
  { key: 'case', zone: 'pv', title: 'Size the case wall', short: 'Case wall', uses: ['material', 'meop'],
    carries: 'the wall, the hoop stress and the case mass' },
  { key: 'grain', zone: 'grain', title: 'Check the grain on a cold day', short: 'Grain', uses: ['material', 'meop', 'case'],
    carries: 'the bore strain' },
  { key: 'insulation', zone: 'ablative', title: 'Size the dome insulation', short: 'Insulation', uses: ['material', 'case'],
    carries: 'the insulation thickness' },
  { key: 'mass', zone: 'rocket', title: 'Add up the mass and the Δv', short: 'Mass & Δv', uses: ['case', 'grain', 'insulation'],
    carries: 'the cost of each inert kilogram' },
  { key: 'buckling', zone: 'buckling', title: 'Pull a vacuum on the empty case', short: 'Buckling', uses: ['material', 'case'],
    carries: 'the buckling reserve' },
  { key: 'lbb', zone: 'lbb', title: 'Leak or burst?', short: 'Leak before break', uses: ['material', 'meop', 'case'],
    carries: 'who must carry the fracture case' },
  { key: 'proof', zone: 'proof', title: 'What the proof test screens', short: 'Proof test', uses: ['duty', 'material', 'case'],
    carries: 'the largest flaw left after proof' },
  { key: 'ageing', zone: 'ageing', title: 'The grain at the end of its life', short: 'Ageing', uses: ['grain'],
    carries: 'the aged grain margin' },
  { key: 'closure', zone: 'bolts', title: 'Keep the aft closure shut', short: 'Closure bolts', uses: ['material', 'meop'],
    carries: 'the separation margin' },
  { key: 'ndt', zone: 'ndt', title: 'Can inspection find the critical flaw?', short: 'NDT', uses: ['duty', 'material', 'case'],
    carries: 'the method and the size it must find' },
  { key: 'notes', zone: 'drawing', title: 'Write it on the drawing', short: 'Drawing notes', uses: ['material', 'meop', 'case', 'insulation', 'proof', 'ndt'],
    carries: 'the notes' },
];

export const stepIndex = (k: StepKey) => STEPS.findIndex((s) => s.key === k);

/** Loops: a result that can send the design back to an earlier step. */
export const LOOPS: { from: StepKey; to: StepKey; why: string }[] = [
  { from: 'mass', to: 'grain', why: 'Too little Δv changes the propellant load: a smaller bore or a longer case, and the chain runs again.' },
  { from: 'buckling', to: 'case', why: 'A negative buckling margin adds a ring or a thicker wall, and that changes the case mass.' },
  { from: 'lbb', to: 'material', why: 'Break before leak puts the fracture case on the proof test and NDT, or asks for a tougher alloy.' },
  { from: 'ageing', to: 'grain', why: 'A negative aged margin changes the bore, the propellant or the firing range.' },
  { from: 'ndt', to: 'material', why: 'If no method finds the critical flaw, only the proof test carries the fracture case, or the alloy changes.' },
];

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** A case alloy with every property the chain uses. */
export interface CaseMat {
  key: string; name: string; family: string;
  uts: number; yld: number; rho: number; // MPa, MPa, kg/m³
  kic: number; kicDefault: boolean; // MPa·√m; true when it is the family default
  E: number; nu: number; alpha: number; // MPa, -, 1/K
  k: number; cp: number; // W/m·K, J/kg·K
  weldable: boolean;
}

const CASE_FAMILIES = ['steel', 'ss', 'ti', 'al', 'ni'];
const toCase = (m: Material): CaseMat => ({
  key: m.key, name: m.name, family: m.family, uts: m.Ftu!, yld: m.Fty!, rho: m.rho!, kic: m.kic!, kicDefault: m.kicDefault,
  E: m.E!, nu: m.nu!, alpha: m.alpha!, k: m.k!, cp: m.cp!, weldable: m.weldable === true,
});

/** Every alloy of the material library that the chain can take as a case: the families of the case-sizing tool. */
export const CASE_MATERIALS: CaseMat[] = MATERIALS
  .filter((m) => CASE_FAMILIES.includes(m.family) && has(m, ['Ftu', 'Fty', 'rho', 'kic', 'E', 'nu', 'alpha', 'k', 'cp']))
  .map(toCase);

/** The comparison: classic case alloys of the library, by family. */
export const CANDIDATES = [
  'D6AC (AMS 6431)', '15CDV6 (1.7734)', 'Maraging 18Ni-250', 'Maraging 18Ni-300', '300M', 'AerMet 100', 'HP 9-4-30',
  '4340 / EN24T', '4130 (25CrMo4)', '17-4PH (H1025)', '15-5PH (H1025)', '13-8Mo PH (H1000)', 'Custom 465',
  '301 stainless (full hard)', 'Ti-6Al-4V (Gr 5)', 'Ti-6Al-4V ELI (Gr 23)', 'Ti-6Al-6V-2Sn', 'Ti-3Al-2.5V (Gr 9)',
  'Al 2219-T87', 'Al-Li 2195', 'Al 7075-T73', 'Al 7050-T7451', 'Al 6061-T6', 'Inconel 718',
].map(slug);

/** Programme factors and criteria. null = not entered: the steps that need it wait. */
export interface Factors {
  proof: number | null; burst: number | null; // × MEOP
  grain: number | null; ins: number | null; buck: number | null; // safety factors: grain strain and bond, insulation affected depth, buckling
  life: number | null; // scatter factor on cycles
  scatter: number | null; // bolt preload scatter, ± fraction
  sep: number | null; // joint separation factor
}
export const FACTOR_NAMES: Record<keyof Factors, string> = {
  proof: 'proof factor', burst: 'burst factor', grain: 'grain safety factor', ins: 'insulation safety factor',
  buck: 'buckling factor', life: 'life factor', scatter: 'preload scatter', sep: 'separation factor',
};
/** The factors each step needs for its verdict (upstream steps can also hold it up). */
export const STEP_FACTORS: Record<StepKey, (keyof Factors)[]> = {
  duty: ['proof', 'life'], material: [], meop: [], case: ['proof', 'burst'], grain: ['grain'], insulation: ['ins'], mass: [],
  buckling: ['buck'], lbb: [], proof: ['life'], ageing: ['grain'], closure: ['scatter', 'sep'], ndt: ['life'], notes: [],
};

export interface ChainInputs {
  mat: CaseMat;
  idMm: number; lengthMm: number; boreMm: number; weldEff: number;
  prop: PropellantClass;
  pNom: number; n: number; sigmaP: number; // nominal peak pressure at 20 °C (MPa), pressure exponent, 1/K
  rateVar: number; abVar: number; atVar: number; // fractions
  tCold: number; tHot: number; tSf: number; // °C: coldest and hottest firing, stress-free (cure)
  retained: number; // fraction of the strain capability left at the end of life
  f: Factors;
}

const EPDM = LINER_MATERIALS.find((m) => m.key === DEFAULTS.epdm)!;
const M10 = THREADS.find((x) => x.name === 'M10')!;
const G129 = GRADES.find((x) => x.key === '12.9')!;
const BOLT = BOLT_METALS.find((x) => x.key === DEFAULTS.boltSteel)!;

/** Values the chain takes from the other worked examples of the site, fixed here. */
export const EXAMPLE = {
  tRef: 20, // °C, temperature of the nominal pressure
  leakChecks: 4, leakFraction: 0.07, firings: 1, slope: 3, // Duty cycle: four leak checks at 7% of MEOP, one firing, m = 3 (welds)
  bulkK: 3500, bond: 0.7, rhoP: 1770, cStar: 1540, cf: 1.5, // propellant: bulk modulus, bond strength (MPa), density, c*, C_F
  insulator: EPDM, erosion: EPDM.erosion * 0.25, exposure: 20, tSurface: 1200, t0: 20, hOut: 10, soak: 300, minGauge: 1, liner: 2,
  nozzle: 6, other: 4, payload: 50, // kg
  vacuum: 0.101, gammaP: 0.56, // MPa outside the evacuated case; SP-8007 lateral-pressure correlation
  lbbA0: 0.25, lbbAc: 0.5, proofY: 1.12, ndtAc: 0.4,
  sealD: 260, bolts: 30, thread: M10, grade: G129, boltMat: BOLT, torque: 60, mu: 0.12, grip: 24, shank: 16, dw: 15, dh: 11, tAssembly: 20,
} as const;

/** The example motor without its factors: the starting values of the tool. */
export function baseInputs(f: Factors): ChainInputs {
  return {
    mat: CASE_MATERIALS.find((m) => m.key === DEFAULTS.caseSteel)!,
    idMm: 300, lengthMm: 1000, boreMm: 100, weldEff: 0.9, prop: PROPELLANT_CLASSES[0],
    pNom: 8.8, n: 0.35, sigmaP: 0.0013, rateVar: 0.03, abVar: 0.01, atVar: 0.01,
    tCold: -40, tHot: 60, tSf: 60, retained: 0.75, f,
  };
}

// ---------------------------------------------------------------------------
// Material classes for the crack-growth law and the NDT methods (as the LBB and NDT tools)
// ---------------------------------------------------------------------------

export function parisFor(m: { family: string; uts: number }) {
  const key = m.family === 'steel' ? (m.uts > 1100 ? 'mart' : 'fp') : m.family === 'ss' ? (m.uts > 900 ? 'mart' : 'aus') : m.family === 'ni' ? 'aus' : m.family;
  return PARIS_CLASSES.find((p) => p.key === key) ?? PARIS_CLASSES[0];
}

export function ndtClassFor(m: { family: string; name: string }): MatClass {
  const ph = /17-4|15-5|PH|FV520|maraging|Custom 4/i.test(m.name);
  return m.family === 'steel' || (m.family === 'ss' && ph) ? 'ferro' : m.family === 'ss' || m.family === 'ni' ? 'aus' : (m.family as MatClass);
}

// ---------------------------------------------------------------------------
// Dome insulation (the most expensive step: a few hundred 1-D transients)
// ---------------------------------------------------------------------------

export interface InsulationResult { required: number | null; tBond: number; mad: number; governs: string; limit: number }
export type Insulate = (mat: CaseMat, wall: number, sf: number | null) => InsulationResult | null;

/** The dome insulation of the Insulation example (aramid EPDM, low-velocity region, 20 s) behind this case wall. */
export function domeInsulation(mat: CaseMat, wall: number, sf: number | null): InsulationResult {
  const backup = BACKUP_MATERIALS.find((b) => b.key === mat.key);
  const limit = backup?.tLimit ?? (mat.family === 'al' ? 120 : 150);
  const s = sizeInsulation({
    ins: { k: EPDM.k, rho: EPDM.rho, cp: EPDM.cp }, case: { k: mat.k, rho: mat.rho, cp: mat.cp }, caseT: wall,
    t0: EXAMPLE.t0, tSurface: EXAMPLE.tSurface, tPyro: EPDM.tPyro, erosion: EXAMPLE.erosion, exposure: EXAMPLE.exposure,
    soak: EXAMPLE.soak, hOut: EXAMPLE.hOut, safetyFactor: sf ?? 1, bondLimit: limit, minGauge: EXAMPLE.minGauge,
    afterBurnout: 'adiabatic',
  });
  return { required: sf === null || !Number.isFinite(s.required) ? null : s.required, tBond: s.tBond, mad: s.mad, governs: s.governs, limit };
}

// ---------------------------------------------------------------------------
// The chain
// ---------------------------------------------------------------------------

export type Verdict = 'ok' | 'warn' | 'bad' | 'info' | 'wait';

/** A margin for the margin ladder: null while its factor or an earlier step is missing. */
export interface Check { step: StepKey; label: string; ms: number | null; sized?: boolean }

const clean = (x: number) => (Math.abs(x) < 1e-9 ? 0 : x);
const msOf = (allow: number, applied: number, sf: number | null) => (sf === null ? null : applied > 0 ? clean(allow / (sf * applied) - 1) : Infinity);

export function runChain(i: ChainInputs, insulate: Insulate = domeInsulation) {
  const f = i.f, ri = i.idMm / 2;

  // ORIENT: the duty cycle, in MEOP cycles (proof once, leak checks, firing). The proof test is part of the life that a
  // flaw missed by NDT must survive; a flaw left by the proof test only has to survive what comes after it.
  const duty = f.proof === null ? null : (() => {
    const ev = [
      { name: 'Proof test', level: f.proof, n: 1 },
      { name: 'Leak checks', level: EXAMPLE.leakFraction, n: EXAMPLE.leakChecks },
      { name: 'Firing', level: 1, n: EXAMPLE.firings },
    ];
    const all = lifeCycle(ev, 1, EXAMPLE.slope), after = lifeCycle(ev.slice(1), 1, EXAMPLE.slope);
    return {
      events: all.rows, all: all.total, after: after.total, count: all.count, proofShare: all.rows[0].share,
      reqAll: f.life === null ? null : all.total * f.life, reqAfter: f.life === null ? null : after.total * f.life,
    };
  })();

  // SELECT: the material, and two quick indices
  const material = {
    mat: i.mat,
    specific: (i.mat.uts * 1e6) / i.mat.rho / 1000, // kN·m/kg
    tolerance: (i.mat.kic / i.mat.yld) ** 2 * 1000, // mm: (K_IC/σy)², about the flaw the alloy holds at yield
    paris: parisFor(i.mat), ndtClass: ndtClassFor(i.mat),
  };

  // SIZE: MEOP from the nominal pressure, the hot day and the variations (root-sum-square)
  const mb = meopBuildUp({ pNom: i.pNom, tRef: EXAMPLE.tRef, tHot: i.tHot, tCold: i.tCold, n: i.n, sigmaP: i.sigmaP,
    rateVar: i.rateVar, abVar: i.abVar, atVar: i.atVar, other: 0 });
  const meop = mb.meop;

  // SIZE: the case wall (Lamé, burst on ultimate and proof on yield, with the weld efficiency)
  const cs = f.proof === null || f.burst === null ? null : sizeCase({
    idMm: i.idMm, meop, proofFactor: f.proof, burstFactor: f.burst, weldEff: i.weldEff, lengthMm: i.lengthMm, dome: 'hemi',
    material: { uts: i.mat.uts, yield: i.mat.yld, density: i.mat.rho / 1000, kic: i.mat.kic },
  });
  const sized = cs !== null && Number.isFinite(cs.t) && cs.t > 0;
  const t = sized ? cs!.t : NaN, R = ri + t / 2;
  const caseStep = cs && { ...cs, sized, msBurst: sized ? clean(cs.msBurst) : null, msProof: sized ? clean(cs.msProof) : null };

  // SIZE: the grain at the coldest firing: cool-down from the stress-free temperature plus ignition
  const cap = strainCapability(i.tCold, i.prop) / 100;
  const gs = sized ? grainStructure({
    boreD: i.boreMm, od: i.idMm, alphaP: i.prop.alpha * 1e-6, alphaC: i.mat.alpha, dT: i.tCold - i.tSf, eRelaxed: i.prop.E,
    bulkK: EXAMPLE.bulkK, pressure: meop, caseE: i.mat.E, caseNu: i.mat.nu, caseT: t, kt: 1,
  }) : null;
  const grain = gs && { ...gs, cap, msStrain: msOf(cap, gs.combined, f.grain), msBond: msOf(EXAMPLE.bond, gs.bond, f.grain) };

  // SIZE: dome insulation behind this wall
  const ins = sized ? insulate(i.mat, t, f.ins) : null;

  // SIZE: mass and Δv
  const propellant = (Math.PI / 4) * (i.idMm ** 2 - i.boreMm ** 2) * i.lengthMm * 1e-9 * EXAMPLE.rhoP;
  const liner = Math.PI * i.idMm * i.lengthMm * EXAMPLE.liner * 1e-9 * EPDM.rho;
  const domeArea = 4 * Math.PI * ri * ri; // two hemispheres, mm²
  const isp = (EXAMPLE.cf * EXAMPLE.cStar) / G0;
  const mass = sized && ins && ins.required !== null ? (() => {
    const domes = domeArea * ins.required * 1e-9 * EPDM.rho, insulation = liner + domes;
    const inert = cs!.mass + insulation + EXAMPLE.nozzle + EXAMPLE.other;
    return { propellant, caseMass: cs!.mass, liner, domes, insulation, inert, isp,
      ...motorPerformance({ propellant, inert, payload: EXAMPLE.payload, isp }) };
  })() : null;

  // VERIFY: the empty case under vacuum (a leak check before the grain is cast), pressure on the closures too
  const bk = sized ? bucklingCheck({ E: i.mat.E, nu: i.mat.nu, yieldStrength: i.mat.yld, r: R, t, L: i.lengthMm, P: 0, M: 0,
    q: EXAMPLE.vacuum, endPressure: true, gammaP: EXAMPLE.gammaP }) : null;
  const buckling = bk && { ...bk, ms: f.buck === null ? null : clean(bk.reserve / f.buck - 1) };

  // VERIFY: leak before break: grow a small surface flaw at MEOP until it breaks through
  const paris = material.paris;
  const sigmaMean = sized ? (meop * R) / t : NaN;
  const yields = sized && sigmaMean >= i.mat.yld;
  const g = sized && !yields && EXAMPLE.lbbA0 < t ? growToBreakthrough({ sigma: sigmaMean, rangeFraction: 1, a0: EXAMPLE.lbbA0,
    ac0: EXAMPLE.lbbAc, t, R, kic: i.mat.kic, flow: (i.mat.yld + i.mat.uts) / 2, C: paris.C, m: paris.m }) : null;
  const lbb = g && { outcome: g.outcome, ligament: g.ligament, sigma: sigmaMean, through: 2 * g.c, critical: 2 * g.cCrit, ratio: g.cCrit / g.c,
    depth: g.a / t, cycles: g.N, critMode: g.critMode, irwin: g.irwin / t };

  // VERIFY: proof test as a flaw screen, and the life after it
  const ps = sized && duty ? proofScreen({ sigmaOp: cs!.hoopMeop, proofFactor: f.proof!, Y: EXAMPLE.proofY, kProof: i.mat.kic,
    kService: i.mat.kic, wall: t, yieldStrength: i.mat.yld, C: paris.C, m: paris.m, rangeFraction: 1, serviceCycles: duty.after,
    lifeFactor: 1, ndtDepth: 0 }) : null;
  const proof = ps && { ...ps, required: duty!.reqAfter, margin: duty!.reqAfter === null ? null : ps.cyclesFromProof / duty!.reqAfter - 1 };

  // VERIFY: ageing: the same strain against the capability left at the end of life
  const ageing = grain && { retained: i.retained, cap: cap * i.retained, msNew: grain.msStrain, ms: msOf(cap * i.retained, grain.combined, f.grain) };

  // FEATURES: the aft closure of the Bolted joints example, clamping a flange of the case alloy
  const closure = (() => {
    const tp = torquePreload(EXAMPLE.torque * 1000, M10, EXAMPLE.mu, EXAMPLE.mu, EXAMPLE.dw, EXAMPLE.dh);
    const kb = boltStiffness(M10, BOLT.E, EXAMPLE.grip, EXAMPLE.shank), km = memberStiffness(M10.d, EXAMPLE.dw, EXAMPLE.grip, i.mat.E);
    const phi = loadFactor(kb, km);
    const dCold = thermalPreload(i.tCold - EXAMPLE.tAssembly, i.mat.alpha, BOLT.alpha, EXAMPLE.grip, kb, km);
    const dHot = thermalPreload(i.tHot - EXAMPLE.tAssembly, i.mat.alpha, BOLT.alpha, EXAMPLE.grip, kb, km);
    const load = meop * Math.PI * (EXAMPLE.sealD / 2) ** 2, P = load / EXAMPLE.bolts;
    const Fmin = f.scatter === null ? null : tp.F * (1 - f.scatter) + Math.min(0, dCold, dHot);
    const Fmax = f.scatter === null ? null : tp.F * (1 + f.scatter) + Math.max(0, dCold, dHot);
    const ms = Fmin === null || f.sep === null ? null : clean(boltMargins({ Fmin, Fmax: Fmax!, P, phi, As: M10.As, Rp: G129.Rp, Rm: G129.Rm,
      fsSep: f.sep, fsYield: null, fsUlt: null, special: 1 }).sep!);
    return { load, P, preload: tp.F, K: tp.K, phi, dCold, dHot, Fmin, Fmax, opens: Fmin === null ? null : Fmin / (1 - phi), ms };
  })();

  // MAKE: NDT before proof: can a method find a flaw smaller than critical, with the whole life still to come?
  const nd = sized && duty ? ndtScreen({ sigma: cs!.hoopMeop, t, kic: i.mat.kic, ac: EXAMPLE.ndtAc, rangeFraction: 1, C: paris.C, m: paris.m,
    mat: material.ndtClass, embedded: false, serviceCycles: duty.all, lifeFactor: f.life }) : null;
  const ndt = nd && (() => {
    const clear = nd.rows.filter((r) => r.ok);
    const best = clear.length ? clear.reduce((a, b) => (b.life > a.life ? b : a)) : null;
    return { ...nd, clear, best, margin: best && nd.required ? best.life / nd.required - 1 : null };
  })();

  // The margin ladder
  const checks: Check[] = [
    { step: 'case', label: 'Case burst', ms: caseStep?.msBurst ?? null, sized: caseStep?.governs === 'burst' },
    { step: 'case', label: 'Case yield at proof', ms: caseStep?.msProof ?? null, sized: caseStep?.governs === 'proof' },
    { step: 'grain', label: 'Grain, cold ignition', ms: grain?.msStrain ?? null },
    { step: 'grain', label: 'Grain bond, cold', ms: grain?.msBond ?? null },
    { step: 'ageing', label: 'Grain at end of life', ms: ageing?.ms ?? null },
    { step: 'buckling', label: 'Empty case, vacuum', ms: buckling?.ms ?? null },
    { step: 'proof', label: 'Life after proof', ms: proof?.margin ?? null },
    { step: 'closure', label: 'Closure separation', ms: closure.ms },
    { step: 'ndt', label: 'Life from the NDT flaw', ms: ndt?.margin ?? null },
  ];
  // The lowest margin, leaving out the check the wall was sized to (zero by definition).
  const known = checks.filter((c) => c.ms !== null && Number.isFinite(c.ms) && !c.sized);
  const lowest = known.length ? known.reduce((a, b) => (b.ms! < a.ms! ? b : a)) : null;

  return { inputs: i, duty, material, meop: { ...mb, value: meop }, case: caseStep, sized, grain, insulation: ins, mass, buckling,
    lbb, yields, proof, ageing, closure, ndt, checks, lowest };
}

export type Chain = ReturnType<typeof runChain>;

/** Verdict of each step, for the step list and the matrix. */
export function verdicts(c: Chain): Record<StepKey, Verdict> {
  const by = (ms: number | null | undefined): Verdict => (ms === null || ms === undefined ? 'wait' : ms < 0 ? 'bad' : 'ok');
  const worst = (...v: Verdict[]): Verdict => (v.includes('bad') ? 'bad' : v.includes('wait') ? 'wait' : v.includes('warn') ? 'warn' : 'ok');
  const m = c.inputs.mat;
  return {
    duty: c.duty ? (c.duty.reqAll === null ? 'wait' : 'info') : 'wait',
    material: m.kicDefault || (!m.weldable && c.inputs.weldEff < 1) ? 'warn' : 'info',
    meop: 'info',
    case: !c.case ? 'wait' : !c.sized ? 'bad' : by(Math.min(c.case.msBurst!, c.case.msProof!)),
    grain: !c.grain ? 'wait' : worst(by(c.grain.msStrain), by(c.grain.msBond)),
    insulation: !c.insulation ? 'wait' : c.insulation.required === null ? 'wait' : 'info',
    mass: c.mass ? 'info' : 'wait',
    buckling: c.buckling ? by(c.buckling.ms) : 'wait',
    lbb: c.yields ? 'bad' : !c.lbb ? 'wait' : c.lbb.outcome === 'leak' ? 'ok' : 'warn',
    proof: !c.proof ? 'wait' : c.proof.proofToYield > 1 ? 'bad' : by(c.proof.margin),
    ageing: c.ageing ? by(c.ageing.ms) : 'wait',
    closure: by(c.closure.ms),
    ndt: !c.ndt ? 'wait' : c.ndt.required === null ? 'wait' : c.ndt.clear.length ? 'ok' : c.proof && c.proof.margin !== null && c.proof.margin >= 0 ? 'warn' : 'bad',
    notes: c.sized ? 'info' : 'wait',
  };
}

// ---------------------------------------------------------------------------
// Drawing notes: what the chain puts on the case drawing. Square brackets are for the programme to fill.
// ---------------------------------------------------------------------------

const up = (s: string) => s.toUpperCase();
const n1 = (v: number, d = 2) => v.toFixed(d);

export function drawingNotes(c: Chain): string[] {
  if (!c.sized || !c.case) return [];
  const m = c.inputs.mat, cs = c.case, out: string[] = [];
  const weld = c.inputs.weldEff < 1;
  out.push(`MATERIAL: ${up(m.name)} TO [MATERIAL SPECIFICATION]. HEAT TREAT TO Ftu ${m.uts} MPa MIN, Fty ${m.yld} MPa MIN, VERIFIED ON TEST COUPONS FROM EACH HEAT TREATMENT BATCH.`);
  out.push(`CYLINDER WALL ${n1(Math.ceil(cs.t * 100) / 100)} MIN, DOME WALL ${n1(Math.ceil(cs.domeT * 100) / 100)} MIN, AFTER ALL MACHINING AND HEAT TREATMENT.`);
  if (weld) out.push(`WELDS: FULL PENETRATION, 100% RADIOGRAPHY TO [STANDARD AND ACCEPTANCE CLASS]. SIZED WITH JOINT EFFICIENCY ${n1(c.inputs.weldEff)}.`);
  out.push(`MEOP ${n1(c.meop.value, 1)} MPa. PROOF TEST ${n1(cs.pProof, 1)} MPa HYDROSTATIC AT [TEMPERATURE], HOLD [TIME]. NO LEAKAGE. NO PERMANENT DEFORMATION ABOVE [LIMIT].`);
  if (c.ndt && c.ndt.best) out.push(`NDT BEFORE PROOF: ${up(c.ndt.best.name)} OF ALL ACCESSIBLE SURFACES TO [PROCEDURE], DEMONSTRATED 90/95 POD FOR ${n1(c.ndt.best.aNde!)} mm DEEP SURFACE CRACKS. NO CRACK INDICATIONS ALLOWED.`);
  else out.push('NDT BEFORE PROOF: [METHOD AND PROCEDURE]. THE PROOF TEST IS THE FRACTURE CONTROL FOR THE MEMBRANE.');
  out.push(`LEAK TEST AFTER PROOF AT ${n1(EXAMPLE.leakFraction * c.meop.value, 1)} MPa, [METHOD], [ACCEPTANCE RATE].`);
  if (c.insulation && c.insulation.required !== null)
    out.push(`INTERNAL INSULATION: ${up(EPDM.name)} TO [SPECIFICATION]. CYLINDER ${n1(EXAMPLE.liner, 1)} MIN, DOMES ${n1(Math.ceil(c.insulation.required * 10) / 10, 1)} MIN.`);
  if (c.buckling && c.buckling.ms !== null && c.buckling.ms < 0)
    out.push(`CAUTION: DO NOT EVACUATE THE EMPTY CASE WITHOUT [VENT OR SUPPORT MANDREL]. BUCKLING RESERVE ${n1(c.buckling.reserve)} UNDER ${n1(EXAMPLE.vacuum, 3)} MPa EXTERNAL.`);
  out.push(`AFT CLOSURE: ${EXAMPLE.bolts} × M10 CLASS 12.9, TIGHTEN TO ${EXAMPLE.torque} N·m WITH [LUBRICANT] (μ ${EXAMPLE.mu} ASSUMED).`);
  return out.map((s, k) => `${k + 1}. ${s}`);
}
