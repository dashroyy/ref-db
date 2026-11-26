import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ends, progress, stageAt, nextStop, prevStop, stageStart, ease, seg, attrs } from '../src/lib/explainer.ts';
import { STATES, CYL, PCG, HBAKE, LBB, cylinder, pcg, hbake, lbb, lbDepth, lbHalf, LB_TAU_B, stageOf } from '../src/lib/explainers.ts';
import { BOLT, OR, GALV, bolt, oring, galv, boltForces, boltLoad, oringShape, oringLoad, polyArea, gamma, kappa, galvCurrent, galvCharge } from '../src/lib/explainers.ts';
import { MMC, INS, VIB, mmc, insul, vib, mmcAt, insulModel, insulAt, insulLimit, charDepth, transmissibility, vibAt } from '../src/lib/explainers.ts';
import { LOOSE, SHELL, REC, loose, shell, recov, looseAt, preloadLeft, knockdown, shellAt, recovery, recoveryTime, recAt } from '../src/lib/explainers.ts';

const MS = {
  cylinder: CYL.ms,
  pcg: PCG.ms,
  hbake: HBAKE.ms,
  lbb: LBB.ms,
  bolt: BOLT.ms,
  oring: OR.ms,
  galv: GALV.ms,
  mmc: MMC.ms,
  insul: INS.ms,
  vib: VIB.ms,
  loose: LOOSE.ms,
  shell: SHELL.ms,
  recov: REC.ms,
};
const FILES = {
  cylinder: 'CylinderSplit',
  pcg: 'PcgGrowth',
  hbake: 'HydrogenBake',
  lbb: 'LeakOrBurst',
  bolt: 'BoltPreload',
  oring: 'ORingSqueeze',
  galv: 'GalvanicJoint',
  mmc: 'MmcBonus',
  insul: 'InsulSoak',
  vib: 'VibSweep',
  loose: 'LooseNut',
  shell: 'ShellBuckle',
  recov: 'SealRecovery',
};
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
    // a key is written out, or made by a template such as data-k={`ha${i}`} or data-k={`hsg${pn.key}`}
    const prefixes = [...src.matchAll(/data-k=\{`([a-zA-Z]+)\$\{/g)].map((m) => m[1]);
    for (const k of Object.keys(fn(ms.map(() => 1)))) {
      const templated = prefixes.some((pre) => k.startsWith(pre) && /^[A-Z0-9]+$/.test(k.slice(pre.length)));
      const keyed = src.includes(`data-k="${k}"`) || (src.includes('data-k={pn.n}') && /^n[AB]$/.test(k));
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

test('bolted joint: only the load factor share of the load gets to the bolt, until the joint opens', () => {
  const { phi, p1, psep } = BOLT;
  assert.ok(Math.abs(psep - 1.25) < 1e-12);
  const w = boltForces(1, p1);
  assert.ok(Math.abs(w.fb - (1 + phi * p1)) < 1e-12 && Math.abs(w.fc - (1 - (1 - phi) * p1)) < 1e-12 && !w.open);
  // while the joint is closed, the bolt force and the clamp force differ by the load
  assert.ok(Math.abs(w.fb - w.fc - p1) < 1e-12);
  const o = boltForces(1, 1.5);
  assert.deepEqual([o.fb, o.fc, o.open], [1.5, 0, true]);
  // during the load cycles the bolt force changes by phi P1 only, and the clamp force by (1 - phi) P1
  const fb: number[] = [];
  const fc: number[] = [];
  for (let u = 0; u <= 1.0001; u += 0.01) {
    const { s, P } = boltLoad([1, 1, u, 0]);
    const f = boltForces(s, P);
    fb.push(f.fb);
    fc.push(f.fc);
  }
  assert.ok(Math.abs(Math.max(...fb) - Math.min(...fb) - phi * p1) < 1e-3);
  assert.ok(Math.abs(Math.max(...fc) - Math.min(...fc) - (1 - phi) * p1) < 1e-3);
  const end = bolt([1, 1, 1, 1]);
  assert.equal(end.stat.text, 'Joint open');
  assert.equal(end.fcLab.text, 'CLAMP FORCE Fc = 0.00 Fi');
  assert.equal(end.fbLab.text, 'BOLT FORCE Fb = 1.50 Fi');
  assert.equal(num(end.sepLab.opacity), 1);
  const work = bolt([1, 1, 0, 0]);
  assert.equal(work.fbLab.text, 'BOLT FORCE Fb = 1.16 Fi');
  assert.equal(num(work.sepLab.opacity), 0);
});

test('O-ring: the rubber keeps its volume, stays in its groove, and only ring A extrudes', () => {
  assert.ok(Math.abs(gamma(0.5) ** 2 - Math.PI) < 1e-9 && Math.abs(gamma(5) - 24) < 1e-9);
  assert.ok(Math.abs(kappa(2) - Math.PI / 2) < 1e-9);
  const area = Math.PI * OR.r ** 2;
  const total = ends(OR.ms)[OR.ms.length - 1];
  for (let t = 0; t <= total; t += total / 61) {
    const { yb, push } = oringLoad(progress(OR.ms, t));
    const sh = oringShape(yb, push);
    assert.ok(Math.abs(polyArea(sh.pts) / area - 1) < 0.01, `area at ${t}`);
    for (const [x, y] of sh.pts) {
      assert.ok(x >= OR.left - 0.01 && x <= OR.wall + 0.01, `x ${x} at ${t}`);
      assert.ok(y >= Math.min(yb, OR.bottom - 2 * OR.r) - 0.01 && y <= OR.bottom + 0.01, `y ${y} at ${t}`);
    }
  }
  const closed = oringShape(oringLoad([1, 0, 0, 0]).yb, 0);
  assert.ok(Math.abs(closed.squeeze - 0.2) < 1e-9, 'a squeeze of 20 % after assembly');
  const end = oring([1, 1, 1, 1]);
  assert.equal(num(end.flake0.opacity), 1);
  assert.equal(num(end.flake1.opacity), 1);
  assert.equal(end.statA.text, 'Nibbled: it will leak');
  assert.equal(end.statB.text, 'Sealed');
  assert.ok(num(end.csA.width) > num(end.prA.width), 'the contact stress stays above the pressure');
  const half = oring([1, 1, 0, 0]);
  assert.equal(half.tongue.d, 'M0,0 Z', 'no extrusion at half pressure');
  assert.equal(num(half.flake0.opacity), 0);
});

test('galvanic cell: no current when dry, four times the current with four times the wet cathode, none when sealed', () => {
  assert.equal(galvCurrent([1, 0, 0, 0]), 0);
  assert.equal(galvCurrent([1, 1, 0, 0]), 1);
  assert.equal(galvCurrent([1, 1, 1, 0]), 4);
  assert.equal(galvCurrent([1, 1, 1, 1]), 0);
  // the loss only grows, and it stops when the joint is sealed
  const total = ends(GALV.ms)[GALV.ms.length - 1];
  let last = -1;
  for (let t = 0; t <= total; t += total / 200) {
    const q = galvCharge(progress(GALV.ms, t));
    assert.ok(q >= last - 1e-9, `loss decreased at ${t}`);
    last = q;
  }
  assert.ok(Math.abs(galvCharge([1, 1, 1, 0.6]) - galvCharge([1, 1, 1, 1])) < 1e-9);
  assert.ok(Math.abs(galvCharge([1, 1, 1, 1]) - GALV.qmax) < 1e-9);
  const dry = galv([1, 0, 0, 0]);
  assert.equal(num(dry.curBar.width), 0);
  assert.equal(num(dry.film.opacity), 0);
  assert.equal(num(dry.e0.opacity), 0);
  const end = galv([1, 1, 1, 1]);
  assert.equal(end.stat.text, 'Sealed: no current');
  assert.equal(num(end.curBar.width), 0);
  assert.equal(num(end.lossBar.width), 220);
});

test('MMC: the zone with its bonus and the gauge pin at the virtual condition give the same answer', () => {
  const total = ends(MMC.ms)[MMC.ms.length - 1];
  for (let t = 0; t <= total; t += total / 157) {
    const a = mmcAt(progress(MMC.ms, t));
    // the pin of diameter VC fits when the axis offset is not more than (d - VC) / 2
    const pinFits = a.e <= (a.d - MMC.vc) / 2 + 1e-9;
    assert.equal(a.ok, pinFits, `at ${t}`);
    assert.ok(Math.abs(a.allowed - (MMC.t + a.d - MMC.mmc)) < 1e-12);
  }
  const end = mmc([1, 1, 1, 1]);
  assert.equal(end.verdict.text, 'CONFORMS');
  assert.equal(end.holeLab.text, 'hole ⌀11.15');
  assert.equal(end.readout.text, 'bonus 0.15  ·  axis ⌀0.553');
  assert.equal(mmc([1, 1, 1, 0]).verdict.text, 'REJECT', 'the same error in a hole at MMC');
  const lmc = mmcAt([1, 1, 0, 0]);
  assert.ok(Math.abs(lmc.d - 11.2) < 1e-12 && Math.abs(lmc.allowed - 0.7) < 1e-12);
});

test('insulation: the bondline is cool at burnout and peaks long after it, below the limit', () => {
  const m = insulModel();
  const atBurnout = insulAt(INS.tb).bond;
  assert.ok(atBurnout < 0.1 * m.peak.th, `${atBurnout} vs ${m.peak.th}`);
  assert.ok(m.peak.t > 3 * INS.tb, `peak at ${m.peak.t}`);
  assert.ok(m.peak.th < insulLimit());
  // soak-back moves the char front a little deeper, and the char never gets to the bondline
  const c1 = charDepth(insulAt(INS.tb).mx);
  const c2 = charDepth(insulAt(INS.tEnd).mx);
  assert.ok(c2 > c1 && c2 < 0.6, `${c1} ${c2}`);
  // the char front is behind the eroded surface
  assert.ok(c1 > INS.v * INS.tb);
  const end = insul([1, 1, 1, 1]);
  assert.equal(num(end.peak.opacity), 1);
  assert.equal(num(end.flame.opacity), 0);
  assert.equal(num(insul([1, 0, 0, 0]).flame.opacity), 1);
});

test('sine sweep: Q at the natural frequency, one at root two, and less isolation with more damping', () => {
  assert.ok(Math.abs(transmissibility(1, 0.05) - 10) < 0.1);
  assert.ok(Math.abs(transmissibility(Math.SQRT2, 0.05) - 1) < 1e-12);
  assert.ok(Math.abs(transmissibility(Math.SQRT2, 1 / 6) - 1) < 1e-12);
  assert.ok(transmissibility(3, 1 / 6) > transmissibility(3, 0.05));
  assert.ok(Math.abs(transmissibility(0.1, 0.05) - 1) < 0.02);
  const atFn = vibAt([1, 1, 0, 0]);
  assert.equal(atFn.r, 1);
  assert.equal(vib([1, 1, 0, 0]).tLab.text, 'response ÷ input = 10.0');
  const end = vib([1, 1, 1, 1]);
  assert.equal(end.stat.text, 'Q = 3: lower and wider');
  assert.equal(num(end.curveB.opacity), 1);
  assert.equal(num(end.q3.opacity), 1);
  assert.equal(num(vib([1, 0, 0, 0]).curveB.opacity), 0);
});

test('loosening: nothing turns below the slip load, the loss accelerates above it, a dowel keeps the preload', () => {
  assert.equal(preloadLeft(0), 1);
  assert.equal(preloadLeft(LOOSE.start), 1);
  assert.ok(Math.abs(preloadLeft(LOOSE.nMax) - 0.08) < 1e-9);
  // equal steps in cycles lose more and more preload
  const steps = [0.2, 0.45, 0.7, 0.95, 1.2].map(preloadLeft);
  const losses = steps.slice(1).map((x, i) => steps[i] - x);
  for (let i = 1; i < losses.length; i++) assert.ok(losses[i] > losses[i - 1]);
  const below = looseAt([1, 0, 0, 0]);
  assert.equal(below.x, 1);
  assert.equal(below.theta, 0);
  // the slip grows as the preload falls
  assert.ok(looseAt([1, 1, 0.5, 0]).amp > looseAt([1, 0.2, 0, 0]).amp);
  const run = loose([1, 1, 1, 0]);
  assert.equal(run.fLab.text, 'preload 8 %');
  assert.equal(run.tLab.text, `nut turned back ${Math.round(0.92 * LOOSE.theta)}°`);
  const end = loose([1, 1, 1, 1]);
  assert.equal(end.fLab.text, 'preload 100 %');
  assert.equal(num(end.dowel.opacity), 1);
});

test('shell buckling: the perfect shell gets to the classical load, a dented one collapses above the knockdown', () => {
  // the SP-8007 table on the page
  assert.equal(knockdown(50).toFixed(2), '0.68');
  assert.equal(knockdown(100).toFixed(2), '0.58');
  assert.equal(knockdown(300).toFixed(2), '0.40');
  assert.equal(knockdown(1000).toFixed(2), '0.22');
  const top = shellAt([1, 0, 0, 0]);
  assert.ok(Math.abs(top.q - 1) < 1e-9 && !top.buckled);
  assert.ok(shellAt([1, 1, 0, 0]).buckled && shellAt([1, 1, 0, 0]).q < 0.4);
  // the dented shell peaks at SHELL.peak, below the classical load and above the knockdown, like the tests
  let peak = 0;
  for (let u = 0; u <= 1.0001; u += 0.01) peak = Math.max(peak, shellAt([1, 1, u, 0]).q);
  assert.ok(Math.abs(peak - SHELL.peak) < 0.01 && peak < 1 && peak > SHELL.gamma);
  for (const q of SHELL.tests) assert.ok(q > SHELL.gamma && q < 1);
  const end = shell([1, 1, 1, 1]);
  assert.equal(num(end.kd.opacity), 1);
  assert.equal(num(end.dent.opacity), 1);
});

test('seal recovery: the worked-example points, and only the cold seal leaves a gap', () => {
  assert.ok(Math.abs(recovery(0.1, REC.tauWarm) - 0.632) < 0.001);
  assert.ok(Math.abs(recovery(0.1, REC.tauCold) - 0.064) < 0.0005);
  assert.ok(Math.abs(REC.tauCold / REC.tauWarm - 32000) < 1e-6);
  assert.ok(recoveryTime(0.5, REC.tauWarm) < 0.05);
  assert.ok(recoveryTime(0.5, REC.tauCold) > 600);
  const total = ends(REC.ms)[REC.ms.length - 1];
  for (let t = 0; t <= total; t += total / 131) {
    const s = recov(progress(REC.ms, t));
    // a seal is never higher than the gap (the attributes are rounded to 0.01)
    const { gap } = recAt(progress(REC.ms, t));
    for (const k of ['W', 'C']) assert.ok(num(s[`seal${k}`].height) <= gap + 0.006);
  }
  const lag = recov([1, 1, 1, 0]);
  assert.equal(lag.stW.text, 'sealing');
  assert.equal(lag.stC.text, 'gap: gas gets past');
  assert.equal(num(lag.gasC.opacity), 1);
  assert.equal(num(lag.gasW.opacity), 0);
  const end = recov([1, 1, 1, 1]);
  assert.equal(num(end.mkC.opacity), 1);
});
