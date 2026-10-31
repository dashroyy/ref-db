// REF·DB zone plan — the single source of truth for navigation, numbering,
// banners, the orbit map, the route footer and the home page.
// PHASES and ZONE_PLAN are copied verbatim from REF·DB v1 so zone numbers match
// the legacy reference. Never hard-code a zone number anywhere else: derive it.

/** @typedef {{ k: string, n: string, sub: string, ico: string, d: string, dark: string, light: string }} Phase */

/** @type {Phase[]} */
export const PHASES = [
  { k: 'orient', n: 'ORIENT', sub: 'Understand the problem', ico: '◎', dark: '#7BA7C7', light: '#3E6F94',
    d: 'Fundamentals and where to read further. Start here if the material behaviour is what you are unsure about.' },
  { k: 'select', n: 'SELECT', sub: 'Choose the material', ico: '◈', dark: '#5BC48A', light: '#1E7A46',
    d: 'Screening, comparison and the property data behind the choice.' },
  { k: 'size', n: 'SIZE', sub: 'Structural design', ico: '▲', dark: '#FC3D21', light: '#C2261A',
    d: 'Turn the concept into dimensions, and check they survive the loads.' },
  { k: 'verify', n: 'VERIFY', sub: 'Prove it survives', ico: '✓', dark: '#3EC5D3', light: '#13808C',
    d: 'Substantiation: show that it does not buckle, burst, crack or leak, and that the analysis behind that claim is sound.' },
  { k: 'detail', n: 'DETAIL', sub: 'Define the drawing', ico: '⊞', dark: '#E0A94E', light: '#9A6A10',
    d: 'Tolerances, fits, features and joints: everything that turns a shape into a specification.' },
  { k: 'feature', n: 'FEATURES', sub: 'Specify the details', ico: '⊕', dark: '#C77BAA', light: '#8F3F72',
    d: 'Threads, fasteners, seals, and the pairs of materials that corrode.' },
  { k: 'make', n: 'MAKE', sub: 'Produce and inspect', ico: '⚙', dark: '#B98BD9', light: '#6E44A0',
    d: 'Cost, process, joining and the inspection that proves it.' },
  { k: 'spec', n: 'SPECIFY', sub: 'Standards & release', ico: '§', dark: '#8CA0AC', light: '#4F616B',
    d: 'The documents your drawing has to invoke.' },
];

/** [phase, key, LABEL, icon] — order is numbering, exactly as REF·DB v1. */
export const ZONE_PLAN = [
  ['orient', 'home', 'OVERVIEW', '⌂'], ['orient', 'reqs', 'REQUIREMENTS & ICD', '☰'], ['orient', 'duty', 'DUTY CYCLE', '⟳'],
  ['orient', 'risk', 'CRITICALITY', '⚑'], ['orient', 'metal', 'METALLURGY', '◈'], ['orient', 'fatigue', 'FATIGUE', '⌇'],
  ['orient', 'visco', 'VISCOELASTICITY', '∿'], ['orient', 'sandbox', 'SANDBOX', '◍'], ['orient', 'worked', 'WORKED EXAMPLE', '▶'],
  ['orient', 'read', 'READING', '❑'],
  ['select', 'materials', 'MATERIALS', '◆'], ['select', 'trade', 'TRADE STUDY', '⚖'], ['select', 'sheet', 'DATASHEET', '▤'],
  ['select', 'allow', 'ALLOWABLES', '∑'], ['select', 'cryo', 'CRYOGENIC', '❄'], ['select', 'xref', 'DESIGNATIONS', '⇄'],
  ['select', 'density', 'DENSITY', '⚖'], ['select', 'plastics', 'PLASTICS', '◍'], ['select', 'elast', 'SILICONE & PU', '◍'],
  ['select', 'coat', 'COATINGS', '▧'],
  ['size', 'loadpath', 'LOAD PATHS & JOINTS', '⇢'], ['size', 'access', 'ENVELOPE & ACCESS', '⬚'], ['size', 'rocket', 'ROCKET MOTOR', '▲'],
  ['size', 'propellant', 'PROPELLANT', '◭'], ['size', 'pv', 'CASE SIZING', '⬭'], ['size', 'grain', 'PROPELLANT GRAIN', '◭'],
  ['size', 'ablative', 'ABLATIVE LINERS', '◈'], ['size', 'thermal', 'TRANSIENT THERMAL', '◕'], ['size', 'handcalc', 'HAND CALCS', '∫'],
  ['size', 'diffexp', 'DIFF. EXPANSION', '↔'],
  ['verify', 'margins', 'MARGIN POLICY', '±'], ['verify', 'buckling', 'SHELL BUCKLING', '◫'], ['verify', 'lbb', 'LEAK BEFORE BREAK', '◔'],
  ['verify', 'vibration', 'RANDOM VIBRATION', '≋'], ['verify', 'proof', 'PROOF TESTING', '◉'], ['verify', 'feamat', 'FEA CARDS', '▦'],
  ['verify', 'fea', 'FEA & TEST', '◱'], ['verify', 'correl', 'TEST CORRELATION', '≍'], ['verify', 'ageing', 'STORAGE & AGEING', '⧗'],
  ['detail', 'gdt', 'GD&T', '⌖'], ['detail', 'gdtprac', 'DATUMS & POSITION', '⊕'], ['detail', 'fits', 'FITS & LIMITS', '◎'],
  ['detail', 'stack', 'TOL STACK', '≡'], ['detail', 'surf', 'SURFACE FINISH', '≈'], ['detail', 'gauge', 'GAUGING', '⌀'],
  ['feature', 'residual', 'RESIDUAL STRESS', '◑'], ['feature', 'threads', 'THREADS', '⟐'], ['feature', 'bolts', 'BOLTED JOINTS', '⬢'],
  ['feature', 'locking', 'LOCKING & RETENTION', '⊗'], ['feature', 'sealstrat', 'SEALING STRATEGY', '◎'], ['feature', 'oring', 'O-RING DESIGN', '◯'],
  ['feature', 'galvanic', 'GALVANIC', '⚡'],
  ['make', 'process', 'PROCESS & AM', '⚙'], ['make', 'cost', 'COST', '£'], ['make', 'weld', 'WELDING', '⌁'], ['make', 'ndt', 'NDT', '◉'],
  ['make', 'leak', 'LEAK TESTING', '◌'], ['make', 'matspec', 'MATERIAL SPECS', '▣'], ['make', 'certs', 'CERTS & TRACE', '✓'],
  ['spec', 'standards', 'STANDARDS', '§'], ['spec', 'guides', 'DESIGN GUIDES', '❋'], ['spec', 'drawing', 'DRAWING FRAME & NOTES', '▭'],
  ['spec', 'release', 'REVISION & SIGN-OFF', '✎'], ['spec', 'export', 'ARCHIVE & EXPORT', '⛨'],
];

/** Zones rebuilt as v2 pages: zone key → page slug ('' is the home page). */
export const REBUILT = {
  home: '',
  fatigue: 'fundamentals/fatigue',
  visco: 'fundamentals/viscoelasticity',
  materials: 'materials/selection',
  xref: 'materials/designations',
  rocket: 'motor/hardware',
  propellant: 'motor/propellant',
  pv: 'motor/case-sizing',
  grain: 'motor/propellant-grain',
  ablative: 'motor/insulation',
  thermal: 'motor/transient-thermal',
  diffexp: 'joints/differential-expansion',
  loadpath: 'joints/load-paths',
  handcalc: 'fundamentals/hand-calcs',
  residual: 'materials/residual-stress',
  feamat: 'verify/fea-cards',
  fea: 'verify/fea-and-test',
  correl: 'verify/test-correlation',
  gdt: 'drawing/gdt',
  gdtprac: 'drawing/datums-and-position',
  fits: 'drawing/fits-and-limits',
  stack: 'drawing/tolerance-stack',
  surf: 'drawing/surface-finish',
  gauge: 'drawing/gauging',
  galvanic: 'materials/galvanic',
  process: 'make/process-and-am',
  cost: 'make/cost',
  ndt: 'make/ndt',
  leak: 'make/leak-testing',
  certs: 'make/certs',
  margins: 'verify/margin-policy',
  vibration: 'verify/random-vibration',
  buckling: 'verify/shell-buckling',
  lbb: 'verify/leak-before-break',
  proof: 'verify/proof-testing',
  ageing: 'verify/storage-ageing',
  oring: 'seals/o-ring-design',
  sealstrat: 'seals/sealing-strategy',
  threads: 'joints/threads',
  bolts: 'joints/bolted-joints',
  locking: 'joints/locking-and-retention',
  matspec: 'materials/specification',
  allow: 'materials/allowables',
};

/** Primers: v2-only learning pages that sit in a phase without taking a zone number. */
export const PRIMERS = [
  { key: 'primer-srm', phase: 'orient', after: 'home', slug: 'fundamentals/how-a-solid-motor-works', label: 'HOW A SOLID MOTOR WORKS', ico: '✦' },
];

/** Briefing pages outside the route. */
export const BRIEFING = [
  { slug: 'start/how-to-use', label: 'How to use' },
  { slug: 'start/roadmap', label: 'Roadmap' },
];

/**
 * @typedef {{ key: string, phase: string, label: string, ico: string, num: number | null, tag: string,
 *   slug: string | null, primer: boolean }} RouteItem
 */

/** The full route in order: every zone (numbered as v1) with primers slotted in after their anchor. */
export function route() {
  /** @type {RouteItem[]} */
  const out = [];
  ZONE_PLAN.forEach(([phase, key, label, ico], i) => {
    const slug = key in REBUILT ? REBUILT[/** @type {keyof typeof REBUILT} */ (key)] : null;
    out.push({ key, phase, label, ico, num: i + 1, tag: `Z${i + 1}`, slug, primer: false });
    PRIMERS.filter((p) => p.after === key).forEach((p, j) => {
      out.push({ key: p.key, phase: p.phase, label: p.label, ico: p.ico, num: null, tag: `P${j + 1}`, slug: p.slug, primer: true });
    });
  });
  return out;
}

export const phaseOf = (/** @type {string} */ k) => PHASES.find((p) => p.k === k);

/** Normalise a URL pathname or slug to a bare slug: '/motor/case-sizing/' → 'motor/case-sizing'. */
export const toSlug = (/** @type {string} */ path, base = '/') =>
  path.replace(new RegExp('^' + base.replace(/\/$/, '')), '').replace(/^\/+|\/+$/g, '');

/** Where a route item opens: its v2 page, or the v1 archive at that zone. */
export const hrefOf = (/** @type {RouteItem} */ item, base = '/') => {
  const b = base.endsWith('/') ? base : base + '/';
  return item.slug !== null ? `${b}${item.slug}${item.slug ? '/' : ''}` : `${b}legacy/?z=${item.key}`;
};
