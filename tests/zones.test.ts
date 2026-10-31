import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHASES, ZONE_PLAN, REBUILT, PRIMERS, BRIEFING, route, hrefOf } from '../src/data/zones.mjs';

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

test('route numbering derives from the plan; primers are unnumbered', () => {
  const r = route();
  assert.equal(r.filter((x) => !x.primer).length, 64);
  assert.equal(r.find((x) => x.key === 'pv')!.tag, 'Z25');
  assert.equal(r.find((x) => x.key === 'oring')!.tag, 'Z51');
  assert.equal(r.find((x) => x.primer)!.num, null);
  assert.equal(hrefOf(r.find((x) => x.key === 'sheet')!, '/'), '/legacy/?z=sheet');
  assert.equal(hrefOf(r.find((x) => x.key === 'pv')!, '/ref-db/'), '/ref-db/motor/case-sizing/');
  assert.equal(hrefOf(r.find((x) => x.key === 'home')!, '/'), '/');
});
