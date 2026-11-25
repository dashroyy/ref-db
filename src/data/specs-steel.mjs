// Specification sheets for the tool steels and the steels of tooling and ground equipment (v2). Same shape as the
// sheets in specs.json. EN product standards by form; the strength of a quenched-and-tempered steel falls with the
// size of the bar, so the notes give the rows. Standards are cited for orientation: work to the issue your programme
// invokes.

const QT = (std) => ({ form: 'Hot-rolled or forged bar', standard: `${std} + BS EN 10060`, note: 'Round bar; BS EN 10060 gives the size tolerances (BS EN 10058, 10059 and 10061 for flat, square and hexagon).' });
const BRIGHT = { form: 'Bright drawn, turned or ground bar', standard: 'BS EN 10277 + BS EN 10278', note: 'Bright bar to size: less machining, and the stock form for most turned parts.' };
const FORGE = (part) => ({ form: 'Open-die forgings', standard: `BS EN 10250-${part}`, note: 'For large parts: ask for the ultrasonic test class and the grain flow.' });
const TUBE = { form: 'Seamless mechanical tube', standard: 'BS EN 10297-1', note: 'Saves boring the bore of sleeves and bushes.' };
const STEEL_FIN = [
  { name: 'Zinc-nickel plating', spec: 'BS EN ISO 19598', note: 'Corrosion protection without cadmium. Bake after plating where the strength is high.' },
  { name: 'Zinc plating', spec: 'BS EN ISO 2081', note: 'Light corrosion protection.' },
  { name: 'Black oxide', spec: 'BS ISO 11408', note: 'Little corrosion protection without oil; no change in size.' },
  { name: 'Phosphate and oil', spec: 'BS EN ISO 9717', note: 'A paint base, or protection in storage.' },
  { name: 'Electroless nickel', spec: 'BS EN ISO 4527', note: 'Even thickness, hard and wear resistant.' },
  { name: 'Hard chromium', spec: 'BS EN ISO 6158', note: 'Wear surfaces. Grind after plating to size.' },
  { name: 'Paint', spec: 'Company spec', note: 'Ground equipment and structures.' },
];
const TOOL_FIN = [
  { name: 'Gas or plasma nitriding', spec: 'Process spec', note: 'A hard, wear-resistant case. Nitride below the tempering temperature, or the core softens.' },
  { name: 'PVD coating (TiN, CrN or TiAlN)', spec: 'Process spec', note: 'A thin, very hard coating for cutting and forming edges.' },
  { name: 'Hard chromium', spec: 'BS EN ISO 6158', note: 'Wear and release surfaces. Bake after plating.' },
  { name: 'Black oxide', spec: 'BS ISO 11408', note: 'Light protection against rust; no change in size.' },
];
const ANNEALED = (hb) => ({ code: 'ANNEALED', note: `The soft delivery condition for machining${hb ? `: typically ${hb} HB maximum` : ''}. Rough machine before hardening.` });
const HT = (note) => ({ code: 'HARDENED AND TEMPERED <HRC> HRC', note });
const TOOL_TIP = 'Rough machine, stress relieve, then finish after the heat treatment, or leave grinding stock: hardening changes the size and can distort the part.';

export const SPECS_STEEL = [
  {
    name: 'Tool steel H13 (1.2344)',
    designation: 'X40CrMoV5-1 (1.2344)',
    family: 'steel',
    base: 'X40CrMoV5-1 · 1.2344 · AISI H13 · legacy BS 4659 BH13',
    composition: 'BS EN ISO 4957 (tool steels) · ASTM A681',
    forms: [
      { form: 'Bar and flat', standard: 'BS EN ISO 4957 / ASTM A681', note: 'Electroslag-remelted (ESR) or vacuum-degassed grades are cleaner and tougher: specify the melt practice for dies and mandrels.' },
      { form: 'Forged block', standard: 'BS EN ISO 4957', note: 'For large dies and mandrels: ask for the ultrasonic test class.' },
    ],
    tempers: [HT('Hot-work tools are usually 44 to 52 HRC. Give a hardness range on the drawing (for example 46 to 50 HRC), and temper at least twice.'), ANNEALED(229)],
    finishes: TOOL_FIN,
    callout: 'MATERIAL: X40CrMoV5-1 (1.2344) BAR AND FLAT TO BS EN ISO 4957\n          CONDITION: HARDENED AND TEMPERED 46-50 HRC\n          HEAT TREAT PER <PROCESS SPEC>, TEMPER TWICE\nFINISH:   GAS OR PLASMA NITRIDING TO <PROCESS SPEC>\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The hot-work tool steel: die-casting and forging dies, extrusion tooling, and the mandrels for winding composite cases. It keeps its hardness to approximately 540 °C and resists heat checking.', TOOL_TIP, 'Nitriding adds wear resistance without softening the core, if the nitriding temperature is below the tempering temperature.'],
  },
  {
    name: 'Tool steel D2', // the exact library name: 'D2' is too short for the alloy-key match
    designation: 'X153CrMoV12 (1.2379)',
    family: 'steel',
    base: 'X153CrMoV12 · 1.2379 · AISI D2 · legacy BS 4659 BD2',
    composition: 'BS EN ISO 4957 (tool steels) · ASTM A681',
    forms: [{ form: 'Bar and flat', standard: 'BS EN ISO 4957 / ASTM A681', note: 'Supplied annealed, often precision ground on the flats.' }],
    tempers: [HT('Cold-work tools are usually 58 to 62 HRC. A high temper (approximately 500 °C) gives secondary hardness and the best stability of size; a low temper gives more toughness.'), ANNEALED(255)],
    finishes: TOOL_FIN,
    callout: 'MATERIAL: X153CrMoV12 (1.2379) BAR AND FLAT TO BS EN ISO 4957\n          CONDITION: HARDENED AND TEMPERED 58-62 HRC\n          HEAT TREAT PER <PROCESS SPEC>\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The cold-work die steel: blanking and forming tools, punches, shear blades and wear parts.', 'It is brittle: never use it as a structural part, and avoid sharp corners in hardened sections.', 'For gauges and precise tooling, ask for a sub-zero treatment or a high temper to stabilise the size.', TOOL_TIP],
  },
  {
    name: 'Tool steel O1', // the exact library name, as for D2
    designation: '100MnCrW4 (1.2510)',
    family: 'steel',
    base: '100MnCrW4 · 1.2510 · AISI O1 · legacy BS 4659 BO1',
    composition: 'BS EN ISO 4957 (tool steels) · ASTM A681',
    forms: [{ form: 'Bar, flat and gauge plate', standard: 'BS EN ISO 4957 / ASTM A681', note: 'Ground flat stock (gauge plate) is the usual form for jigs and fixtures: buy it ground to thickness.' }],
    tempers: [HT('Gauges, jigs and fixtures are usually 57 to 62 HRC. It is oil hardened, so it distorts less than a water-hardening steel.'), ANNEALED()],
    finishes: TOOL_FIN,
    callout: 'MATERIAL: 100MnCrW4 (1.2510) GAUGE PLATE TO BS EN ISO 4957\n          CONDITION: HARDENED AND TEMPERED 58-62 HRC\n          HEAT TREAT PER <PROCESS SPEC>\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The oil-hardening gauge steel: gauges, jigs, fixtures, punches and cutters where stability through the heat treatment is important.', 'Stabilise gauges with a sub-zero treatment, or temper again after grinding.', TOOL_TIP],
  },
  {
    name: '4140 / 42CrMo4 (1.7225)',
    designation: '42CrMo4 (1.7225)',
    family: 'steel',
    base: '42CrMo4 · 1.7225 · AISI 4140 · legacy BS 970 708M40 (EN19)',
    composition: 'BS EN 10083-3 (alloy steels for quenching and tempering)',
    forms: [QT('BS EN 10083-3'), BRIGHT, FORGE(3), TUBE],
    tempers: [
      { code: '+QT', note: 'Quenched and tempered. The EN 10083-3 minimums fall with size: to 16 mm Rp0.2 ≥ 900 and Rm 1100 to 1300 MPa; 16 to 40 mm ≥ 750 and 1000 to 1200; 40 to 100 mm ≥ 650 and 900 to 1100; 100 to 160 mm ≥ 550 and 800 to 950.' },
      { code: '+A', note: 'Soft annealed, for machining before hardening.' },
      { code: '+N', note: 'Normalised.' },
    ],
    finishes: STEEL_FIN,
    callout: 'MATERIAL: 42CrMo4 (1.7225) BRIGHT DRAWN, TURNED OR GROUND BAR TO BS EN 10277\n          CONDITION: +QT\n          TOLERANCES TO BS EN 10278\nFINISH:   BLACK OXIDE TO BS ISO 11408\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The general-purpose quenched-and-tempered steel: shafts, bolts, fixtures and tooling parts. Buy it +QT and machine it as supplied where you can.', 'The strength depends on the ruling section: read the row for the size of the bar, not the smallest size.', 'Above approximately 1000 MPa, plating needs a hydrogen-embrittlement bake.'],
  },
  {
    name: '4340 / EN24T (34CrNiMo6, 1.6582)',
    designation: '34CrNiMo6 (1.6582)',
    family: 'steel',
    base: '34CrNiMo6 · 1.6582 · similar to AISI 4340 · legacy BS 970 817M40 (EN24)',
    composition: 'BS EN 10083-3 (alloy steels for quenching and tempering) · legacy BS 970 (EN24T)',
    forms: [QT('BS EN 10083-3'), BRIGHT, FORGE(3)],
    tempers: [
      { code: '+QT', note: 'The EN 10083-3 minimums: to 16 mm Rp0.2 ≥ 1000 and Rm 1200 to 1400 MPa; 16 to 40 mm ≥ 900 and 1100 to 1300; 40 to 100 mm ≥ 800 and 1000 to 1200; 100 to 160 mm ≥ 700 and 900 to 1100.' },
      { code: 'T (BS 970)', note: 'The legacy EN24T condition: Rm 850 to 1000 MPa, available in large sections.' },
      { code: '+A', note: 'Soft annealed, for machining before hardening.' },
    ],
    finishes: STEEL_FIN,
    callout: 'MATERIAL: 34CrNiMo6 (1.6582) HOT-ROLLED OR FORGED BAR TO BS EN 10083-3\n          CONDITION: +QT\n          TOLERANCES TO BS EN 10060\nFINISH:   ZINC-NICKEL PLATING TO BS EN ISO 19598\n          HYDROGEN EMBRITTLEMENT RELIEF BAKE TO AMS 2759/9 OR BS EN ISO 9588\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['It hardens deeply, so large sections reach full strength: shafts, gears, bolts, fixtures and highly loaded tooling.', 'EN24T (850 to 1000 MPa) is the common UK stock condition: machine it as supplied.', 'At high strength it is sensitive to hydrogen: bake after plating, and avoid grinding burns.'],
  },
  {
    name: 'EN8 (080M40), medium carbon',
    designation: 'C40 (1.0511)',
    family: 'steel',
    base: 'C40 · 1.0511 · legacy BS 970 080M40 (EN8) · approximately AISI 1040',
    composition: 'BS EN 10083-2 (non-alloy steels for quenching and tempering) · BS EN 10277 (bright bar)',
    forms: [BRIGHT, QT('BS EN 10083-2'), FORGE(2)],
    tempers: [
      { code: '+N', note: 'Normalised: the usual stock condition. Read the size table of the standard for the minimum strength.' },
      { code: '+QT', note: 'Hardened and tempered for more strength, in small sections.' },
      { code: '+C', note: 'Cold drawn: stronger at the surface, and to size.' },
    ],
    finishes: STEEL_FIN,
    callout: 'MATERIAL: C40 (1.0511) BRIGHT DRAWN, TURNED OR GROUND BAR TO BS EN 10277\n          CONDITION: +N\n          TOLERANCES TO BS EN 10278\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The general medium-carbon engineering steel: shafts, pins, studs, fixtures and machine parts at modest stress.', 'Flame or induction hardening gives a hard surface on a tough core.', 'Weld only with a preheat and a procedure: the carbon is high enough to crack the heat-affected zone.'],
  },
  {
    name: 'EN16T (605M36)',
    designation: '605M36 (EN16)',
    family: 'steel',
    base: '605M36 · legacy BS 970 EN16 (manganese-molybdenum steel) · no direct EN equivalent',
    composition: 'BS 970-3 (withdrawn): stockists still sell to it',
    forms: [{ form: 'Bar', standard: 'BS 970-3', note: 'BS 970 is withdrawn: agree the replacement specification and the certificate with the supplier.' }],
    tempers: [{ code: 'T', note: 'Rm 850 to 1000 MPa (the T condition of BS 970).' }, { code: 'R', note: 'Rm 700 to 850 MPa.' }],
    finishes: STEEL_FIN,
    callout: 'MATERIAL: 605M36 (EN16) BAR TO BS 970-3\n          CONDITION: T\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['A manganese-molybdenum steel for shafts, axles, studs and fixtures at moderate strength: cheaper than EN24T.', 'It hardens through moderate sections only: check the ruling section for the strength that you need.'],
  },
  {
    name: 'EN3B (070M20), bright mild steel',
    designation: '070M20 (EN3B)',
    family: 'steel',
    base: '070M20 · legacy BS 970 EN3B · bright mild steel; today bright bar to BS EN 10277 in an equivalent grade',
    composition: 'BS EN 10277 (bright steel products) · legacy BS 970-3',
    forms: [BRIGHT, { form: 'Hot-rolled bar', standard: 'BS EN 10025-2 + BS EN 10060', note: 'Black bar, for parts machined all over.' }],
    tempers: [{ code: '+C', note: 'Cold drawn. The strength changes with the bar size: use the certificate.' }, { code: '+AR', note: 'As rolled (black bar).' }],
    finishes: STEEL_FIN,
    callout: 'MATERIAL: 070M20 (EN3B) BRIGHT DRAWN, TURNED OR GROUND BAR TO BS EN 10277\n          CONDITION: +C\n          TOLERANCES TO BS EN 10278\nFINISH:   ZINC PLATING TO BS EN ISO 2081\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The bright mild steel for jigs, brackets, spacers and ground equipment. Never flight hardware.', 'It welds easily and case hardens, but it is not hardenable through.', 'Agree the modern EN grade with the supplier: EN3B is a legacy name.'],
  },
  {
    name: 'S355 structural steel (S355J2+N)',
    designation: 'S355J2+N (1.0577)',
    family: 'steel',
    base: 'S355J2 · 1.0577 · legacy BS 4360 grade 50D',
    composition: 'BS EN 10025-2 (hot-rolled structural steel) · BS EN 10210 and BS EN 10219 (hollow sections)',
    forms: [
      { form: 'Plate', standard: 'BS EN 10025-2 + BS EN 10029', note: 'BS EN 10029 gives the plate tolerances.' },
      { form: 'Sections and flats', standard: 'BS EN 10025-2', note: '' },
      { form: 'Hot-finished hollow sections', standard: 'BS EN 10210', note: '' },
      { form: 'Cold-formed hollow sections', standard: 'BS EN 10219', note: '' },
    ],
    tempers: [{ code: '+N', note: 'Normalised or normalised rolled: ReH ≥ 355 MPa to 16 mm, lower for thicker; Rm 470 to 630 MPa.' }, { code: '+AR', note: 'As rolled.' }],
    finishes: [
      { name: 'Hot-dip galvanising', spec: 'BS EN ISO 1461', note: 'For outdoor stands and frames. Vent and drain hollow sections.' },
      { name: 'Paint', spec: 'Company spec', note: 'Over a blast-cleaned surface (BS EN ISO 8501-1 Sa 2½).' },
    ],
    callout: 'MATERIAL: S355J2+N (1.0577) PLATE TO BS EN 10025-2\n          TOLERANCES TO BS EN 10029\nFINISH:   HOT-DIP GALVANISING TO BS EN ISO 1461\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['The default steel for test stands, handling frames, baseplates and ground support equipment. Never flight hardware.', 'J2 means a Charpy test at −20 °C: use J2 or K2 for welded structures that see cold weather.', 'The yield strength falls with thickness: use the row for your thickness.'],
  },
  {
    name: 'Grey cast iron (EN-GJL-250)',
    designation: 'EN-GJL-250 (5.1301)',
    family: 'steel',
    base: 'EN-GJL-250 · 5.1301 · legacy BS 1452 grade 250',
    composition: 'BS EN 1561 (grey cast iron)',
    forms: [
      { form: 'Sand casting', standard: 'BS EN 1561', note: 'Rm 250 to 350 MPa in a separately cast test bar. In the casting it falls with the wall thickness: ask the foundry for your section.' },
      { form: 'Continuous-cast bar', standard: 'BS EN 1561', note: 'Bar stock for machined parts: dense and free of sand.' },
    ],
    tempers: [{ code: 'AS CAST', note: 'The usual condition.' }, { code: 'STRESS RELIEVED', note: 'For machine bases and precise tooling: stress relieve (or age) before the finish machining.' }],
    finishes: [{ name: 'Paint', spec: 'Company spec', note: 'Machine bases and housings.' }],
    callout: 'MATERIAL: EN-GJL-250 (5.1301) SAND CASTING TO BS EN 1561\n          CONDITION: STRESS RELIEVED\n          CASTING QUALITY TO <CASTING SPEC>\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: ['Machine bases, surface plates and tooling: very good damping, stability and machinability, at very low cost.', 'It is brittle in tension, with almost no elongation: not for impact, pressure or flight hardware.'],
  },
];
