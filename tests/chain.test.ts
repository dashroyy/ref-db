import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEPS, LOOPS, CANDIDATES, CASE_MATERIALS, runChain, baseInputs, verdicts, drawingNotes, stepIndex, type Factors } from '../src/lib/chain.ts';
import { ZONE_PLAN } from '../src/data/zones.mjs';

// The factors of the page's worked example. For the example only: the tool starts with them blank.
const F: Factors = { proof: 1.1, burst: 1.25, grain: 1.5, ins: 1.5, buck: 1.25, life: 4, scatter: 0.25, sep: 1.2 };
const BLANK: Factors = { proof: null, burst: null, grain: null, ins: null, buck: null, life: null, scatter: null, sep: null };
const near = (a: number | null | undefined, b: number, tol: number, what: string) =>
  assert.ok(a !== null && a !== undefined && Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} ± ${tol}`);
const mat = (key: string) => CASE_MATERIALS.find((m) => m.key === key)!;

test('the steps: unique, each uses only earlier steps, each names a zone; loops go back', () => {
  assert.equal(new Set(STEPS.map((s) => s.key)).size, STEPS.length);
  STEPS.forEach((s, k) => {
    assert.ok(ZONE_PLAN.some((z) => z[1] === s.zone), `${s.key}: zone ${s.zone}`);
    for (const u of s.uses) assert.ok(stepIndex(u) >= 0 && stepIndex(u) < k, `${s.key} uses ${u}, which must come before it`);
  });
  for (const l of LOOPS) assert.ok(stepIndex(l.to) < stepIndex(l.from), `loop ${l.from} → ${l.to} goes back`);
  assert.equal(STEPS.filter((s) => s.uses.includes('case')).length, 8, 'the page says eight steps use the case wall');
  assert.equal(STEPS.length, 14, 'the page says fourteen steps');
  for (const k of CANDIDATES) assert.ok(CASE_MATERIALS.some((m) => m.key === k), `candidate ${k} in the library`);
});

test('the worked example reproduces the numbers of the zone pages', () => {
  const c = runChain(baseInputs(F));
  near(c.duty!.all, 2.332, 0.002, 'equivalent MEOP cycles');
  near(c.duty!.after, 1.001, 0.002, 'cycles after proof');
  near(c.duty!.reqAll, 9.33, 0.01, 'life to show from NDT');
  near(c.meop.value, 10.02, 0.005, 'MEOP');
  near(c.case!.t, 1.380, 0.001, 'wall');
  assert.equal(c.case!.governs, 'burst');
  near(c.case!.hoopMeop, 1094, 1, 'hoop at MEOP');
  near(c.case!.mass, 11.80, 0.01, 'case mass');
  near(c.grain!.combined, 0.1608, 0.001, 'cold ignition strain');
  near(c.grain!.msStrain, 0.64, 0.005, 'grain margin');
  near(c.grain!.bond, 0.253, 0.002, 'bond tension');
  near(c.insulation!.required, 8.93, 0.03, 'dome insulation');
  assert.equal(c.insulation!.governs, 'bondline temperature');
  near(c.mass!.dv, 2071, 1, 'Δv');
  near(c.mass!.fraction, 0.807, 0.001, 'mass fraction');
  near(c.buckling!.reserve, 1.243, 0.003, 'buckling reserve');
  assert.ok(c.buckling!.ms! < 0, 'the empty case fails the vacuum check with a factor of 1.25');
  assert.equal(c.lbb!.outcome, 'runs');
  near(c.lbb!.through, 3.29, 0.02, 'crack length when it runs');
  near(c.proof!.aScreen, 0.858, 0.003, 'proof-screened flaw');
  near(c.proof!.aCrit, 1.038, 0.003, 'critical flaw');
  near(c.proof!.cyclesFromProof, 105, 1.5, 'cycles after proof');
  near(c.ageing!.ms, 0.23, 0.005, 'aged grain margin');
  near(c.closure.P, 17739, 5, 'load per bolt');
  near(c.closure.preload, 36495, 5, 'preload');
  near(c.closure.ms, 0.51, 0.005, 'separation margin');
  near(c.ndt!.aCrit, 0.877, 0.003, 'NDT critical flaw');
  assert.deepEqual(c.ndt!.clear.map((r) => r.short).sort(), ['ET', 'PT', 'UT']);
  assert.equal(c.lowest!.step, 'buckling');
  const v = verdicts(c);
  assert.equal(v.buckling, 'bad');
  assert.equal(v.lbb, 'warn');
  assert.equal(v.grain, 'ok');
  assert.equal(drawingNotes(c).length, 9);
});

test('blank factors: the steps that need them wait, the others still answer', () => {
  const c = runChain(baseInputs(BLANK));
  assert.equal(c.case, null);
  for (const k of ['grain', 'insulation', 'mass', 'buckling', 'lbb', 'proof', 'ageing', 'ndt'] as const) assert.equal(c[k], null, k);
  near(c.meop.value, 10.02, 0.005, 'MEOP needs no factor');
  near(c.closure.P, 17739, 5, 'the bolt load needs no factor');
  assert.equal(c.closure.ms, null);
  assert.equal(c.lowest, null);
  const v = verdicts(c);
  assert.equal(v.case, 'wait');
  assert.equal(v.meop, 'info');
  assert.deepEqual(drawingNotes(c), []);
});

test('changing the alloy moves the chain as the Leak before break page says', () => {
  const cdv = runChain({ ...baseInputs(F), mat: mat('15cdv6-1-7734') });
  near(cdv.case!.t, 2.23, 0.005, '15CDV6 wall');
  assert.equal(cdv.lbb!.outcome, 'leak');
  near(cdv.lbb!.ratio, 1.79, 0.02, '15CDV6 margin on length');
  assert.ok(cdv.buckling!.ms! > 0);
  assert.ok(cdv.mass!.dv < 2071 - 100, 'the heavier case costs Δv');
  const mar = runChain({ ...baseInputs(F), mat: mat('maraging-18ni-250') });
  near(mar.case!.t, 1.215, 0.005, 'maraging wall');
  assert.equal(mar.lbb!.outcome, 'leak');
  near(mar.lbb!.ratio, 1.29, 0.02, 'maraging margin on length');
  // an alloy that cannot hold the burst pressure stops the chain at the case
  const weak = runChain({ ...baseInputs(F), mat: { ...mat('al-6061-t6'), uts: 10, yld: 8 } });
  assert.equal(weak.sized, false);
  assert.equal(verdicts(weak).case, 'bad');
  assert.equal(weak.grain, null);
});
