// The standards register (src/data/standards.json): what each standard covers, why you would reach for it, where to
// get it, and which pages of this site cite it (found in the page text at build time). A checker reads a list of
// references, as on a drawing or a specification, and finds withdrawn standards, undated references, a drawing that
// mixes ISO and ASME tolerancing, and general tolerances without a class.
import data from '../data/standards.json' with { type: 'json' };

export interface Standard { ref: string; title: string; cat: string; why: string }
export const STANDARDS = data.standards as Standard[];

export const CATS: { key: string; name: string }[] = [
  { key: 'drawing', name: 'Drawing practice' }, { key: 'gps', name: 'GPS and tolerancing' }, { key: 'hardware', name: 'Threads, fasteners and seals' },
  { key: 'material', name: 'Materials and testing' }, { key: 'process', name: 'Special processes and NDT' }, { key: 'quality', name: 'Quality, configuration and records' },
  { key: 'design', name: 'Design criteria and structures' }, { key: 'env', name: 'Environment, safety and human factors' }, { key: 'im', name: 'Insensitive munitions' },
];

/** Where to get a standard, from the body that publishes it. */
export function accessFor(ref: string) {
  const r = ref.toUpperCase();
  if (r.startsWith('EN 9300')) return 'ASD-STAN (asd-stan.org) or your national standards body.';
  if (/^(BS|ISO|EN)\b/.test(r)) return 'BSI Knowledge (bsigroup.com) for BS, BS EN and BS ISO; iso.org for ISO. Many employers have a subscription: ask before you buy.';
  if (r.startsWith('ASME')) return 'ASME (asme.org).';
  if (r.startsWith('CMH')) return 'SAE International (sae.org), which publishes CMH-17.';
  if (/^(SAE|AMS|AS\d|AS |EIA)/.test(r)) return 'SAE International (sae.org).';
  if (/^(DEF STAN|JSP)/.test(r)) return 'UK Defence Standardization (DStan): free to register. Some parts are restricted: get them through your Design Authority.';
  if (/^(STANAG|AOP)/.test(r)) return 'NATO Standardization Office (nso.nato.int): public documents are free; others through your national authority.';
  if (r.startsWith('NASA')) return 'NASA Technical Standards System (standards.nasa.gov): free.';
  if (/^(MIL|NASM|NAS)/.test(r)) return 'ASSIST Quick Search for MIL documents (free); NAS and NASM from the AIA.';
  if (r.startsWith('ASTM')) return 'ASTM International (astm.org).';
  if (r.startsWith('ECSS')) return 'ECSS (ecss.nl): free to download after registration.';
  if (r.startsWith('CS-')) return 'EASA (easa.europa.eu): free.';
  if (r.startsWith('AIAA')) return 'AIAA (aiaa.org).';
  if (/^(DIN|VDI)/.test(r)) return 'DIN Media (formerly Beuth) for DIN and VDI documents.';
  if (r.startsWith('MMPDS')) return 'Battelle, under licence: ask your stress office.';
  if (r.startsWith('NADCAP')) return 'Performance Review Institute (p-r-i.org): an accreditation of suppliers, not a document to buy.';
  return 'Your programme or company document library.';
}

/**
 * The designations that identify a standard in text: "BS EN ISO 3452" is found as "ISO 3452", "ISO 286-1/-2" as
 * "ISO 286", "AMS 2644 / ASTM E1417" as both. A part number without a prefix takes the prefix of the one before it
 * ("ISO 4014 / 4017"). Designations without a number count only if they are one upper-case word of five letters or
 * more (MMPDS, NADCAP).
 */
export function tokens(ref: string) {
  const parts = ref.replace(/\(.*?\)/g, '').split(/\s*\/\s*/);
  const out: string[] = [];
  let prefix = '';
  for (let p of parts) {
    p = p.trim().replace(/\s+series$/i, '').replace(/^BS EN ISO /, 'ISO ').replace(/^BS ISO /, 'ISO ').replace(/^EN ISO /, 'ISO ').replace(/^BS EN /, 'EN ');
    if (!p || /^-\d/.test(p)) continue;
    if (/^[A-Z]?\d/.test(p) && prefix) p = prefix + p;
    p = p.replace(/^((?:ISO|EN|IEC)\s\d+)-\d.*$/, '$1').replace(/[-:](19|20)\d{2}$/, ''); // ISO 286-1 → ISO 286; Y14.5-2018 → Y14.5
    const m = p.match(/^(.*?)(?:[A-Z]?\d[\d.-]*\w*)$/);
    if (m && /\d/.test(p)) prefix = m[1];
    if (/\d/.test(p) || /^[A-Z]{5,}$/.test(p)) out.push(p);
  }
  return [...new Set(out)];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** True if the text names the designation (not as part of a longer number). */
export const names = (text: string, token: string) => new RegExp(`(?<![\\w-])${esc(token)}(?!\\d)`).test(text);

export interface Doc { path: string; title: string; text: string }
/** The pages whose text names any designation of the standard. */
export const citedBy = (s: Standard, docs: Doc[]) => {
  const t = tokens(s.ref);
  return t.length ? docs.filter((d) => t.some((k) => names(d.text, k))).map(({ path, title }) => ({ path, title })) : [];
};

/** Withdrawn or replaced standards that still turn up on drawings. */
export const SUPERSEDED: { test: RegExp; old: string; now: string; note: string }[] = [
  { test: /\bBS\s?308\b/, old: 'BS 308', now: 'BS 8888', note: 'BS 308 was withdrawn in 2000; BS 8888 replaced it and invokes the ISO GPS standards.' },
  { test: /\bMIL-HDBK-5\b/, old: 'MIL-HDBK-5', now: 'MMPDS', note: 'MIL-HDBK-5 was replaced by MMPDS in 2003.' },
  { test: /\bISO\s?4287\b/, old: 'ISO 4287', now: 'ISO 21920-2', note: 'The surface texture parameters moved to ISO 21920-2 (2021).' },
  { test: /\bISO\s?1302\b/, old: 'ISO 1302', now: 'ISO 21920-1', note: 'The surface texture symbols moved to ISO 21920-1 (2021).' },
  { test: /\bISO\s?4288\b/, old: 'ISO 4288', now: 'ISO 21920-3', note: 'The measurement rules moved to ISO 21920-3 (2021).' },
  { test: /\bISO\s?2768-2\b/, old: 'ISO 2768-2', now: 'ISO 22081', note: 'ISO 22081 replaced ISO 2768-2 for general geometrical tolerances.' },
  { test: /\bY14\.5M\b/, old: 'ASME Y14.5M-1994', now: 'ASME Y14.5-2018', note: 'The 1994 edition was replaced in 2009 and again in 2018.' },
  { test: /\bY14\.5-2009\b/, old: 'ASME Y14.5-2009', now: 'ASME Y14.5-2018', note: 'Replaced by the 2018 edition.' },
  { test: /\bAS9100[ABC]\b/, old: 'AS9100 (rev A to C)', now: 'AS9100D', note: 'Earlier revisions are withdrawn.' },
  { test: /\bISO\s?9001:2008\b/, old: 'ISO 9001:2008', now: 'ISO 9001:2015', note: 'The 2008 edition is withdrawn.' },
  { test: /\bBS\s?4500\b/, old: 'BS 4500', now: 'BS EN ISO 286-1/-2', note: 'The British limits and fits standard was replaced by ISO 286.' },
  { test: /\bEN\s?10002-1\b/, old: 'EN 10002-1', now: 'BS EN ISO 6892-1', note: 'Tensile testing of metals moved to ISO 6892-1.' },
  { test: /(?<![\w-])QQ-A-250\b/, old: 'QQ-A-250', now: 'AMS-QQ-A-250', note: 'The federal aluminium specifications were transferred to SAE.' },
  { test: /\bMIL-S-8879\b/, old: 'MIL-S-8879', now: 'SAE AS8879', note: 'The UNJ thread specification was transferred to SAE.' },
];

export type Level = 'ok' | 'warn' | 'bad' | 'info';
export interface LineCheck { line: string; std?: Standard; issues: { level: Level; text: string }[] }

// A year, an SAE revision letter (AS9102C), an ASTM year suffix (E1444/E1444M-22), an MMPDS edition (MMPDS-17), or the
// words issue, revision or amendment.
const dated = (line: string) =>
  /\b(19|20)\d{2}\b/.test(line) || /\b(AMS|AS|ARP)\s?\d+[A-Z]\b/.test(line) || /\bASTM\s?[A-Z]?\d+[A-Z]?(\/[A-Z]?\d+M)?-\d{2}\b/.test(line) ||
  /\bMMPDS-\d+\b/.test(line) || /\b(issue|rev(ision)?|amd)\.?\s*\w+/i.test(line);
const ISO_GPS = /\b(BS\s?8888|ISO\s?8015|ISO\s?1101|ISO\s?5459|ISO\s?2692)\b/;
const ASME_GDT = /\bY14\.5/;

/** Check a list of references, one on each line (or separated by ;). */
export function checkRefs(text: string) {
  const lines = text.split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean);
  const out: LineCheck[] = lines.map((line) => {
    const issues: LineCheck['issues'] = [];
    const sup = SUPERSEDED.find((s) => s.test.test(line));
    // A numbered SAE material or process specification (AMS 6431) counts as the generic SAE AMS row.
    const std = STANDARDS.find((s) => tokens(s.ref).some((t) => names(line, t))) ?? (/\bAMS\s?\d{4}/.test(line) ? STANDARDS.find((s) => s.ref === 'SAE AMS specs') : undefined);
    if (sup) issues.push({ level: 'bad', text: `${sup.old} is withdrawn or replaced: use ${sup.now}. ${sup.note}` });
    if (!sup && !std) issues.push({ level: 'info', text: 'Not in the register: check its title and issue against the published list.' });
    if (std && !sup && !dated(line)) issues.push({ level: 'warn', text: 'Undated: an undated reference follows whatever was published last. Cite the issue (year or revision letter).' });
    if (/\bISO\s?2768\b(?!-[12])/.test(line) && !/2768-?[fmcv][HKL]?\b/i.test(line)) issues.push({ level: 'warn', text: 'ISO 2768 without a tolerance class: write the class, for example ISO 2768-mK.' });
    if (!issues.length) issues.push({ level: 'ok', text: std ? `${std.title}.` : 'Recognised.' });
    return { line, std, issues };
  });
  const mix = ISO_GPS.test(text) && ASME_GDT.test(text);
  return { lines: out, mix, bad: out.filter((l) => l.issues.some((i) => i.level === 'bad')).length, warn: out.filter((l) => l.issues.some((i) => i.level === 'warn')).length };
}
