// The star map: the route through REF·DB drawn as a solar system. The sun is the overview (Z1). Each phase is a
// planet, in route order from the sun outwards. Each zone of the phase is a moon, and its surface shows its topic.
// Pure data, derived from the zone plan: the 3D scene is in src/scripts/starmap-scene.ts.
import { PHASES, route, hrefOf } from '../data/zones.mjs';

/** Moon surfaces. The number is the index the moon shader reads. */
export const MOTIFS = ['rock', 'ice', 'molten', 'crystal', 'cracked', 'helix', 'grid', 'arc', 'scan', 'haze', 'ripple'] as const;
export type Motif = (typeof MOTIFS)[number];

// What each zone's moon looks like: ice for cryogenic, molten seams for welding and propellant, crystal facets for
// metallurgy, cracks for fatigue and fracture, a helix for threads, a panel grid for documents, arcs for galvanic
// corrosion, a scan line for test and inspection, haze for seals and leaks, ripples for vibration and waves.
const MOON_MOTIF: Record<string, Motif> = {
  'primer-srm': 'molten', 'primer-composite': 'helix', reqs: 'grid', duty: 'ripple', risk: 'cracked', metal: 'crystal', fatigue: 'cracked', visco: 'ripple',
  sandbox: 'rock', worked: 'scan', read: 'grid',
  materials: 'crystal', trade: 'rock', sheet: 'grid', allow: 'scan', cryo: 'ice', xref: 'grid', density: 'rock', plastics: 'helix',
  elast: 'haze', coat: 'haze',
  loadpath: 'grid', access: 'rock', rocket: 'molten', propellant: 'molten', pv: 'rock', grain: 'cracked', ablative: 'molten',
  thermal: 'ripple', handcalc: 'grid', diffexp: 'ripple',
  margins: 'scan', buckling: 'cracked', lbb: 'cracked', vibration: 'ripple', proof: 'scan', feamat: 'grid', fea: 'grid',
  correl: 'scan', ageing: 'haze',
  gdt: 'grid', gdtprac: 'grid', fits: 'scan', stack: 'grid', surf: 'ripple', gauge: 'scan',
  residual: 'cracked', threads: 'helix', bolts: 'helix', locking: 'helix', sealstrat: 'haze', oring: 'haze', galvanic: 'arc',
  process: 'molten', cost: 'rock', weld: 'molten', ndt: 'scan', leak: 'haze', matspec: 'grid', certs: 'grid',
  standards: 'grid', guides: 'grid', drawing: 'grid', release: 'grid', export: 'grid',
};
export const motifOf = (key: string): Motif => MOON_MOTIF[key] ?? 'rock';

/** The small 3D model that orbits each planet: a picture of what the phase is about. */
export const EMBLEMS: Record<string, { model: string; what: string }> = {
  orient: { model: 'gyro', what: 'A gyroscope beacon: find your bearings' },
  select: { model: 'crystal', what: 'Crystal shards: the material and its structure' },
  size: { model: 'motor', what: 'A solid rocket motor: the hardware being sized' },
  verify: { model: 'probe', what: 'A survey probe that scans the planet: test and analysis' },
  detail: { model: 'gauge', what: 'A GO / NO-GO plug gauge: tolerances made real' },
  feature: { model: 'bolt', what: 'A bolt and nut, with an O-ring for a planetary ring' },
  make: { model: 'gear', what: 'A gear: production' },
  spec: { model: 'sheet', what: 'A drawing sheet with its frame and title block' },
};

/** The home page's task list (concept copy of MissionHome's; share one list when the map becomes the home page). */
export const TASKS = [
  { q: 'Which alloy should I use?', z: 'materials' },
  { q: 'How thick does the case wall have to be?', z: 'pv' },
  { q: 'Will the grain survive cold soak?', z: 'grain' },
  { q: 'How thick does the insulation need to be?', z: 'ablative' },
  { q: 'What does the proof test actually buy me?', z: 'proof' },
  { q: 'Will this O-ring seal at −40 °C?', z: 'oring' },
  { q: 'How do I call this material up on a drawing?', z: 'matspec' },
  { q: 'Does it leak or does it burst?', z: 'lbb' },
  { q: 'Will it survive the ride?', z: 'vibration' },
  { q: 'How tight do I torque this bolt?', z: 'bolts' },
  { q: 'Will my tolerances stack up?', z: 'stack' },
  { q: 'Can these two metals touch?', z: 'galvanic' },
];

export interface MapMoon {
  key: string; tag: string; label: string; ico: string; href: string;
  v2: boolean; primer: boolean; desc: string; motif: number;
}
export interface MapPlanet { k: string; n: string; sub: string; d: string; color: string; index: number; emblem: string; moons: MapMoon[] }
export interface MapData {
  sun: { tag: string; label: string; href: string; desc: string };
  planets: MapPlanet[];
  v2: number; total: number;
}

/**
 * The map for a site at `base`. `descs` maps a page slug to its description ('' is the home page). The overview
 * (zone 1) is the sun, so it is not a moon of ORIENT.
 */
export function buildMap(base: string, descs: Record<string, string>): MapData {
  const items = route();
  const home = items.find((i) => i.key === 'home')!;
  const zones = items.filter((i) => !i.primer);
  const planets = PHASES.map((p, index) => ({
    k: p.k, n: p.n, sub: p.sub, d: p.d, color: p.dark, index, emblem: EMBLEMS[p.k]?.model ?? 'gyro',
    moons: items
      .filter((i) => i.phase === p.k && i.key !== 'home')
      .map((i) => ({
        key: i.key, tag: i.primer ? 'PRIMER' : i.tag, label: i.label, ico: i.ico, href: hrefOf(i, base),
        v2: i.slug !== null, primer: i.primer,
        desc: i.slug !== null ? descs[i.slug] ?? '' : 'Opens the v1 reference at this zone while v2 is rebuilt.',
        motif: MOTIFS.indexOf(motifOf(i.key)),
      })),
  }));
  return {
    sun: { tag: home.tag, label: home.label, href: hrefOf(home, base), desc: descs[''] ?? '' },
    planets,
    v2: zones.filter((z) => z.slug !== null).length,
    total: zones.length,
  };
}
