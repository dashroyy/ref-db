import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, CATS, KINDS, PATHS, citation, citedBy, filterSources, sourceById, type Doc } from '../src/lib/reading.ts';

const DOCS = fileURLToPath(new URL('../src/content/docs/', import.meta.url));
const walk = (dir: string, pre = ''): Doc[] => readdirSync(dir).flatMap((f) => {
  const full = join(dir, f);
  if (statSync(full).isDirectory()) return walk(full, `${pre}${f}/`);
  if (!/\.mdx?$/.test(f)) return [];
  const text = readFileSync(full, 'utf8');
  return [{ path: `${pre}${f.replace(/\.mdx?$/, '')}`.replace(/^index$/, ''), title: text.match(/^title:\s*(.+)$/m)?.[1] ?? f, text }];
});
const docs = walk(DOCS).filter((d) => d.path !== 'fundamentals/reading');
const pages = (id: string) => citedBy(sourceById(id)!, docs).map((p) => p.path);

test('every source is complete, in a known category, and its patterns compile', () => {
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length, 'ids unique');
  for (const s of SOURCES) {
    assert.ok(CATS.some((c) => c.key === s.cat), `${s.id}: category`);
    assert.ok(s.kind in KINDS, `${s.id}: kind`);
    assert.ok(s.title && s.who && s.what && s.why && s.get, `${s.id}: text`);
    assert.ok(s.find.length > 0, `${s.id}: a pattern`);
    for (const f of s.find) assert.doesNotThrow(() => new RegExp(f), `${s.id}: ${f}`);
    if (s.url) assert.match(s.url, /^https:\/\//, `${s.id}: url`);
    assert.doesNotMatch(s.title, /ignit|initiat|explosiv|formulat/i, `${s.id}: outside the scope of the site`);
  }
  for (const c of CATS) assert.ok(SOURCES.some((s) => s.cat === c.key), `${c.key} has sources`);
});

test('reading paths use sources of the list', () => {
  for (const p of PATHS) {
    assert.ok(p.ids.length >= 5, `${p.key}: at least five`);
    for (const id of p.ids) assert.ok(sourceById(id), `${p.key}: ${id}`);
    assert.equal(new Set(p.ids).size, p.ids.length, `${p.key}: no repeats`);
  }
});

test('citations are found in the text of the pages that cite them', () => {
  assert.ok(pages('sutton').includes('motor/hardware'));
  assert.ok(pages('sp8007').includes('verify/shell-buckling'));
  assert.ok(pages('mmpds').includes('materials/allowables'));
  assert.ok(pages('parker').includes('seals/o-ring-design'));
  assert.ok(pages('vdi2230').includes('joints/bolted-joints'));
  assert.ok(pages('rubinstein').includes('fundamentals/molecular-sandbox'));
  // no pattern is so loose that it finds a source on most pages
  for (const s of SOURCES) assert.ok(citedBy(s, docs).length <= docs.length * 0.5, `${s.id}: cited on ${citedBy(s, docs).length} of ${docs.length} pages`);
});

test('the numbers that the page states', () => {
  assert.equal(SOURCES.length, 75, 'the page says 75 sources');
  assert.equal(CATS.length, 10, 'in ten subjects');
  assert.equal(SOURCES.filter((s) => s.start && s.free).length, 2, 'two of the start set are free');
  const casePath = PATHS.find((p) => p.key === 'case')!;
  assert.equal(casePath.ids.length, 8);
  assert.deepEqual(casePath.ids.filter((id) => sourceById(id)!.free).sort(), ['sp8007', 'sp8025', 'sp8040', 'std5019']);
});

test('a reference-list entry, and the filters', () => {
  assert.equal(citation(sourceById('sutton')!), 'G. P. Sutton & O. Biblarz, Rocket Propulsion Elements, 9th ed., Wiley (2017).');
  assert.equal(citation(sourceById('sp8025')!), 'NASA SP-8025, Solid Rocket Motor Metal Cases (1970).');
  const knock = filterSources(SOURCES, { q: 'knockdown' }).map((s) => s.id);
  assert.ok(knock.includes('sp8007') && knock.includes('timogere'));
  assert.ok(filterSources(SOURCES, { free: true }).every((s) => s.free));
  assert.deepEqual(filterSources(SOURCES, { start: true }).map((s) => s.id).sort(), ['bruhn', 'mmpds', 'ntrs', 'shigley', 'sp8025', 'sutton']);
  assert.deepEqual(filterSources(SOURCES, { cat: 'draw' }).map((s) => s.id), ['bs8888', 'y145', 'krulikowski', 'drake']);
});
