// Revision control and sign-off: is a change a revision or a new part number (the form, fit and function test of
// interchangeability), which revision letter comes next (ASME Y14.35), and who signs the release. Screening logic
// only: the change board and the programme's configuration-management plan decide.

export type Ans = 'yes' | 'no' | 'unsure';
export type Crit = 'none' | 'major' | 'critical' | 'fracture';

/** The interchangeability questions. A "no" or "unsure" to any of the first four makes the part a new part number. */
export interface ChangeAnswers {
  fit: Ans; // old parts still assemble with every mating part
  func: Ans; // old parts still meet every performance, strength and life requirement
  form: Ans; // shape, mass and centre of gravity stay inside what the next assembly relies on
  swap: Ans; // new parts replace old ones, and old parts replace new ones, in every existing assembly
  classI: Ans; // the change affects an ICD, a customer requirement, safety, qualification, cost or schedule
  parentOk?: Ans; // the next assembly stays interchangeable at its own interfaces
}

export const QUESTIONS: { key: keyof ChangeAnswers; q: string; short: string }[] = [
  { key: 'fit', short: 'Fit', q: 'Do old parts still assemble with every mating part?' },
  { key: 'func', short: 'Function', q: 'Do old parts still meet every performance, strength and life requirement?' },
  { key: 'form', short: 'Form', q: 'Do shape, mass and centre of gravity stay inside what the next assembly relies on?' },
  { key: 'swap', short: 'Two-way', q: 'Can new parts replace old parts, and old parts replace new, in every existing assembly?' },
  { key: 'classI', short: 'Class I', q: 'Does it affect an ICD, a customer requirement, safety, qualification, cost or schedule?' },
];

export interface ChangeType { key: string; name: string; a: Omit<ChangeAnswers, 'parentOk'>; updates: string[] }

/** Typical answers for each kind of change. They are starting points: the engineer answers for the actual change. */
export const CHANGES: ChangeType[] = [
  { key: 'clarify', name: 'Clarify a note or correct a typo', a: { fit: 'yes', func: 'yes', form: 'yes', swap: 'yes', classI: 'no' },
    updates: ['Drawing'] },
  { key: 'relax', name: 'Relax a tolerance; parts still fit', a: { fit: 'yes', func: 'yes', form: 'yes', swap: 'yes', classI: 'no' },
    updates: ['Drawing', 'Tolerance stack of the next assembly', 'Inspection plan'] },
  { key: 'tighten', name: 'Tighten a tolerance', a: { fit: 'yes', func: 'unsure', form: 'yes', swap: 'unsure', classI: 'no' },
    updates: ['Drawing', 'Inspection plan', 'Screen stock against the new limits'] },
  { key: 'process', name: 'Change a process or surface treatment', a: { fit: 'yes', func: 'unsure', form: 'yes', swap: 'unsure', classI: 'no' },
    updates: ['Drawing notes', 'Process specification', 'Galvanic and coating check'] },
  { key: 'material', name: 'Change the material or its grade', a: { fit: 'yes', func: 'unsure', form: 'unsure', swap: 'unsure', classI: 'yes' },
    updates: ['Drawing and material specification', 'Model mass properties', 'Stress analysis', 'Galvanic and coating check'] },
  { key: 'function', name: 'Change a functional feature that does not mate', a: { fit: 'yes', func: 'no', form: 'yes', swap: 'no', classI: 'no' },
    updates: ['Drawing and model', 'Analysis of that function', 'Inspection plan'] },
  { key: 'mating', name: 'Change a mating or interface feature', a: { fit: 'no', func: 'unsure', form: 'no', swap: 'no', classI: 'yes' },
    updates: ['Drawing and model', 'Mating part drawings', 'Tolerance stack of the next assembly', 'ICD'] },
  { key: 'add', name: 'Add a feature that old parts do not have', a: { fit: 'unsure', func: 'unsure', form: 'no', swap: 'no', classI: 'no' },
    updates: ['Drawing and model', 'Inspection plan'] },
];

export interface ChangeResult {
  action: 'revision' | 'newPN';
  failed: string[]; // questions answered "no"
  unsure: string[]; // questions answered "unsure": treated as "no" until shown otherwise
  changeClass: 'I' | 'II';
  parent?: 'revise' | 'newPN' | 'ask';
  updates: string[];
  approvals: string[];
}

export function classifyChange(a: ChangeAnswers, type?: ChangeType): ChangeResult {
  const core = QUESTIONS.slice(0, 4);
  const failed = core.filter((q) => a[q.key] === 'no').map((q) => q.short);
  const unsure = core.filter((q) => a[q.key] === 'unsure').map((q) => q.short);
  const action = failed.length || unsure.length ? 'newPN' : 'revision';
  const changeClass = a.classI === 'no' ? 'II' : 'I';
  const updates = [...(type?.updates ?? ['Drawing'])];
  if (action === 'newPN') {
    updates.push('Parts list of every next assembly (where-used)', 'Disposition of stock, work in progress and fielded parts', 'Delta first article inspection (AS9102)');
  } else {
    updates.push('Revision table: change record and zones affected');
    if (type && type.key !== 'clarify') updates.push('Delta first article inspection, if a characteristic changed (AS9102)');
  }
  if (changeClass === 'I' && !updates.includes('ICD')) updates.push('ICD and the requirement documents it affects');
  const approvals = ['Design authority'];
  if (changeClass === 'I') approvals.push('Change board, and the customer where the contract requires it');
  const parent = action === 'revision' ? undefined : a.parentOk === 'yes' ? 'revise' : a.parentOk === 'no' ? 'newPN' : 'ask';
  return { action, failed, unsure, changeClass, parent, updates, approvals };
}

// ASME Y14.35: revision letters exclude I, O, Q, S, X and Z, because they read like numbers or other letters. After Y
// the sequence goes to AA, AB and so on.
export const REV_EXCLUDED = ['I', 'O', 'Q', 'S', 'X', 'Z'];
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((c) => !REV_EXCLUDED.includes(c)); // 20 letters

/** True for a release revision of letters only, none of them excluded. */
export const isValidRev = (r: string) => /^[A-Z]{1,3}$/.test(r) && r.split('').every((c) => ALPHA.includes(c));

/** Position in the sequence: A = 1, Y = 20, AA = 21. */
export function revIndex(r: string) {
  if (!isValidRev(r)) return NaN;
  return r.split('').reduce((n, c) => n * ALPHA.length + ALPHA.indexOf(c) + 1, 0);
}

export function revFromIndex(n: number) {
  let s = '';
  while (n > 0) { const k = (n - 1) % ALPHA.length; s = ALPHA[k] + s; n = Math.floor((n - 1) / ALPHA.length); }
  return s;
}

/** The next release revision. A blank, a dash or "NC" (the initial release on some drawings) goes to A. An excluded
 * letter is not a valid revision, so the next one is found from the letter before it. */
export function nextRev(r: string) {
  const s = r.trim().toUpperCase();
  if (s === '' || s === '-' || s === 'NC' || /^\d+$/.test(s)) return 'A';
  if (isValidRev(s)) return revFromIndex(revIndex(s) + 1);
  // Step to the next valid letter after an excluded one (for example O goes to P).
  const n = s.split('').reduce((m, c) => m * 26 + c.charCodeAt(0) - 64, 0);
  for (let k = n + 1; k < n + 30; k++) {
    let t = '', x = k;
    while (x > 0) { t = String.fromCharCode(65 + ((x - 1) % 26)) + t; x = Math.floor((x - 1) / 26); }
    if (isValidRev(t)) return t;
  }
  return 'A';
}

export interface Signatory { role: string; checks: string; independent?: boolean }

/** The sign-off route. Each signatory checks something different; higher criticality adds independent checks. */
export function signoff(crit: Crit, classI: boolean, analysisChanged: boolean): Signatory[] {
  const r: Signatory[] = [
    { role: 'Drawn', checks: 'The drawing is complete and agrees with the model at this revision.' },
    { role: 'Checked', checks: 'Drawing practice and GD&T. Every feature is defined once and has one meaning.' },
  ];
  if (crit !== 'none' || analysisChanged) r.push({ role: 'Stress', checks: 'Every margin is positive and references a released analysis at this revision.' });
  if (crit === 'critical' || crit === 'fracture') r.push({ role: 'Independent stress check', checks: 'A second analyst, who did not do the analysis, checks the critical margins.', independent: true });
  if (crit === 'fracture') r.push({ role: 'Fracture control', checks: 'Flaw size, NDT method and acceptance class agree with the damage-tolerance analysis.', independent: true });
  if (crit !== 'none') r.push({ role: 'Manufacturing', checks: 'The part can be made with the intended process and tooling.' });
  r.push({ role: 'Quality', checks: 'Every requirement can be measured or verified. Critical characteristics are marked.' });
  r.push({ role: 'Design authority', checks: 'The part meets its requirements. Approves the release.' });
  if (classI) r.push({ role: 'Change board', checks: 'Approves a Class I change, and its effect on the ICD, cost and schedule.', independent: true });
  return r;
}

export const CHECKLIST = [
  'Every feature is fully defined. Nothing is dimensioned twice.',
  'Each datum scheme agrees with the mating part and the ICD.',
  'Every functional feature has its own tolerance.',
  'Material, condition, treatments and notes are complete.',
  'Each characteristic can be measured.',
  'The master (drawing or model) is stated, and both agree at this revision.',
  'The revision table references the change record and the zones affected.',
  'The checker signs the release copy, not the live CAD model.',
];
