// Requirements and interface control: a check of requirement wording for what makes a requirement unverifiable, the
// transfer of an interface load set from one reference point to another, the bolt loads of a circular pattern, and a
// budget with growth allowances and a reserve. Units: mm, kN, kN·mm (N·m at the UI), kg.

export type Level = 'bad' | 'warn';
export interface Issue { level: Level; word: string; problem: string; fix: string }

const RULES: [RegExp, Level, string, string][] = [
  [/\b(suitable|adequate|appropriate|sufficient|reasonable|robust|compatible|acceptable|user-friendly|easy)\b/i, 'bad', 'No threshold', 'State the number it must meet'],
  [/\b(minimi[sz]e[ds]?|maximi[sz]e[ds]?|optimi[sz]e[ds]?|as (?:small|low|light|short|high|large|fast) as possible)\b/i, 'bad', 'No end point', 'Give a limit; add a goal if you want one'],
  [/\b(as required|where necessary|if necessary|as needed|as applicable|etc\.?|and so on)/i, 'bad', 'Delegates the decision', 'Name the condition'],
  [/\band\/or\b/i, 'bad', 'Two requirements in one', 'Split it into two'],
  [/\b(should|may|might|could|will)\b/i, 'warn', 'Not binding in most specifications', 'Use "shall", or move it to guidance'],
  [/\b(TBD|TBC|TBR)\b/, 'warn', 'Open item', 'Give it an owner and a date'],
  [/\b(all|always|never|every|none)\b/i, 'warn', 'Absolute', 'Check that it can be verified'],
];

/** Check one requirement. Returns the issues found and a suggested verification method. */
export function lint(text: string) {
  const t = text.trim(), issues: Issue[] = [];
  if (!t) return { text: t, issues, method: '' };
  for (const [re, level, problem, fix] of RULES) {
    const m = t.match(re);
    if (m) issues.push({ level, word: m[0], problem, fix });
  }
  const shalls = (t.match(/\bshall\b/gi) ?? []).length;
  if (shalls === 0 && !/\bmust\b/i.test(t)) issues.push({ level: 'bad', word: '', problem: 'No binding verb', fix: 'Write it with "shall"' });
  if (shalls > 1) issues.push({ level: 'bad', word: 'shall', problem: 'More than one requirement', fix: 'One "shall" for each row' });
  if (!/\d/.test(t) && !/\b(TBD|TBC|TBR)\b/.test(t)) issues.push({ level: 'warn', word: '', problem: 'No value', fix: 'Add the number and its unit, or the document that gives it' });
  return { text: t, issues, method: method(t) };
}

/** Suggest a verification method from the words of the requirement (a starting point, not a rule). */
export function method(t: string) {
  if (/\b(dimension|diameter|marked|marking|finish|colour|material|certificate|drawing|thread)\b/i.test(t)) return 'Inspection';
  if (/\b(assembl|install|access|operat|remov|replace)/i.test(t)) return 'Demonstration';
  if (/\b(leak|pressure|proof|burst|vibration|shock|temperature|thermal|load|torque|life|mass|weigh)/i.test(t)) return /\b(weigh|mass|leak|proof)/i.test(t) ? 'Test' : 'Test or analysis';
  return 'Analysis';
}

/** Check a list of requirements, one for each line. */
export const lintAll = (s: string) => s.split(/\r?\n/).map((l) => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '')).filter((l) => l.trim()).map(lint);

export type V3 = [number, number, number];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Move a load set (force F, moment M) from point A to point B: the force is the same, M_B = M_A + (A − B) × F. */
export function transfer(F: V3, M: V3, A: V3, B: V3) {
  const r: V3 = [A[0] - B[0], A[1] - B[1], A[2] - B[2]], rxF = cross(r, F);
  return { F, M: [M[0] + rxF[0], M[1] + rxF[1], M[2] + rxF[2]] as V3, r };
}

/**
 * A circular pattern of n bolts on diameter D, with the x axis normal to the joint: axial force Fx shared equally, and
 * the bending moment (My, Mz) giving at most 4M/(nD) on the outermost bolt; the shear (Fy, Fz) and torque Mx shared.
 */
export function boltPattern(F: V3, M: V3, n: number, D: number) {
  const Mb = Math.hypot(M[1], M[2]), axial = F[0] / n, bend = (4 * Mb) / (n * D);
  const shear = Math.hypot(F[1], F[2]) / n + (2 * Math.abs(M[0])) / (n * D);
  return { axial, bend, max: axial + bend, min: axial - bend, shear, Mb, increase: bend / Math.abs(axial || 1) };
}

/** A budget: items with a current value and a growth allowance (fraction); the system holds a reserve. */
export interface BudgetItem { name: string; value: number; growth: number }
export function budget(items: BudgetItem[], allowable: number, reserve: number) {
  const rows = items.filter((i) => i.name && i.value > 0).map((i) => ({ ...i, predicted: i.value * (1 + i.growth) }));
  const current = rows.reduce((a, r) => a + r.value, 0), predicted = rows.reduce((a, r) => a + r.predicted, 0);
  const available = allowable - reserve;
  return { rows, current, predicted, available, margin: available - predicted, marginNow: available - current, growth: predicted - current };
}
