import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPart, overall, overhang, bridge, wall, clearance, DEFAULT_PART } from '../src/lib/design.ts';
import { PLACES, fit, materialsFor } from '../src/lib/care.ts';
import { PHOTO_ITEMS, readiness } from '../src/lib/photos.ts';
import { suggest, GIFT_TAGS, WHO, VIBE, BUDGET } from '../src/lib/gifts.ts';
import { PRODUCTS } from '../src/data/catalog.ts';
import { materialById } from '../src/data/materials.ts';
import { GUIDES } from '../src/data/guides.ts';

test('design: the 45° rule and its neighbours', () => {
  assert.equal(overhang(45), 'good');
  assert.equal(overhang(55), 'care');
  assert.equal(overhang(75), 'problem');
  assert.equal(bridge(30), 'good');
  assert.equal(bridge(80), 'problem');
  assert.equal(wall(0.4), 'problem');
  assert.equal(wall(0.8), 'care');
  assert.equal(wall(1.2), 'good');
  assert.equal(clearance(0.1), 'problem');
  assert.equal(clearance(0.3), 'good');
  assert.equal(clearance(0.8), 'care');
});

test('design worked example: the default part passes; one bad feature fails the whole part', () => {
  assert.equal(overall(checkPart(DEFAULT_PART)), 'good');
  const bad = checkPart({ ...DEFAULT_PART, overhangDeg: 80 });
  assert.equal(overall(bad), 'problem');
  assert.equal(bad.find((c) => c.id === 'overhang')!.verdict, 'problem');
  assert.equal(overall(checkPart({ ...DEFAULT_PART, wallMm: 0.9 })), 'care');
});

test('care worked example: the car. ASA is good, PETG risky, PLA to avoid', () => {
  const car = PLACES.find((p) => p.id === 'car')!;
  assert.equal(fit(materialById('asa')!, car), 'good');
  assert.equal(fit(materialById('petg')!, car), 'risky');
  assert.equal(fit(materialById('pla')!, car), 'avoid');
  assert.equal(materialsFor('car')[0].material.id, 'asa');
});

test('care: everything suits a desk; nothing is good in a dishwasher', () => {
  assert.ok(materialsFor('desk').every((m) => m.fit === 'good'));
  assert.ok(materialsFor('dishwasher').every((m) => m.fit !== 'good'));
});

test('photos: ready only when every required shot is ticked', () => {
  const required = PHOTO_ITEMS.filter((i) => i.required).map((i) => i.id);
  assert.equal(readiness(required).ready, true);
  assert.equal(readiness(required.slice(1)).ready, false);
  assert.equal(readiness(required.slice(1)).missing[0].id, required[0]);
  assert.equal(readiness([]).done, 0);
});

test('gifts: every product is tagged, and every answer gets suggestions', () => {
  for (const p of PRODUCTS) assert.ok(GIFT_TAGS[p.id], `${p.id} needs gift tags in src/lib/gifts.ts`);
  for (const w of WHO) for (const v of VIBE) for (const b of BUDGET) {
    const picks = suggest({ who: w.id, vibe: v.id, budget: b.id });
    assert.ok(picks.length > 0 && picks.length <= 3, `${w.id}/${v.id}/${b.id}`);
    // within-budget picks always come before over-budget ones
    const firstOver = picks.findIndex((p) => p.overBudget);
    if (firstOver >= 0) assert.ok(picks.slice(firstOver).every((p) => p.overBudget));
  }
});

test('gifts: budget is respected when anything fits it', () => {
  const picks = suggest({ who: 'kid', vibe: 'fun', budget: '30' });
  assert.ok(picks.every((p) => !p.overBudget && p.product.price <= 3000));
  assert.equal(picks[0].product.id, 'mto-flexi-dragon'); // kid + fun, cheapest full match
});

test('guides: slugs are unique and every guide says where to go next', () => {
  assert.equal(new Set(GUIDES.map((g) => g.slug)).size, GUIDES.length);
  for (const g of GUIDES) assert.ok(g.cta.href.startsWith('/') && g.cta.label && g.tool, g.slug);
});

test('ship dates: working days skip weekends', async () => {
  const { addWorkingDays, shipWindow, formatWindow, slower } = await import('../src/lib/shipdate.ts');
  const thu = new Date(2026, 10, 12); // Thursday 12 Nov 2026
  assert.equal(addWorkingDays(thu, 1).getDate(), 13); // Friday
  assert.equal(addWorkingDays(thu, 2).getDate(), 16); // Monday, over the weekend
  assert.equal(addWorkingDays(new Date(2026, 10, 14), 1).getDate(), 16); // ordered Saturday → Monday
  assert.equal(formatWindow(shipWindow(thu, [3, 7])), 'Tue 17 – Mon 23 Nov');
  assert.equal(formatWindow(shipWindow(new Date(2026, 10, 25), [3, 7])), 'Mon 30 Nov – Fri 4 Dec');
  assert.deepEqual(slower([3, 7], [4, 6]), [4, 7]);
});
