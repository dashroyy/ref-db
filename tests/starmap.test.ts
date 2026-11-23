import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMap, MOTIFS, motifOf, EMBLEMS, TASKS } from '../src/lib/starmap.ts';
import { PHASES, ZONE_PLAN, PRIMERS, route } from '../src/data/zones.mjs';

test('the map: the overview is the sun, each phase a planet, every other zone a moon', () => {
  const m = buildMap('/', { '': 'Home.', 'materials/cryogenic': 'Cryogenic design.' });
  assert.equal(m.sun.tag, 'Z1'); assert.equal(m.sun.href, '/'); assert.equal(m.sun.desc, 'Home.');
  assert.deepEqual(m.planets.map((p) => p.k), PHASES.map((p) => p.k), 'planets in route order');
  const moons = m.planets.flatMap((p) => p.moons);
  assert.equal(moons.length, ZONE_PLAN.length - 1 + PRIMERS.length, 'every zone but the overview, and the primers');
  assert.ok(!moons.some((x) => x.key === 'home'));
  assert.equal(m.keyOnly, false);
  assert.equal(m.all, route().length); assert.equal(m.shown, route().length, 'ADVANCED on: every topic is on the map');
  const cryo = moons.find((x) => x.key === 'cryo')!;
  assert.equal(cryo.href, '/materials/cryogenic/'); assert.equal(cryo.desc, 'Cryogenic design.'); assert.equal(MOTIFS[cryo.motif], 'ice');
  for (const x of moons.filter((y) => !y.v2)) assert.match(x.href, /legacy\/\?z=/, `${x.key} opens the v1 archive`);
});

test('ADVANCED off: the key topics only, the page you are on kept, empty phases left out and the rest numbered in sequence', () => {
  const core = route().filter((z) => z.core);
  const m = buildMap('/', {}, { keyOnly: true });
  const moons = m.planets.flatMap((p) => p.moons);
  assert.equal(moons.length + 1, core.length, 'every key topic but the overview (the sun) is a moon');
  assert.ok(moons.every((x) => core.some((z) => z.key === x.key)));
  assert.ok(m.planets.every((p) => p.moons.length > 0), 'no empty phase');
  assert.deepEqual(m.planets.map((p) => p.index), m.planets.map((_, i) => i), 'the phases drawn are numbered in sequence');
  assert.ok(!m.planets.some((p) => p.k === 'detail'), 'a phase without key topics is not drawn');
  assert.ok(m.keyOnly); assert.equal(m.shown, core.length); assert.equal(m.all, route().length);
  const kept = buildMap('/', {}, { keyOnly: true, keep: 'gdt' });
  assert.ok(kept.planets.find((p) => p.k === 'detail')?.moons.some((x) => x.key === 'gdt'), 'the page you are on stays on the map');
});

test('a site under a base path links inside it', () => {
  const m = buildMap('/ref-db/', {});
  assert.equal(m.sun.href, '/ref-db/');
  assert.ok(m.planets.flatMap((p) => p.moons).every((x) => x.href.startsWith('/ref-db/')));
});

test('every zone has a surface, every phase a model, every task a zone', () => {
  for (const [, key] of ZONE_PLAN) assert.ok(MOTIFS.includes(motifOf(key)), key);
  assert.equal(motifOf('not-a-zone'), 'rock');
  for (const p of PHASES) assert.ok(EMBLEMS[p.k]?.model && EMBLEMS[p.k].what, p.k);
  const keys = new Set(ZONE_PLAN.map((z) => z[1]));
  for (const t of TASKS) assert.ok(keys.has(t.z), t.z);
});
