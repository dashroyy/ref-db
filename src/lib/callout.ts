// Material callout builder: turns a spec sheet + chosen form, condition and finish
// into a drawing material block. The three-part rule: alloy and condition, product
// form standard (with its tolerance standard), and the finish with its own spec.

export interface SpecForm { form: string; standard: string; note: string; }
export interface SpecTemper { code: string; note: string; }
export interface SpecFinish { name: string; spec: string; note: string; }
export interface SpecSheet {
  name: string; designation: string; family: string; base: string; composition: string;
  forms: SpecForm[]; tempers: SpecTemper[]; finishes: SpecFinish[]; callout: string; tips: string[];
  /** manufacturing considerations (src/data/specs-mfg.mjs); pcg: the alloy can grow peripheral coarse grain */
  mfg?: { pcg: boolean; notes: string[] };
  /** a library material with no sheet yet: placeholders for the form, standard, condition and finish */
  skeleton?: boolean;
}

/** A skeleton sheet for a library metal that has no specification sheet: its designation, if the designations table
 *  knows it, and placeholders for everything else. Nothing is invented. */
export function skeletonSheet(m: { name: string; family: string; summary: string; spec: string }, x?: { en: string; enNo: string } | null): SpecSheet {
  const en = x?.en ? x.en.split(' / ')[0].replace(/\s*\([^)]*\)\s*/g, ' ').trim() : '';
  const hint = x?.en?.match(/\(((?:BS )?EN [^)]+|AMS [^)]+|ASTM [^)]+)\)/)?.[1];
  const no = x?.enNo && x.enNo !== '—' && !en.includes(x.enNo) ? ` (${x.enNo})` : '';
  const std = hint ? `${/^EN /.test(hint) ? 'BS ' + hint : hint} / <PRODUCT STANDARD>` : '<PRODUCT STANDARD>';
  return {
    name: m.name, designation: en ? en + no : m.name, family: m.family, skeleton: true,
    base: `${m.summary}. No specification sheet yet: the callout is a skeleton with placeholders.`, composition: '',
    forms: [{ form: '<PRODUCT FORM>', standard: std, note: hint ? `The designations table gives ${hint} for this alloy: confirm that it covers your product form.` : 'Give the product form and its standard (bar, plate, tube, forging or casting each have their own).' }],
    tempers: [{ code: '<CONDITION>', note: 'State the temper or heat treatment, with a minimum strength or hardness that an inspector can test.' }],
    finishes: [{ name: '<FINISH>', spec: '<FINISH SPEC>', note: 'State the finish with its own specification, or none.' }],
    callout: '', tips: m.spec ? [m.spec] : [],
  };
}

const stripNotes = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim();

/** Split a form standard into the property standard alternatives and the tolerance standard(s). */
export function parseStandard(raw: string) {
  const parts = raw.split(/\s\+\s/).map(stripNotes).filter(Boolean);
  const alternatives = (parts[0] ?? '').split(/\s\/\s/).map((s) => s.trim()).filter(Boolean);
  return { alternatives, tolerances: parts.slice(1) };
}

/** First code of a temper entry: 'T6 / T651' → 'T6'. */
export const temperCode = (raw: string) => raw.split(/\s\/\s/)[0].trim();

/** Finish spec without bracketed notes; generic company, process and programme specs become placeholders. */
export const finishSpec = (raw: string) => {
  const s = stripNotes(raw).split(/\s\/\s/)[0].trim();
  if (/company/i.test(s)) return '<COMPANY SPEC>';
  if (/^process spec/i.test(s)) return '<PROCESS SPEC>';
  if (/^programme spec/i.test(s)) return '<PROGRAMME SPEC>';
  return s;
};

export interface CalloutChoice {
  sheet: SpecSheet;
  formIndex: number;
  standard: string; // one of the parsed alternatives
  temperIndex: number; // -1 = none
  finishIndex: number; // -1 = none
  afterFinish: boolean;
  traceability: boolean;
  certificate: boolean;
  // optional lines, as in the v1 builder
  heatTreat?: boolean; // the condition by a process specification, with furnace pyrometry
  hydrogenBake?: boolean; // embrittlement relief after plating a steel
  ndt?: boolean; // penetrant inspection of the finished part
  pcg?: { stock: number; macro: boolean } | null; // no peripheral coarse grain on the finished part
  edges?: boolean; // edge condition to ISO 13715
  grainDirection?: boolean;
}

const pad = (k: string) => (k + ':').padEnd(10, ' ');
const CONT = ' '.repeat(10);

/** True when a finish is an electroplating that can put hydrogen into a steel (not hot-dip galvanising or electropolishing). */
export const isPlating = (finishName: string) => /plat|electro(?!polish)|zinc|cadmium/i.test(finishName) && !/galvani[sz]|hot.dip/i.test(finishName);
/** The hydrogen-bake line applies by default to a plated steel, unless the finish specification already calls for the bake. */
export const needsBake = (sheet: SpecSheet, finish: SpecFinish | null) =>
  !!finish && ['steel', 'ss', 'ni'].includes(sheet.family) && isPlating(finish.name) && !/embrittlement/i.test(finish.spec);

export function buildCallout(c: CalloutChoice) {
  const s = c.sheet;
  const form = s.forms[c.formIndex];
  const { tolerances } = parseStandard(form.standard);
  const temper = c.temperIndex >= 0 ? s.tempers[c.temperIndex] : null;
  const finish = c.finishIndex >= 0 ? s.finishes[c.finishIndex] : null;
  const FORM = form.form.toUpperCase().replace(/&/g, 'AND');
  const lines: string[] = [];

  if (s.family === 'al' && temper && !temper.code.startsWith('<')) {
    // EN aluminium: the temper is part of the designation (EN AW-6082-T6)
    lines.push(`${pad('MATERIAL')}${s.designation}-${temperCode(temper.code)} ${FORM} TO ${c.standard}`);
  } else {
    lines.push(`${pad('MATERIAL')}${s.designation} ${FORM} TO ${c.standard}`);
    if (temper) lines.push(`${CONT}CONDITION: ${temperCode(temper.code).toUpperCase()}`);
  }
  for (const t of tolerances) lines.push(`${CONT}TOLERANCES TO ${t}`);
  if (c.heatTreat && temper) lines.push(`${CONT}HEAT TREAT TO ${temperCode(temper.code).toUpperCase()} PER <PROCESS SPEC>`, `${CONT}FURNACE PYROMETRY TO AMS 2750`);
  if (finish) lines.push(`${pad('FINISH')}${finish.name.toUpperCase()} TO ${finishSpec(finish.spec)}`);
  if (finish && c.hydrogenBake) lines.push(`${CONT}HYDROGEN EMBRITTLEMENT RELIEF BAKE TO AMS 2759/9 OR BS EN ISO 9588`, `${CONT}START THE BAKE WITHIN <TIME> OF PLATING`);
  if (c.ndt) lines.push(`${pad('NDT')}PENETRANT INSPECTION TO BS EN ISO 3452-1, SENSITIVITY LEVEL 3`, `${CONT}ACCEPTANCE TO <PROGRAMME SPEC>`);
  if (c.certificate) lines.push(`${pad('CERTS')}SUPPLY WITH BS EN 10204 TYPE 3.1 INSPECTION CERTIFICATE`);
  if (c.traceability) lines.push(`${pad('MARK')}BATCH / HEAT NO. BY <METHOD> AT <LOCATION>`, `${CONT}NO STAMPING ON FRACTURE-CRITICAL SURFACES`);
  if (c.pcg) {
    lines.push(`${pad('GRAIN')}NO PERIPHERAL COARSE GRAIN ON THE FINISHED PART`);
    if (c.pcg.stock > 0) lines.push(`${CONT}REMOVE MIN ${c.pcg.stock.toFixed(1)} mm FROM ALL AS-SUPPLIED SURFACES`);
    if (c.pcg.macro) lines.push(`${CONT}VERIFY BY MACRO-ETCH OF A SACRIFICIAL SAMPLE PER <PROCESS SPEC>`);
  }
  const notes: string[] = [];
  if (c.afterFinish && finish) notes.push('DIMENSIONS APPLY AFTER FINISH');
  if (c.edges) notes.push('EDGES TO ISO 13715 -0.1/-0.5, NO BURRS');
  if (c.grainDirection) notes.push('GRAIN DIRECTION AS SHOWN');
  notes.forEach((n, i) => lines.push(`${i === 0 ? pad('NOTE') : CONT}${n}`));
  return lines.join('\n');
}
