import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASES, ZONE_PLAN, REBUILT, PRIMERS, BRIEFING, CORE, route, around, hrefOf } from '../src/data/zones.mjs';

const DOCS = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const pageExists = (slug: string) =>
  ['.md', '.mdx'].some((ext) => existsSync(join(DOCS, (slug || 'index') + ext)));

test('64 zones, 8 phases, phases contiguous and in PHASES order (as v1)', () => {
  assert.equal(ZONE_PLAN.length, 64);
  assert.equal(PHASES.length, 8);
  const order = ZONE_PLAN.map((z) => z[0]).filter((p, i, a) => i === 0 || a[i - 1] !== p);
  assert.deepEqual(order, PHASES.map((p) => p.k));
  assert.equal(new Set(ZONE_PLAN.map((z) => z[1])).size, 64, 'zone keys unique');
});

test('every rebuilt zone, primer and briefing page exists', () => {
  for (const [key, slug] of Object.entries(REBUILT)) {
    assert.ok(ZONE_PLAN.some((z) => z[1] === key), `${key} is a zone`);
    assert.ok(pageExists(slug), `page for ${key}: ${slug}`);
  }
  for (const p of [...PRIMERS, ...BRIEFING]) assert.ok(pageExists(p.slug), p.slug);
});

test('every docs page is reachable from the route or the briefing', () => {
  const known = new Set(['', ...Object.values(REBUILT), ...PRIMERS.map((p) => p.slug), ...BRIEFING.map((b) => b.slug)]);
  const walk = (dir: string, pre = ''): string[] =>
    readdirSync(dir).flatMap((f) => {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) return walk(full, `${pre}${f}/`);
      return /\.mdx?$/.test(f) ? [`${pre}${f.replace(/\.mdx?$/, '')}`.replace(/^index$/, '')] : [];
    });
  for (const slug of walk(DOCS)) assert.ok(known.has(slug), `orphan page: ${slug}`);
});

test('the key topics: real route items, not the whole route, with their own previous and next', () => {
  const r = route();
  assert.equal(new Set(CORE).size, CORE.length, 'no key topic listed twice');
  for (const k of CORE) assert.ok(r.some((z) => z.key === k), `${k} is on the route`);
  assert.deepEqual(r.filter((z) => z.core).map((z) => z.key).sort(), [...CORE].sort());
  assert.ok(r.find((z) => z.key === 'home')!.core && r.find((z) => z.key === 'primer-srm')!.core, 'the home page and How a solid motor works are key topics');
  assert.ok(CORE.length < r.length, 'ADVANCED still adds topics');
  const key = (z: { core: boolean }) => z.core;
  assert.deepEqual([around('home', key).prev, around('home', key).next?.key], [null, 'primer-srm']);
  assert.deepEqual([around('pv', key).prev?.key, around('pv', key).next?.key], ['propellant', 'primer-composite']);
  // from a specialised page: the nearest key topics on each side, or the next pages on the route
  assert.deepEqual([around('thermal', key).prev?.key, around('thermal', key).next?.key], ['primer-nozzle', 'margins']);
  assert.deepEqual([around('thermal').prev?.key, around('thermal').next?.key], ['primer-mass', 'primer-heating']);
  assert.equal(around(r.filter((z) => z.core).at(-1)!.key, key).next, null, 'the last key topic has no next key topic');
  assert.deepEqual(around('not-a-zone'), { prev: null, next: null });
});

test('the How to use guide gives the current key-topic numbers', () => {
  const core = route().filter((z) => z.core);
  const md = readFileSync(join(DOCS, 'start/how-to-use.md'), 'utf8');
  const ex = [...md.matchAll(/\*([A-Z]+) \u00b7 ([ZP]\d+) \u00b7 KEY TOPIC (\d+) OF (\d+)\*/g)];
  assert.ok(ex.length > 0, 'the guide has an example of the key-topic banner');
  for (const [, phase, tag, at, of] of ex) {
    const z = core.find((x) => x.tag === tag);
    assert.ok(z, `${tag} in the guide is a key topic`);
    assert.equal(PHASES.find((p) => p.k === z.phase)!.n, phase);
    assert.deepEqual([Number(at), Number(of)], [core.indexOf(z) + 1, core.length], `update the banner example of ${tag} in how-to-use.md`);
  }
});

test('route numbering derives from the plan; primers are unnumbered', () => {
  const r = route();
  assert.equal(r.filter((x) => !x.primer).length, 64);
  assert.equal(r.find((x) => x.key === 'pv')!.tag, 'Z25');
  assert.equal(r.find((x) => x.key === 'oring')!.tag, 'Z51');
  assert.equal(r.find((x) => x.primer)!.num, null);
  assert.deepEqual(r.filter((x) => x.primer).map((x) => x.tag), PRIMERS.map((_, i) => `P${i + 1}`), 'primers numbered once, in route order');
  assert.equal(r[r.findIndex((x) => x.key === 'propellant') + 1].key, 'primer-proptests', 'the propellant-tests primer follows the propellant');
  assert.equal(r[r.findIndex((x) => x.key === 'pv') + 1].key, 'primer-composite', 'the composite primer follows case sizing');
  assert.equal(r[r.findIndex((x) => x.key === 'pv') + 2].key, 'primer-closures', 'then the closures primer');
  assert.equal(r[r.findIndex((x) => x.key === 'grain') + 1].key, 'primer-bond', 'the bondline primer follows the grain');
  assert.equal(r[r.findIndex((x) => x.key === 'grain') + 2].key, 'primer-erosive', 'then the erosive-burning primer');
  assert.equal(r[r.findIndex((x) => x.key === 'grain') + 3].key, 'primer-instability', 'then the instability primer');
  assert.equal(r[r.findIndex((x) => x.key === 'ablative') + 1].key, 'primer-nozzle', 'the nozzle primer follows the ablative liners');
  assert.equal(r[r.findIndex((x) => x.key === 'ablative') + 2].key, 'primer-tvc', 'then the thrust-vector-control primer');
  assert.equal(r[r.findIndex((x) => x.key === 'ablative') + 3].key, 'primer-mass', 'then the mass-properties primer');
  assert.equal(r[r.findIndex((x) => x.key === 'vibration') + 1].key, 'primer-handling', 'the handling primer follows random vibration');
  assert.equal(r[r.findIndex((x) => x.key === 'proof') + 1].key, 'primer-firing', 'the static-firing primer follows proof testing');
  assert.equal(r[r.findIndex((x) => x.key === 'proof') + 2].key, 'primer-reliability', 'then the reliability primer');
  assert.equal(r[r.findIndex((x) => x.key === 'ndt') + 1].key, 'primer-flaws', 'the grain-flaws primer follows NDT');
  assert.equal(r[r.findIndex((x) => x.key === 'ageing') + 1].key, 'primer-cycles', 'the thermal-cycles primer follows storage and ageing');
  assert.equal(r[r.findIndex((x) => x.key === 'thermal') + 1].key, 'primer-heating', 'the external-heating primer follows transient thermal');
  assert.equal(r.filter((x) => x.slug === null).length, 0, 'every zone is rebuilt');
  assert.equal(hrefOf({ ...r.find((x) => x.key === 'read')!, slug: null }, '/'), '/legacy/?z=read', 'a zone without a page opens the v1 archive');
  assert.equal(hrefOf(r.find((x) => x.key === 'pv')!, '/ref-db/'), '/ref-db/motor/case-sizing/');
  assert.equal(hrefOf(r.find((x) => x.key === 'home')!, '/'), '/');
});
