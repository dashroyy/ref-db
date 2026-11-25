// Specification sheets for the titanium alloys that had only a skeleton (v2). Same shape as the sheets in specs.json,
// with the manufacturing considerations on the sheet (mfg). Standards are AMS, ASTM and the UK TA series, by product
// form; each number was checked against the publisher's catalogue. Strengths are quoted from the specification titles
// or, where marked, from supplier data. Standards are cited for orientation: work to the issue your programme invokes.
// Not here: IMI 834 and gamma TiAl, which are bought to engine-maker or producer specifications (they keep a skeleton).

const TI_FIN = [
  { name: 'Anodise (Type 2)', spec: 'AMS 2488', note: 'A thin anodic layer that reduces galling and fretting; it also colour codes parts. No significant change in size.' },
  { name: 'Shot peen', spec: 'AMS 2430', note: 'Fatigue improvement: give the intensity (Almen) and the coverage.' },
  { name: 'Dry film lubricant', spec: 'AS5272 / Company spec', note: 'Anti-galling on threads and sliding faces: titanium galls against itself and against stainless steel.' },
  { name: 'Cleaning and descaling', spec: 'ASTM B600', note: 'Removes scale and contamination after hot work or heat treatment. Acid pickling can add hydrogen: keep within the hydrogen limit of the material specification.' },
];
const TI_MFG = {
  pcg: false,
  notes: [
    'Alpha case is the titanium equivalent of peripheral coarse grain: hot work and heat treatment in air leave a hard, brittle, oxygen-rich layer. Remove it by machining or chemical milling, and say so on the drawing.',
    'It galls against itself and against stainless steel: give anti-seize or a dry film lubricant on threads and sliding faces.',
    'It machines slowly: low surface speed, high feed, a rigid setup, flood coolant and sharp tools.',
    'Fine swarf and dust can burn: check the rules of the shop for grinding and fine chips.',
  ],
};
const OXY = 'Titanium can ignite in liquid oxygen and in high-pressure gaseous oxygen: do not use it in oxygen service.';

export const SPECS_TI = [
  {
    name: 'CP Ti Grade 2',
    designation: 'Titanium Grade 2 (UNS R50400)',
    family: 'ti',
    base: 'Unalloyed titanium · ASTM Grade 2 · UNS R50400 · 3.7035',
    composition: 'ASTM B265 (strip, sheet and plate) · AMS 4902 (sheet, strip and plate) · ASTM B348 (bar and billet) · ASTM B338 (tube) · ASTM B381 (forgings)',
    forms: [
      { form: 'Sheet, strip and plate', standard: 'ASTM B265 / AMS 4902', note: 'AMS 4902 is the aerospace sheet, with a 276 MPa (40 ksi) minimum yield.' },
      { form: 'Bar and billet', standard: 'ASTM B348', note: '' },
      { form: 'Seamless or welded tube', standard: 'ASTM B338', note: 'Heat-exchanger and condenser tube.' },
      { form: 'Forgings', standard: 'ASTM B381', note: '' },
    ],
    tempers: [{ code: 'ANNEALED', note: 'The supply condition. Grade 2: Rm 345 MPa and Rp0.2 275 MPa minimum (ASTM B265).' }],
    finishes: TI_FIN,
    callout: 'MATERIAL: Titanium Grade 2 (UNS R50400) SHEET, STRIP AND PLATE TO ASTM B265\n          CONDITION: ANNEALED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Unalloyed titanium for corrosion resistance and forming, not for strength: liners, bellows, ducting, heat exchangers and chemical-service parts.',
      'Grade 1 is softer and more formable and Grade 4 is the strongest unalloyed grade: Grade 2 is the usual compromise.',
      'It welds well with full inert-gas shielding of the weld and of the hot metal behind it. A straw colour is acceptable; blue or grey shows contamination. Give the colour acceptance on the drawing.',
      'It resists seawater, chlorides and oxidising acids, but not reducing acids or dry chlorine.',
      OXY,
    ],
    mfg: TI_MFG,
  },
  {
    name: 'Ti-3Al-2.5V (Gr 9)',
    designation: 'Ti-3Al-2.5V (UNS R56320)',
    family: 'ti',
    base: 'Ti-3Al-2.5V · ASTM Grade 9 · UNS R56320 · 3.7194 · near-alpha, sometimes called half 6-4',
    composition: 'AMS 4944 (hydraulic tube, cold worked and stress relieved) · AMS 4943 (hydraulic tube, annealed) · ASTM B338 (tube) · ASTM B265 (sheet and strip) · ASTM B348 (bar)',
    forms: [
      { form: 'Seamless hydraulic tube', standard: 'AMS 4944 / AMS 4943', note: 'AMS 4944 is cold worked and stress relieved: the usual high-pressure hydraulic tube. AMS 4943 is annealed, for tube that you bend or flare more.' },
      { form: 'Seamless or welded tube', standard: 'ASTM B338', note: 'General and heat-exchanger tube, Grade 9.' },
      { form: 'Sheet and strip', standard: 'ASTM B265', note: 'Grade 9.' },
      { form: 'Bar', standard: 'ASTM B348', note: 'Grade 9.' },
    ],
    tempers: [
      { code: 'COLD WORKED AND STRESS RELIEVED', note: 'AMS 4944: Rm 860 MPa (125 ksi) and Rp0.2 725 MPa (105 ksi) minimum (supplier data).' },
      { code: 'ANNEALED', note: 'AMS 4943: Rm 620 MPa (90 ksi) and Rp0.2 485 MPa (70 ksi) minimum (supplier data).' },
    ],
    finishes: TI_FIN,
    callout: 'MATERIAL: Ti-3Al-2.5V (UNS R56320) SEAMLESS HYDRAULIC TUBE TO AMS 4944\n          CONDITION: COLD WORKED AND STRESS RELIEVED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The standard titanium tube for high-pressure hydraulic and fluid lines: approximately half the mass of a steel line of the same rating.',
      'Bending and flaring depend on the texture of the cold worked tube: qualify the bend and flare procedure with the tube specification and the supplier.',
      OXY,
    ],
    mfg: TI_MFG,
  },
  {
    name: 'Ti-5Al-2.5Sn (Gr 6)',
    designation: 'Ti-5Al-2.5Sn (UNS R54520)',
    family: 'ti',
    base: 'Ti-5Al-2.5Sn · ASTM Grade 6 · UNS R54520 (ELI: R54521) · alpha alloy',
    composition: 'AMS 4910 (sheet, strip and plate) · AMS 4926 (bar and rings) · AMS 4966 (forgings) · AMS 4924 (ELI bar, forgings and rings) · ASTM B265 and B348 (Grade 6)',
    forms: [
      { form: 'Sheet, strip and plate', standard: 'AMS 4910 / ASTM B265', note: 'Annealed.' },
      { form: 'Bar and rings', standard: 'AMS 4926 / ASTM B348', note: 'Annealed, 758 MPa (110 ksi) minimum yield.' },
      { form: 'Forgings', standard: 'AMS 4966', note: 'Annealed, 758 MPa (110 ksi) minimum yield.' },
      { form: 'Bar, forgings and rings, ELI', standard: 'AMS 4924', note: 'Extra-low interstitial, 620 MPa (90 ksi) minimum yield: for cryogenic toughness.' },
    ],
    tempers: [{ code: 'ANNEALED', note: 'The only usual condition: an alpha alloy does not respond to a strengthening heat treatment.' }],
    finishes: TI_FIN,
    callout: 'MATERIAL: Ti-5Al-2.5Sn (UNS R54520) SHEET, STRIP AND PLATE TO AMS 4910\n          CONDITION: ANNEALED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'An all-alpha alloy with very good weldability. The ELI grade keeps its toughness down to liquid-hydrogen temperature: cryogenic tanks, welded pressure parts and cryogenic ducting.',
      'Use the ELI grade (AMS 4924) for cryogenic parts: the normal interstitial levels lower the toughness at low temperature.',
      OXY,
    ],
    mfg: TI_MFG,
  },
  {
    name: 'Ti-6Al-2Sn-4Zr-2Mo',
    designation: 'Ti-6Al-2Sn-4Zr-2Mo (UNS R54620)',
    family: 'ti',
    base: 'Ti-6Al-2Sn-4Zr-2Mo (Ti-6242; with 0.08Si, Ti-6242S) · UNS R54620 · near-alpha, for creep resistance',
    composition: 'AMS 4919 (sheet, strip and plate) · AMS 4976 (forgings, solution treated and aged)',
    forms: [
      { form: 'Forgings', standard: 'AMS 4976', note: 'Solution and precipitation heat treated.' },
      { form: 'Sheet, strip and plate', standard: 'AMS 4919', note: 'Annealed. The silicon-bearing issue is duplex annealed: give the revision your programme invokes.' },
    ],
    tempers: [
      { code: 'SOLUTION TREATED AND AGED', note: 'The forging condition (AMS 4976).' },
      { code: 'ANNEALED', note: 'The sheet condition (AMS 4919): annealed or duplex annealed, as the revision states.' },
    ],
    finishes: TI_FIN,
    callout: 'MATERIAL: Ti-6Al-2Sn-4Zr-2Mo (UNS R54620) FORGINGS TO AMS 4976\n          CONDITION: SOLUTION TREATED AND AGED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The creep-resistant titanium: hot structure, compressor parts and warm gas paths to approximately 540 °C, where Ti-6Al-4V runs out.',
      'Above approximately 540 °C oxidation and the growth of alpha case limit it: check the time at temperature.',
      'Weld it with a qualified procedure and full inert-gas shielding.',
    ],
    mfg: TI_MFG,
  },
  {
    name: 'Ti-6Al-6V-2Sn',
    designation: 'Ti-6Al-6V-2Sn (UNS R56620)',
    family: 'ti',
    base: 'Ti-6Al-6V-2Sn (with Cu and Fe) · UNS R56620 · alpha-beta, deep hardening',
    composition: 'AMS 4979 (bar, wire, forgings and rings, solution treated and aged) · AMS 4971 (the same forms, annealed) · AMS 4918 (sheet, strip and plate, annealed)',
    forms: [
      { form: 'Bar, wire, forgings and rings', standard: 'AMS 4979 / AMS 4971', note: 'AMS 4979 is solution treated and aged; AMS 4971 is annealed and heat treatable.' },
      { form: 'Sheet, strip and plate', standard: 'AMS 4918', note: 'Annealed.' },
    ],
    tempers: [
      { code: 'SOLUTION TREATED AND AGED', note: 'AMS 4979: more strength than Ti-6Al-4V in thick sections, with less ductility and toughness.' },
      { code: 'ANNEALED', note: 'AMS 4918 and AMS 4971: for machining, then solution treat and age where the design needs the strength.' },
    ],
    finishes: TI_FIN,
    callout: 'MATERIAL: Ti-6Al-6V-2Sn (UNS R56620) BAR, WIRE, FORGINGS AND RINGS TO AMS 4979\n          CONDITION: SOLUTION TREATED AND AGED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Heavily loaded fittings, lugs and fasteners where Ti-6Al-4V is short of strength: it hardens deeper in thick sections.',
      'It has less toughness and weldability than Ti-6Al-4V: use it for machined and forged parts, not for welded structure.',
      'Use the allowables for the heat-treated section size: the strength falls as the section grows.',
    ],
    mfg: TI_MFG,
  },
  {
    name: 'IMI 550 (Ti-4Al-4Mo-2Sn-0.5Si)',
    designation: 'Ti-4Al-4Mo-2Sn-0.5Si',
    family: 'ti',
    base: 'Ti-4Al-4Mo-2Sn-0.5Si · IMI 550 (TIMETAL 550) · UK alpha-beta, high strength',
    composition: 'BS 2TA 45 (bar and section, sections to 25 mm) · BS TA 46 (bar and section, 25 to 100 mm) · BS 2TA 47 (forging stock) · BS 2TA 57 (plate, 50 to 65 mm)',
    forms: [
      { form: 'Bar and section', standard: 'BS 2TA 45', note: 'Sections to 25 mm: Rm 1100 to 1280 MPa.' },
      { form: 'Bar and section, large', standard: 'BS TA 46', note: 'Sections over 25 mm to 100 mm: Rm 1050 to 1220 MPa. The listed issue is from 1973: check that it is still current.' },
      { form: 'Forging stock', standard: 'BS 2TA 47', note: 'Rm 1050 to 1220 MPa, limiting ruling section 100 mm.' },
      { form: 'Plate', standard: 'BS 2TA 57', note: 'Over 50 mm to 65 mm thick: Rm 1030 to 1220 MPa.' },
    ],
    tempers: [{ code: 'SOLUTION TREATED AND AGED', note: 'The heat-treated condition of the TA specifications: the strength range is in the specification for the form and the section.' }],
    finishes: TI_FIN,
    callout: 'MATERIAL: Ti-4Al-4Mo-2Sn-0.5Si BAR AND SECTION TO BS 2TA 45\n          CONDITION: SOLUTION TREATED AND AGED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The UK forging alloy: compressor discs, highly loaded fittings and fasteners. Stronger than Ti-6Al-4V up to approximately 400 °C.',
      'UK drawings call it by the TA specification number (for example 2TA 45). The specification sets the strength for the form and the ruling section: give the one that covers your size.',
      'Check the availability before you design around it: it is a legacy UK alloy.',
    ],
    mfg: TI_MFG,
  },
  {
    name: 'Ti-10V-2Fe-3Al (STA)',
    designation: 'Ti-10V-2Fe-3Al (UNS R56410)',
    family: 'ti',
    base: 'Ti-10V-2Fe-3Al (Ti-10-2-3) · UNS R56410 · near-beta, deep hardening',
    composition: 'AMS 4983 (forgings, solution treated and aged, 1241 MPa) · AMS 4986 (forgings, overaged, 1103 MPa) · AMS 4987 (forgings, overaged, 965 MPa)',
    forms: [{ form: 'Forgings', standard: 'AMS 4983 / AMS 4986 / AMS 4987', note: 'Consumable-electrode melted, single-step solution treated. The three specifications differ in the ageing, and so in the strength: choose the one that the stress analysis assumed.' }],
    tempers: [
      { code: 'SOLUTION TREATED AND AGED', note: 'AMS 4983: Rm 1241 MPa (180 ksi) minimum, the highest strength. Read the section-size limit in the specification.' },
      { code: 'SOLUTION TREATED AND OVERAGED', note: 'AMS 4986 (Rm 1103 MPa, 160 ksi) or AMS 4987 (Rm 965 MPa, 140 ksi): more toughness and stress-corrosion resistance as the strength falls.' },
    ],
    finishes: TI_FIN,
    callout: 'MATERIAL: Ti-10V-2Fe-3Al (UNS R56410) FORGINGS TO AMS 4983\n          CONDITION: SOLUTION TREATED AND AGED\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Near-net forgings for helicopter rotor hubs and landing-gear parts: deep hardening, with a high toughness for its strength.',
      'The properties depend on the forging and heat-treatment practice: specify the forging supplier approval and the microstructure acceptance of your programme.',
      'It has little temperature capability: use it below approximately 300 °C.',
    ],
    mfg: TI_MFG,
  },
];
