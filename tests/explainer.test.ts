import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ends, progress, stageAt, nextStop, prevStop, stageStart, ease, seg, attrs } from '../src/lib/explainer.ts';
import { STATES, CYL, PCG, HBAKE, LBB, cylinder, pcg, hbake, lbb, lbDepth, lbHalf, LB_TAU_B, stageOf } from '../src/lib/explainers.ts';

const MS = { cylinder: CYL.ms, pcg: PCG.ms, hbake: HBAKE.ms, lbb: LBB.ms };
const FILES = { cylinder: 'CylinderSplit', pcg: 'PcgGrowth', hbake: 'HydrogenBake', lbb: 'LeakOrBurst' };
const num = (v: string | number | undefined) => Number(v);

test('timeline: stage ends, progress and the stops', () => {
  const ms = [1000, 2000, 500];
  assert.deepEqual(ends(ms), [1000, 3000, 3500]);
  assert.deepEqual(progress(ms, 0), [0, 0, 0]);
  assert.deepEqual(progress(ms, 2000), [1, 0.5, 0]);
  assert.deepEqual(progress(ms, 3500), [1, 1, 1]);
  // a stage end belongs to that stage, because the player stops there
  assert.equal(stageAt(ms, 0), 0);
  assert.equal(stageAt(ms, 1000), 0);
  assert.equal(stageAt(ms, 1001), 1);
  assert.equal(stageAt(ms, 3500), 2);
  assert.equal(nextStop(ms, 0), 1000);
  assert.equal(nextStop(ms, 1000), 3000);
  assert.equal(nextStop(ms, 3500), 3500);
  assert.equal(prevStop(ms, 3500), 3000);
  assert.equal(prevStop(ms, 1500), 1000);
  assert.equal(prevStop(ms, 1000), 0);
  assert.equal(prevStop(ms, 0), 0);
  assert.equal(stageStart(ms, 0), 0);
  assert.equal(stageStart(ms, 2), 3000);
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(0.5), 0.5);
  assert.equal(seg(0.5, 0.25, 0.75), 0.5);
  assert.equal(seg(0.1, 0.25, 0.75), 0);
  assert.deepEqual(attrs({ text: 'a', x: 1 }), { x: 1 });
  assert.deepEqual(stageOf([1, 1, 0, 0]), 1);
  assert.deepEqual(stageOf([0, 0, 0]), 0);
});

test('every state is finite at all times, and its opacities are between 0 and 1', () => {
  for (const [name, fn] of Object.entries(STATES)) {
    const ms = MS[name as keyof typeof MS];
    const total = ends(ms)[ms.length - 1];
    for (let t = 0; t <= total; t += total / 97) {
      const s = fn(progress(ms, t));
      for (const [k, a] of Object.entries(s)) {
        for (const [n, v] of Object.entries(a)) {
          const txt = String(v);
          assert.doesNotMatch(txt, /NaN|Infinity|undefined/, `${name} ${k}.${n} at ${t}`);
          if (n === 'opacity') assert.ok(num(v) >= 0 && num(v) <= 1, `${name} ${k}.opacity ${v}`);
          if (n === 'width' || n === 'height') assert.ok(num(v) >= 0, `${name} ${k}.${n} ${v}`);
        }
      }
    }
    // the animation changes the picture: the start and the end are different
    assert.notDeepEqual(fn(progress(ms, 0)), fn(progress(ms, total)), name);
  }
});

test('every state key has its element in the component, and the server renders the end state', () => {
  for (const [name, fn] of Object.entries(STATES)) {
    const src = readFileSync(new URL(`../src/components/${FILES[name as keyof typeof FILES]}.astro`, import.meta.url), 'utf8');
    assert.match(src, new RegExp(`<Explainer name="${name}"`), name);
    assert.match(src, new RegExp(`const S = ${name}\\(\\[1(, 1)*\\]\\)`), `${name} renders the end state`);
    const ms = MS[name as keyof typeof MS];
    assert.equal(fn(ms.map(() => 1)) !== undefined, true);
    for (const k of Object.keys(fn(ms.map(() => 1)))) {
      const templated = /^(ha|hb|mA|mB|puff)\d+$/.test(k) && src.includes(`data-k={\`${k.replace(/\d+$/, '')}\${i}\`}`);
      const keyed = src.includes(`data-k="${k}"`) || src.includes(`data-k={pn.n}`) && /^n[AB]$/.test(k);
      assert.ok(templated || keyed, `${name}: no element for ${k}`);
    }
  }
});

test('cylinder: the hoop stress is two times the axial stress, and gets to the strength', () => {
  const end = cylinder([1, 1, 1, 1]);
  assert.equal(num(end.hbar.width), CYL.bar.w);
  assert.equal(num(end.hbar.width), 2 * num(end.abar.width));
  assert.equal(end.hval.text, 'σh = 100 % of the strength');
  assert.equal(end.aval.text, 'σa = 50 % of the strength');
  assert.equal(end.slim.stroke, 'var(--rd-accent)');
  const mid = cylinder([1, 1, 0, 0]);
  assert.equal(mid.pval.text, '55 % of burst');
  assert.equal(mid.slim.stroke, 'var(--rd-muted)');
  assert.equal(num(mid.crack.opacity), 0, 'no crack before burst');
  // the arrows on the wall element: the hoop arrow is two times the axial arrow
  const h = CYL.cy - CYL.el.half - num(end.eh1.y2);
  const a = CYL.el.x - CYL.el.half - num(end.ea1.x2);
  assert.ok(Math.abs(h - 2 * a) < 0.02, `${h} vs ${a}`);
});

test('PCG: the machined surface is deeper than the deepest coarse grain', () => {
  assert.ok(PCG.stock > PCG.deepest + 5, `${PCG.stock} vs ${PCG.deepest}`);
  assert.ok(PCG.cells.length >= 6);
  const end = pcg([1, 1, 1, 1]);
  assert.ok(90 + num(end.reveal.height) - 2 >= PCG.deepest, 'all the coarse grains have grown in');
  assert.equal(num(end.tool.opacity), 0, 'the tool has gone at the end');
  assert.ok(num(end.cutR.x) <= 440 && num(end.cutR.x) + num(end.cutR.width) >= 840, 'all the skin is machined off');
  const start = pcg([0, 0, 0, 0]);
  assert.equal(num(start.det.opacity), 0);
  assert.equal(num(start.reveal.height), 0);
});

test('hydrogen: the bake removes it, and without the bake it goes to the notch root', () => {
  const end = hbake([1, 1, 1, 1]);
  const lit = Array.from({ length: HBAKE.atoms }, (_, i) => end[`ha${i}`]).filter((a) => num(a.opacity) > 0);
  assert.equal(lit.length, 3, 'three atoms stay in the baked part');
  const { cx, tip } = HBAKE.bar;
  for (let i = 0; i < HBAKE.atoms; i++) {
    const a = end[`hb${i}`];
    const d = Math.hypot(num(a.cx) - (cx + 430), num(a.cy) - tip);
    assert.ok(d < 30, `atom ${i} is ${d.toFixed(1)} from the notch root`);
  }
  assert.equal(end.statA.text, 'Baked: no crack');
  assert.equal(end.statB.text, 'Not baked: cracked, later');
  assert.equal(num(end.wholeB.opacity), 0, 'part B has come apart');
  const loaded = hbake([1, 1, 1, 0]);
  assert.equal(num(loaded.wholeB.opacity), 1, 'part B is whole before it cracks');
  assert.equal(num(loaded.crack.opacity), 0);
});

test('leak before break: the crack grows faster as it grows, and A leaks while B bursts', () => {
  assert.ok(Math.abs(lbDepth(0) - 12) < 1e-9);
  assert.ok(Math.abs(lbDepth(1) - 100) < 1e-9);
  assert.ok(Math.abs(lbDepth(LB_TAU_B) - 55) < 1e-9);
  assert.ok(LB_TAU_B > 0.5 && LB_TAU_B < 1);
  const gaps = LBB.marks.map((m, i) => m.a - (i ? LBB.marks[i - 1].a : 12));
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], 'the beach marks get further apart');
  assert.ok(lbHalf(100) > lbHalf(50) && lbHalf(50) > lbHalf(12));
  // the through crack is shorter than the critical length
  assert.ok(LBB.through < LBB.critLen);
  const end = lbb([1, 1, 1, 1]);
  assert.equal(end.nA.text, '2000 cycles');
  assert.equal(end.nB.text, `${Math.round(2000 * LB_TAU_B)} cycles`);
  assert.equal(num(end.presB.width), 0, 'B lost all its pressure');
  assert.ok(num(end.presA.width) > 0 && num(end.presA.width) < 120, 'A loses its pressure slowly');
  assert.equal(num(end.critB.opacity), 0);
  const before = lbb([1, 1, 0, 0]);
  assert.equal(num(before.burst.opacity), 0);
  assert.equal(num(before.ffB.opacity), 0);
});
