// Certificates and traceability: EN 10204 inspection document types, a review of one certificate against the drawing
// and the part, the consistency of hardness and tensile strength for steels, and attribute sampling for receiving
// inspection (operating characteristic, AQL, LTPD, zero-acceptance sample size). Units: MPa, %, HRC. Screening only.

export const CERT_TYPES = [
  { key: '2.1', rank: 1, name: 'Declaration of compliance', content: 'Statement that the product complies, without test results', by: 'Manufacturer' },
  { key: '2.2', rank: 2, name: 'Test report', content: 'Results of non-specific tests: typical of the production, not of this batch', by: 'Manufacturer' },
  { key: '3.1', rank: 3, name: 'Inspection certificate 3.1', content: 'Results of specific tests on the delivered batch', by: "Manufacturer's inspection representative, independent of production" },
  { key: '3.2', rank: 4, name: 'Inspection certificate 3.2', content: 'As 3.1, and the results are also verified by a second party', by: "Manufacturer's representative and the purchaser's representative or a third party" },
] as const;
export type CertType = (typeof CERT_TYPES)[number]['key'];
export const certRank = (k: string) => CERT_TYPES.find((c) => c.key === k)?.rank ?? 0;

// ---------- Hardness and strength (steels) ----------

/** Rockwell C to Vickers and Brinell for steels, approximately as the ASTM E140 / ISO 18265 tables. */
export const HARDNESS = [
  { hrc: 20, hv: 238, hb: 226 }, { hrc: 25, hv: 266, hb: 253 }, { hrc: 30, hv: 302, hb: 286 }, { hrc: 35, hv: 345, hb: 327 },
  { hrc: 40, hv: 392, hb: 371 }, { hrc: 45, hv: 446, hb: 421 }, { hrc: 50, hv: 513, hb: 481 }, { hrc: 55, hv: 595, hb: 560 },
  { hrc: 60, hv: 697, hb: NaN },
];

function interp(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]) return ys[0] + ((ys[1] - ys[0]) * (x - xs[0])) / (xs[1] - xs[0]);
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
  const n = xs.length - 1;
  return ys[n] + ((ys[n] - ys[n - 1]) * (x - xs[n])) / (xs[n] - xs[n - 1]);
}
export const hrcToHv = (hrc: number) => interp(HARDNESS.map((h) => h.hrc), HARDNESS.map((h) => h.hv), hrc);
export const hvToHrc = (hv: number) => interp(HARDNESS.map((h) => h.hv), HARDNESS.map((h) => h.hrc), hv);
export const hbToHrc = (hb: number) => interp(HARDNESS.slice(0, 8).map((h) => h.hb), HARDNESS.slice(0, 8).map((h) => h.hrc), hb);
export const hrcToHb = (hrc: number) => (hrc > 55 ? NaN : interp(HARDNESS.slice(0, 8).map((h) => h.hrc), HARDNESS.slice(0, 8).map((h) => h.hb), hrc));
/** Approximate tensile strength of a steel from its Vickers hardness: UTS ≈ 3.3 HV (MPa), for about HV 200–650. */
export const utsFromHv = (hv: number) => 3.3 * hv;
export const utsFromHrc = (hrc: number) => utsFromHv(hrcToHv(hrc));
/** Valid range of the conversion, HRC. */
export const HRC_RANGE = [20, 58] as const;

// ---------- Review of one certificate ----------

export type Dir = 'L' | 'LT' | 'ST';
export interface CertInputs {
  required: string | null; supplied: string; // EN 10204 types
  specDrawing: string; specCert: string; issueDrawing: string; issueCert: string;
  condDrawing: string; condCert: string;
  heatPart: string; heatCert: string;
  minUts: number; minYs: number; minEl: number; // drawing or specification minimums
  uts: number; ys: number; el: number; hrc: number; // results on the certificate (NaN if not given)
  steel: boolean; testDir: Dir; loadDir: Dir;
  signed: boolean; source: 'mill' | 'distributor-with-mill' | 'distributor-only';
}
export type Finding = { item: string; status: 'ok' | 'bad' | 'warn' | 'need'; text: string };

const norm = (s: string) => s.toUpperCase().replace(/[\s\-_.]/g, '');

export function reviewCert(i: CertInputs) {
  const out: Finding[] = [];
  const add = (item: string, status: Finding['status'], text: string) => out.push({ item, status, text });
  if (i.required === null) add('Certificate type', 'need', 'Enter the type that your purchase order or programme requires.');
  else if (certRank(i.supplied) >= certRank(i.required)) add('Certificate type', 'ok', `${i.supplied} meets the required ${i.required}.`);
  else add('Certificate type', 'bad', `${i.supplied} is lower than the required ${i.required}. ${certRank(i.supplied) <= 2 ? 'It has no results for this batch.' : ''}`.trim());
  const specOk = !!norm(i.specDrawing) && norm(i.specDrawing) === norm(i.specCert);
  add('Specification', specOk ? 'ok' : 'bad', specOk ? 'The certificate gives the specification on the drawing.' : !norm(i.specDrawing) ? 'Enter the specification on the drawing.' : 'The specification on the certificate is not the one on the drawing.');
  if (norm(i.issueDrawing) || norm(i.issueCert)) add('Issue', norm(i.issueDrawing) === norm(i.issueCert) ? 'ok' : 'warn', norm(i.issueDrawing) === norm(i.issueCert) ? 'Same issue of the specification.' : 'A different issue: check that the purchase order permits it, or get a concession.');
  add('Condition', norm(i.condDrawing) === norm(i.condCert) ? 'ok' : 'bad', norm(i.condDrawing) === norm(i.condCert) ? 'Same condition (temper or heat treatment).' : 'The condition on the certificate is not the one ordered.');
  add('Heat or lot', norm(i.heatPart) && norm(i.heatPart) === norm(i.heatCert) ? 'ok' : 'bad', norm(i.heatPart) && norm(i.heatPart) === norm(i.heatCert) ? 'The marking on the material agrees with the certificate.' : 'The marking on the material does not agree with the certificate. Quarantine the material: the certificate is not evidence for it.');
  const res: [string, number, number, string][] = [['UTS', i.uts, i.minUts, 'MPa'], ['Yield', i.ys, i.minYs, 'MPa'], ['Elongation', i.el, i.minEl, '%']];
  for (const [n, v, min, u] of res) {
    if (!Number.isFinite(min) || min <= 0) continue;
    if (!Number.isFinite(v)) add(n, 'bad', `No result on the certificate, but the drawing gives a minimum of ${min} ${u}.`);
    else add(n, v >= min ? 'ok' : 'bad', `${v} ${u} against a minimum of ${min} ${u}${v >= min ? '' : ': below the minimum'}.`);
  }
  if (Number.isFinite(i.ys) && Number.isFinite(i.uts) && i.ys > i.uts) add('Yield ÷ UTS', 'bad', 'The yield is higher than the UTS: an error in the certificate.');
  if (i.steel && Number.isFinite(i.hrc) && Number.isFinite(i.uts)) {
    const implied = utsFromHrc(i.hrc), d = (i.uts - implied) / i.uts;
    const inRange = i.hrc >= HRC_RANGE[0] && i.hrc <= HRC_RANGE[1];
    if (!inRange) add('Hardness ÷ UTS', 'warn', `${i.hrc} HRC is outside the range of the conversion.`);
    else add('Hardness ÷ UTS', Math.abs(d) <= 0.1 ? 'ok' : 'warn', `${i.hrc} HRC is approximately ${Math.round(implied)} MPa, ${Math.abs(d * 100).toFixed(0)}% ${d > 0 ? 'below' : 'above'} the UTS on the certificate.${Math.abs(d) > 0.1 ? ' Ask for the test record, or test again.' : ''}`);
  }
  if (i.testDir !== i.loadDir) {
    const worse = (i.loadDir === 'ST' && i.testDir !== 'ST') || (i.loadDir === 'LT' && i.testDir === 'L');
    add('Test direction', worse ? 'warn' : 'ok', worse ? `Tested in ${i.testDir}, loaded in ${i.loadDir}. Properties in ${i.loadDir} are usually lower: the result does not represent the load path.` : `Tested in ${i.testDir}, which is usually the lower direction for this load.`);
  } else add('Test direction', 'ok', 'Tested in the direction of the load.');
  add('Signature', i.signed ? 'ok' : 'bad', i.signed ? 'Signed or validated by the stated person.' : 'Not signed or validated: it is not a valid inspection document.');
  add('Source', i.source === 'distributor-only' ? 'warn' : 'ok', i.source === 'mill' ? 'Issued by the producer.' : i.source === 'distributor-with-mill' ? 'Distributor certificate with a copy of the producer certificate: the chain is complete.' : 'Distributor certificate without the producer certificate: the chain to the melt is not shown. Ask for it.');
  const bad = out.filter((f) => f.status === 'bad').length, warn = out.filter((f) => f.status === 'warn').length, need = out.filter((f) => f.status === 'need').length;
  return { findings: out, bad, warn, need, verdict: bad ? 'reject' : need ? 'incomplete' : warn ? 'query' : 'accept' } as const;
}

// ---------- Attribute sampling ----------

/** Probability of acceptance: P(defectives in the sample ≤ c) for a sample of n from a large lot with defect rate p. */
export function accept(n: number, c: number, p: number) {
  if (p <= 0) return 1;
  if (p >= 1) return c >= n ? 1 : 0;
  let term = Math.pow(1 - p, n), s = 0;
  for (let k = 0; k <= Math.min(c, n); k++) { s += term; term *= ((n - k) / (k + 1)) * (p / (1 - p)); }
  return Math.min(1, s);
}

/** The defect rate at which the plan accepts with probability pa (AQL at pa = 0.95, LTPD at pa = 0.10). */
export function rateAt(n: number, c: number, pa: number) {
  let lo = 0, hi = 1;
  for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (accept(n, c, mid) > pa) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/** Sample size for a zero-acceptance plan that rejects a lot with defect rate p, with the stated confidence. */
export const zeroAcceptN = (p: number, confidence: number) => Math.ceil(Math.log(1 - confidence) / Math.log(1 - p) - 1e-9);
