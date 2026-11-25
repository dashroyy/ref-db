// Specification sheets for the magnesium alloys (v2). Same shape as the sheets in specs.json, with the manufacturing
// considerations on the sheet (mfg). Wrought and cast alloys by ASTM (B90 sheet and plate, B107 extrusions, B91
// forgings, B80 sand castings, B94 die castings) and AMS; each AMS number was checked against the SAE catalogue.
// Tempers to ASTM B296 (F, O, H24, T5, T6). Standards are cited for orientation: work to the issue your programme
// invokes.

const MG_FIN = [
  { name: 'Chromate conversion (Dow 7)', spec: 'SAE AMS-M-3171', note: 'The base treatment under paint. Hexavalent chromate is restricted under REACH: say whether a chromate-free process is acceptable.' },
  { name: 'Anodise, acid type (Dow 17)', spec: 'AMS 2478 / SAE AMS-M-45202', note: 'Corrosion and abrasion resistance, under paint.' },
  { name: 'Anodise, alkaline type (HAE)', spec: 'AMS 2476', note: 'Corrosion and abrasion resistance, under paint.' },
  { name: 'Hard anodic coating, chromate-free', spec: 'AMS 2466', note: 'A high-voltage alkaline coating without hexavalent chromium: corrosion and abrasion resistance, typically on castings.' },
  { name: 'Paint system', spec: 'Programme spec', note: 'Magnesium needs a full paint system over the conversion or anodic coating for any exposed service.' },
];
const MG_MFG = {
  pcg: false,
  notes: [
    'Galvanic corrosion is the main concern: magnesium is the most anodic structural metal. Isolate it from steel, stainless steel, copper alloys, nickel alloys and carbon fibre (sealant on the faying surfaces, insulating washers, aluminium or coated fasteners), and protect every surface.',
    'Fine chips, swarf and dust can burn: machine with sharp tools and coarse chips, keep the fines dry and collected, and keep a class D extinguisher near. Never use water on a magnesium fire.',
    'Castings have porosity: give the casting quality, the radiography and, for pressure-tight parts, the impregnation.',
    'The AZ alloys creep above approximately 120 °C: use the rare-earth alloys (ZE41A, EV31A, WE43) for warm parts.',
  ],
};
const WELD_SCC = 'Stress relieve welded and heavily formed parts: magnesium-aluminium alloys can crack by stress corrosion, more so as the aluminium content rises.';

export const SPECS_MG = [
  {
    name: 'Mg AZ31B-H24',
    designation: 'AZ31B (UNS M11311)',
    family: 'mg',
    base: 'AZ31B · UNS M11311 · 3.5312 · the general wrought magnesium alloy',
    composition: 'AMS 4377 (sheet and plate, H24) · AMS 4375 (sheet and plate, O) · ASTM B90 (sheet and plate) · ASTM B107 (extrusions)',
    forms: [
      { form: 'Sheet and plate', standard: 'AMS 4377 / AMS 4375 / ASTM B90', note: 'AMS 4377 is the H24 temper (cold rolled, partially annealed); AMS 4375 is annealed (O).' },
      { form: 'Extruded bar, rod, profile and tube', standard: 'ASTM B107', note: '' },
    ],
    tempers: [
      { code: 'H24', note: 'Cold rolled and partially annealed (AMS 4377): the usual sheet temper.' },
      { code: 'O', note: 'Annealed and recrystallised (AMS 4375): the most formable.' },
      { code: 'F', note: 'Extrusions as fabricated.' },
    ],
    finishes: MG_FIN,
    callout: 'MATERIAL: AZ31B (UNS M11311) SHEET AND PLATE TO AMS 4377\n          CONDITION: H24\nFINISH:   CHROMATE CONVERSION (DOW 7) TO SAE AMS-M-3171\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The general wrought magnesium: light brackets, covers, housings, and jigs and fixtures that are lifted by hand. Approximately two thirds of the density of aluminium.',
      'Form it warm: at room temperature its hexagonal structure cracks in tight bends. Keep H24 below the forming temperature limit of the specification, or it softens.',
      'It welds (GTA, with AZ61A or AZ92A filler).',
      WELD_SCC,
    ],
    mfg: MG_MFG,
  },
  {
    name: 'Mg AZ80A-T5',
    designation: 'AZ80A (UNS M11800)',
    family: 'mg',
    base: 'AZ80A · UNS M11800 · high-strength wrought magnesium-aluminium alloy',
    composition: 'ASTM B91 (forgings) · ASTM B107 (extrusions)',
    forms: [
      { form: 'Forgings', standard: 'ASTM B91', note: '' },
      { form: 'Extruded bar, rod and profile', standard: 'ASTM B107', note: '' },
    ],
    tempers: [
      { code: 'T5', note: 'Artificially aged after forging or extrusion: the usual condition for stressed parts.' },
      { code: 'F', note: 'As fabricated.' },
    ],
    finishes: MG_FIN,
    callout: 'MATERIAL: AZ80A (UNS M11800) FORGINGS TO ASTM B91\n          CONDITION: T5\nFINISH:   CHROMATE CONVERSION (DOW 7) TO SAE AMS-M-3171\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Stronger than AZ31B: forgings and extrusions for loaded light parts.',
      WELD_SCC,
    ],
    mfg: MG_MFG,
  },
  {
    name: 'Mg ZK60A-T5',
    designation: 'ZK60A (UNS M16600)',
    family: 'mg',
    base: 'ZK60A · UNS M16600 · magnesium-zinc-zirconium, the strongest common wrought magnesium',
    composition: 'AMS 4352 (extrusions, T5) · ASTM B107 (extrusions) · ASTM B91 (forgings)',
    forms: [
      { form: 'Extruded bar, rod, tube and profile', standard: 'AMS 4352 / ASTM B107', note: 'AMS 4352 is the T5 extrusion.' },
      { form: 'Forgings', standard: 'ASTM B91', note: '' },
    ],
    tempers: [
      { code: 'T5', note: 'Artificially aged: the usual condition.' },
      { code: 'F', note: 'As fabricated.' },
    ],
    finishes: MG_FIN,
    callout: 'MATERIAL: ZK60A (UNS M16600) EXTRUDED BAR, ROD, TUBE AND PROFILE TO AMS 4352\n          CONDITION: T5\nFINISH:   CHROMATE CONVERSION (DOW 7) TO SAE AMS-M-3171\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'High strength with good toughness: highly stressed extrusions and forgings where mass matters most.',
      'It is not weldable (it cracks hot): design for fasteners.',
    ],
    mfg: MG_MFG,
  },
  {
    name: 'Mg AZ91 (die cast)',
    designation: 'AZ91D (UNS M11916)',
    family: 'mg',
    base: 'AZ91D · UNS M11916 · EN-MC21120 (MgAl9Zn1(A)) · the die-casting alloy',
    composition: 'ASTM B94 (die castings) · BS EN 1753 (ingots and castings)',
    forms: [
      { form: 'Die casting', standard: 'ASTM B94', note: 'High-pressure die castings in AZ91D, the high-purity grade for corrosion resistance.' },
      { form: 'Die casting, EN', standard: 'BS EN 1753', note: 'EN-MC21120.' },
    ],
    tempers: [{ code: 'F', note: 'As cast: die castings are not solution heat treated.' }],
    finishes: MG_FIN,
    callout: 'MATERIAL: AZ91D (UNS M11916) DIE CASTING TO ASTM B94\n          CONDITION: F\n          CASTING QUALITY TO <CASTING SPEC>\nFINISH:   CHROMATE CONVERSION (DOW 7) TO SAE AMS-M-3171\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'High-pressure die castings: housings, covers, brackets and enclosures.',
      'Die castings have gas porosity: they cannot be solution heat treated (they blister), and they are not pressure-tight without impregnation.',
      'Keep the iron, nickel and copper impurities to the D-grade limits: small amounts destroy the corrosion resistance.',
    ],
    mfg: MG_MFG,
  },
  {
    name: 'Mg ZE41A-T5',
    designation: 'ZE41A (UNS M16410)',
    family: 'mg',
    base: 'ZE41A · UNS M16410 · EN-MC35110 (MgZn4RE1Zr) · zinc and rare-earth casting alloy',
    composition: 'AMS 4439 (sand castings, T5) · ASTM B80 (sand castings)',
    forms: [{ form: 'Sand casting', standard: 'AMS 4439 / ASTM B80', note: 'AMS 4439 is the T5 sand casting.' }],
    tempers: [{ code: 'T5', note: 'Precipitation heat treated (AMS 4439).' }],
    finishes: MG_FIN,
    callout: 'MATERIAL: ZE41A (UNS M16410) SAND CASTING TO AMS 4439\n          CONDITION: T5\n          CASTING QUALITY TO <CASTING SPEC>, RADIOGRAPHY TO <GRADE>\nFINISH:   CHROMATE CONVERSION (DOW 7) TO SAE AMS-M-3171\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Pressure-tight sand castings with good creep and fatigue strength to approximately 150 °C: gearbox and transmission housings and electronics enclosures. Good damping.',
      'It is not usually welded in structure: weld repair of castings needs approval and a qualified procedure.',
    ],
    mfg: MG_MFG,
  },
  {
    name: 'Mg Elektron 21 (EV31A)',
    designation: 'EV31A (Elektron 21)',
    family: 'mg',
    base: 'EV31A · Elektron 21 · 2.8Nd-1.4Gd-0.4Zn-0.6Zr · rare-earth casting alloy',
    composition: 'AMS 4429 (sand castings, T6) · ASTM B80 (sand castings)',
    forms: [{ form: 'Sand casting', standard: 'AMS 4429 / ASTM B80', note: 'AMS 4429 is the T6 sand casting.' }],
    tempers: [{ code: 'T6', note: 'Solution and precipitation heat treated (AMS 4429).' }],
    finishes: MG_FIN,
    callout: 'MATERIAL: EV31A (Elektron 21) SAND CASTING TO AMS 4429\n          CONDITION: T6\n          CASTING QUALITY TO <CASTING SPEC>, RADIOGRAPHY TO <GRADE>\nFINISH:   ANODISE, ACID TYPE (DOW 17) TO AMS 2478\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'High-integrity aerospace castings to approximately 200 °C: gearbox and transmission housings. Better castability and corrosion resistance than ZE41A.',
    ],
    mfg: MG_MFG,
  },
  {
    name: 'Mg WE43 / Elektron 43',
    designation: 'WE43B',
    family: 'mg',
    base: 'WE43 · EN-MC95320 (MgY4RE3Zr) · yttrium and rare-earth alloy for high temperature',
    composition: 'AMS 4427 (sand castings, WE43B, T6) · ASTM B80 (sand castings) · wrought Elektron 43 to the producer specification',
    forms: [{ form: 'Sand casting', standard: 'AMS 4427 / ASTM B80', note: 'AMS 4427 is the WE43B T6 sand casting.' }],
    tempers: [{ code: 'T6', note: 'Solution and precipitation heat treated (AMS 4427).' }],
    finishes: MG_FIN,
    callout: 'MATERIAL: WE43B SAND CASTING TO AMS 4427\n          CONDITION: T6\n          CASTING QUALITY TO <CASTING SPEC>, RADIOGRAPHY TO <GRADE>\nFINISH:   HARD ANODIC COATING, CHROMATE-FREE TO AMS 2466\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The high-temperature magnesium: strength to approximately 250 °C and the best corrosion resistance of the common magnesium alloys. Aerospace gearbox and engine castings.',
      'It is harder to ignite than the AZ alloys: the wrought form (Elektron 43) is used for aircraft seat structures.',
    ],
    mfg: MG_MFG,
  },
];
