import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStandard, temperCode, finishSpec, buildCallout, needsBake, isPlating, skeletonSheet, type SpecSheet } from '../src/lib/callout.ts';
import { MFG } from '../src/data/specs-mfg.mjs';
import data from '../src/data/specs.json' with { type: 'json' };
import { SPECS_V2 } from '../src/data/specs-v2.mjs';
import { SPECS_CU } from '../src/data/specs-cu.mjs';
import xref from '../src/data/xref.json' with { type: 'json' };
import { MATERIALS } from '../src/lib/materials.ts';
import { sameAlloy } from '../src/lib/datasheet.ts';

const sheets = [...(data.specs as SpecSheet[]), ...(SPECS_V2 as SpecSheet[]), ...(SPECS_CU as SpecSheet[])];
const sheet = (n: string) => sheets.find((s) => s.name.startsWith(n))!;

test('standards parse into alternatives and tolerance standards', () => {
  assert.deepEqual(parseStandard('BS EN 755-2 (properties) + BS EN 755-3 (tolerances)'), { alternatives: ['BS EN 755-2'], tolerances: ['BS EN 755-3'] });
  assert.deepEqual(parseStandard('AMS 4928 / ASTM B348'), { alternatives: ['AMS 4928', 'ASTM B348'], tolerances: [] });
  assert.equal(temperCode('T6 / T651'), 'T6');
  assert.equal(finishSpec('BS EN ISO 7599 (or DEF STAN 03-24/25 on MoD work)'), 'BS EN ISO 7599');
  assert.equal(finishSpec('Company finish spec'), '<COMPANY SPEC>');
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
    const s = sheets.find((x) => x.name === name);
    assert.ok(s, `${name}: no specification sheet of that name`);
    assert.ok(m.notes.length >= 3 && m.notes.every((n) => n.length > 20), `${name}: notes`);
    assert.equal(m.pcg, s!.family === 'al' && /\b[267]\d{3}/.test(name), `${name}: the PCG flag`);
  }
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
  const s4130 = sheet('4130'), zinc = s4130.finishes.find((f) => /^Zinc plating/.test(f.name))!;
  assert.ok(needsBake(s4130, zinc));
  const d6 = sheet('D6AC'), zn = d6.finishes.find((f) => /electroplate/i.test(f.name))!;
  assert.ok(!needsBake(d6, zn), 'the D6AC finish specification already calls for the bake');
  assert.ok(!needsBake(sheet('Aluminium 6082'), sheet('Aluminium 6082').finishes[0]));
  const out = buildCallout({ sheet: s4130, formIndex: 0, standard: 'X', temperIndex: 0, finishIndex: s4130.finishes.indexOf(zinc), afterFinish: false, traceability: false, certificate: false, hydrogenBake: true });
  assert.match(out, /HYDROGEN EMBRITTLEMENT RELIEF BAKE TO AMS 2759\/9 OR BS EN ISO 9588\n {10}START THE BAKE WITHIN <TIME> OF PLATING/);
});

test('brass sheets: each matches its library entry and names its EN product standards', () => {
  for (const sh of SPECS_CU as SpecSheet[]) {
    const lib = MATERIALS.filter((m) => sameAlloy(m, sh));
    assert.equal(lib.length, 1, `${sh.name}: one library material, found ${lib.map((m) => m.name).join(', ')}`);
    assert.ok(sh.forms.every((f) => /^(BS EN \d{4,5}|ASTM B\d+)$/.test(f.standard)), `${sh.name}: product standards`);
    assert.ok(sh.tempers.length && sh.finishes.length && sh.tips.length && sh.callout.startsWith('MATERIAL: '), sh.name);
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
  // a brass with no full sheet takes its designation and standard from the designations table
  const muntz = skel.find((sk) => sk.name.includes('CW509L'))!;
  assert.equal(muntz.designation, 'CuZn40 (CW509L)');
  assert.deepEqual(parseStandard(muntz.forms[0].standard).alternatives, ['BS EN 12163', '<PRODUCT STANDARD>']);
  // an aluminium skeleton does not join a placeholder condition to the designation
  const al = skel.find((sk) => sk.family === 'al')!;
  assert.doesNotMatch(buildCallout({ sheet: al, formIndex: 0, standard: 'X', temperIndex: 0, finishIndex: -1, afterFinish: false, traceability: false, certificate: false }), /-<CONDITION>/);
});

