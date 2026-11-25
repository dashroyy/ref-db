// Specification sheets for the stainless steels that had only a skeleton (v2): the free-machining, martensitic,
// semi-austenitic PH and duplex grades. Same shape as the sheets in specs.json. EN 10088 conditions: +A annealed,
// +AT solution annealed, +QTnnn hardened and tempered to a minimum tensile strength of nnn MPa (the range and the size
// limits are in the standard), +C cold worked. AMS and ASTM forms where those are the usual supply routes. Standards are
// cited for orientation: work to the issue your programme invokes.

const F = {
  bright: { form: 'Bright drawn or peeled bar', standard: 'BS EN 10088-3 + BS EN 10278', note: 'The usual machining bar. Give the tolerance class from EN 10278 (for example h9 or h11).' },
  hot: { form: 'Hot-rolled bar', standard: 'BS EN 10088-3 + BS EN 10060', note: 'Round bar. BS EN 10058, 10059 and 10061 give the tolerances of flat, square and hexagon bar.' },
  plate: { form: 'Plate, sheet and strip', standard: 'BS EN 10088-2 + BS EN ISO 18286', note: 'EN ISO 18286 gives the tolerances of hot-rolled plate, EN ISO 9445 those of cold-rolled sheet and strip. Give the surface finish code (1D, 2B, 2R and others) from EN 10088-2.' },
  forging: { form: 'Open-die forgings', standard: 'BS EN 10250-4', note: 'For large parts: ask for the ultrasonic test class.' },
};
const PASS = { name: 'Passivation', spec: 'ASTM A967 / AMS 2700 (BS EN ISO 16048 for fasteners)', note: 'Removes free iron from machining and restores the passive film. Machined stainless steel is not passive until it is passivated.' };
const SS_FIN = [
  PASS,
  { name: 'Electropolish', spec: 'ASTM B912', note: 'A smooth, clean surface with better corrosion resistance. It removes a few micrometres: allow for it on fits.' },
  { name: 'Pickling', spec: 'ASTM A380', note: 'After welding or heat treatment: removes the heat tint and the scale. Passivate after it.' },
  { name: 'Bead blast', spec: 'Company spec', note: 'A uniform matt finish. Use glass or stainless media only, then passivate.' },
];
const HARD_FIN = [
  PASS,
  { name: 'Electroless nickel', spec: 'BS EN ISO 4527', note: 'Even thickness, hard and wear resistant. Bake after plating when the steel is hardened.' },
  { name: 'Hard chromium', spec: 'BS EN ISO 6158', note: 'Wear surfaces. Grind after plating to size, and bake after plating.' },
  { name: 'Gas or plasma nitriding', spec: 'Process spec', note: 'A hard, wear-resistant case. It lowers the corrosion resistance of the surface.' },
];
const TEMPER_EMB = 'Do not temper it between approximately 400 and 550 °C: the toughness and the corrosion resistance fall (temper embrittlement).';

export const SPECS_SS = [
  {
    name: '303 stainless (free machining)',
    designation: 'X8CrNiS18-9 (1.4305)',
    family: 'ss',
    base: 'X8CrNiS18-9 · 1.4305 · UNS S30300 · legacy BS 970 303S31 · free-machining austenitic',
    composition: 'BS EN 10088-3 (bar) · ASTM A582 (free-machining bar) · AMS 5640 (aerospace bar, wire and forgings)',
    forms: [
      F.bright,
      F.hot,
      { form: 'Bar, UNS S30300', standard: 'ASTM A582', note: 'The North American free-machining bar.' },
      { form: 'Bar, wire and forgings, aerospace', standard: 'AMS 5640', note: 'The specification has more than one type: give the type on the drawing.' },
    ],
    tempers: [
      { code: '+AT', note: 'Solution annealed: the standard supply condition.' },
      { code: '+C<STRENGTH LEVEL>', note: 'Cold drawn to a higher strength, for small bar: give the strength level from EN 10088-3.' },
    ],
    finishes: SS_FIN,
    callout: 'MATERIAL: X8CrNiS18-9 (1.4305) BRIGHT DRAWN OR PEELED BAR TO BS EN 10088-3\n          CONDITION: +AT\n          TOLERANCES TO BS EN 10278, h9\nFINISH:   PASSIVATION TO ASTM A967\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The free-machining stainless steel: the sulphur gives short chips and fast cycle times. Turned tooling parts, fixture pins, shafts, fittings and fasteners.',
      'The sulphides lower the corrosion resistance, the weldability and the transverse ductility. For wetted, welded or highly stressed parts, use 304L or 316L.',
      'Passivate it by a method for the free-machining grades (ASTM A967 has them): the wrong bath attacks the sulphides and pits the surface.',
      'It does not harden by heat treatment. It is almost non-magnetic when annealed; cold work makes it slightly magnetic.',
    ],
  },
  {
    name: 'Stainless 410',
    designation: 'X12Cr13 (1.4006)',
    family: 'ss',
    base: 'X12Cr13 · 1.4006 · UNS S41000 · legacy BS 970 410S21 · martensitic, hardenable',
    composition: 'BS EN 10088-2 (plate and sheet) · BS EN 10088-3 (bar) · ASTM A276 (bar) · ASTM A240 (plate)',
    forms: [
      F.bright,
      F.hot,
      F.plate,
      F.forging,
      { form: 'Bar, UNS S41000', standard: 'ASTM A276', note: 'Give the condition (annealed, or hardened and tempered) from the standard.' },
    ],
    tempers: [
      { code: '+QT650', note: 'Hardened and tempered to Rm 650 MPa minimum (EN 10088-3 bar). The usual condition for machined parts.' },
      { code: '+A', note: 'Annealed: soft, for machining or forming before hardening.' },
      { code: 'HARDENED AND TEMPERED <HRC> HRC', note: 'For parts hardened after machining: give the hardness range that the part needs.' },
    ],
    finishes: HARD_FIN,
    callout: 'MATERIAL: X12Cr13 (1.4006) BRIGHT DRAWN OR PEELED BAR TO BS EN 10088-3\n          CONDITION: +QT650\n          TOLERANCES TO BS EN 10278, h9\nFINISH:   PASSIVATION TO ASTM A967\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The basic hardenable stainless steel: shafts, valve and pump parts, wear parts and fasteners in mild environments.',
      'Its corrosion resistance is the lowest of the common stainless grades: dry air, fresh water and mild chemicals. Passivate it; it can still stain in damp storage.',
      TEMPER_EMB,
      'Hardened, it is susceptible to hydrogen embrittlement: bake after electroplating.',
      'It is magnetic in all conditions.',
    ],
  },
  {
    name: '431 stainless (S80)',
    designation: 'X17CrNi16-2 (1.4057)',
    family: 'ss',
    base: 'X17CrNi16-2 · 1.4057 · UNS S43100 · legacy BS 970 431S29 · BS S80 (aerospace) · martensitic with nickel',
    composition: 'BS EN 10088-3 (bar) · BS S80 (aerospace bar and forgings) · AMS 5628 (bar, wire and forgings) · ASTM A276 (bar)',
    forms: [
      F.bright,
      F.hot,
      F.forging,
      { form: 'Bar and forgings, aerospace (UK)', standard: 'BS S80', note: 'The British aerospace specification: supplied hardened and tempered.' },
      { form: 'Bar, wire and forgings, aerospace', standard: 'AMS 5628', note: '' },
      { form: 'Bar, UNS S43100', standard: 'ASTM A276', note: '' },
    ],
    tempers: [
      { code: '+QT800', note: 'Hardened and tempered to Rm 800 MPa minimum (EN 10088-3 bar). The usual condition.' },
      { code: '+QT900', note: 'Hardened and tempered to Rm 900 MPa minimum, for smaller sections: read the size limit in the standard.' },
      { code: '+A', note: 'Annealed, for machining before hardening.' },
    ],
    finishes: HARD_FIN,
    callout: 'MATERIAL: X17CrNi16-2 (1.4057) BRIGHT DRAWN OR PEELED BAR TO BS EN 10088-3\n          CONDITION: +QT800\n          TOLERANCES TO BS EN 10278, h9\nFINISH:   PASSIVATION TO ASTM A967\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'The strongest of the common martensitic stainless steels, and the most corrosion resistant of them: shafts, pins, valve spindles, pump shafts and aircraft fittings.',
      TEMPER_EMB,
      'Hardened, it is susceptible to hydrogen embrittlement and to stress-corrosion cracking: bake after electroplating, and avoid sustained tension in chloride service.',
      'It is magnetic in all conditions.',
    ],
  },
  {
    name: '17-7PH stainless',
    designation: 'X7CrNiAl17-7 (1.4568)',
    family: 'ss',
    base: 'X7CrNiAl17-7 · 1.4568 · UNS S17700 · semi-austenitic precipitation hardening',
    composition: 'AMS 5528 (sheet, strip and plate) · AMS 5529 (cold-rolled sheet and strip) · ASTM A693 (plate, sheet and strip) · AMS 5644 (bar and forgings) · AMS 5678 and BS EN 10270-3 (spring wire) · BS EN 10151 (spring strip)',
    forms: [
      { form: 'Sheet, strip and plate', standard: 'AMS 5528 / ASTM A693', note: 'Supplied in Condition A: form it, then heat treat it to TH1050 or RH950.' },
      { form: 'Cold-rolled sheet and strip', standard: 'AMS 5529', note: 'Supplied in Condition C (cold rolled): age it to CH900.' },
      { form: 'Strip for springs', standard: 'BS EN 10151', note: '' },
      { form: 'Spring wire', standard: 'AMS 5678 / BS EN 10270-3', note: 'Cold drawn (Condition C): coil it, then age it to CH900.' },
      { form: 'Bar and forgings', standard: 'AMS 5644', note: 'Bar is less usual: for machined parts, 17-4PH or 15-5PH is usually the better choice.' },
    ],
    tempers: [
      { code: 'A', note: 'Condition A: solution annealed, austenitic and formable. The supply condition of most sheet.' },
      { code: 'TH1050', note: 'Conditioned at approximately 760 °C, cooled, then aged at 565 °C: good strength, with better toughness and stress-corrosion resistance than RH950.' },
      { code: 'RH950', note: 'Conditioned at approximately 955 °C, refrigerated at approximately -73 °C, then aged at 510 °C: the highest strength from Condition A.' },
      { code: 'CH900', note: 'Cold rolled or cold drawn (Condition C), then aged at 480 °C: the spring condition and the highest strength.' },
    ],
    finishes: [PASS, { name: 'Electropolish', spec: 'ASTM B912', note: 'A smooth, clean surface for springs and bellows. It removes a few micrometres.' }],
    callout: 'MATERIAL: X7CrNiAl17-7 (1.4568) SHEET, STRIP AND PLATE TO AMS 5528\n          CONDITION: TH1050\n          HEAT TREAT TO TH1050 PER AMS 2759/3\n          FURNACE PYROMETRY TO AMS 2750\nFINISH:   PASSIVATION TO ASTM A967\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Springs, clips, bellows, diaphragms and thin formed parts that need high strength with the corrosion resistance of a stainless steel.',
      'Form it in Condition A or C, then heat treat it. Each step of the heat treatment changes the dimensions slightly: allow for this on precision parts.',
      'RH950 and CH900 give the most strength but the least resistance to stress-corrosion cracking. Use TH1050 where the part sees sustained tension in a corrosive environment.',
    ],
  },
  {
    name: 'Duplex 2205',
    designation: 'X2CrNiMoN22-5-3 (1.4462)',
    family: 'ss',
    base: 'X2CrNiMoN22-5-3 · 1.4462 · UNS S32205 and S31803 · austenitic-ferritic (duplex)',
    composition: 'BS EN 10088-2 (plate) · BS EN 10088-3 (bar) · BS EN 10272 (bar for pressure purposes) · BS EN 10216-5 (seamless pressure tube) · BS EN 10222-5 (pressure forgings) · ASTM A240 (plate) · ASTM A182 F51 and F60 (forgings)',
    forms: [
      F.plate,
      F.bright,
      { form: 'Bar for pressure purposes', standard: 'BS EN 10272', note: '' },
      { form: 'Seamless tube: pressure', standard: 'BS EN 10216-5', note: 'For pressure-retaining systems.' },
      { form: 'Forgings for pressure purposes', standard: 'BS EN 10222-5', note: '' },
      { form: 'Plate, UNS S32205', standard: 'ASTM A240', note: '' },
    ],
    tempers: [{ code: '+AT', note: 'Solution annealed and water quenched: the usual condition. Duplex steel does not harden by heat treatment.' }],
    finishes: SS_FIN,
    callout: 'MATERIAL: X2CrNiMoN22-5-3 (1.4462) PLATE, SHEET AND STRIP TO BS EN 10088-2\n          CONDITION: +AT\n          TOLERANCES TO BS EN ISO 18286\nCERTS:    BS EN 10204 TYPE 3.1',
    tips: [
      'Approximately twice the proof strength of 316L, with better resistance to pitting and to chloride stress-corrosion cracking (PREN approximately 35).',
      'Do not use it above approximately 250 °C: long exposure makes it brittle (475 °C embrittlement). It also loses toughness at low temperature: check the impact energy below approximately -50 °C.',
      'Weld it with a qualified procedure and an over-alloyed filler: the heat input controls the ferrite-austenite balance. For critical welds, specify a ferrite check or a test for intermetallic phases (ASTM A923).',
      'It is magnetic (the ferrite).',
    ],
  },
];
