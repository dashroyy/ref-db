// The metal families, for the metallurgy page: each family's classes with their crystal structure, how they are
// strengthened and what to watch for, and a rule that puts every metal of the material library (src/lib/materials.ts)
// into its class. A metal added to the library appears in its family's chart without any change here, provided its
// name matches a rule; otherwise it falls into the family's "other" class.
import { MATERIALS, type Material } from './materials.ts';

export interface MetalClass {
  key: string; name: string;
  test: (name: string) => boolean;
  structure: string; strength: string; watch: string;
}
export interface Family { key: string; name: string; lib: string[]; intro: string; classes: MetalClass[] }

const re = (s: string) => (n: string) => new RegExp(s, 'i').test(n);

export const METAL_FAMILIES: Family[] = [
  {
    key: 'steel', name: 'Carbon and alloy steels', lib: ['steel'],
    intro: 'Iron with carbon. The carbon content sets the hardness that a quench can give; the alloy elements (Cr, Mo, Ni, V) set how deep it hardens and how it tempers.',
    classes: [
      { key: 'carbon', name: 'Carbon and structural steels', test: re('EN3B|EN8|S355|cast iron|9% Ni'), structure: 'BCC ferrite and pearlite', strength: 'Carbon content and grain size (normalising)', watch: 'Ductile-to-brittle transition: specify an impact test at the lowest service temperature. Rusts: protect it. 9% Ni steel is the cryogenic exception.' },
      { key: 'qt', name: 'Low-alloy quenched and tempered', test: re('4130|4140|4340|EN16|EN24|D6AC|15CDV6|300M'), structure: 'Tempered martensite (BCC)', strength: 'Martensite from the quench, then tempering', watch: 'Hydrogen embrittlement above about 1000 MPa: bake after plating. Temper embrittlement near 350 °C. Decarburisation on the surface. Weld only with preheat and a procedure.' },
      { key: 'uhs', name: 'Ultra-high-strength and maraging', test: re('Maraging|AerMet|HP 9-4-30'), structure: 'Low-carbon martensite with fine precipitates', strength: 'Precipitation in a soft martensite (maraging), secondary hardening carbides (AerMet)', watch: 'Very sensitive to hydrogen and to small flaws: fracture control and stress-corrosion checks. Expensive, controlled melting (VIM/VAR).' },
      { key: 'tool', name: 'Tool steels', test: re('Tool steel'), structure: 'Martensite with hard carbides', strength: 'High carbon and carbides for hardness and wear', watch: 'Brittle: for tools, dies and wear parts, not structure.' },
    ],
  },
  {
    key: 'ss', name: 'Stainless steels', lib: ['ss'],
    intro: 'At least 10.5% chromium forms a thin, self-healing chromium oxide film. The other elements decide the crystal structure, and with it the class.',
    classes: [
      { key: 'aus', name: 'Austenitic (300 series, Nitronic)', test: re('304|316|321|347|301|303|21-6-9|Nitronic'), structure: 'FCC: nickel keeps the austenite stable', strength: 'Solid solution and cold work only: cannot be hardened by heat treatment', watch: 'No ductile-to-brittle transition: the cryogenic stainless. Sensitisation in welds (use L grades or 321/347). Chloride stress-corrosion cracking above about 60 °C. Galls against itself.' },
      { key: 'mart', name: 'Martensitic (400 series)', test: re('\\b410\\b|\\b431\\b|440C'), structure: 'BCC/BCT martensite', strength: 'Quench and temper, like a carbon steel', watch: 'The lowest corrosion resistance of the stainless steels. Hydrogen embrittlement at high hardness. Has a ductile-to-brittle transition.' },
      { key: 'ph', name: 'Precipitation-hardening', test: re('17-4|15-5|13-8|Custom 4|17-7|FV520'), structure: 'Martensite (17-4, 15-5, 13-8) or semi-austenitic (17-7)', strength: 'Copper or Ni-Al precipitates in an age at 480–620 °C (H900 to H1150)', watch: 'Strength and toughness trade with the ageing temperature: H900 is strongest and least tough, H1025 to H1150 are the usual compromise. 15-5 and 13-8 are cleaner and tougher than 17-4.' },
      { key: 'dup', name: 'Duplex and super duplex', test: re('Duplex|2205|2507'), structure: 'About half FCC austenite, half BCC ferrite', strength: 'Solid solution; about twice the yield of 316L', watch: '475 °C embrittlement: limit to about 250–300 °C. Sigma phase if welded or heat treated wrongly. Excellent chloride resistance (PREN above 34; above 40 for super duplex).' },
    ],
  },
  {
    key: 'al', name: 'Aluminium alloys', lib: ['al'],
    intro: 'FCC, light, and tough at cryogenic temperature. The first digit of the alloy number gives the main alloying element; the temper (O, H, T) gives the condition.',
    classes: [
      { key: '1', name: '1xxx: pure aluminium', test: re('^Al 1'), structure: 'FCC', strength: 'Work hardening only', watch: 'Low strength; best conductivity and corrosion resistance.' },
      { key: '2', name: '2xxx: Al-Cu (2014, 2024, 2219, 2618)', test: re('^Al 2|2618'), structure: 'FCC with Al-Cu precipitates', strength: 'Precipitation hardening (T3, T6, T8)', watch: 'Poor corrosion resistance: clad or protect. Good fatigue (2024) and elevated temperature (2219, 2618). 2219 welds well.' },
      { key: '5', name: '5xxx: Al-Mg (5083, 5251)', test: re('^Al 5'), structure: 'FCC', strength: 'Solid solution and work hardening (H tempers)', watch: 'Weldable, very good in seawater. Above 3% Mg, sensitisation above about 65 °C.' },
      { key: '6', name: '6xxx: Al-Mg-Si (6061, 6082, 6063)', test: re('^Al 6'), structure: 'FCC with Mg2Si precipitates', strength: 'Precipitation hardening (T6)', watch: 'General purpose, weldable, anodises well. The weld zone loses a third to a half of its T6 strength.' },
      { key: '7', name: '7xxx: Al-Zn (7075, 7050, 7010, 7020)', test: re('^Al 7'), structure: 'FCC with Zn-Mg precipitates', strength: 'Precipitation hardening: the strongest aluminium alloys', watch: 'Stress-corrosion cracking in T6, worst in the short-transverse direction: the T73/T74/T76 over-aged tempers trade 10–15% strength for resistance.' },
      { key: 'li', name: 'Al-Li (2195, 2050, 2099)', test: re('Al-Li'), structure: 'FCC with Al-Li-Cu precipitates', strength: 'Precipitation hardening', watch: 'About 5% lighter and 7–10% stiffer than 2xxx: launch-vehicle tanks. Anisotropic; careful with welding (friction stir).' },
      { key: 'be', name: 'Beryllium and Al-Be (S-200F, AlBeMet)', test: re('Beryllium|AlBeMet'), structure: 'HCP beryllium (AlBeMet: FCC aluminium with HCP beryllium)', strength: 'Powder metallurgy; very high stiffness for its weight', watch: 'Stiffness-to-weight about six times that of aluminium: mirrors, instrument structure. Beryllium dust and fume are toxic: machining needs controls. Brittle and anisotropic (beryllium).' },
      { key: 'cast', name: 'Cast and additive (A356, AlSi10Mg)', test: re('A356|AlSi10Mg|LM25'), structure: 'FCC with silicon eutectic', strength: 'Silicon for castability, Mg2Si ageing', watch: 'Porosity and lower fatigue: use casting factors and HIP where it matters.' },
    ],
  },
  {
    key: 'ti', name: 'Titanium alloys', lib: ['ti'],
    intro: 'HCP (α) below about 880 °C and BCC (β) above. Aluminium, oxygen and tin stabilise α; vanadium, molybdenum and iron stabilise β. The balance gives the class.',
    classes: [
      { key: 'cp', name: 'Commercially pure', test: re('CP Ti'), structure: 'HCP α', strength: 'Oxygen content (grades 1 to 4)', watch: 'The most corrosion resistant. Low strength. Welds well with full inert-gas shielding.' },
      { key: 'alpha', name: 'α and near-α (Ti-5-2.5, 6-2-4-2, IMI 834)', test: re('5Al-2\\.5Sn|6Al-2Sn-4Zr|IMI 834'), structure: 'HCP α with a little β', strength: 'Solid solution (Al, Sn, Zr)', watch: 'The best creep resistance: to about 600 °C (IMI 834). Ti-5Al-2.5Sn ELI is the cryogenic titanium. Not heat treatable to high strength.' },
      { key: 'ab', name: 'α-β (Ti-6Al-4V, IMI 550, Ti-3-2.5)', test: re('6Al-4V|6Al-6V|IMI 550|3Al-2\\.5V'), structure: 'HCP α plus BCC β', strength: 'Solution treatment and ageing (STA) of the α-β mixture', watch: 'Ti-6Al-4V is half of all titanium used. Texture: properties depend on direction. Alpha case: remove the brittle oxygen-rich surface after hot work. Galls: never run titanium on titanium unlubricated.' },
      { key: 'beta', name: 'β and near-β (Ti-10-2-3)', test: re('10V-2Fe|15V|Beta'), structure: 'BCC β, aged to precipitate α', strength: 'Deep hardening by ageing: the highest strengths', watch: 'Heavy sections harden through. Denser; ductile-to-brittle behaviour is less of an issue than in steels but toughness falls at peak strength.' },
      { key: 'tial', name: 'Titanium aluminides', test: re('TiAl'), structure: 'Ordered intermetallic (γ-TiAl)', strength: 'Ordered structure', watch: 'Light and stiff to about 750 °C; brittle at room temperature.' },
    ],
  },
  {
    key: 'ni', name: 'Nickel and cobalt superalloys', lib: ['ni'],
    intro: 'FCC nickel with chromium for oxidation resistance. The strength at temperature comes from solid solution (Mo, W, Co) or from ordered γ′ (Ni3Al, Ti) and γ″ (Ni3Nb) precipitates.',
    classes: [
      { key: 'ss', name: 'Solid-solution (625, 600, Hastelloy X, Nimonic 75)', test: re('Inconel 6[02][05]|Inconel 617|Hastelloy|Haynes 230|Haynes 214|Nimonic 75|Monel 400|Haynes 188|L-605'), structure: 'FCC γ', strength: 'Solid solution: Mo, W, Cr, Co', watch: 'Weldable and formable sheet: combustors, ducting, heat shields. Lower strength than the precipitation-hardened alloys, but no over-ageing.' },
      { key: 'gp', name: 'Precipitation-hardened (718, Waspaloy, Nimonic 80A/90, C263, X-750, 282)', test: re('718|Waspaloy|Nimonic (80A|90|105|C263)|X-750|Haynes 282|Rene 41|K-500|Inconel 939|A286|MP35N|JBK|HR-1'), structure: 'FCC γ with γ′ or γ″ precipitates', strength: 'Solution treatment and ageing', watch: 'Inconel 718 (γ″) welds without strain-age cracking and is the workhorse to about 650–700 °C. The γ′ alloys (Waspaloy, Nimonic 90, Rene 41) go hotter but crack on welding. All are slow to machine.' },
      { key: 'cast', name: 'Cast and single crystal (MAR-M-247, CMSX-4)', test: re('MAR-M|CMSX'), structure: 'FCC γ with a high fraction of γ′; no grain boundaries in single crystals', strength: 'γ′ up to 70% of the volume', watch: 'Turbine blades. Anisotropic. Not for machined structure.' },
      { key: 'ods', name: 'Oxide-dispersion strengthened', test: re('ODS|GRX'), structure: 'FCC (or BCC FeCrAl) with fine oxides', strength: 'Dispersion: stable to near the melting point', watch: 'Difficult to join; properties depend on the processing route.' },
      { key: 'lowx', name: 'Low-expansion (Invar, Kovar)', test: re('Invar|Kovar'), structure: 'FCC Fe-Ni', strength: 'Solid solution', watch: 'Almost no expansion near room temperature: optical benches, glass-to-metal seals. Low strength.' },
    ],
  },
  {
    key: 'cu', name: 'Copper alloys', lib: ['cu'],
    intro: 'FCC copper: the best conductor of heat after silver, tough at all temperatures. Small additions give strength while keeping conductivity, or wear and corrosion resistance.',
    classes: [
      { key: 'hc', name: 'High-conductivity (C101, CuCrZr, GRCop, NARloy-Z)', test: re('C101|CuCrZr|GRCop|NARloy|AMZIRC|Glidcop'), structure: 'FCC with fine precipitates or dispersed oxides', strength: 'Small Cr, Zr, Nb or Ag additions: precipitates or dispersions that keep conductivity', watch: 'Rocket-engine chamber liners and electrodes. Pure copper softens above about 200 °C; the alloys hold their strength hotter.' },
      { key: 'be', name: 'Beryllium copper (C17200, C17510)', test: re('Beryllium copper'), structure: 'FCC with Be-rich precipitates', strength: 'Solution treatment and ageing: up to about 1300 MPa', watch: 'The strongest copper alloys, non-sparking, excellent springs and bushes. Beryllium dust and fume are toxic: machining and grinding need controls.' },
      { key: 'bronze', name: 'Bronzes (phosphor, aluminium, bearing)', test: re('bronze'), structure: 'FCC (α), with κ phases in aluminium bronze', strength: 'Solid solution of Sn or Al, with Fe and Ni in aluminium bronze', watch: 'Bushes and bearings against steel: good wear and galling resistance. Aluminium bronze (C63000) is the aerospace bush alloy; phosphor bronze for springs and contacts.' },
      { key: 'brass', name: 'Brass (Cu-Zn)', test: re('Brass'), structure: 'FCC α, with BCC β above about 37% Zn', strength: 'Solid solution and cold work', watch: 'Free-machining fittings. Dezincification in water; season cracking in ammonia.' },
    ],
  },
];

/** The class of a library metal within its family, or "other". */
export function classOf(f: Family, m: Pick<Material, 'name'>) {
  return f.classes.find((c) => c.test(m.name))?.key ?? 'other';
}

/** The library metals of a family, each with its class key. */
export function members(f: Family) {
  return MATERIALS.filter((m) => f.lib.includes(m.family)).map((m) => ({ m, cls: classOf(f, m) }));
}
