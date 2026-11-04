// Cryogenic design. The cryogens; integrated thermal contraction from 293 K (NIST curve fits and NBS Monograph 29);
// fits and bolted joints that change on cooldown; heat conducted through supports (NIST conductivity fits) and the
// boil-off it causes; and a screen of each library material for toughness in the cold, oxygen and hydrogen.
// Data in src/data/cryogenic.json. Units: K, mm, N, MPa, W.
import data from '../data/cryogenic.json' with { type: 'json' };
import { MATERIALS, type Material } from './materials.ts';
import { METAL_FAMILIES, classOf } from './metalfamilies.ts';

/** The reference temperature of the contraction data, K. */
export const T0 = 293;

export interface Fluid { key: string; name: string; sym: string; K: number; rho: number; hfg: number; M: number; note: string }
export const FLUIDS = data.fluids as Fluid[];
export const fluid = (key: string) => FLUIDS.find((f) => f.key === key);
/** The fluid that boils at T (within 0.05 K), if any. */
export const fluidAt = (T: number) => FLUIDS.find((f) => Math.abs(f.K - T) < 0.05);

const R = 8.314462618, ATM = 101325;
/** Volume of gas at 20 °C and 1 atm from one volume of boiling liquid (ideal gas). */
export const expansionRatio = (f: Fluid) => f.rho / ((ATM * f.M * 1e-3) / (R * 293.15));

/** Boil-off for a heat input Q (W): kg/h, and litres of liquid an hour and a day. */
export function boilOff(Q: number, f: Fluid) {
  const kgPerH = (Q / (f.hfg * 1000)) * 3600;
  return { kgPerH, LPerH: (kgPerH / f.rho) * 1000, LPerDay: ((kgPerH * 24) / f.rho) * 1000 };
}

// ---------------------------------------------------------------------------------------------------------------
// Contraction

export interface Curve { name: string; basis: string; src: string; poly?: number[]; tLow?: number; f?: number; table?: number[][]; range: number[] }
export const CURVES = data.contraction as Record<string, Curve>;

const polyAt = (p: number[], T: number) => p[0] + p[1] * T + p[2] * T ** 2 + p[3] * T ** 3 + p[4] * T ** 4;

/**
 * Integrated contraction (L293 − LT)/L293, as a fraction, on cooling from 293 K to T. NIST fits give
 * (L − L293)/L293 × 10⁵ as a polynomial in T, constant below tLow; the NBS tables give (L293 − LT)/L293 × 10⁵.
 * Below the lowest temperature of the data the value is held (contraction there is small) and `held` says so.
 */
export function contraction(key: string, T: number) {
  const c = CURVES[key];
  if (!c) return { value: NaN, held: false };
  if (T >= T0) return { value: 0, held: false };
  const lo = c.range[0], held = T < lo, t = Math.max(T, lo);
  if (c.poly) {
    const v = c.tLow !== undefined && t < c.tLow ? c.f! : polyAt(c.poly, t);
    return { value: -(v - polyAt(c.poly, T0)) * 1e-5, held };
  }
  const tb = c.table!;
  if (t <= tb[0][0]) return { value: tb[0][1] * 1e-5, held: T < tb[0][0] };
  const i = tb.findIndex((p) => p[0] >= t);
  const [x0, y0] = tb[i - 1], [x1, y1] = tb[i];
  return { value: (y0 + ((y1 - y0) * (t - x0)) / (x1 - x0)) * 1e-5, held };
}

/** Constant-coefficient estimate α·(293 − T): what a room-temperature expansion coefficient predicts. */
export const naiveContraction = (alpha: number, T: number) => alpha * Math.max(0, T0 - T);

const exact = (re: RegExp) => (n: string) => re.test(n);
// Ordered: the first rule that matches a library material gives its curve. `exact` is true when the curve was
// measured on that alloy (or one that differs only in temper); otherwise it is the curve of its class.
const CURVE_RULES: { test: (m: Pick<Material, 'name' | 'family'>) => boolean; key?: string; exact?: (n: string) => boolean }[] = [
  { test: (m) => /Invar/.test(m.name), key: 'invar', exact: () => true },
  { test: (m) => /Kovar|AlBeMet|TiAl|Duplex|Rhenium|Iridium|MA956/i.test(m.name) },
  { test: (m) => /Monel/.test(m.name), key: 'monel', exact: () => true },
  { test: (m) => /Beryllium copper/i.test(m.name), key: 'becu', exact: () => true },
  { test: (m) => /^Beryllium \(/.test(m.name), key: 'be', exact: () => true },
  { test: (m) => /Brass/.test(m.name), key: 'brass' },
  { test: (m) => /9% Ni/.test(m.name), key: 'fe', exact: () => true },
  { test: (m) => /A286|JBK-75|HR-1/.test(m.name), key: 'aus' },
  { test: (m) => /CP Ti/.test(m.name), key: 'ti', exact: () => true },
  { test: (m) => /TZM|Molybdenum/.test(m.name), key: 'mo' },
  { test: (m) => /Tungsten|W-25Re/.test(m.name), key: 'w' },
  { test: (m) => /Tantalum|Ta-10W/.test(m.name), key: 'ta' },
  { test: (m) => /Niobium|Nb-1Zr|C-103/.test(m.name), key: 'nb' },
  { test: (m) => m.family === 'poly' && /^PTFE/.test(m.name), key: 'ptfe', exact: () => true },
  { test: (m) => m.family === 'poly' && /PCTFE/.test(m.name), key: 'pctfe', exact: () => true },
  { test: (m) => m.family === 'poly' && /Nylon/.test(m.name), key: 'nylon', exact: () => true },
  { test: (m) => m.family === 'poly' && /UHMWPE/.test(m.name), key: 'pe' },
  { test: (m) => m.family === 'elast' && /Silicone/i.test(m.name), key: 'silicone' },
  { test: (m) => m.family === 'ss', key: 'ss' }, // resolved by class below
  { test: (m) => m.family === 'steel', key: 'fe' },
  { test: (m) => m.family === 'al', key: 'al', exact: exact(/6061|5083/) },
  { test: (m) => m.family === 'ti', key: 'ti64', exact: exact(/6Al-4V/) },
  { test: (m) => m.family === 'ni', key: 'in718', exact: exact(/718/) },
  { test: (m) => m.family === 'cu', key: 'cu', exact: exact(/C101|Cu-ETP/) },
  { test: (m) => m.family === 'mg', key: 'mg' },
];
const SS = METAL_FAMILIES.find((f) => f.key === 'ss')!;

/** The contraction curve of a library material: its own alloy where the data have it, otherwise its class. */
export function curveFor(m: Pick<Material, 'name' | 'family'>): { key: string; exact: boolean } | undefined {
  const r = CURVE_RULES.find((x) => x.test(m));
  if (!r || !r.key) return undefined;
  if (r.key === 'ss') {
    const cls = classOf(SS, m);
    if (cls === 'aus') return { key: 'aus', exact: /304|316/.test(m.name) };
    if (cls === 'mart' || cls === 'ph') return { key: 'fe', exact: false };
    return undefined;
  }
  return { key: r.key, exact: !!r.exact?.(m.name) };
}

/** The library materials that have a contraction curve. */
export const CRYO_MATERIALS = MATERIALS.filter((m) => m.family !== 'prop' && curveFor(m));

/** Contraction of a library material at T: the fraction, the curve used and whether it is the alloy's own. */
export function materialContraction(m: Pick<Material, 'name' | 'family'>, T: number) {
  const c = curveFor(m);
  if (!c) return undefined;
  const { value, held } = contraction(c.key, T);
  return { value, held, curve: c.key, exact: c.exact, basis: CURVES[c.key].basis };
}

// ---------------------------------------------------------------------------------------------------------------
// Fits, bolted joints and restrained parts

/** Change of a diametral fit on cooling (mm): positive tightens, when the outer part shrinks more than the inner. */
export const fitShift = (d: number, cInner: number, cOuter: number) => d * (cOuter - cInner);

/** Preload change on cooling (N): negative when the clamped parts shrink more than the bolt over the grip. */
export const preloadShift = (grip: number, cBolt: number, cMember: number, kb: number, km: number) =>
  -(cMember - cBolt) * grip * ((kb * km) / (kb + km));

/**
 * Thickness of a spacer under the nut, of contraction cSpacer, that makes the clamped stack shrink as much as the bolt:
 * cb·(Lg + s) = cm·Lg + cs·s. NaN when no such spacer exists (the bolt already shrinks as much, or the spacer more).
 */
export function balancingSpacer(grip: number, cBolt: number, cMember: number, cSpacer: number) {
  if (cMember <= cBolt || cBolt <= cSpacer) return NaN;
  return (grip * (cMember - cBolt)) / (cBolt - cSpacer);
}

/** Stress in a part held at both ends while it cools: E·contraction (MPa). Elastic: above yield it is not real. */
export const restrainedStress = (E: number, c: number) => E * c;

// ---------------------------------------------------------------------------------------------------------------
// Heat leak

export interface Kfit { name: string; form: string; coef: number[]; range: number[] }
export const KFITS = data.conductivity as Record<string, Kfit>;

/** Thermal conductivity (W/m·K) from the NIST fit, held at the ends of its range. */
export function conductivity(key: string, T: number) {
  const c = KFITS[key];
  const t = Math.min(Math.max(T, c.range[0]), c.range[1]);
  if (c.form === 'rational') {
    // log10 k = (a + c√T + eT + gT^1.5 + iT²) / (1 + b√T + dT + fT^1.5 + hT²): the NIST form for OFHC copper.
    const [a, b, cc, d, e, f, g, h, i] = c.coef, s = Math.sqrt(t);
    return 10 ** ((a + cc * s + e * t + g * t * s + i * t * t) / (1 + b * s + d * t + f * t * s + h * t * t));
  }
  const x = Math.log10(t);
  return 10 ** c.coef.reduce((sum, a, i) => sum + a * x ** i, 0);
}

/**
 * The conductivity integral ∫k dT from Tc to Tw (W/m), by Simpson's rule. The conductivity is not extrapolated
 * below its data: the integral then starts at the lowest temperature of the data, given as `from`.
 */
export function kIntegral(key: string, Tc: number, Tw: number) {
  const c = KFITS[key];
  const lo = Math.max(Math.min(Tc, Tw), c.range[0]), hi = Math.min(Math.max(Tc, Tw), c.range[1]);
  if (!(hi > lo)) return { value: 0, from: lo, to: hi };
  const n = 400, h = (hi - lo) / n;
  let s = conductivity(key, lo) + conductivity(key, hi);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * conductivity(key, lo + i * h);
  return { value: (s * h) / 3, from: lo, to: hi };
}

/** Heat conducted by n supports, each of section A (mm²) and length L (mm), between Tc and Tw: W. */
export const heatLeak = (key: string, A: number, L: number, n: number, Tc: number, Tw: number) =>
  n * ((A * 1e-6) / (L * 1e-3)) * kIntegral(key, Tc, Tw).value;

// ---------------------------------------------------------------------------------------------------------------
// Screen: toughness in the cold, oxygen and hydrogen

export type Rate = 'ok' | 'warn' | 'bad';
export interface ServiceClass {
  key: string; name: string; short: string; structure: string;
  /** Usable to okK; check down to warnK; below warnK, not usable. */
  okK: number; warnK: number; cold: string;
  /** Liquid oxygen in tanks and lines. */ lox: Rate; loxNote: string;
  /** Oxygen at pressure or speed: valves, regulators, places where the flow impinges. */ gox: Rate; goxNote: string;
  /** Hydrogen: embrittlement and permeation. */ h2: Rate; h2Note: string;
}

const TI_O2 = 'PROHIBITED in oxygen. Titanium ignites on impact or at a fresh scratch, and burns violently.';
const SS_GOX = 'Burns in high-pressure oxygen once ignited. Keep particles out, and use nickel or copper alloys where the flow impinges.';

export const SERVICE: ServiceClass[] = [
  { key: 'aus', name: 'Austenitic stainless steel (stable grades) and A-286', short: 'Austenitic SS, A-286', structure: 'FCC', okK: 4, warnK: 4,
    cold: 'FCC: no ductile-to-brittle transition. Strength rises as it cools and toughness stays high to 4 K. For the coldest welds, use a filler metal with low ferrite.',
    lox: 'ok', loxNote: 'The default for LOX lines, valves and vessels.', gox: 'warn', goxNote: SS_GOX,
    h2: 'ok', h2Note: 'Stable grades (316L, 310, 21-6-9, Nitronic) and A-286 keep their ductility in hydrogen.' },
  { key: 'aus-meta', name: 'Metastable austenitic stainless steel (304L, 301, 303, 321, 347)', short: '304L, 301, 321 SS', structure: 'FCC that can change to martensite when it is strained cold', okK: 4, warnK: 4,
    cold: 'Tough to 4 K, but cold deformation changes part of the austenite to martensite (301 and 304 the most). The steel becomes slightly magnetic and stronger.',
    lox: 'ok', loxNote: 'The default for LOX lines, valves and vessels.', gox: 'warn', goxNote: SS_GOX,
    h2: 'warn', h2Note: 'The martensite that forms on strain makes these the most hydrogen-sensitive stainless steels. The effect is worst near 200 K, so chilldown and warm-up count. Use 316L for hydrogen.' },
  { key: 'mart', name: 'Martensitic and precipitation-hardening stainless steel', short: 'Martensitic, PH SS', structure: 'BCC/BCT martensite', okK: 233, warnK: 200,
    cold: 'Martensite has a ductile-to-brittle transition: toughness falls quickly below about −40 °C. Keep cryogenic fluid off it. For cold fasteners, use A-286 or 316.',
    lox: 'warn', loxNote: 'Oxygen compatibility like other stainless steels, but brittle at LOX temperature.', gox: 'warn', goxNote: 'Burns in high-pressure oxygen once ignited, like other stainless steels.',
    h2: 'bad', h2Note: 'High-strength martensite is severely embrittled by hydrogen.' },
  { key: 'dup', name: 'Duplex and super duplex stainless steel', short: 'Duplex SS', structure: 'About half FCC austenite and half BCC ferrite', okK: 223, warnK: 200,
    cold: 'The ferrite half has a ductile-to-brittle transition. Duplex is normally limited to about −50 °C.',
    lox: 'warn', loxNote: 'Not a cryogenic material: brittle at LOX temperature.', gox: 'warn', goxNote: 'Burns in high-pressure oxygen once ignited, like other stainless steels.',
    h2: 'warn', h2Note: 'The ferrite is sensitive to hydrogen embrittlement.' },
  { key: 'cs', name: 'Carbon, low-alloy, tool and maraging steels', short: 'Carbon, alloy steel', structure: 'BCC ferrite or BCT martensite', okK: 233, warnK: 200,
    cold: 'BCC: a ductile-to-brittle transition, between about −70 °C and room temperature for most grades. A part that is tough in the workshop can break like glass when cold. Keep cryogenic fluid off it.',
    lox: 'bad', loxNote: 'Brittle at LOX temperature, and carbon steel burns in oxygen once ignited.', gox: 'warn', goxNote: 'Used for warm oxygen pipelines only inside the velocity limits of the oxygen pipeline codes.',
    h2: 'bad', h2Note: 'High-strength steels are severely embrittled by hydrogen. Only low-strength steels are used, inside the limits of the hydrogen piping code (ASME B31.12).' },
  { key: 'ni9', name: '9% nickel steel', short: '9% Ni steel', structure: 'BCC, with nickel to lower the transition', okK: 77, warnK: 77,
    cold: 'Nickel lowers the transition: 9% Ni steel is used down to −196 °C (77 K) for LNG and liquid nitrogen tanks, not colder.',
    lox: 'warn', loxNote: 'Ferritic steel: confirm oxygen compatibility by the governing code before use in LOX.', gox: 'warn', goxNote: 'Ferritic steel burns in oxygen once ignited.',
    h2: 'warn', h2Note: 'Ferritic: sensitive to hydrogen embrittlement, and too cold for LH2 anyway.' },
  { key: 'al', name: 'Aluminium alloys', short: 'Aluminium alloys', structure: 'FCC', okK: 4, warnK: 4,
    cold: 'FCC: no transition. Strength and toughness rise as it cools. 2219, 2195 (Al-Li) and 5083 are the cryogenic tank alloys.',
    lox: 'ok', loxNote: 'Standard for LOX tanks: the oxide film protects the metal.', gox: 'bad', goxNote: 'Burns readily in high-pressure oxygen once ignited. Keep it out of valves, regulators and places where the flow impinges.',
    h2: 'ok', h2Note: 'Practically free of hydrogen embrittlement in dry hydrogen: standard for LH2 tanks.' },
  { key: 'cu', name: 'Copper alloys (copper, bronze, brass, beryllium copper)', short: 'Copper alloys', structure: 'FCC', okK: 4, warnK: 4,
    cold: 'FCC: no transition; tough to 4 K.',
    lox: 'ok', loxNote: 'Good: used for seals, heat exchangers and valve parts.', gox: 'ok', goxNote: 'Among the most burn-resistant metals: used where the flow impinges.',
    h2: 'ok', h2Note: 'Oxygen-free copper is not embrittled by hydrogen.' },
  { key: 'ni', name: 'Nickel and cobalt alloys (718, 625, Monel)', short: 'Ni, Co alloys', structure: 'FCC', okK: 4, warnK: 4,
    cold: 'FCC: no transition. Inconel 718 is used to 20 K in turbopumps.',
    lox: 'ok', loxNote: 'Good. Monel and nickel 200 burn least; the superalloys are between Monel and stainless steel.', gox: 'warn', goxNote: 'Monel 400 and K-500 are the choice where the flow impinges. 718 and 625 are better than stainless steel but not as good as Monel.',
    h2: 'warn', h2Note: 'High-pressure hydrogen near room temperature severely embrittles 718, 625 and Monel K-500. There is little effect at LH2 temperature. Use a barrier coating, or test.' },
  { key: 'lowx', name: 'Invar and Kovar (Fe-Ni)', short: 'Invar, Kovar', structure: 'FCC Fe-Ni', okK: 4, warnK: 4,
    cold: 'Invar stays FCC and tough to 4 K and hardly moves: it is used for cryogenic optical benches and for spacers that balance contraction.',
    lox: 'warn', loxNote: 'Few oxygen data: test before use in LOX.', gox: 'warn', goxNote: 'Few oxygen data: test before use.',
    h2: 'warn', h2Note: 'Fe-Ni alloys: check the hydrogen data for the alloy.' },
  { key: 'ti-eli', name: 'Titanium, extra-low-interstitial (ELI) grades', short: 'Ti, ELI grades', structure: 'HCP α, with β in 6Al-4V', okK: 20, warnK: 4,
    cold: 'HCP has few slip systems, and oxygen and iron make it brittle in the cold. ELI grades keep their toughness to 20 K: Ti-5Al-2.5Sn ELI and Ti-6Al-4V ELI are used in LH2 tanks, pumps and helium bottles.',
    lox: 'bad', loxNote: TI_O2, gox: 'bad', goxNote: 'PROHIBITED: titanium burns in oxygen even at low pressure.',
    h2: 'warn', h2Note: 'Absorbs hydrogen and forms brittle hydrides, faster when warm. Acceptable at LH2 temperature; keep it out of warm hydrogen.' },
  { key: 'ti-ab', name: 'Titanium, standard grades (CP, 6Al-4V, 5Al-2.5Sn)', short: 'Ti, standard grades', structure: 'HCP α, or α + β', okK: 77, warnK: 20,
    cold: 'Usable to about 77 K. Below that, use an ELI grade: the oxygen in standard grades makes them brittle.',
    lox: 'bad', loxNote: TI_O2, gox: 'bad', goxNote: 'PROHIBITED: titanium burns in oxygen even at low pressure.',
    h2: 'warn', h2Note: 'Absorbs hydrogen and forms brittle hydrides, faster when warm. Acceptable at LH2 temperature; keep it out of warm hydrogen.' },
  { key: 'ti-b', name: 'β titanium and titanium aluminides', short: 'Ti β, TiAl', structure: 'BCC β, or an ordered intermetallic', okK: 200, warnK: 77,
    cold: 'BCC β and the aluminides lose toughness in the cold. Test before any cryogenic use.',
    lox: 'bad', loxNote: TI_O2, gox: 'bad', goxNote: 'PROHIBITED: titanium burns in oxygen even at low pressure.',
    h2: 'warn', h2Note: 'β titanium absorbs hydrogen readily.' },
  { key: 'mg', name: 'Magnesium alloys', short: 'Magnesium', structure: 'HCP', okK: 200, warnK: 77,
    cold: 'HCP with few slip systems: ductility falls in the cold, and there are few cryogenic data.',
    lox: 'bad', loxNote: 'Ignition risk: not used in oxygen systems.', gox: 'bad', goxNote: 'Ignition risk: not used in oxygen systems.',
    h2: 'warn', h2Note: 'Few data: test.' },
  { key: 'refr-bcc', name: 'Molybdenum and tungsten', short: 'Mo, W', structure: 'BCC', okK: 350, warnK: 300,
    cold: 'BCC with a transition near or above room temperature: brittle in the cold.',
    lox: 'warn', loxNote: 'Not normally used in oxygen: test.', gox: 'warn', goxNote: 'Not normally used in oxygen: test.',
    h2: 'ok', h2Note: 'Very low hydrogen solubility: used in hydrogen furnaces.' },
  { key: 'refr-nb', name: 'Niobium and tantalum alloys', short: 'Nb, Ta', structure: 'BCC', okK: 77, warnK: 4,
    cold: 'BCC, but niobium and tantalum stay ductile at low temperature when pure. Oxygen, nitrogen and hydrogen pick-up raise the transition: test the alloy.',
    lox: 'warn', loxNote: 'Not normally used in oxygen: test.', gox: 'warn', goxNote: 'Not normally used in oxygen: test.',
    h2: 'bad', h2Note: 'Absorbs hydrogen and forms brittle hydrides.' },
  { key: 'be', name: 'Beryllium and Al-Be', short: 'Beryllium, AlBeMet', structure: 'HCP', okK: 400, warnK: 4,
    cold: 'HCP and brittle even at room temperature. Used at cryogenic temperature for optics and low-stress parts.',
    lox: 'warn', loxNote: 'Not normally used in oxygen: test.', gox: 'warn', goxNote: 'Not normally used in oxygen: test.',
    h2: 'warn', h2Note: 'Few data: test.' },
  { key: 'comp', name: 'Fibre composites', short: 'Fibre composites', structure: 'Fibres in a polymer matrix', okK: 400, warnK: 4,
    cold: 'The fibres gain strength in the cold, but the resin contracts much more than the fibre. Transverse microcracks open leak paths before any structural failure: this ended the X-33 composite LH2 tank.',
    lox: 'warn', loxNote: 'Epoxy resins can ignite on impact in LOX. Composite LOX tanks need a LOX-compatible resin or a liner, and impact tests (ASTM G86).', gox: 'bad', goxNote: 'The resin burns in oxygen at pressure.',
    h2: 'warn', h2Note: 'Permeation through microcracks, not embrittlement: use a liner or a toughened resin.' },
  { key: 'ptfe', name: 'PTFE, PCTFE and polyimide', short: 'PTFE, PCTFE, PI', structure: 'Polymer', okK: 4, warnK: 4,
    cold: 'Usable as seats, seals and insulators: PTFE keeps some ductility even at 4 K. They contract 3 to 7 times as much as metals.',
    lox: 'ok', loxNote: 'PTFE and PCTFE are the standard LOX seat and seal polymers, after impact tests.', gox: 'warn', goxNote: 'Fast pressurisation heats the gas (adiabatic compression) and can ignite a polymer seat. Keep dead-end volumes small and open valves slowly.',
    h2: 'ok', h2Note: 'Permeation, not embrittlement.' },
  { key: 'poly', name: 'Other engineering polymers', short: 'Other polymers', structure: 'Polymer, glassy in the cold', okK: 400, warnK: 4,
    cold: 'Glassy and brittle far above cryogenic temperature: use only at low stress, after test.',
    lox: 'bad', loxNote: 'Most hydrocarbon polymers fail LOX impact tests. Use PTFE or PCTFE.', gox: 'warn', goxNote: 'Some grades (PEEK, polyimide) pass oxygen tests; most hydrocarbon polymers do not. Test before use.',
    h2: 'ok', h2Note: 'Permeation, not embrittlement.' },
  { key: 'elast', name: 'Elastomers', short: 'Elastomers', structure: 'Rubber, glassy below its glass transition', okK: 233, warnK: 200,
    cold: 'Elastomers go glassy between −20 °C (FKM) and −120 °C (silicone): none seals at cryogenic temperature. Use spring-energised PTFE seals, metal seals or PCTFE seats.',
    lox: 'bad', loxNote: 'Not LOX-compatible.', gox: 'warn', goxNote: 'Fluoroelastomers are used in warm oxygen at moderate pressure after test; most other elastomers are not.',
    h2: 'warn', h2Note: 'Rapid gas decompression damages seals in high-pressure hydrogen: choose a resistant grade.' },
  { key: 'cc', name: 'Carbon, ceramics and ablatives', short: 'Carbon, ceramics', structure: 'Brittle solids', okK: 400, warnK: 4,
    cold: 'Brittle already at room temperature. In the cold, the difference in contraction from metal fittings is the risk.',
    lox: 'warn', loxNote: 'Carbon and organic-bonded materials burn in oxygen; oxide ceramics do not.', gox: 'warn', goxNote: 'Carbon and organic-bonded materials burn in oxygen; oxide ceramics do not.',
    h2: 'warn', h2Note: 'Few hydrogen data: test.' },
];
export const OTHER: ServiceClass = { key: 'other', name: 'No class held', short: 'Other', structure: '—', okK: 400, warnK: 4,
  cold: 'No cryogenic data held for this material: test it at temperature.', lox: 'warn', loxNote: 'No oxygen data held: test.', gox: 'warn', goxNote: 'No oxygen data held: test.', h2: 'warn', h2Note: 'No hydrogen data held: test.' };

const TI = METAL_FAMILIES.find((f) => f.key === 'ti')!;
// Materials whose class is set by name before their family.
const NAME_RULES: [RegExp, string][] = [
  [/Invar|Kovar/, 'lowx'], [/A286|JBK-75|HR-1/, 'aus'], [/9% Ni/, 'ni9'], [/^Beryllium \(|AlBeMet/, 'be'], [/Duplex/i, 'dup'],
  [/TZM|Tungsten|W-25Re/, 'refr-bcc'], [/Niobium|Nb-1Zr|Tantalum|C-103/, 'refr-nb'],
];

/** The service class of a library material. Propellant is not screened. */
export function serviceClassFor(m: Pick<Material, 'name' | 'family'>): ServiceClass | undefined {
  if (m.family === 'prop') return undefined;
  const n = m.name, k = (key: string) => SERVICE.find((s) => s.key === key)!;
  const byName = NAME_RULES.find(([re]) => re.test(n));
  if (byName) return k(byName[1]);
  switch (m.family) {
    case 'ss': {
      const c = classOf(SS, m);
      if (c === 'aus') return /316|21-6-9|Nitronic/.test(n) ? k('aus') : k('aus-meta');
      if (c === 'mart' || c === 'ph') return k('mart');
      return OTHER;
    }
    case 'steel': return k('cs');
    case 'al': return k('al');
    case 'ti': {
      if (/ELI/.test(n)) return k('ti-eli');
      const c = classOf(TI, m);
      return c === 'beta' || c === 'tial' ? k('ti-b') : k('ti-ab');
    }
    case 'ni': return /MA956/.test(n) ? OTHER : k('ni');
    case 'cu': return k('cu');
    case 'mg': return k('mg');
    case 'comp': return k('comp');
    case 'cc': return k('cc');
    case 'poly': return /PTFE|PCTFE|Vespel|polyimide/i.test(n) ? k('ptfe') : k('poly');
    case 'elast': return k('elast');
    default: return OTHER;
  }
}

// Changes for one material within its class.
const OVERRIDES: { test: RegExp; okK?: number; warnK?: number; lox?: Rate; gox?: Rate; h2?: Rate; note?: string }[] = [
  { test: /Kovar/, okK: 195, warnK: 4, note: 'ASTM F15 checks that Kovar does not change to martensite at −78.5 °C. Colder than that it can, which changes its size and expansion: check before cryogenic use.' },
  { test: /Monel/, gox: 'ok', note: 'Monel is among the most burn-resistant alloys in oxygen: the choice for parts where the flow impinges.' },
  { test: /Aluminium bronze/, gox: 'warn', note: 'The aluminium in aluminium bronze makes it less burn-resistant in oxygen than other copper alloys.' },
  { test: /C101|Cu-ETP/, note: 'Oxygen-bearing copper (Cu-ETP) blisters in hot hydrogen. Use oxygen-free copper for hydrogen.' },
  { test: /^Al 7/, note: 'High-strength 7xxx tempers keep their strength in the cold but lose some toughness: check the data at temperature, or use 2219, 2195 or 5083.' },
  { test: /Vespel|polyimide/i, lox: 'warn', note: 'Polyimide is used in oxygen only after impact tests.' },
  { test: /^(EPDM|NBR|Natural|Silicone|Butyl|Neoprene|Polyurethane)/, gox: 'bad' },
  { test: /Stainless 304L|304L \/ 316L/, note: '304L is the most used cryogenic stainless steel. For hydrogen, or where it is strained cold, 316L is the more stable choice.' },
];

/** The class of a material with its own changes applied, and the notes that go with them. */
export function serviceFor(m: Pick<Material, 'name' | 'family'>) {
  const base = serviceClassFor(m);
  if (!base) return undefined;
  const s: ServiceClass = { ...base }, notes: string[] = [];
  for (const o of OVERRIDES) {
    if (!o.test.test(m.name)) continue;
    if (o.okK !== undefined) s.okK = o.okK;
    if (o.warnK !== undefined) s.warnK = o.warnK;
    if (o.lox) s.lox = o.lox;
    if (o.gox) s.gox = o.gox;
    if (o.h2) s.h2 = o.h2;
    if (o.note) notes.push(o.note);
  }
  return { s, notes };
}

export const toughness = (s: Pick<ServiceClass, 'okK' | 'warnK'>, T: number): Rate => (T >= s.okK ? 'ok' : T >= s.warnK ? 'warn' : 'bad');
export const worst = (...r: Rate[]): Rate => (r.includes('bad') ? 'bad' : r.includes('warn') ? 'warn' : 'ok');

/** The rating of a class in a fluid: toughness at its boiling point, with oxygen for LOX and hydrogen for LH2. */
export const rating = (s: ServiceClass, f: Fluid): Rate =>
  worst(toughness(s, f.K), f.key === 'lox' ? s.lox : 'ok', f.key === 'lh2' ? s.h2 : 'ok');

/** Screen a library material at temperature T (K). */
export function screen(m: Material, T: number) {
  const sf = serviceFor(m);
  if (!sf) return undefined;
  const { s, notes } = sf;
  // The metallurgy page's class gives the more exact structure, except for 9% Ni, which it files with carbon steels.
  let structure = s.structure;
  const fam = METAL_FAMILIES.find((f) => f.lib.includes(m.family));
  if (fam && s.key !== 'ni9') { const c = fam.classes.find((x) => x.key === classOf(fam, m)); if (c) structure = c.structure; }
  return { s, structure, tough: toughness(s, T), notes, c: materialContraction(m, T) };
}

/** All the library materials that the screen covers. */
export const SCREEN_MATERIALS = MATERIALS.filter((m) => serviceClassFor(m));
