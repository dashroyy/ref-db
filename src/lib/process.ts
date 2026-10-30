// Manufacturing process selection for motor hardware: what each process can hold (tolerance, surface finish, size,
// quantity), a screen of the processes against a requirement, the cost of a part by route against quantity, and
// design checks for laser powder bed fusion (LPBF). Typical values for screening; units mm, µm Ra, £.

export type Family = 'machining' | 'forming' | 'casting' | 'additive' | 'fabrication';
export interface Process {
  key: string; name: string; family: Family;
  /** ± tolerance (mm) on a 25–100 mm dimension: the best a good shop holds with care, and the usual value. */
  tol: [best: number, usual: number];
  /** Ra (µm): the best with care, and the usual range. */
  ra: [best: number, usualLo: number, usualHi: number];
  qty: [min: number, max: number]; // economic batch range
  maxSize: number; // largest envelope (mm), typical
  internal: boolean; // can make closed internal passages
  netShape: boolean; // needs finish machining for precise features
  note: string;
}

export const PROCESSES: Process[] = [
  { key: 'grind', name: 'Grinding', family: 'machining', tol: [0.002, 0.008], ra: [0.05, 0.2, 0.8], qty: [1, 1e5], maxSize: 2000, internal: false, netShape: false, note: 'Seal faces, bearing seats, fatigue-critical fillets. A finishing operation after turning or milling.' },
  { key: 'hone', name: 'Honing and lapping', family: 'machining', tol: [0.001, 0.005], ra: [0.025, 0.05, 0.4], qty: [1, 1e5], maxSize: 1000, internal: false, netShape: false, note: 'Bores and flat faces only. Controls form and finish more than position.' },
  { key: 'turn', name: 'Turning and boring', family: 'machining', tol: [0.005, 0.025], ra: [0.2, 0.8, 3.2], qty: [1, 1e5], maxSize: 3000, internal: false, netShape: false, note: 'Closures, bosses, nozzle housings, seal bores: most rotational motor parts.' },
  { key: 'mill', name: 'Milling (CNC)', family: 'machining', tol: [0.01, 0.05], ra: [0.4, 0.8, 6.3], qty: [1, 1e4], maxSize: 3000, internal: false, netShape: false, note: 'Prismatic parts, brackets, flats and pockets on turned parts.' },
  { key: 'edm', name: 'Wire EDM', family: 'machining', tol: [0.003, 0.01], ra: [0.2, 0.8, 3.2], qty: [1, 1000], maxSize: 600, internal: false, netShape: false, note: 'Hard materials, sharp internal profiles. Remove the recast layer on fatigue-critical surfaces.' },
  { key: 'flow', name: 'Flow forming and spinning', family: 'forming', tol: [0.03, 0.1], ra: [0.4, 0.8, 1.6], qty: [5, 1e4], maxSize: 1500, internal: false, netShape: true, note: 'Thin-walled seamless cases from a thick preform: no longitudinal weld, strength from cold work.' },
  { key: 'forge', name: 'Closed-die forging', family: 'forming', tol: [0.25, 0.5], ra: [3.2, 6.3, 12.5], qty: [50, 1e5], maxSize: 1500, internal: false, netShape: true, note: 'Closures and bosses: grain flow follows the shape, best short-transverse properties. Die cost and lead time.' },
  { key: 'ring', name: 'Ring rolling', family: 'forming', tol: [0.5, 1], ra: [6.3, 12.5, 25], qty: [5, 1e4], maxSize: 6000, internal: false, netShape: true, note: 'Flanges, joint rings and skirt rings with circumferential grain flow.' },
  { key: 'invest', name: 'Investment casting', family: 'casting', tol: [0.1, 0.2], ra: [0.8, 1.6, 3.2], qty: [25, 1e4], maxSize: 1000, internal: true, netShape: true, note: 'Complex shapes. Cast properties are lower and scatter more: a casting factor usually applies.' },
  { key: 'sand', name: 'Sand casting', family: 'casting', tol: [0.5, 1], ra: [6.3, 12.5, 25], qty: [1, 1000], maxSize: 5000, internal: true, netShape: true, note: 'Large, low quantity; ground equipment more than flight hardware.' },
  { key: 'lpbf', name: 'Laser powder bed fusion (as built)', family: 'additive', tol: [0.05, 0.15], ra: [3.2, 6.3, 15], qty: [1, 500], maxSize: 400, internal: true, netShape: true, note: 'Internal channels and part consolidation. Machine every sealing face, thread and datum.' },
  { key: 'ded', name: 'Directed energy deposition', family: 'additive', tol: [0.5, 1], ra: [12.5, 25, 50], qty: [1, 50], maxSize: 3000, internal: false, netShape: true, note: 'Large near-net preforms and features added to a part. Always machined.' },
  { key: 'sheet', name: 'Sheet forming, laser cutting', family: 'fabrication', tol: [0.1, 0.2], ra: [0.8, 1.6, 3.2], qty: [10, 1e5], maxSize: 3000, internal: false, netShape: true, note: 'Brackets, covers, heat shields and thin structure.' },
];
export const process = (k: string) => PROCESSES.find((p) => p.key === k);

export interface Requirement { tol: number; ra: number; qty: number; size: number; internal: boolean }
export type Fit = 'usual' | 'care' | 'no';

/**
 * Screen each process against a requirement. Tolerance and finish are 'usual' when the usual capability meets them,
 * 'care' when only the best capability does, 'no' otherwise. A process that cannot meet them as made can still be
 * the route if finish machining follows (netShape).
 */
export function screen(r: Requirement) {
  return PROCESSES.map((p) => {
    const tol: Fit = r.tol >= p.tol[1] ? 'usual' : r.tol >= p.tol[0] ? 'care' : 'no';
    const ra: Fit = r.ra >= Math.sqrt(p.ra[1] * p.ra[2]) ? 'usual' : r.ra >= p.ra[0] ? 'care' : 'no'; // usual: at or above the middle of the usual range
    const qty = r.qty >= p.qty[0] && r.qty <= p.qty[1];
    const size = r.size <= p.maxSize;
    const internal = !r.internal || p.internal;
    const asMade: Fit = tol === 'no' || ra === 'no' ? 'no' : tol === 'care' || ra === 'care' ? 'care' : 'usual';
    const ok = size && internal;
    const score = !ok ? 0 : (asMade === 'usual' ? 3 : asMade === 'care' ? 2 : p.netShape ? 1 : 0) + (qty ? 1 : 0);
    return { p, tol, ra, qty, size, internal, asMade, ok, score };
  }).sort((a, b) => b.score - a.score);
}

// ---------- Cost by route ----------

export interface Route { key: string; name: string; btf: number; tooling: number; processPerPart: number; machiningHours: number }
/** Illustrative routes for a machined pressure-vessel closure; replace with your own quotes. */
export const ROUTES: Route[] = [
  { key: 'billet', name: 'Machined from bar or plate', btf: 8, tooling: 0, processPerPart: 0, machiningHours: 10 },
  { key: 'forge', name: 'Forged, then machined', btf: 2.5, tooling: 25000, processPerPart: 400, machiningHours: 4 },
  { key: 'cast', name: 'Investment cast, then machined', btf: 1.5, tooling: 12000, processPerPart: 600, machiningHours: 2.5 },
  { key: 'am', name: 'LPBF, then machined', btf: 1.3, tooling: 0, processPerPart: 2500, machiningHours: 2.5 },
];

/** Cost of one part: tooling shared over the quantity, material bought (buy-to-fly × finished mass), process, machining. */
export function routeCost(r: Route, o: { qty: number; mass: number; pricePerKg: number; rate: number }) {
  const material = r.btf * o.mass * o.pricePerKg, tooling = r.tooling / Math.max(1, o.qty), machining = r.machiningHours * o.rate;
  return { total: tooling + material + r.processPerPart + machining, tooling, material, process: r.processPerPart, machining };
}

/** The quantity above which route b costs less per part than route a (Infinity if never, 0 if always). */
export function breakEven(a: Route, b: Route, o: { mass: number; pricePerKg: number; rate: number }) {
  const unit = (r: Route) => routeCost({ ...r, tooling: 0 }, { ...o, qty: 1 }).total;
  const du = unit(a) - unit(b), dt = b.tooling - a.tooling; // b saves du per part and costs dt more tooling
  if (du <= 0) return dt <= 0 && du === 0 ? 0 : Infinity;
  return Math.max(0, dt / du);
}

// ---------- LPBF design checks ----------

export interface AmInputs {
  overhang: number; // smallest downward-facing surface angle from the build plate, degrees
  hole: number; // largest horizontal hole diameter, mm
  wall: number; // thinnest wall, mm
  channel: number; // smallest internal channel diameter, mm
  channelLength: number; // longest internal channel, mm
  height: number; // build height, mm
  machineHeight: number; // build envelope height, mm
}
export type Level = 'ok' | 'warn' | 'bad';

/** Rules of thumb for LPBF in titanium, nickel and steel alloys; your machine and parameter set give the real limits. */
export function amChecks(i: AmInputs) {
  const c: { key: string; level: Level; text: string }[] = [];
  c.push({ key: 'overhang', level: i.overhang >= 45 ? 'ok' : i.overhang >= 35 ? 'warn' : 'bad',
    text: i.overhang >= 45 ? `${i.overhang}° from the plate: self-supporting.` : i.overhang >= 35 ? `${i.overhang}°: possible, but the down-facing surface is rough. Check it, or add support.` : `${i.overhang}°: needs support, which must be removed and leaves witness marks. Change the build orientation or the shape (a chamfer instead of a flat roof).` });
  c.push({ key: 'hole', level: i.hole <= 6 ? 'ok' : i.hole <= 8 ? 'warn' : 'bad',
    text: i.hole <= 6 ? `⌀${i.hole} horizontal hole: builds round enough without support.` : i.hole <= 8 ? `⌀${i.hole}: the top of the hole sags. Ream it, or use a teardrop shape.` : `⌀${i.hole}: use a teardrop or diamond top, or support, and machine the hole to size.` });
  c.push({ key: 'wall', level: i.wall >= 0.5 ? 'ok' : i.wall >= 0.3 ? 'warn' : 'bad',
    text: i.wall >= 0.5 ? `${i.wall} mm wall: buildable.` : i.wall >= 0.3 ? `${i.wall} mm: at the limit of the process; expect porosity and size error.` : `${i.wall} mm: thinner than the melt track. It will not build reliably.` });
  const ld = i.channelLength / Math.max(i.channel, 1e-9);
  c.push({ key: 'channel', level: i.channel < 1 ? 'bad' : ld > 50 ? 'warn' : 'ok',
    text: i.channel < 1 ? `⌀${i.channel} channel: below approximately 1 mm, powder cannot be removed reliably.` : ld > 50 ? `Channel L/D ${ld.toFixed(0)}: powder removal and inspection are difficult. Add exits, and plan CT inspection and flow testing.` : `Channel L/D ${ld.toFixed(0)}: powder can be removed. The inside stays as built (Ra 6–15 µm) unless abrasive flow machining follows.` });
  c.push({ key: 'height', level: i.height <= i.machineHeight ? 'ok' : 'bad',
    text: i.height <= i.machineHeight ? `${i.height} mm high in a ${i.machineHeight} mm envelope.` : `${i.height} mm does not fit the ${i.machineHeight} mm envelope: change the orientation, split the part, or use a larger machine.` });
  return { checks: c, worst: c.some((x) => x.level === 'bad') ? 'bad' : c.some((x) => x.level === 'warn') ? 'warn' : 'ok' as Level };
}
