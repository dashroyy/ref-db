// Specification sheets for the refractory metals (v2): the niobium, molybdenum, tantalum and tungsten alloys of
// nozzles, throat inserts and hot structure, and tungsten heavy alloy for ballast. Same shape as the sheets in
// specs.json, with the manufacturing considerations on the sheet (mfg). ASTM product standards by form; each number was
// checked against the ASTM catalogue. Where no public standard covers a form, the standard is <PRODUCER SPEC>.
// Not here: rhenium and iridium-coated rhenium, which are made to the producer's or programme's specification (they
// keep a skeleton). Standards are cited for orientation: work to the issue your programme invokes.

const CLEAN = { name: 'Chemical cleaning', spec: 'Process spec', note: 'Before heat treatment, brazing, welding or coating: removes oxide and contamination.' };
const REF_MFG = {
  pcg: false,
  notes: [
    'Oxidation is the main limit: niobium, molybdenum, tantalum and tungsten oxidise quickly in air at temperature, and molybdenum oxide evaporates. Hot parts need a coating, a vacuum or an inert gas, or a short exposure.',
    'Oxygen, nitrogen, hydrogen and carbon picked up at high temperature embrittle these metals: heat treat, braze and weld them in vacuum or high-purity inert gas, and clean them before every hot process.',
    'Tungsten and molybdenum are brittle at and below room temperature (niobium and tantalum stay ductile): avoid notches and sharp corners, and do not load them by impact when cold.',
    'Recrystallisation in service or in a heat treatment lowers the strength and, for molybdenum and tungsten, the ductility: keep the hot cycle below the recrystallisation temperature, or design for the recrystallised properties.',
  ],
};

export const SPECS_REFRACT = [
  {
    name: 'C-103 Niobium (Nb-10Hf-1Ti)',
    designation: 'Nb-10Hf-1Ti (UNS R04295)',
    family: 'refract',
    base: 'Nb-10Hf-1Ti · C-103 · UNS R04295 · niobium alloy for radiation-cooled hot structure',
    composition: 'ASTM B654 (foil, sheet, strip and plate) · ASTM B655 (bar, rod and wire) · also AMS 7852 and AMS 7857 (aerospace)',
    forms: [
      { form: 'Foil, sheet, strip and plate', standard: 'ASTM B654', note: 'Annealed unless the order says otherwise.' },
      { form: 'Bar, rod and wire', standard: 'ASTM B655', note: '' },
    ],
    tempers: [{ code: 'ANNEALED (RECRYSTALLISED)', note: 'The usual condition: formable and weldable.' }],
    finishes: [
      { name: 'Fused silicide coating (for example R512E)', spec: 'Process spec', note: 'Oxidation protection in air and combustion gas to approximately 1370 °C, with a life limit at temperature. Coat after all forming and welding.' },
      CLEAN,
    ],
    callout: 'MATERIAL: Nb-10Hf-1Ti (UNS R04295) FOIL, SHEET, STRIP AND PLATE TO ASTM B654\n          CONDITION: ANNEALED (RECRYSTALLISED)\nFINISH:   FUSED SILICIDE COATING TO <PROCESS SPEC>\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The standard alloy for radiation-cooled nozzle extensions and thruster chambers: ductile, formable and weldable, with useful strength above 1000 °C.',
      'Without a coating it oxidises quickly in air above approximately 400 to 500 °C: hot parts need the silicide coating, or a vacuum or an inert environment.',
      'Weld it by electron beam, or by GTA in a high-purity inert gas: oxygen and nitrogen pick-up embrittles the weld.',
    ],
    mfg: REF_MFG,
  },
  {
    name: 'Nb-1Zr',
    designation: 'Nb-1Zr (UNS R04261)',
    family: 'refract',
    base: 'Nb-1Zr · UNS R04261 (commercial grade, Type 4) · UNS R04251 (reactor grade, Type 3)',
    composition: 'ASTM B393 (strip, sheet and plate) · ASTM B392 (bar, rod and wire) · ASTM B394 (seamless and welded tube) · ASTM B391 (ingot)',
    forms: [
      { form: 'Strip, sheet and plate', standard: 'ASTM B393', note: 'Give the type: 4 (commercial grade, R04261) or 3 (reactor grade, R04251).' },
      { form: 'Bar, rod and wire', standard: 'ASTM B392', note: '' },
      { form: 'Seamless and welded tube', standard: 'ASTM B394', note: '' },
    ],
    tempers: [{ code: 'ANNEALED (RECRYSTALLISED)', note: 'The usual condition.' }],
    finishes: [CLEAN],
    callout: 'MATERIAL: Nb-1Zr (UNS R04261) STRIP, SHEET AND PLATE TO ASTM B393\n          CONDITION: ANNEALED (RECRYSTALLISED)\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'More ductile and easier to weld than C-103, with less strength: heat pipes, space nuclear power, and thruster parts where formability matters. It is very compatible with liquid alkali metals.',
      'The zirconium gives much more creep strength than pure niobium.',
      'It oxidises in air at temperature: use it in vacuum, inert gas or liquid metal, or coat it.',
    ],
    mfg: REF_MFG,
  },
  {
    name: 'TZM Molybdenum',
    designation: 'TZM molybdenum alloy',
    family: 'refract',
    base: 'Mo-0.5Ti-0.1Zr · TZM · ASTM alloy 363 (vacuum arc cast, UNS R03630) and 364 (powder metallurgy, UNS R03640)',
    composition: 'ASTM B387 (bar, rod and wire) · ASTM B386 (plate, sheet, strip and foil)',
    forms: [
      { form: 'Bar and rod', standard: 'ASTM B387', note: 'Give the alloy: 363 (vacuum arc cast) or 364 (powder metallurgy).' },
      { form: 'Plate, sheet, strip and foil', standard: 'ASTM B386', note: 'Give the alloy: 363 or 364.' },
    ],
    tempers: [
      { code: 'STRESS RELIEVED', note: 'The usual condition: the worked structure keeps its strength and its lowest ductile-to-brittle transition temperature.' },
      { code: 'RECRYSTALLISED', note: 'Lower strength, and brittle up to a higher temperature: avoid it for structural parts.' },
    ],
    finishes: [{ name: 'Silicide coating', spec: 'Process spec', note: 'Oxidation protection where the part sees air at temperature.' }, CLEAN],
    callout: 'MATERIAL: TZM molybdenum alloy BAR AND ROD TO ASTM B387, ALLOY 364\n          CONDITION: STRESS RELIEVED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Throat inserts, hot valve internals and hot structure in a vacuum or an inert or reducing gas, and hot-work tools and dies: it keeps strength above 1100 °C, where the nickel alloys fail.',
      'In air it oxidises above approximately 500 °C, and the oxide evaporates: protect it with a coating, or keep it out of oxygen.',
      'It is notch sensitive at and below room temperature: generous radii, no sharp corners, and no impact loads when cold.',
      'Recrystallisation (approximately 1400 °C for TZM, lower for pure molybdenum) lowers its strength and ductility: keep the hot cycle below it, or design for the recrystallised properties.',
    ],
    mfg: REF_MFG,
  },
  {
    name: 'Tantalum Ta-10W',
    designation: 'Ta-10W (UNS R05255)',
    family: 'refract',
    base: 'Ta-10W · UNS R05255 · tantalum-tungsten alloy',
    composition: 'ASTM B708 (plate, sheet and strip) · ASTM B365 (rod and wire) · ASTM B521 (seamless and welded tube)',
    forms: [
      { form: 'Plate, sheet and strip', standard: 'ASTM B708', note: '' },
      { form: 'Rod and wire', standard: 'ASTM B365', note: '' },
      { form: 'Seamless and welded tube', standard: 'ASTM B521', note: '' },
    ],
    tempers: [{ code: 'ANNEALED', note: 'The usual condition: ductile and weldable.' }],
    finishes: [{ name: 'Silicide or aluminide coating', spec: 'Process spec', note: 'Oxidation protection for hot service in air.' }, CLEAN],
    callout: 'MATERIAL: Ta-10W (UNS R05255) PLATE, SHEET AND STRIP TO ASTM B708\n          CONDITION: ANNEALED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Strength at very high temperature with the ductility and weldability of tantalum: hot gas valves, nozzle and thruster parts, crucibles and furnace parts.',
      'It is heavy (approximately 16.8 g/cm³) and very expensive: keep it to small hot parts.',
      'It oxidises in air above approximately 500 °C and can take up hydrogen in some environments: coat it, or use it in vacuum or inert gas.',
    ],
    mfg: REF_MFG,
  },
  {
    name: 'Tungsten / W-25Re',
    designation: 'Tungsten (unalloyed)',
    family: 'refract',
    base: 'W · unalloyed tungsten · W-25Re (25% rhenium) to the producer specification',
    composition: 'ASTM B760 (plate, sheet and foil) · rod, bar, blanks and W-25Re to the producer specification',
    forms: [
      { form: 'Plate, sheet and foil', standard: 'ASTM B760', note: 'Give the condition (hot rolled, stress relieved or cold rolled) on the order.' },
      { form: 'Rod, bar and blanks', standard: '<PRODUCER SPEC>', note: 'Pressed and sintered, or worked: give the minimum density and the condition.' },
    ],
    tempers: [
      { code: 'STRESS RELIEVED', note: 'The usual condition of worked tungsten: the most ductility that tungsten has.' },
      { code: 'HOT ROLLED', note: 'Plate as rolled.' },
      { code: 'PRESSED AND SINTERED', note: 'Blanks and inserts: lower density and strength than worked tungsten. Give the minimum density.' },
    ],
    finishes: [CLEAN],
    callout: 'MATERIAL: Tungsten (unalloyed) PLATE, SHEET AND FOIL TO ASTM B760\n          CONDITION: STRESS RELIEVED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Throat inserts, erosion shields and the hottest parts: tungsten melts at 3422 °C and keeps more strength at temperature than any other metal.',
      'It is brittle at room temperature (its ductile-to-brittle transition is above room temperature): no sharp corners or notches, grind rather than turn, and heat it for forming.',
      'W-25Re (25% rhenium) is ductile at room temperature and weldable: for formed and welded parts and thermocouples. It is bought to the producer specification.',
      'It oxidises in air above approximately 500 °C: hot parts need a non-oxidising environment, a coating or a short exposure.',
    ],
    mfg: REF_MFG,
  },
  {
    name: 'Tungsten heavy alloy (90W-Ni-Fe)',
    designation: 'W-Ni-Fe heavy alloy',
    family: 'refract',
    base: '90W-7Ni-3Fe (typical) · ASTM B777 Class 1 · liquid-phase sintered tungsten in a nickel-iron binder',
    composition: 'ASTM B777 (tungsten-base high-density metal, Classes 1 to 4)',
    forms: [{ form: 'Bar, rod, plate and blanks', standard: 'ASTM B777', note: 'Give the class and, where it matters, a non-magnetic grade (W-Ni-Cu).' }],
    tempers: [
      { code: 'CLASS 1', note: '90% W nominal: density 16.85 to 17.25 g/cm³, 32 HRC maximum. The most ductile class.' },
      { code: 'CLASS 2', note: '92.5% W nominal: density 17.15 to 17.85 g/cm³.' },
      { code: 'CLASS 3', note: '95% W nominal: density 17.75 to 18.35 g/cm³.' },
      { code: 'CLASS 4', note: '97% W nominal: density 18.25 to 18.85 g/cm³. There is no non-magnetic grade.' },
    ],
    finishes: [
      { name: 'Nickel plating', spec: 'BS EN ISO 4526', note: 'Corrosion protection: the nickel-iron binder can rust in damp air.' },
      { name: 'Paint', spec: 'Company spec', note: 'Non-functional surfaces.' },
    ],
    callout: 'MATERIAL: W-Ni-Fe heavy alloy BAR, ROD, PLATE AND BLANKS TO ASTM B777\n          CONDITION: CLASS 1\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Ballast, balance and counterweights, inertia parts and radiation shielding: the density of tungsten in a part that machines well, unlike pure tungsten.',
      'The W-Ni-Fe grades are slightly magnetic; the W-Ni-Cu grades are non-magnetic, for parts near instruments and sensors.',
      'Ductility falls as the tungsten content rises: use Class 1 where the part sees impact or bending.',
    ],
  },
];
