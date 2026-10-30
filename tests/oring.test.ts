import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyseGland, stretchedCs, extrusionLimit, suggestGroove, nearestId, designGland, sectionFor, pointSqueeze, glandAt, type ORingInputs } from '../src/lib/oring.ts';
import data from '../src/data/orings.json' with { type: 'json' };

const close = (a: number, b: number, rel = 1e-3) =>
  assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${a} ≉ ${b}`);

// Worked example on the O-ring page: static radial piston seal, 150 mm bore.
const base: ORingInputs = {
  arrangement: 'piston', duty: 'static',
  cs: 5.33, csTol: 0.13, id: 139.29, idTol: 0.84,
  bore: { min: 150.0, max: 150.063 }, shaft: { min: 149.86, max: 149.9 },
  groove: { min: 141.45, max: 141.55 }, width: { min: 7.0, max: 7.2 }, faceGap: { min: 0, max: 0 },
  eccentric: true, tMin: -40, tMax: 60, tAssembly: 20,
  alphaE: 1.6e-4, alphaM: 12e-6, swell: 0.05, compressionSet: 0.2,
  pressure: 10, hardness: 70, opening: 0,
};

test('stretch thins the cross-section at constant volume', () => {
  close(stretchedCs(5.33, 0.02), 5.33 / Math.sqrt(1.02), 1e-12);
  assert.equal(stretchedCs(5.33, -0.01), 5.33);
});

test('nominal piston gland matches the hand calculation', () => {
  const r = analyseGland(base);
  close(r.gNom, 4.26575, 1e-6);
  close(r.stretchNom, (141.5 - 139.29) / 139.29, 1e-9);
  close(r.sqNom, 0.1933, 2e-3);
  close(r.fillNom, (Math.PI / 4) * 5.33 ** 2 / (1 + r.stretchNom) / (7.1 * 4.26575), 1e-9);
});

test('worst-case squeeze brackets nominal; eccentricity widens the spread', () => {
  const r = analyseGland(base);
  assert.ok(r.sqMax > r.sqNom && r.sqMinCold < r.sqNom && r.sqMinEol < r.sqMinCold);
  const c = analyseGland({ ...base, eccentric: false });
  assert.ok(c.gMin > r.gMin && c.gMax < r.gMax);
});

test('rod gland geometry, concentric and eccentric', () => {
  const rod: ORingInputs = { ...base, arrangement: 'rod', bore: { min: 50.1, max: 50.15 }, shaft: { min: 49.95, max: 50.0 }, groove: { min: 58.5, max: 58.6 }, id: 50.39 };
  const c = analyseGland({ ...rod, eccentric: false });
  close(c.gMin, (58.5 - 50.0) / 2, 1e-9);
  close(c.gMax, (58.6 - 49.95) / 2, 1e-9);
  const e = analyseGland(rod);
  close(e.gMin, (58.5 - 50.15) / 2, 1e-9);
  close(e.gMax, (58.6 + 50.15) / 2 - 49.95, 1e-9);
});

test('colder means less squeeze; joint opening reduces it further', () => {
  const warm = analyseGland({ ...base, tMin: 20 }), cold = analyseGland(base);
  assert.ok(cold.sqMinCold < warm.sqMinCold);
  const open = analyseGland({ ...base, opening: 0.3 });
  assert.ok(open.sqMinPressurised < open.sqMinEol);
  close(open.clearancePressurised, open.clearanceMax + 0.6, 1e-9);
});

test('extrusion limits follow the v1 screening table', () => {
  close(extrusionLimit(3, 70), 0.15, 1e-9);
  close(extrusionLimit(8, 90), 0.15, 1e-9);
  close(extrusionLimit(8, 80), 0.115, 1e-9);
  assert.equal(extrusionLimit(12, 70), 0);
  assert.equal(analyseGland(base).backupNeeded, true); // 0.203 mm gap at 10 MPa, 70 Shore
});

test('suggested groove hits the target nominal squeeze and fill', () => {
  const s = suggestGroove('piston', 150.0315, 5.33, 139.29, 0.2, 0.75);
  const r = analyseGland({ ...base, groove: { min: s.groove, max: s.groove }, width: { min: s.width, max: s.width }, bore: { min: 150.0315, max: 150.0315 } });
  close(r.sqNom, 0.2, 1e-6);
  close(r.fillNom, 0.75, 1e-6);
});

test('stock ID lookup from ISO 3601 class A data', () => {
  const ids = (data.idsA as Record<string, number[]>)['5.33'];
  assert.equal(nearestId(ids, 137.4), 139.29);
});

test('design from the hardware: the nozzle seal of the worked example', () => {
  const ids = (data.idsA as Record<string, number[]>)['5.33'];
  const d = designGland({ arrangement: 'piston', duty: 'static', mating: 150, pressure: 10, hardness: 70, clearance: 0.203, squeeze: 0.2, fill: 0.75, ids });
  assert.equal(d.cs, 5.33); assert.equal(d.id, 139.29);
  assert.ok(d.stretch > 0.01 && d.stretch < 0.05, 'stretch 1–5%');
  assert.ok(Math.abs(d.groove - 141.54) < 0.01); assert.equal(d.backups, 1, 'a back-up ring at 10 MPa with this clearance');
  assert.ok(Math.abs(d.idTol - 0.84) < 0.005);
  assert.equal(sectionFor(10), 1.78); assert.equal(sectionFor(150), 5.33);
});

test('face seals put the ring against the pressure side', () => {
  const ids = (data.idsA as Record<string, number[]>)['3.53'];
  const inside = designGland({ arrangement: 'face', duty: 'static', mating: 80, pressureInside: true, pressure: 5, hardness: 70, clearance: 0.05, squeeze: 0.25, fill: 0.75, ids });
  assert.ok(inside.od >= 80, 'ring OD on the groove OD');
  const outside = designGland({ arrangement: 'face', duty: 'static', mating: 80, pressureInside: false, pressure: 5, hardness: 70, clearance: 0.05, squeeze: 0.25, fill: 0.75, ids });
  assert.ok(outside.id <= 80, 'ring ID on the groove ID');
});

test('point squeeze agrees with the worst case at the corners', () => {
  const i = { ...base };
  const g = analyseGland(i);
  const x = [i.cs - i.csTol, i.id - i.idTol, i.bore.max, i.shaft.min, i.groove.max, 0, 0];
  // smallest ring, most stretch (smallest ID onto the largest root), deepest gland, cold
  const s = pointSqueeze({ ...i, groove: { min: i.groove.max, max: i.groove.max } }, x, i.tMin);
  assert.ok(Math.abs(s - g.sqMinCold) < 0.01, `${s} vs ${g.sqMinCold}`);
});

test('the gland at a corner agrees with the worst-case analysis', () => {
  const g = analyseGland(base);
  close(glandAt(base, 'min', base.tMin).squeeze, g.sqMinCold, 1e-9);
  close(glandAt(base, 'min', base.tMin).squeezeEol, g.sqMinEol, 1e-9);
  close(glandAt(base, 'max', base.tMax).squeeze, g.sqMax, 1e-9);
  const n = glandAt(base, 'nom', 20);
  assert.ok(Math.abs(n.squeeze - g.sqNom) < 0.01, `${n.squeeze} vs ${g.sqNom}`);
  const opened = glandAt({ ...base, opening: 0.25 }, 'min', base.tMin, true);
  close(opened.squeezeEol, analyseGland({ ...base, opening: 0.25 }).sqMinPressurised, 1e-9);
  assert.ok(glandAt(base, 'max', 20).gap === 0, 'the tight side of an off-centre fit has no gap');
});
