import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleBlock, generalNotes, genTolText, needsBake, checkNote, checkNotes, type FrameInputs } from '../src/lib/drawingnotes.ts';

const base: FrameInputs = {
  std: 'iso', projection: 'first', units: 'mm', genTol: 'iso2768', linClass: 'm', geoClass: 'K', envelope: false,
  finishRa: 3.2, edgeBreak: '0.2–0.5', material: 'D6AC', materialSpec: 'AMS 6431', ftuMPa: 1520,
  treatment: 'plateZnNi', fasteners: true, marking: 'etch', criticality: 'critical', ndt: 'mpi', cleanliness: true, exportControl: false,
};

test('title block and general tolerances', () => {
  assert.equal(genTolText(base), 'ISO 2768-mK');
  assert.equal(genTolText({ ...base, envelope: true }), 'ISO 2768-mK-E');
  const tb = titleBlock(base);
  assert.ok(tb.find((r) => r.field === 'Projection')!.value === 'First angle');
  assert.ok(tb.find((r) => r.field === 'Material')!.value.includes('AMS 6431'));
  assert.ok(!tb.some((r) => r.field === 'Export control'));
  assert.ok(titleBlock({ ...base, exportControl: true }).some((r) => r.field === 'Export control'));
  assert.match(titleBlock({ ...base, std: 'asme', stdIssue: '' }).find((r) => r.field === 'Governing standard')!.value, /ASME Y14\.5-\[issue\]/);
});

test('the builder writes the notes the choices need, and leaves the values to the programme', () => {
  const n = generalNotes(base).map((x) => x.text);
  assert.ok(n.some((t) => /hydrogen embrittlement/.test(t)), 'plated 1520 MPa steel needs a bake');
  assert.ok(!generalNotes({ ...base, ftuMPa: 900 }).some((x) => /hydrogen/.test(x.text)));
  assert.ok(!generalNotes({ ...base, treatment: 'paint' }).some((x) => /hydrogen/.test(x.text)), 'paint is not plating');
  assert.ok(n.some((t) => /Tighten fasteners to \[torque\]/.test(t)), 'the torque is a bracket, never a value');
  assert.ok(n.some((t) => /by magnetic particle per ASTM E1444 to \[acceptance/.test(t)));
  assert.ok(n.some((t) => /No impression stamping/.test(t)));
  assert.ok(n.some((t) => /Break sharp edges 0\.2–0\.5 mm/.test(t)));
  assert.equal(needsBake(1000, 'plateCd'), true); assert.equal(needsBake(999, 'plateCd'), false); assert.equal(needsBake(1600, 'anodize'), false);
});

test('the built notes pass the checker, apart from their brackets', () => {
  for (const x of generalNotes(base)) assert.deepEqual(checkNote(x.text), [], x.text);
});

test('the checker finds the notes that cannot be verified', () => {
  assert.ok(checkNote('Break all sharp edges.').length > 0);
  assert.deepEqual(checkNote('Break sharp edges 0.2–0.5 mm.'), []);
  assert.ok(checkNote('Finish to suit.').length > 0);
  assert.ok(checkNote('Torque to standard values.').some((w) => /value/.test(w)));
  assert.ok(checkNote('Torque to 60 N·m.').some((w) => /lubrication/.test(w)));
  assert.deepEqual(checkNote('Torque to 60 N·m with MoS2 grease, friction 0.10–0.14.'), []);
  assert.ok(checkNote('Clean before assembly.').length > 0);
  assert.ok(checkNote('Wall approximately 1.4 mm.').length > 0);
  assert.ok(checkNote('Anodize.').length > 0);
  assert.deepEqual(checkNote('Anodize per MIL-A-8625 type II class 1.'), []);
  const c = checkNotes('1. Torque bolts to 60 N·m with MoS2 grease.\n2. Torque bolts to 55 N·m with MoS2 grease.\n3. Break all sharp edges.');
  assert.equal(c.results.length, 3); assert.equal(c.conflicts.length, 1); assert.equal(c.clean, 2);
});
