// O-ring gland analysis at the tolerance and temperature extremes.
// Units: mm, MPa, °C. Shown and derived on /seals/o-ring-design/.

export type Arrangement = 'piston' | 'rod' | 'face';
export type Duty = 'static' | 'dynamic';
export interface Range { min: number; max: number; }

export interface ORingInputs {
  arrangement: Arrangement;
  duty: Duty;
  cs: number; csTol: number; // cross-section, ± tolerance
  id: number; idTol: number; // ring inside diameter, ± tolerance
  /** piston: cylinder bore · rod: housing bore the rod passes through · face: unused */
  bore: Range;
  /** piston: piston OD · rod: rod OD · face: unused */
  shaft: Range;
  /** piston: groove root diameter · rod: groove (outer) diameter · face: groove depth */
  groove: Range;
  width: Range; // groove width
  faceGap: Range; // face: flange separation at assembly
  eccentric: boolean; // radial: parts can sit fully off-centre
  tMin: number; tMax: number; tAssembly: number;
  alphaE: number; // elastomer CTE, 1/K
  alphaM: number; // housing CTE, 1/K
  swell: number; // volume swell in service fluid, fraction
  compressionSet: number; // fraction of squeeze lost by end of life
  pressure: number; // MPa
  hardness: number; // Shore A
  opening: number; // gap increase under pressure (radial for radial seals, axial for face seals), mm
}

/** Cross-section after stretching onto a diameter, assuming constant volume: d / √(1 + s). */
export const stretchedCs = (cs: number, stretch: number) => (stretch > 0 ? cs / Math.sqrt(1 + stretch) : cs);

/** Screening squeeze bands, %: nominal target and worst-case limits. */
export function squeezeBands(arrangement: Arrangement, duty: Duty) {
  if (duty === 'dynamic') return { nom: [10, 18], wc: [7, 22] };
  return arrangement === 'face' ? { nom: [20, 30], wc: [12, 35] } : { nom: [15, 25], wc: [10, 30] };
}

/**
 * Screening diametral extrusion-gap limit (mm) vs pressure and hardness, from REF·DB v1's table
 * (70 and 90 Shore A, interpolated between). 0 means "use a back-up ring".
 */
export function extrusionLimit(pressure: number, hardness: number) {
  const row = pressure <= 5 ? [0.15, 0.25] : pressure <= 10 ? [0.08, 0.15] : [0, 0.08];
  const f = Math.min(1, Math.max(0, (hardness - 70) / 20));
  return row[0] + (row[1] - row[0]) * f;
}

export function analyseGland(i: ORingInputs) {
  const dTh = i.tMax - i.tAssembly, dTc = i.tMin - i.tAssembly;
  const lin = Math.cbrt(1 + i.swell); // linear growth from volume swell

  // Gland depth (radial gap the ring is squeezed into, or axial for a face seal)
  let gMin: number, gMax: number, gNom: number, gFillMin: number, clearanceMax: number;
  if (i.arrangement === 'piston') {
    gNom = ((i.bore.min + i.bore.max) / 2 - (i.groove.min + i.groove.max) / 2) / 2;
    gMin = i.eccentric ? (i.shaft.min - i.groove.max) / 2 : (i.bore.min - i.groove.max) / 2;
    gMax = i.eccentric ? i.bore.max - (i.shaft.min + i.groove.min) / 2 : (i.bore.max - i.groove.min) / 2;
    gFillMin = (i.bore.min - i.groove.max) / 2;
    clearanceMax = i.bore.max - i.shaft.min;
  } else if (i.arrangement === 'rod') {
    gNom = ((i.groove.min + i.groove.max) / 2 - (i.shaft.min + i.shaft.max) / 2) / 2;
    gMin = i.eccentric ? (i.groove.min - i.bore.max) / 2 : (i.groove.min - i.shaft.max) / 2;
    gMax = i.eccentric ? (i.groove.max + i.bore.max) / 2 - i.shaft.min : (i.groove.max - i.shaft.min) / 2;
    gFillMin = (i.groove.min - i.shaft.max) / 2;
    clearanceMax = i.bore.max - i.shaft.min;
  } else {
    gNom = (i.groove.min + i.groove.max) / 2 + (i.faceGap.min + i.faceGap.max) / 2;
    gMin = i.groove.min + i.faceGap.min;
    gMax = i.groove.max + i.faceGap.max;
    gFillMin = i.groove.min;
    clearanceMax = 2 * i.faceGap.max; // one-sided axial gap expressed as an equivalent diametral clearance
  }
  // Under pressure the joint opens: the gland deepens and the extrusion gap widens.
  const gMaxPressurised = gMax + i.opening;
  const clearancePressurised = clearanceMax + 2 * i.opening;

  // Stretch (piston: ring ID stretched onto the groove root; rod: onto the rod if smaller)
  const onto = i.arrangement === 'piston' ? i.groove : i.arrangement === 'rod' ? i.shaft : null;
  const idMin = i.id - i.idTol, idMax = i.id + i.idTol;
  const stretchNom = onto ? Math.max(0, ((onto.min + onto.max) / 2 - i.id) / i.id) : 0;
  const stretchMin = onto ? Math.max(0, (onto.min - idMax) / idMax) : 0;
  const stretchMax = onto ? Math.max(0, (onto.max - idMin) / idMin) : 0;
  const rawStretchMin = onto ? (onto.min - idMax) / idMax : 0; // negative = ring loose in the groove
  // Rod glands: ring OD against the groove diameter — circumferential compression if larger.
  const odMax = idMax + 2 * (i.cs + i.csTol);
  const circCompression = i.arrangement === 'rod' ? (odMax - i.groove.min) / odMax : 0;

  // Effective cross-sections
  const csNom = stretchedCs(i.cs, stretchNom);
  const csHot = stretchedCs(i.cs + i.csTol, stretchMin) * (1 + i.alphaE * dTh) * lin;
  const csCold = stretchedCs(i.cs - i.csTol, stretchMax) * (1 + i.alphaE * dTc);

  const squeeze = (cs: number, g: number) => (cs - g) / cs;
  const sqNom = squeeze(csNom, gNom);
  const sqMax = squeeze(csHot, gMin * (1 + i.alphaM * dTh));
  const sqMinCold = squeeze(csCold, gMax * (1 + i.alphaM * dTc));
  const sqMinEol = sqMinCold * (1 - i.compressionSet); // after compression set
  const sqMinPressurised = squeeze(csCold, gMaxPressurised * (1 + i.alphaM * dTc)) * (1 - i.compressionSet);

  // Gland fill: ring section area over groove area
  const area = (cs: number, s: number) => (Math.PI / 4) * cs * cs / (1 + s);
  const wNom = (i.width.min + i.width.max) / 2;
  const fillNom = area(i.cs, stretchNom) / (wNom * gNom);
  const fillMax = (area(i.cs + i.csTol, stretchMin) * (1 + i.alphaE * dTh) ** 2 * (1 + i.swell)) / (i.width.min * gFillMin * (1 + i.alphaM * dTh) ** 2);

  const limit = extrusionLimit(i.pressure, i.hardness);
  const bands = squeezeBands(i.arrangement, i.duty);
  return {
    gNom, gMin, gMax, gMaxPressurised,
    stretchNom, stretchMin, stretchMax, rawStretchMin, circCompression,
    sqNom, sqMax, sqMinCold, sqMinEol, sqMinPressurised,
    fillNom, fillMax,
    clearanceMax, clearancePressurised, extrusionLimit: limit,
    backupNeeded: limit === 0 || clearancePressurised > limit,
    bands,
  };
}

/**
 * Suggest groove dimensions for a target nominal squeeze and fill, given the mating
 * diameter (piston: bore; rod: rod; face: none) and the ring.
 */
export function suggestGroove(arrangement: Arrangement, mating: number, cs: number, id: number, squeezeTarget: number, fillTarget: number) {
  let stretch = 0, groove = 0, depth = cs * (1 - squeezeTarget);
  for (let k = 0; k < 20; k++) {
    const csEff = stretchedCs(cs, stretch);
    depth = csEff * (1 - squeezeTarget);
    if (arrangement === 'piston') { groove = mating - 2 * depth; stretch = Math.max(0, (groove - id) / id); }
    else if (arrangement === 'rod') { groove = mating + 2 * depth; stretch = Math.max(0, (mating - id) / id); }
    else { groove = depth; }
  }
  const width = ((Math.PI / 4) * cs * cs / (1 + stretch)) / (fillTarget * depth);
  return { groove, depth, width, stretch };
}

/** Nearest stock inside diameter from a list. */
export const nearestId = (ids: number[], target: number) => ids.reduce((b, v) => (Math.abs(v - target) < Math.abs(b - target) ? v : b), ids[0]);

// ---------- Design from the hardware ----------

/** Cross-section tolerances (±, mm) of the ISO 3601-1 class A sections used here. */
export const CS_TOL: Record<string, number> = { '1.78': 0.08, '2.62': 0.08, '3.53': 0.1, '5.33': 0.13, '6.99': 0.15 };

/** A typical inside-diameter tolerance (±, mm), fitted to the AS568 / ISO 3601-1 inch series: 0.13 + 0.0051·d. */
export const idTolerance = (id: number) => 0.13 + 0.0051 * id;

/** The usual class A section for a seal diameter (mm): larger seals need a larger section to tolerate the hardware. */
export const sectionFor = (d: number) => (d < 20 ? 1.78 : d < 50 ? 2.62 : d < 120 ? 3.53 : d < 300 ? 5.33 : 6.99);

/** Minimum length of a 15–20° lead-in chamfer (mm) for a section, from the usual seal-maker tables (≈ 0.5 × CS). */
export const leadIn = (cs: number) => Math.max(1.1, Math.round(cs * 0.52 * 10) / 10);

/** Typical back-up ring thickness (mm) for a section: approximately a quarter of the section. */
export const backupThickness = (cs: number) => Math.round(cs * 0.26 * 10) / 10;

export interface DesignInputs {
  arrangement: Arrangement; duty: Duty;
  /** piston: bore Ø · rod: rod Ø · face: groove OD (pressure inside) or groove ID (pressure outside) */
  mating: number;
  pressureInside?: boolean; // face seals
  pressure: number; hardness: number; clearance: number; // diametral clearance of the fit, mm
  squeeze: number; fill: number; // targets, fractions
  cs?: number; // section; chosen from the diameter when not given
  ids: number[]; // stock inside diameters for the section
  backups?: number; // 0, 1 or 2; chosen from the extrusion check when not given
}

/**
 * Size a ring and its groove for a nominal squeeze and fill. Radial: the ring is stretched 1–5% onto a piston groove
 * root, or sits at or just under the rod for a rod groove. Face: the ring presses against the pressure side of the
 * groove (OD for internal pressure, ID for external). The groove width includes any back-up rings.
 */
export function designGland(o: DesignInputs) {
  const cs = o.cs ?? sectionFor(o.mating);
  const limit = extrusionLimit(o.pressure, o.hardness);
  const backups = o.backups ?? (limit === 0 || o.clearance > limit ? (o.pressure > 10 ? 2 : 1) : 0);
  let id: number, stretch = 0, groove: number, depth: number;
  if (o.arrangement === 'piston') {
    const target = o.mating - 2 * cs * (1 - o.squeeze); // approximate root, to pick the ID
    const fit = o.ids.filter((v) => v <= target / 1.01 && v >= target / 1.05);
    id = fit.length ? fit[fit.length - 1] : nearestId(o.ids, target / 1.02);
    const s = suggestGroove('piston', o.mating, cs, id, o.squeeze, o.fill);
    ({ groove, depth, stretch } = s);
  } else if (o.arrangement === 'rod') {
    const fit = o.ids.filter((v) => v <= o.mating && v >= o.mating / 1.03);
    id = fit.length ? fit[fit.length - 1] : nearestId(o.ids, o.mating);
    const s = suggestGroove('rod', o.mating, cs, id, o.squeeze, o.fill);
    ({ groove, depth, stretch } = s);
  } else {
    // face: internal pressure → ring OD 1–3% over the groove OD; external → ring ID 1–3% under the groove ID
    const inside = o.pressureInside !== false;
    const fit = inside ? o.ids.filter((v) => v + 2 * cs >= o.mating && v + 2 * cs <= o.mating * 1.03) : o.ids.filter((v) => v <= o.mating && v >= o.mating * 0.97);
    const over = o.ids.filter((v) => v + 2 * cs >= o.mating), under = o.ids.filter((v) => v <= o.mating);
    id = fit.length ? (inside ? fit[0] : fit[fit.length - 1]) : inside ? (over[0] ?? o.ids[o.ids.length - 1]) : (under[under.length - 1] ?? o.ids[0]);
    depth = cs * (1 - o.squeeze);
    groove = depth;
  }
  const area = (Math.PI / 4) * cs * cs / (1 + stretch);
  const width = area / (o.fill * depth) + backups * backupThickness(cs);
  const od = id + 2 * cs;
  return {
    cs, csTol: CS_TOL[cs.toFixed(2)] ?? 0.1, id, idTol: idTolerance(id), od, stretch, groove, depth, width,
    backups, backupT: backupThickness(cs), extrusionLimit: limit, chamfer: leadIn(cs),
    rootRadius: cs <= 2.62 ? 0.2 : cs <= 5.33 ? 0.4 : 0.6, edgeBreak: 0.1,
    faceRing: o.arrangement === 'face' ? (o.pressureInside !== false ? { od, groove: o.mating, comp: (od - o.mating) / od } : { id, groove: o.mating, stretch: (o.mating - id) / id }) : null,
  };
}

/**
 * The squeeze of one assembly at a temperature, for a Monte Carlo: x = [cs, id, bore, shaft, groove, width, gap].
 * The off-centre offset is half the actual clearance when the parts can sit fully off-centre.
 */
export function pointSqueeze(i: ORingInputs, x: number[], T: number) {
  const [cs, id, bore, shaft, groove, , gap] = x, dT = T - i.tAssembly;
  const e = i.eccentric && i.arrangement !== 'face' ? Math.max(0, bore - shaft) / 2 : 0;
  let g: number, stretch = 0;
  if (i.arrangement === 'piston') { g = (bore - groove) / 2 + e; stretch = Math.max(0, (groove - id) / id); }
  else if (i.arrangement === 'rod') { g = (groove - shaft) / 2 + e; stretch = Math.max(0, (shaft - id) / id); }
  else g = groove + gap;
  const c = stretchedCs(cs, stretch) * (1 + i.alphaE * dT) * (dT > 0 ? Math.cbrt(1 + i.swell) : 1);
  return (c - g * (1 + i.alphaM * dT)) / c;
}

// ---------- The gland at one corner and one temperature (for the live section view) ----------

export type Corner = 'nom' | 'min' | 'max';
/**
 * The gland of one assembly: nominal, the corner of least squeeze (smallest ring, most stretch, deepest gland, widest
 * groove, the deep side of an off-centre fit) or the corner of most squeeze (largest ring, least stretch, shallowest
 * gland, narrowest groove, swollen). At a temperature, optionally with the joint opened by pressure. The corners are
 * those of analyseGland, so the squeezes agree with the checks. Returns the section c, the local depth g, the width w,
 * the squeeze (and after compression set), the fill, and the radial extrusion gap on the side drawn.
 */
export function glandAt(i: ORingInputs, corner: Corner, T: number, pressurised = false) {
  const mid = (r: Range) => (r.min + r.max) / 2, dT = T - i.tAssembly, e = i.eccentric && i.arrangement !== 'face';
  const cs = corner === 'min' ? i.cs - i.csTol : corner === 'max' ? i.cs + i.csTol : i.cs;
  const id = corner === 'min' ? i.id - i.idTol : corner === 'max' ? i.id + i.idTol : i.id;
  let g: number, gap: number, onto: number | null;
  if (i.arrangement === 'piston') {
    if (corner === 'nom') { g = (mid(i.bore) - mid(i.groove)) / 2; gap = (mid(i.bore) - mid(i.shaft)) / 2; onto = mid(i.groove); }
    else if (corner === 'min') { g = e ? i.bore.max - (i.shaft.min + i.groove.min) / 2 : (i.bore.max - i.groove.min) / 2; gap = e ? i.bore.max - i.shaft.min : (i.bore.max - i.shaft.min) / 2; onto = i.groove.max; }
    else { g = e ? (i.shaft.min - i.groove.max) / 2 : (i.bore.min - i.groove.max) / 2; gap = e ? 0 : (i.bore.min - i.shaft.max) / 2; onto = i.groove.min; }
  } else if (i.arrangement === 'rod') {
    if (corner === 'nom') { g = (mid(i.groove) - mid(i.shaft)) / 2; gap = (mid(i.bore) - mid(i.shaft)) / 2; onto = mid(i.shaft); }
    else if (corner === 'min') { g = e ? (i.groove.max + i.bore.max) / 2 - i.shaft.min : (i.groove.max - i.shaft.min) / 2; gap = e ? i.bore.max - i.shaft.min : (i.bore.max - i.shaft.min) / 2; onto = i.shaft.max; }
    else { g = e ? (i.groove.min - i.bore.max) / 2 : (i.groove.min - i.shaft.max) / 2; gap = e ? 0 : (i.bore.min - i.shaft.max) / 2; onto = i.shaft.min; }
  } else {
    const gp = corner === 'nom' ? mid(i.faceGap) : corner === 'min' ? i.faceGap.max : i.faceGap.min;
    g = (corner === 'nom' ? mid(i.groove) : corner === 'min' ? i.groove.max : i.groove.min) + gp;
    gap = gp; onto = null;
  }
  if (pressurised) { g += i.opening; gap += i.opening; }
  const stretch = onto === null ? 0 : Math.max(0, (onto - id) / id);
  const c = stretchedCs(cs, stretch) * (1 + i.alphaE * dT) * (corner === 'max' ? Math.cbrt(1 + i.swell) : 1); // swell only where it hurts
  const gT = g * (1 + i.alphaM * dT), w = corner === 'min' ? i.width.max : corner === 'max' ? i.width.min : mid(i.width);
  const squeeze = (c - gT) / c;
  return {
    c, g: gT, w, stretch, squeeze, squeezeEol: corner === 'nom' ? squeeze : squeeze * (1 - i.compressionSet),
    fill: ((Math.PI / 4) * c * c) / (w * gT), gap: Math.max(0, gap * (1 + i.alphaM * dT)),
  };
}
