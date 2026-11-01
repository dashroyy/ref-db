// Archive and export control: the neutral format each released item is kept in, how long the record is kept, SHA-256
// checksums so that integrity can be shown later, and a check before technical data is sent. The export check never
// gives a classification or a licence: the export compliance team decides, and the designer marks.

export interface ArchiveItem { key: string; name: string; format: string; std: string; why: string; record: boolean }

export const ARCHIVE_ITEMS: ArchiveItem[] = [
  { key: 'drawing', name: 'Drawing', format: 'PDF/A', std: 'ISO 19005', why: 'Self-contained: fonts and images are embedded, and nothing depends on outside software.', record: true },
  { key: 'model', name: '3D model with PMI', format: 'STEP AP242', std: 'ISO 10303-242', why: 'Neutral. Carries the geometry with its tolerances and annotation (PMI).', record: true },
  { key: 'native', name: 'Native CAD', format: 'Native files', std: '', why: 'Keep them for later changes, but not as the record: they become unreadable as software versions move on.', record: false },
  { key: 'analysis', name: 'Analysis report', format: 'PDF/A', std: 'ISO 19005', why: 'The released analysis that the margins on the drawing refer to.', record: true },
  { key: 'inspection', name: 'Inspection and FAI records', format: 'PDF/A, with data as CSV', std: 'ISO 19005', why: 'Plain-text data stays readable without the software that made it.', record: true },
  { key: 'certs', name: 'Material certificates', format: 'PDF/A', std: 'ISO 19005', why: 'Traceability from the part to the heat and the batch.', record: true },
];

/** The last year that the record must be kept: the release year, plus the service life, plus the contract's extra years. */
export function retainUntil(releaseYear: number, lifeYears: number, extraYears: number) {
  if (![releaseYear, lifeYears, extraYears].every(Number.isFinite) || lifeYears < 0 || extraYears < 0) return NaN;
  return releaseYear + lifeYears + extraYears;
}

export const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of the bytes, as lower-case hex. Uses Web Crypto, so the data stays on the device. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return toHex(await crypto.subtle.digest('SHA-256', bytes));
}

export interface Entry { name: string; hash: string; size?: number }

/** A manifest in the sha256sum format ("hash  name"), so that the standard tools can verify it. */
export function manifestText(entries: Entry[], header: string[] = []) {
  return [...header.map((h) => `# ${h}`), ...entries.map((e) => `${e.hash}  ${e.name}`)].join('\n');
}

/** Read a manifest in the sha256sum format. Comment lines and blank lines are ignored; "*name" (binary mode) is accepted. */
export function parseManifest(text: string) {
  const m = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const r = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (r) m.set(r[2].trim(), r[1].toLowerCase());
  }
  return m;
}

export type Verdict = 'match' | 'changed' | 'new';
/** Compare files against a manifest: each file matches, has changed, or is not in the manifest; and which listed files are missing. */
export function compareManifest(manifest: Map<string, string>, files: Entry[]) {
  const results = files.map((f) => ({ ...f, verdict: (!manifest.has(f.name) ? 'new' : manifest.get(f.name) === f.hash ? 'match' : 'changed') as Verdict }));
  const names = new Set(files.map((f) => f.name));
  const missing = [...manifest.keys()].filter((n) => !names.has(n));
  return { results, missing };
}

export type Tri = 'yes' | 'no' | 'unknown';
export interface SendCheck {
  classified: Tri; // the compliance team has classified the data against the control lists
  marked: Tri; // the drawing and the file metadata carry the classification
  usOrigin: Tri; // the data contains US-origin technical data
  licence: 'none' | 'identified' | 'notRequired'; // licence route recorded by the compliance team
  recipientChecked: Tri; // the recipient and the end use are known and screened
  overseas: boolean; // the recipient, or the place where the data is stored, is outside the UK
}

/** Ready only when every decision is recorded. The tool never makes the decision itself. */
export function checkSend(s: SendCheck) {
  const stops: string[] = [], checks: string[] = [];
  if (s.classified !== 'yes') stops.push('The data is not classified. Ask your export compliance team before it is sent.');
  if (s.classified === 'yes' && s.marked !== 'yes') stops.push('Mark the classification on the drawing and in the file metadata.');
  if (s.usOrigin === 'unknown') stops.push('Find out if the data contains US-origin technical data.');
  if (s.usOrigin === 'yes') checks.push('US-origin data: ITAR or EAR obligations apply on top of UK controls, and they follow the data. A re-transfer can need US authorisation.');
  if (s.overseas && s.licence === 'none') stops.push('No licence decision is recorded. Your export compliance team decides the licence route (SIEL, OIEL, OGEL) or records that none is required.');
  if (s.recipientChecked !== 'yes') stops.push('Screen the recipient and the end use.');
  if (!s.overseas) checks.push('Cloud storage and email servers can be outside the UK. Where the data goes, and who can open it, can make it an export.');
  return { status: stops.length ? 'stop' as const : 'ready' as const, stops, checks };
}
