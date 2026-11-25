import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStandard, temperCode, finishSpec, buildCallout, needsBake, isPlating, skeletonSheet, pcgRisk, type SpecSheet } from '../src/lib/callout.ts';
import { MFG } from '../src/data/specs-mfg.mjs';
import data from '../src/data/specs.json' with { type: 'json' };
import { SPECS_V2 } from '../src/data/specs-v2.mjs';
import { SPECS_CU } from '../src/data/specs-cu.mjs';
import { SPECS_STEEL } from '../src/data/specs-steel.mjs';
import { SPECS_SS } from '../src/data/specs-ss.mjs';
import { SPECS_AL } from '../src/data/specs-al.mjs';
import { SPECS_TI } from '../src/data/specs-ti.mjs';
import { SPECS_NI } from '../src/data/specs-ni.mjs';
import { SPECS_MG } from '../src/data/specs-mg.mjs';
import { SPECS_REFRACT } from '../src/data/specs-refract.mjs';
import xref from '../src/data/xref.json' with { type: 'json' };
import { MATERIALS } from '../src/lib/materials.ts';
import { sameAlloy } from '../src/lib/datasheet.ts';

const sheets = [...(data.specs as SpecSheet[]), ...(SPECS_V2 as SpecSheet[]), ...(SPECS_CU as SpecSheet[]), ...(SPECS_STEEL as SpecSheet[]), ...(SPECS_SS as SpecSheet[]), ...(SPECS_AL as SpecSheet[]), ...(SPECS_TI as SpecSheet[]), ...(SPECS_NI as SpecSheet[]), ...(SPECS_MG as SpecSheet[]), ...(SPECS_REFRACT as SpecSheet[])];
const sheet = (n: string) => sheets.find((s) => s.name.startsWith(n))!;

test('standards parse into alternatives and tolerance standards', () => {
  assert.deepEqual(parseStandard('BS EN 755-2 (properties) + BS EN 755-3 (tolerances)'), { alternatives: ['BS EN 755-2'], tolerances: ['BS EN 755-3'] });
  assert.deepEqual(parseStandard('AMS 4928 / ASTM B348'), { alternatives: ['AMS 4928', 'ASTM B348'], tolerances: [] });
  // a note that holds ' + ' is not a tolerance standard (the v1 Inconel 718 bar)
  assert.deepEqual(parseStandard('AMS 5662 (solution + aged) / AMS 5663 / ASTM B637'), { alternatives: ['AMS 5662', 'AMS 5663', 'ASTM B637'], tolerances: [] });
  assert.equal(temperCode('T6 / T651'), 'T6');
  assert.equal(finishSpec('BS EN ISO 7599 (or DEF STAN 03-24/25 on MoD work)'), 'BS EN ISO 7599');
  assert.equal(finishSpec('Company finish spec'), '<COMPANY SPEC>');
  assert.equal(finishSpec('Process spec'), '<PROCESS SPEC>');
  assert.equal(finishSpec('Programme spec'), '<PROGRAMME SPEC>');
});

test('aluminium callout reproduces the v1 example material line', () => {
  const s = sheet('Aluminium 6082');
  const out = buildCallout({ sheet: s, formIndex: 0, standard: 'BS EN 755-2', temperIndex: 0, finishIndex: 0, afterFinish: true, traceability: false, certificate: false });
  const lines = out.split('\n');
  assert.equal(lines[0], 'MATERIAL: EN AW-6082-T6 EXTRUDED ROUND BAR / ROD TO BS EN 755-2');
  assert.equal(lines[1], '          TOLERANCES TO BS EN 755-3');
  assert.match(lines[2], /^FINISH: {3}SULPHURIC ANODISE TO BS EN ISO 7599$/);
  assert.equal(lines.at(-1), 'NOTE:     DIMENSIONS APPLY AFTER FINISH');
});

test('every sheet, form, condition and finish produces a callout', () => {
  for (const s of sheets) {
    assert.ok(s.forms.length && s.tempers.length, `${s.name} has forms and tempers`);
    s.forms.forEach((f, fi) => {
      const { alternatives } = parseStandard(f.standard);
      assert.ok(alternatives.length, `${s.name} / ${f.form} has a standard`);
      const out = buildCallout({ sheet: s, formIndex: fi, standard: alternatives[0], temperIndex: 0, finishIndex: s.finishes.length ? 0 : -1, afterFinish: true, traceability: true, certificate: true });
      assert.ok(out.startsWith('MATERIAL: ') && !out.includes('undefined'), `${s.name} / ${f.form}`);
    });
  }
});

test('v2 case-steel sheets are present and complete', () => {
  for (const n of ['D6AC', 'Maraging 18Ni-250']) {
    const s = sheet(n);
    assert.ok(s.callout.includes('AMS'));
    assert.ok(s.tips.length >= 3);
  }
});

test('manufacturing considerations: every entry has a sheet, and the PCG flag marks the heat-treatable aluminium alloys', () => {
  for (const [name, m] of Object.entries(MFG)) {
    // keyed by a full sheet, or by the library name of a metal that has a skeleton
    const fam = sheets.find((x) => x.name === name)?.family ?? MATERIALS.find((x) => x.name === name)?.family;
    assert.ok(fam, `${name}: no specification sheet or library material of that name`);
    assert.ok(m.notes.length >= 3 && m.notes.every((n) => n.length > 20), `${name}: notes`);
    assert.equal(m.pcg, fam === 'al' && /\b[267]\d{3}/.test(name), `${name}: the PCG flag`);
  }
  // without notes, every heat-treatable aluminium alloy still defaults to the PCG lines
  assert.ok(pcgRisk({ family: 'al', name: 'Al 7050-T7451', designation: 'EN AW-7050' }));
  assert.ok(pcgRisk({ family: 'al', name: 'Al-Li 2195', designation: 'Al-Li 2195' }));
  assert.ok(!pcgRisk({ family: 'al', name: 'Al 5083-H111', designation: 'EN AW-5083' }));
  assert.ok(!pcgRisk({ family: 'al', name: 'Al A356 / LM25 (cast)', designation: 'Al A356 / LM25 (cast)' }));
  assert.ok(pcgRisk({ family: 'al', name: 'Al 6005A-T6', designation: 'EN AW-6005A' }), 'an A-suffix alloy of a heat-treatable series');
  assert.ok(!pcgRisk({ family: 'al', name: 'X', designation: 'EN AC-42100 (AlSi7Mg0.3)' }), 'a casting');
  // every aluminium sheet of a heat-treatable series has its notes, with the PCG warning first
  for (const s of sheets.filter((x) => x.family === 'al' && /\b[267]\d{3}/.test(x.name))) {
    assert.ok(MFG[s.name]?.pcg, `${s.name}: PCG notes`);
    assert.match(MFG[s.name].notes[0], /^Peripheral coarse grain/);
  }
});

test('callout: the peripheral coarse grain, heat-treatment, NDT and note lines', () => {
  const s = sheet('Aluminium 7075');
  const out = buildCallout({ sheet: s, formIndex: 0, standard: parseStandard(s.forms[0].standard).alternatives[0], temperIndex: 0, finishIndex: 0, afterFinish: true, traceability: false, certificate: false, heatTreat: true, ndt: true, edges: true, grainDirection: true, pcg: { stock: 1.5, macro: true } });
  const lines = out.split('\n');
  assert.ok(lines.includes('          FURNACE PYROMETRY TO AMS 2750'));
  assert.ok(lines.some((l) => /^ {10}HEAT TREAT TO T\d+ PER <PROCESS SPEC>$/.test(l)));
  assert.ok(lines.includes('NDT:      PENETRANT INSPECTION TO BS EN ISO 3452-1, SENSITIVITY LEVEL 3'));
  const g = lines.indexOf('GRAIN:    NO PERIPHERAL COARSE GRAIN ON THE FINISHED PART');
  assert.ok(g > 0);
  assert.equal(lines[g + 1], '          REMOVE MIN 1.5 mm FROM ALL AS-SUPPLIED SURFACES');
  assert.equal(lines[g + 2], '          VERIFY BY MACRO-ETCH OF A SACRIFICIAL SAMPLE PER <PROCESS SPEC>');
  assert.deepEqual(lines.slice(-3), ['NOTE:     DIMENSIONS APPLY AFTER FINISH', '          EDGES TO ISO 13715 -0.1/-0.5, NO BURRS', '          GRAIN DIRECTION AS SHOWN']);
  // without stock or macro-etch, only the requirement line
  const bare = buildCallout({ sheet: s, formIndex: 0, standard: 'X', temperIndex: 0, finishIndex: -1, afterFinish: true, traceability: false, certificate: false, pcg: { stock: 0, macro: false } });
  assert.match(bare, /GRAIN: {4}NO PERIPHERAL COARSE GRAIN ON THE FINISHED PART$/);
});

test('hydrogen-embrittlement bake: on for a plated steel, off when the finish already calls for it', () => {
  assert.ok(isPlating('Zinc plating') && isPlating('Zinc-nickel electroplate') && isPlating('Cadmium / zinc-nickel plating') && isPlating('Silver plate'));
  assert.ok(!isPlating('Electropolish') && !isPlating('Hot dip galvanize') && !isPlating('Passivation') && !isPlating('Phosphate + oil'));
  // hard chromium is an electroplate (hydrogen); a chromate conversion coating is not
  assert.ok(isPlating('Hard chromium') && isPlating('Hard chrome plating') && !isPlating('Chromate conversion'));
  const s4130 = sheet('4130'), zinc = s4130.finishes.find((f) => /^Zinc plating/.test(f.name))!;
  assert.ok(needsBake(s4130, zinc));
  const d6 = sheet('D6AC'), zn = d6.finishes.find((f) => /electroplate/i.test(f.name))!;
  assert.ok(!needsBake(d6, zn), 'the D6AC finish specification already calls for the bake');
  assert.ok(!needsBake(sheet('Aluminium 6082'), sheet('Aluminium 6082').finishes[0]));
  const out = buildCallout({ sheet: s4130, formIndex: 0, standard: 'X', temperIndex: 0, finishIndex: s4130.finishes.indexOf(zinc), afterFinish: false, traceability: false, certificate: false, hydrogenBake: true });
  assert.match(out, /HYDROGEN EMBRITTLEMENT RELIEF BAKE TO AMS 2759\/9 OR BS EN ISO 9588\n {10}START THE BAKE WITHIN <TIME> OF PLATING/);
});

test('copper-alloy sheets: each matches its library entry and names its product standards', () => {
  for (const sh of SPECS_CU as SpecSheet[]) {
    const lib = MATERIALS.filter((m) => sameAlloy(m, sh));
    assert.equal(lib.length, 1, `${sh.name}: one library material, found ${lib.map((m) => m.name).join(', ')}`);
    assert.ok(sh.forms.every((f) => /^(BS EN \d{4,5}|ASTM B\d+|AMS \d{4})$/.test(f.standard)), `${sh.name}: product standards`);
    assert.ok(sh.tempers.length && sh.tips.length && sh.callout.startsWith('MATERIAL: '), sh.name); // a heat-exchanger tube can have no finish
  }
  const w = sheet('Brass CW713R');
  const out = buildCallout({ sheet: w, formIndex: 0, standard: 'BS EN 12164', temperIndex: 0, finishIndex: -1, afterFinish: false, traceability: false, certificate: true });
  assert.equal(out.split('\n')[0], 'MATERIAL: CuZn37Mn3Al2PbSi (CW713R) ROD FOR FREE MACHINING TO BS EN 12164');
  assert.equal(out.split('\n')[1], '          CONDITION: R540');
});

test('every library metal is in the builder: a full sheet, or a skeleton with placeholders', () => {
  const rows = xref.rows as { name: string; family: string; en: string; enNo: string }[];
  const metals = MATERIALS.filter((m) => m.kind === 'metal');
  const skel = metals.filter((m) => !sheets.some((sh) => sameAlloy(m, sh))).map((m) => skeletonSheet(m, rows.find((r) => sameAlloy(m, r))));
  assert.ok(skel.length > 0 && skel.length < metals.length);
  for (const sk of skel) {
    const out = buildCallout({ sheet: sk, formIndex: 0, standard: parseStandard(sk.forms[0].standard).alternatives[0], temperIndex: 0, finishIndex: 0, afterFinish: true, traceability: false, certificate: true });
    assert.ok(out.startsWith('MATERIAL: ') && out.includes('<PRODUCT FORM>') && out.includes('CONDITION: <CONDITION>') && !out.includes('undefined'), sk.name);
  }
  // a skeleton takes its designation, and a standard where the designations table gives one, from that table
  const hinted = skel.filter((sk) => sk.forms[0].standard.endsWith(' / <PRODUCT STANDARD>'));
  assert.equal(skeletonSheet({ name: 'X', family: 'cu', summary: '', spec: '' }, { en: 'CuZn40 (EN 12163)', enNo: 'CW509L' }).forms[0].standard, 'BS EN 12163 / <PRODUCT STANDARD>', 'a skeleton takes the standard that the designations table gives');
  for (const sk of hinted) assert.match(parseStandard(sk.forms[0].standard).alternatives[0], /^(BS EN|AMS|ASTM) /, sk.name);
  assert.equal(skeletonSheet({ name: 'X', family: 'cu', summary: '', spec: '' }, { en: 'CuZn40 (EN 12163)', enNo: 'CW509L' }).designation, 'CuZn40 (CW509L)');
  // an aluminium skeleton does not join a placeholder condition to the designation
  const al = skel.find((sk) => sk.family === 'al')!;
  assert.doesNotMatch(buildCallout({ sheet: al, formIndex: 0, standard: 'X', temperIndex: 0, finishIndex: -1, afterFinish: false, traceability: false, certificate: false }), /-<CONDITION>/);
});

test('steel sheets: each matches one library material, with product standards and a full callout', () => {
  for (const sh of SPECS_STEEL as SpecSheet[]) {
    const lib = MATERIALS.filter((m) => sameAlloy(m, sh));
    assert.equal(lib.length, 1, `${sh.name}: one library material, found ${lib.map((m) => m.name).join(', ')}`);
    assert.equal(lib[0].family, 'steel', sh.name);
    assert.ok(sh.forms.every((f) => /^(BS (EN (ISO )?)?\d{3,5}(-\d)?|ASTM A\d+|AMS \d{4})/.test(f.standard)), `${sh.name}: product standards`);
    assert.ok(sh.tempers.length && sh.finishes.length && sh.tips.length && sh.callout.startsWith('MATERIAL: '), sh.name);
    sh.forms.forEach((f, fi) => {
      const out = buildCallout({ sheet: sh, formIndex: fi, standard: parseStandard(f.standard).alternatives[0], temperIndex: 0, finishIndex: 0, afterFinish: true, traceability: true, certificate: true });
      assert.ok(out.startsWith('MATERIAL: ') && !out.includes('undefined'), `${sh.name} / ${f.form}`);
    });
  }
  // the quenched-and-tempered steels: the plated finish switches the hydrogen bake on
  const s42 = sheet('4140 / 42CrMo4');
  assert.ok(needsBake(s42, s42.finishes.find((f) => /Zinc-nickel/.test(f.name))!));
  assert.ok(needsBake(s42, s42.finishes.find((f) => /Hard chromium/.test(f.name))!), 'hard chromium is a plating');
});

test('stainless and aluminium sheets: each matches one library material of its family, and every form builds', () => {
  for (const [list, fam, std] of [
    [SPECS_SS, 'ss', /^(BS (EN (ISO )?)?\d{3,5}(-\d)?|BS S\d+|ASTM A\d+|AMS \d{4})/],
    [SPECS_AL, 'al', /^(BS (EN )?\d{3,5}(-\d)?|BS L\d+|ASTM [BF]\d+|AMS \d{4})/],
  ] as const) {
    for (const sh of list as SpecSheet[]) {
      const lib = MATERIALS.filter((m) => sameAlloy(m, sh));
      assert.equal(lib.length, 1, `${sh.name}: one library material, found ${lib.map((m) => m.name).join(', ')}`);
      assert.equal(lib[0].family, fam, sh.name);
      assert.ok(sh.forms.every((f) => std.test(f.standard)), `${sh.name}: product standards`);
      assert.ok(sh.tempers.length && sh.finishes.length && sh.tips.length && sh.callout.startsWith('MATERIAL: '), sh.name);
      sh.forms.forEach((f, fi) => sh.tempers.forEach((_, ti) => {
        const out = buildCallout({ sheet: sh, formIndex: fi, standard: parseStandard(f.standard).alternatives[0], temperIndex: ti, finishIndex: 0, afterFinish: true, traceability: true, certificate: true });
        assert.ok(out.startsWith('MATERIAL: ') && !out.includes('undefined'), `${sh.name} / ${f.form}`);
      }));
    }
  }
  // wrought aluminium joins the temper to the designation; a casting keeps it on the condition line
  const b = (n: string) => buildCallout({ sheet: sheet(n), formIndex: 0, standard: parseStandard(sheet(n).forms[0].standard).alternatives[0], temperIndex: 0, finishIndex: -1, afterFinish: false, traceability: false, certificate: false }).split('\n');
  assert.equal(b('Al 7050')[0], 'MATERIAL: EN AW-7050-T7451 PLATE TO AMS 4050');
  assert.deepEqual(b('Al A356').slice(0, 2), ['MATERIAL: EN AC-42100 (AlSi7Mg0.3) SAND CASTING (S) TO BS EN 1706', '          CONDITION: T6']);
  // the heat-treatable alloys default to the PCG lines; 5083 and the casting do not
  assert.ok(pcgRisk(sheet('Al 7050')) && pcgRisk(sheet('Al 6063')) && !pcgRisk(sheet('Al 5083')) && !pcgRisk(sheet('Al A356')));
  assert.ok(pcgRisk({ ...sheet('Al 2014A'), mfg: MFG['Al 2014A-T6'] }), 'the 2014A notes key the sheet');
  // the hardened martensitic stainless steels bake after plating; passivation is not a plating
  const s431 = sheet('431 stainless');
  assert.ok(needsBake(s431, s431.finishes.find((f) => /Hard chromium/.test(f.name))!) && !needsBake(s431, s431.finishes[0]));
  // passivation cites the general standards: BS EN ISO 16048 is for fasteners
  for (const sh of sheets) for (const f of sh.finishes) if (/^Passivat/i.test(f.name)) assert.doesNotMatch(finishSpec(f.spec), /16048/, `${sh.name}: passivation`);
});


test('titanium and nickel sheets: each matches one library material of its family, and every form builds', () => {
  for (const [list, fam, std] of [
    [SPECS_TI, 'ti', /^(AMS \d{4}|ASTM B\d+|BS (2)?TA \d+)/],
    [SPECS_NI, 'ni', /^(AMS \d{4}|ASTM [BF]\d+|BS (2)?HR \d+)/],
  ] as const) {
    for (const sh of list as SpecSheet[]) {
      const lib = MATERIALS.filter((m) => sameAlloy(m, sh));
      assert.equal(lib.length, 1, `${sh.name}: one library material, found ${lib.map((m) => m.name).join(', ')}`);
      assert.equal(lib[0].family, fam, sh.name);
      assert.ok(sh.forms.every((f) => std.test(f.standard)), `${sh.name}: product standards`);
      assert.ok(sh.tempers.length && sh.finishes.length && sh.tips.length && sh.callout.startsWith('MATERIAL: '), sh.name);
      if (sh.mfg) assert.ok(!pcgRisk(sh) && sh.mfg.notes.length >= 3 && sh.mfg.notes.every((n) => n.length > 20), `${sh.name}: notes`);
      sh.forms.forEach((f, fi) => sh.tempers.forEach((_, ti) => {
        const out = buildCallout({ sheet: sh, formIndex: fi, standard: parseStandard(f.standard).alternatives[0], temperIndex: ti, finishIndex: 0, afterFinish: true, traceability: true, certificate: true });
        assert.ok(out.startsWith('MATERIAL: ') && !out.includes('undefined'), `${sh.name} / ${f.form}`);
      }));
    }
  }
  // the bake line: on for a plated age-hardened alloy, off where the sheet says that the alloy is not sensitive
  const k500 = sheet('Monel K-500'), invar = sheet('Invar 36');
  assert.ok(needsBake(k500, k500.finishes.find((f) => /Silver/.test(f.name))!));
  assert.ok(!needsBake(invar, invar.finishes.find((f) => /^Nickel plating/.test(f.name))!));
  // AMS 2525 is a graphite film, not the general dry film lubricant; AMS 2700 (stainless passivation) and AMS 2680
  // (electron-beam welding) are not titanium finishes
  for (const sh of sheets) for (const f of sh.finishes) {
    if (/dry film/i.test(f.name)) assert.doesNotMatch(f.spec, /AMS 2525/, sh.name);
    if (sh.family === 'ti') assert.doesNotMatch(f.spec, /AMS 2700|AMS 2680/, sh.name);
  }
});

test('magnesium and refractory sheets: each matches one library material of its family, and every form builds', () => {
  for (const [list, fam, std] of [
    [SPECS_MG, 'mg', /^(AMS \d{4}|ASTM B\d+|BS EN \d{4})/],
    [SPECS_REFRACT, 'refract', /^(ASTM B\d+|<PRODUCER SPEC>)/],
  ] as const) {
    for (const sh of list as SpecSheet[]) {
      const lib = MATERIALS.filter((m) => sameAlloy(m, sh));
      assert.equal(lib.length, 1, `${sh.name}: one library material, found ${lib.map((m) => m.name).join(', ')}`);
      assert.equal(lib[0].family, fam, sh.name);
      assert.ok(sh.forms.every((f) => std.test(f.standard)), `${sh.name}: product standards`);
      assert.ok(sh.tempers.length && sh.finishes.length && sh.tips.length && sh.callout.startsWith('MATERIAL: '), sh.name);
      if (sh.mfg) assert.ok(!pcgRisk(sh) && sh.mfg.notes.length >= 3, `${sh.name}: notes`);
      sh.forms.forEach((f, fi) => sh.tempers.forEach((_, ti) => {
        const out = buildCallout({ sheet: sh, formIndex: fi, standard: parseStandard(f.standard).alternatives[0], temperIndex: ti, finishIndex: 0, afterFinish: true, traceability: true, certificate: true });
        assert.ok(out.startsWith('MATERIAL: ') && !out.includes('undefined'), `${sh.name} / ${f.form}`);
      }));
    }
  }
  // magnesium is not in the hydrogen-bake families, and an anodic coating is not a plating
  const az = sheet('Mg AZ31B');
  assert.ok(az.finishes.every((f) => !needsBake(az, f)));
  // a form with no public standard keeps the placeholder in the callout
  const w = sheet('Tungsten / W-25Re');
  const out = buildCallout({ sheet: w, formIndex: 1, standard: parseStandard(w.forms[1].standard).alternatives[0], temperIndex: 2, finishIndex: -1, afterFinish: false, traceability: false, certificate: false });
  assert.equal(out.split('\n')[0], 'MATERIAL: Tungsten (unalloyed) ROD, BAR AND BLANKS TO <PRODUCER SPEC>');
});

test('no sheet cites a standard that was found to be wrong for its use', () => {
  // BS 7864 and BS L100 cannot be found; DEF STAN 03-38 is guidance on chromate alternatives; DTD 5212 is maraging
  // steel; AMS 7005 is a plasma-arc DED process; AMS 4095 is not a confirmed 2219 plate specification
  const wrong = /BS 7864|BS L100|DEF STAN 03-38|DTD 5212|AMS 7005|AMS 4095/;
  for (const sh of sheets) {
    const text = [sh.composition, sh.callout, ...sh.forms.map((f) => f.standard), ...sh.finishes.map((f) => f.spec)].join(' | ');
    assert.doesNotMatch(text, wrong, sh.name);
    // zinc-nickel is BS EN ISO 19598 (or AMS 2417); ISO 2081 is plain zinc
    for (const f of sh.finishes) if (/zinc-nickel/i.test(f.name)) assert.doesNotMatch(f.spec, /2081/, `${sh.name}: ${f.name}`);
  }
});
