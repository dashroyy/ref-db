// Feature control frames: the 14 geometric characteristics, what each one may carry (datums, a diametral zone, a
// material condition modifier), a check of a frame against those rules (ASME Y14.5-2018, with the ISO differences
// noted), and the frame as text. Shown on /drawing/gdt/.

export type Char =
  | 'straightness' | 'flatness' | 'circularity' | 'cylindricity' | 'profileLine' | 'profileSurface'
  | 'perpendicularity' | 'angularity' | 'parallelism' | 'position' | 'concentricity' | 'symmetry' | 'runout' | 'totalRunout';

/**
 * datums: none (form), optional (profile), required (orientation, location, runout).
 * dia: a diametral zone is possible (on an axis). mod: MMC/LMC possible (on a feature of size).
 */
export const CHARS: { key: Char; name: string; group: string; sym: string; datums: 'none' | 'optional' | 'required'; dia: boolean; mod: boolean; asmeRemoved?: boolean }[] = [
  { key: 'straightness', name: 'Straightness', group: 'Form', sym: '⏤', datums: 'none', dia: true, mod: true },
  { key: 'flatness', name: 'Flatness', group: 'Form', sym: '⏥', datums: 'none', dia: false, mod: true },
  { key: 'circularity', name: 'Circularity', group: 'Form', sym: '○', datums: 'none', dia: false, mod: false },
  { key: 'cylindricity', name: 'Cylindricity', group: 'Form', sym: '⌭', datums: 'none', dia: false, mod: false },
  { key: 'profileLine', name: 'Profile of a line', group: 'Profile', sym: '⌒', datums: 'optional', dia: false, mod: false },
  { key: 'profileSurface', name: 'Profile of a surface', group: 'Profile', sym: '⌓', datums: 'optional', dia: false, mod: false },
  { key: 'perpendicularity', name: 'Perpendicularity', group: 'Orientation', sym: '⟂', datums: 'required', dia: true, mod: true },
  { key: 'angularity', name: 'Angularity', group: 'Orientation', sym: '∠', datums: 'required', dia: true, mod: true },
  { key: 'parallelism', name: 'Parallelism', group: 'Orientation', sym: '∥', datums: 'required', dia: true, mod: true },
  { key: 'position', name: 'Position', group: 'Location', sym: '⌖', datums: 'required', dia: true, mod: true },
  { key: 'concentricity', name: 'Concentricity', group: 'Location', sym: '◎', datums: 'required', dia: true, mod: false, asmeRemoved: true },
  { key: 'symmetry', name: 'Symmetry', group: 'Location', sym: '⌯', datums: 'required', dia: false, mod: false, asmeRemoved: true },
  { key: 'runout', name: 'Circular runout', group: 'Runout', sym: '↗', datums: 'required', dia: false, mod: false },
  { key: 'totalRunout', name: 'Total runout', group: 'Runout', sym: '⌰', datums: 'required', dia: false, mod: false },
];

export type Mod = '' | 'M' | 'L';
export interface Frame {
  char: Char; dia: boolean; value: number; mod: Mod;
  projected?: number; // projected tolerance zone height, mm (position and orientation of a threaded or pressed hole)
  datums: { letter: string; mod: Mod }[]; // primary, secondary, tertiary
  featureOfSize: boolean; // the controlled feature has a size (a hole, a pin, a slot)
}

const BAD_LETTERS = new Set(['I', 'O', 'Q']);

/** Check a frame. Each message is 'bad' (not a valid frame) or 'warn' (valid, but check it). */
export function checkFrame(f: Frame) {
  const c = CHARS.find((x) => x.key === f.char)!, out: { level: 'bad' | 'warn' | 'ok'; text: string }[] = [];
  const ds = f.datums.filter((d) => d.letter.trim());
  if (!(f.value > 0)) out.push({ level: 'bad', text: 'The tolerance value must be more than zero.' });
  if (c.datums === 'none' && ds.length) out.push({ level: 'bad', text: `${c.name} is a form tolerance. It controls the feature by itself and takes no datums.` });
  if (c.datums === 'required' && !ds.length) out.push({ level: 'bad', text: `${c.name} needs at least one datum: it controls the feature relative to something.` });
  if (c.datums === 'optional' && !ds.length) out.push({ level: 'warn', text: 'Profile without datums controls form only (size and shape), not location or orientation.' });
  if (f.dia && !c.dia) out.push({ level: 'bad', text: `${c.name} does not take a diametral zone (⌀).` });
  if (f.dia && c.dia && !f.featureOfSize && c.key !== 'position') out.push({ level: 'warn', text: 'A ⌀ zone applies to an axis: the controlled feature must be a feature of size.' });
  if (f.mod && !c.mod) out.push({ level: 'bad', text: `${c.name} cannot take a material condition modifier: it applies regardless of feature size.` });
  if (f.mod && c.mod && !f.featureOfSize) out.push({ level: 'bad', text: 'MMC and LMC apply only to a feature of size (a hole, a pin, a slot, a tab), not to a surface.' });
  if (c.key === 'straightness' && f.dia && !f.featureOfSize) out.push({ level: 'bad', text: 'Straightness with ⌀ controls the axis of a cylindrical feature of size.' });
  if (c.key === 'flatness' && f.mod) out.push({ level: 'warn', text: 'Flatness at MMC controls the derived median plane of a feature of size (ASME Y14.5-2018), not a surface.' });
  if (c.key === 'position' && f.featureOfSize && !f.dia) out.push({ level: 'warn', text: 'Position of a hole or a pin usually has a ⌀ zone. Without ⌀, the zone is two parallel planes (a slot or a tab).' });
  if (c.asmeRemoved) out.push({ level: 'warn', text: `${c.name} was removed from ASME Y14.5-2018. ISO keeps it. Under ASME, use position, profile or runout.` });
  if (f.projected && !(['position', 'perpendicularity', 'angularity', 'parallelism'] as Char[]).includes(f.char)) out.push({ level: 'bad', text: 'A projected tolerance zone applies to position or orientation of a hole for a fastener or a pin.' });
  const letters = ds.map((d) => d.letter.trim().toUpperCase());
  if (new Set(letters).size !== letters.length) out.push({ level: 'bad', text: 'A datum letter is used twice in one frame.' });
  if (letters.some((l) => BAD_LETTERS.has(l))) out.push({ level: 'bad', text: 'Do not use I, O or Q as datum letters: they look like the numbers 1 and 0.' });
  if (ds.some((d) => d.mod)) out.push({ level: 'warn', text: 'A datum at MMB or LMB (ASME) lets the part shift on a datum feature of size. The datum feature must be a feature of size.' });
  if (c.group === 'Runout' && ds.length) out.push({ level: 'warn', text: 'Runout is measured about a datum axis: make the datum a cylinder or two coaxial cylinders, often with a face as primary.' });
  if (ds.length > 3) out.push({ level: 'bad', text: 'A frame has at most three datum references.' });
  if (!out.some((m) => m.level !== 'warn')) out.unshift({ level: 'ok', text: 'The frame is valid.' });
  return out;
}

const MODTXT: Record<Mod, string> = { '': '', M: 'Ⓜ', L: 'Ⓛ' };

/** The frame as text for a drawing note or a CAD field, for example "⌖|⌀0.2Ⓜ|A|BⓂ|C". */
export function frameText(f: Frame) {
  const c = CHARS.find((x) => x.key === f.char)!;
  const tol = `${f.dia ? '⌀' : ''}${Number(f.value.toPrecision(6))}${MODTXT[f.mod]}${f.projected ? ` Ⓟ${Number(f.projected.toPrecision(6))}` : ''}`;
  const ds = f.datums.filter((d) => d.letter.trim()).map((d) => `${d.letter.trim().toUpperCase()}${MODTXT[d.mod]}`);
  return [c.sym, tol, ...ds].join('|');
}
