import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Standard numbers that an audit (2026-11-25) found wrong for the use they were cited for. None may come back in the
// pages, the components, the library or the registers.
const src = fileURLToPath(new URL('../src/', import.meta.url));
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(mdx?|astro|json|mjs|ts)$/.test(f)) files.push(p);
  }
};
walk(src);

test('no file cites a standard that the audit found wrong', () => {
  // BS 7864 and BS L100 cannot be found; DEF STAN 03-38 is guidance on chromate alternatives, not a plating
  // specification; DTD 5212 is maraging steel; AMS 7005 is a plasma-arc DED process; AMS 4095 is not a confirmed 2219
  // plate specification
  const wrong = /BS 7864|BS L100|DEF STAN 03-38|DTD 5212|AMS 7005|AMS 4095/;
  // zinc-nickel is BS EN ISO 19598, ASTM B841 or AMS 2417: ISO 2081 is plain zinc
  const zincNickel = /zinc-nickel[^.\n|]{0,60}ISO 2081|ISO 2081[^.\n|]{0,60}zinc-nickel/i;
  assert.ok(files.length > 100, `${files.length} files`);
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, wrong, f);
    assert.doesNotMatch(text, zincNickel, f);
  }
});

test('the 7010 and 7075 library entries cite the specification of their own temper', () => {
  const lib = JSON.parse(readFileSync(join(src, 'data/materials.json'), 'utf8'));
  const list = (lib.materials ?? lib) as { name: string; spec: string }[];
  // AMS 4205 is 7010-T7451 plate (AMS 4204 is T7651); AMS 4078 is 7075-T7351 plate and AMS 4147 7075-T7352 forgings
  assert.match(list.find((m) => m.name === 'Al 7010-T7451')!.spec, /^AMS 4205/);
  assert.match(list.find((m) => m.name === 'Al 7075-T73')!.spec, /AMS 4078 \(T7351 plate\)/);
});
