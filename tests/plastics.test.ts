import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POLYMERS, polymer, screen, tgInWindow, fitAt, fitSweep, type FitInput } from '../src/lib/plastics.ts';

test('the v1 data is complete', () => {
  assert.equal(POLYMERS.length, 37);
  for (const p of POLYMERS) {
    assert.ok(p.tmin < p.tmax, p.a);
    assert.ok(p.good.length && p.bad.length, p.a);
    assert.ok(!/—/.test(p.good.join() + p.bad.join()), `${p.a} has an em dash`);
    if (p.fam !== 'elastomer') assert.ok(p.E && p.cte, `${p.a} needs E and CTE`);
  }
});

test('the screen gives the reason for each failure', () => {
  const r = { tmin: -54, tmax: 71, maxWabs: 0.3, outgas: 'low' as const };
  assert.deepEqual(screen(polymer('PEEK')!, r), []);
  assert.deepEqual(screen(polymer('POM')!, r), ['too cold: rated to -40 °C', 'outgassing moderate']);
  assert.deepEqual(screen(polymer('PA')!, r), ['too cold: rated to -40 °C', 'absorbs 1.8% water', 'outgassing high']);
  assert.ok(screen(polymer('PTFE')!, { rad: 'good' })[0].startsWith('radiation'));
  assert.equal(tgInWindow(polymer('PA')!, r), true); // Tg 60 °C is inside −54 to 71 °C
  assert.equal(tgInWindow(polymer('PET')!, r), false); // Tg 78 °C is above it
  assert.equal(tgInWindow(polymer('EPDM')!, r), false); // elastomers work above Tg by design
});

const peekIn6061: FitInput = { arrangement: 'bush', d: 30, D: 50, di: 25, fit0: 0.05, Ep: 3600, nuP: 0.4, alphaP: 47e-6, Em: 68900, nuM: 0.33, alphaM: 23.6e-6 };

test('a plastic bush in an aluminium housing: tight hot, loose cold', () => {
  assert.ok(Math.abs(fitAt(peekIn6061, 20).delta - 0.05) < 1e-12);
  assert.ok(Math.abs(fitAt(peekIn6061, -40).delta - (0.05 - 30 * 23.4e-6 * 60)) < 1e-9); // 0.00788
  const pom = { ...peekIn6061, Ep: 3000, alphaP: 110e-6 };
  assert.ok(Math.abs(fitAt(pom, -40).delta - (0.05 - 30 * 86.4e-6 * 60)) < 1e-9); // −0.1055: loose
  assert.equal(fitAt(pom, -40).p, 0);
  assert.ok(fitAt(peekIn6061, 70).p > fitAt(peekIn6061, 20).p);
  const s = fitSweep(peekIn6061, -40, 70, 10);
  assert.equal(s.length, 11); assert.ok(s[10].delta > s[0].delta);
});

test('a ring on a shaft loosens hot; a thin bush in a rigid housing closes by about the interference', () => {
  const ring: FitInput = { ...peekIn6061, arrangement: 'ring', di: 0 };
  assert.ok(fitAt(ring, 70).delta < fitAt(ring, 20).delta);
  assert.ok(fitAt(ring, 20).hoopPlastic > 0, 'hoop tension in the ring');
  const thin = fitAt({ ...peekIn6061, di: 29, Em: 1e12 }, 20);
  const ratio = thin.closure / 0.05; // 2·d·di / (d² + di² − ν(d² − di²)) = 1.013
  assert.ok(Math.abs(ratio - 1740 / (1741 - 0.4 * 59)) < 1e-3, String(ratio));
  assert.ok(thin.hoopPlastic < 0, 'hoop compression in the bush');
});
