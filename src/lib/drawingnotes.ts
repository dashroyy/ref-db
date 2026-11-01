// Drawing frame and general notes: the title-block fields that set how a drawing is read, a builder that writes the
// general notes from the choices made for a part, and a checker that finds notes that cannot be verified. The builder
// leaves [brackets] where the programme's own specification, value or class must go: it never supplies them.

export type Std = 'iso' | 'asme';
export type GenTol = 'iso2768' | 'iso22081' | 'asmeBlock' | 'none';
export type Treatment = 'none' | 'anodize' | 'passivate' | 'plateZnNi' | 'plateCd' | 'paint' | 'conversion';
export type Crit = 'none' | 'major' | 'critical' | 'fracture';
export type Ndt = 'none' | 'fpi' | 'mpi' | 'ut' | 'rt' | 'ct';

export interface FrameInputs {
  std: Std; stdIssue?: string;
  projection: 'first' | 'third';
  units: 'mm' | 'in';
  genTol: GenTol; linClass?: string; geoClass?: string; envelope?: boolean;
  finishRa?: number; // default surface texture, µm
  edgeBreak?: string; // for example "0.2–0.5"
  material?: string; materialSpec?: string; ftuMPa?: number;
  treatment: Treatment;
  fasteners: boolean;
  marking: 'etch' | 'laser' | 'dotpeen' | 'ink' | 'none';
  criticality: Crit;
  ndt: Ndt;
  cleanliness: boolean;
  exportControl: boolean;
}

export const TREATMENTS: { key: Treatment; name: string; plating?: boolean }[] = [
  { key: 'none', name: 'None' },
  { key: 'anodize', name: 'Anodize (aluminium)' },
  { key: 'conversion', name: 'Chemical conversion coating' },
  { key: 'passivate', name: 'Passivate (stainless)' },
  { key: 'plateZnNi', name: 'Zinc-nickel plate', plating: true },
  { key: 'plateCd', name: 'Cadmium plate', plating: true },
  { key: 'paint', name: 'Primer and paint' },
];
export const NDT_METHODS: { key: Ndt; name: string; std: string }[] = [
  { key: 'none', name: 'None beyond visual', std: '' },
  { key: 'fpi', name: 'Fluorescent penetrant (FPI)', std: 'ASTM E1417' },
  { key: 'mpi', name: 'Magnetic particle (MPI)', std: 'ASTM E1444' },
  { key: 'ut', name: 'Ultrasonic (UT)', std: 'ASTM E2375 or the programme UT specification' },
  { key: 'rt', name: 'Radiography (RT)', std: 'ASTM E1742' },
  { key: 'ct', name: 'Computed tomography (CT)', std: 'the programme CT specification' },
];

/** High-strength steel that is electroplated needs a hydrogen-embrittlement relief bake: Rm ≥ 1000 MPa (ISO 9587/4042). */
export const needsBake = (ftu: number | undefined, t: Treatment) => !!TREATMENTS.find((x) => x.key === t)?.plating && (ftu ?? 0) >= 1000;

/** The general-tolerance line for the title block. */
export function genTolText(i: FrameInputs) {
  switch (i.genTol) {
    case 'iso2768': return `ISO 2768-${i.linClass ?? 'm'}${i.geoClass ?? ''}${i.geoClass && i.envelope ? '-E' : ''}`;
    case 'iso22081': return 'ISO 22081 general geometrical specification: [tolerance] to datums [A, B, C]';
    case 'asmeBlock': return i.units === 'in' ? 'UNLESS OTHERWISE SPECIFIED: .X ±[ ] .XX ±[ ] .XXX ±[ ] ANGLES ±[ ]°' : 'UNLESS OTHERWISE SPECIFIED: X ±[ ] X.X ±[ ] X.XX ±[ ] ANGLES ±[ ]°';
    default: return '';
  }
}

/** The title-block fields, each with its value (or a [bracket] to fill) and why it is there. */
export function titleBlock(i: FrameInputs) {
  const std = i.std === 'iso' ? `ISO GPS (ISO 8015, ISO 1101)${i.stdIssue ? `, ${i.stdIssue}` : ''}` : `ASME Y14.5${i.stdIssue ? `-${i.stdIssue}` : '-[issue]'}`;
  return [
    { field: 'Governing standard', value: std, why: 'Sets how every symbol is read.' },
    { field: 'Projection', value: i.projection === 'first' ? 'First angle' : 'Third angle', why: 'First angle in the UK and Europe, third angle in the US. Never assume.' },
    { field: 'Units', value: i.units === 'mm' ? 'Millimetres' : 'Inches', why: 'State it, also when it is the default.' },
    { field: 'General tolerances', value: genTolText(i) || '[none: every dimension toleranced]', why: 'Apply to every dimension without its own tolerance.' },
    { field: 'Default surface texture', value: i.finishRa ? `Ra ${i.finishRa} µm` : '[Ra]', why: 'Applies to every surface without its own symbol.' },
    { field: 'Material', value: i.material ? `${i.material}${i.materialSpec ? ` per ${i.materialSpec}` : ''}` : '[alloy, condition, form, specification]', why: 'Alloy, condition, product form and specification.' },
    { field: 'Criticality', value: i.criticality === 'none' ? '[class]' : { major: 'Major', critical: 'Critical', fracture: 'Fracture critical' }[i.criticality], why: 'Sets the inspection and the approvals.' },
    ...(i.exportControl ? [{ field: 'Export control', value: '[classification and marking text]', why: 'A legal requirement where it applies.' }] : []),
    { field: 'Mass, scale, sheet, revision', value: '[mass] · [scale] · sheet [n] of [m] · rev [ ]', why: 'Housekeeping that auditors check.' },
  ];
}

/** The general notes, in the usual order. [Brackets] are for the programme's own values. */
export function generalNotes(i: FrameInputs) {
  const n: { text: string; why: string }[] = [];
  const add = (text: string, why: string) => n.push({ text, why });
  add(i.std === 'iso' ? `Interpret drawing per ISO 8015 and ISO 1101${i.stdIssue ? ` (${i.stdIssue})` : ''}.${i.envelope && i.genTol === 'iso2768' ? '' : ' Envelope requirement Ⓔ applies only where shown.'}`
    : `Interpret drawing per ASME Y14.5-${i.stdIssue || '[issue]'}.`, i.std === 'iso' ? 'Under ISO 8015 a size tolerance does not control form (independency).' : 'Under ASME Y14.5 Rule #1, size controls form (the envelope).');
  if (i.genTol !== 'none') add(`Dimensions without a tolerance: ${genTolText(i)}.`, 'For features that have no function. Tolerance every functional feature explicitly.');
  add(`Remove burrs. Break sharp edges ${i.edgeBreak ? `${i.edgeBreak} mm` : '[range] mm'} unless otherwise specified.`, 'A size makes the note verifiable.');
  add(`Surface texture Ra ${i.finishRa ?? '[ ]'} µm unless otherwise specified.`, 'The default for all surfaces without a symbol.');
  if (i.material) add(`Material: ${i.material}${i.materialSpec ? ` per ${i.materialSpec}` : ''}, [condition], [product form].`, 'Give more than the alloy.');
  if (i.treatment !== 'none') {
    const t = TREATMENTS.find((x) => x.key === i.treatment)!;
    add(`${t.name} per [specification], [class / thickness].`, 'The process and its class.');
    add('Dimensions apply [before / after] surface treatment.', 'Coatings add thickness: say which state the dimensions are in.');
    add('Mask threads and surfaces marked [symbol] from treatment.', 'Threads, seal faces and electrical bonding faces usually stay bare.');
    if (needsBake(i.ftuMPa, i.treatment)) add('Bake for hydrogen embrittlement relief per [specification] within [time] of plating.', `Steel at ${i.ftuMPa} MPa ultimate is susceptible: plating needs a relief bake, usually within 4 hours.`);
  }
  if (i.fasteners) add('Tighten fasteners to [torque] N·m with [lubricant]; friction coefficient assumed [range]. Lock per [method].', 'A torque without its lubricant does not set the preload.');
  if (i.ndt !== 'none') { const m = NDT_METHODS.find((x) => x.key === i.ndt)!; add(`Inspect [features] by ${m.name.replace(/ \(.*\)/, '').toLowerCase()} per ${m.std} to [acceptance standard and class].`, 'Method, standard and acceptance class.'); }
  if (i.criticality === 'fracture') add('Fracture-critical part: [flaw size and NDE requirements] per [fracture control plan].', 'The fracture control plan sets the flaw size and the inspection.');
  if (i.cleanliness) add('Clean to [cleanliness level] per [specification] before assembly.', 'A level and a method, not only "clean".');
  if (i.marking !== 'none') {
    const how = { etch: 'electrolytic etch', laser: 'laser marking', dotpeen: 'dot peen', ink: 'ink', none: '' }[i.marking];
    add(`Mark part number, issue and serial number per [specification] at location shown, by ${how}.${i.criticality !== 'none' && i.marking === 'dotpeen' ? ' [Check: dot peen is an impression method]' : ''}${i.criticality !== 'none' ? ' No impression stamping.' : ''}`, 'Stamping is a stress raiser on critical parts.');
  }
  if (i.exportControl) add('[Export control marking text and classification].', 'Legal requirement where it applies.');
  return n;
}

// ---------- Checker ----------

/** Words and patterns that make a note impossible to verify, with the reason. */
const VAGUE: [RegExp, string][] = [
  [/\b(break|remove)\b.*\bsharp edges?\b(?![^.]*\d)/i, 'An edge break needs a size, for example 0.2–0.5 mm.'],
  [/\bto suit\b|\bas required\b|\bas necessary\b|\bif required\b/i, 'Gives the decision to the shop. State the requirement.'],
  [/\bstandard (values?|practice|torques?)\b|\bshop practice\b|\bgood (engineering|workmanship) practice\b/i, 'Which standard? Name the document and the values.'],
  [/\bclean\b(?![^.]*\b(level|per|to|specification|spec)\b)/i, 'Cleanliness needs a level and a method.'],
  [/\btorque\b(?![^.]*\d)/i, 'A torque needs a value, a lubricant and a tolerance.'],
  [/\b(inspect|check|test)\b(?![^.]*\b(per|to|astm|iso|en|class|level|spec)\b)/i, 'An inspection needs a method, a standard and an acceptance class.'],
  [/\b(approx(imately)?|about|around|nominal(ly)?|roughly)\b/i, 'Approximate values cannot be inspected. Give a tolerance or mark the value as reference.'],
  [/\b(smooth|polish(ed)?|fine finish|good finish)\b(?![^.]*\bR[az]\b)/i, 'A finish needs a parameter and a value, for example Ra 0.8 µm.'],
  [/\b(heat treat(ed)?|harden(ed)?)\b(?![^.]*\b(per|to|hrc|hv|hb|mpa|spec)\b)/i, 'A heat treatment needs a specification and a result (hardness or strength).'],
  [/\b(paint|coat(ed)?|plate[d]?|anodi[sz]e[d]?)\b(?![^.]*\b(per|to|spec|class|type|µm|um)\b)/i, 'A coating needs a specification and a class or thickness.'],
  [/\bweld\b(?![^.]*\b(per|to|wps|aws|iso|class|spec)\b)/i, 'A weld needs a procedure, a specification and an inspection class.'],
  [/\bshould\b|\bmay\b|\bpreferably\b|\bwhere possible\b/i, 'A note is a requirement: use "shall", or delete it.'],
];

/**
 * Check one note: the reasons it cannot be verified (empty if none found). A [bracket] is a blank for the programme's
 * own value, so it counts as a value here.
 */
export function checkNote(text: string) {
  const t = text.trim().replace(/\[[^\]]*\]/g, '0');
  if (!t) return [];
  const out = VAGUE.filter(([re]) => re.test(t)).map(([, why]) => why);
  if (/\btorque\b|\btighten\b/i.test(t) && /\d/.test(t) && !/lubric|\bdry\b|\boil\b|grease|anti-?seize|\bμ\b|friction|mos2/i.test(t))
    out.push('A torque without the lubrication condition does not set the preload.');
  return out.filter((w, i, a) => a.indexOf(w) === i);
}

/** True if a note still has [brackets] to fill. */
export const hasBlanks = (text: string) => /\[[^\]]*\]/.test(text);

/** Check a list of notes, one per line, and find a value given twice with different numbers (torque, Ra). */
export function checkNotes(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
  const results = lines.map((l) => ({ note: l, issues: checkNote(l) }));
  const conflicts: string[] = [];
  for (const [label, re] of [['torque', /(\d+(?:\.\d+)?)\s*N\s*·?\s*m/i], ['surface texture', /Ra\s*(\d+(?:\.\d+)?)/i]] as const) {
    const vals = [...new Set(lines.map((l) => re.exec(l)?.[1]).filter(Boolean))];
    if (vals.length > 1 && lines.filter((l) => /unless otherwise/i.test(l) && re.test(l)).length < 2) conflicts.push(`Two different ${label} values (${vals.join(' and ')}). State each requirement once.`);
  }
  return { results, conflicts, clean: results.filter((r) => !r.issues.length).length };
}
