import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLUIDS, fluid, fluidAt, expansionRatio, boilOff, CURVES, contraction, naiveContraction, curveFor, CRYO_MATERIALS, materialContraction,
  fitShift, preloadShift, balancingSpacer, restrainedStress, KFITS, conductivity, kIntegral, heatLeak,
  SERVICE, serviceClassFor, serviceFor, screen, rating, toughness, SCREEN_MATERIALS,
} from '../src/lib/cryogenic.ts';
import { MATERIALS, material } from '../src/lib/materials.ts';
import { boltStiffness, memberStiffness } from '../src/lib/bolts.ts';
import { THREAD_DB } from '../src/lib/threaddb.ts';

const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const pct = (key: string, T: number) => contraction(key, T).value * 100;

test('the cryogens: NIST WebBook boiling points, and what they mean', () => {
  assert.deepEqual(FLUIDS.map((f) => f.sym), ['LCH4', 'LOX', 'LN2', 'LH2', 'LHe']);
  assert.equal(fluidAt(77.4)?.key, 'ln2');
  assert.equal(fluidAt(80), undefined);
  near(expansionRatio(fluid('ln2')!), 694, 5, 'LN2 to gas at 20 °C');
  near(expansionRatio(fluid('lox')!), 860, 6, 'LOX to gas');
  near(boilOff(1, fluid('ln2')!).LPerH, 0.0224, 0.0003, '1 W boils 22 mL of LN2 an hour');
  near(boilOff(1, fluid('lhe')!).LPerH, 1.40, 0.02, '1 W boils 1.4 L of LHe an hour');
});

test('integrated contraction: the NIST and NBS values', () => {
  near(pct('aus', 4), 0.300, 0.002); near(pct('aus', 77), 0.280, 0.002);
  near(pct('al', 4), 0.415, 0.002); near(pct('al', 77), 0.389, 0.002);
  near(pct('cu', 4), 0.326, 0.002); near(pct('cu', 77), 0.304, 0.003);
  near(pct('ti64', 4), 0.174, 0.002); near(pct('in718', 4), 0.239, 0.002);
  near(pct('invar', 20), 0.040, 0.001); near(pct('ptfe', 4), 2.12, 0.01);
  near(pct('brass', 0), 0.384, 1e-9); near(pct('mg', 100), 0.427, 1e-9);
  // below the data the curve is held, and says so
  assert.equal(contraction('g10w', 4).held, true); assert.equal(contraction('g10w', 20).held, false);
  assert.equal(contraction('aus', 4).held, false, 'NIST gives the flat part itself');
  for (const k of Object.keys(CURVES)) {
    assert.equal(contraction(k, 293).value, 0, k);
    let prev = Infinity;
    // falls as T rises (to 0.0003%: the NIST fits step by up to 2 × 10⁻⁶ where the flat part joins the polynomial)
    for (let T = 4; T <= 293; T++) { const v = contraction(k, T).value; assert.ok(v <= prev + 3e-6, `${k} rises at ${T} K`); prev = v; }
  }
});

test('a constant expansion coefficient over-predicts the cold', () => {
  const al = material('al-6061-t6')!;
  const naive = naiveContraction(al.alpha!, 20), real = materialContraction(al, 20)!.value;
  assert.ok(naive / real > 1.4, 'more than 40% too much at 20 K');
});

test('each library material finds its own curve or its class', () => {
  const c = (name: string) => curveFor(MATERIALS.find((m) => m.name === name)!);
  assert.deepEqual(c('Stainless 316L'), { key: 'aus', exact: true });
  assert.deepEqual(c('17-4PH (H1025)'), { key: 'fe', exact: false });
  assert.deepEqual(c('Invar 36 (FeNi36)'), { key: 'invar', exact: true });
  assert.deepEqual(c('Al-Li 2195'), { key: 'al', exact: false });
  assert.deepEqual(c('Beryllium copper C17200'), { key: 'becu', exact: true });
  assert.equal(c('Duplex 2205'), undefined, 'no curve is held for duplex');
  assert.equal(c('Kovar (FeNi29Co17)'), undefined);
  assert.ok(CRYO_MATERIALS.length > 120 && CRYO_MATERIALS.every((m) => curveFor(m)));
});

test('worked example: a LOX valve on a test stand', () => {
  const T = fluid('lox')!.K;
  const ss = material('stainless-316l')!, al = material('al-6061-t6')!, a286 = material('a286-fe-ni-cr')!;
  const cs = materialContraction(ss, T)!.value, ca = materialContraction(al, T)!.value, cb = materialContraction(a286, T)!.value;
  near(2000 * cs, 5.40, 0.02, '2 m of 316L line');
  near(restrainedStress(ss.E!, cs), 521, 3, 'held at both ends: far past yield');
  near(fitShift(40, cs, ca) * 1000, 42.5, 0.5, 'a 316L sleeve in a 6061 body tightens');
  const t = THREAD_DB.find((x) => x.key === 'M8')!;
  const kb = boltStiffness(t, a286.E!, 20, 0), km = memberStiffness(t.d, 12, 20, al.E!);
  const dF = preloadShift(20, cb, ca, kb, km);
  near(dF / 1000, -3.46, 0.05, 'A-286 bolts in an aluminium flange lose preload');
  near(balancingSpacer(20, cb, ca, contraction('invar', T).value), 9.2, 0.1, 'an Invar spacer that balances it');
  assert.ok(Number.isNaN(balancingSpacer(20, ca, cb, 0)), 'no spacer when the bolt already shrinks more');
  near(heatLeak('g10w', 100, 100, 4, T, 293), 0.528, 0.005, 'four G-10CR struts');
});

test('conductivity: the NIST fits and their integrals', () => {
  near(conductivity('ss', 300), 15.3, 0.1);
  near(conductivity('cu', 300), 396, 4, 'the rational form for OFHC copper');
  near(kIntegral('ss', 4, 293).value, 2924, 15);
  near(kIntegral('ss', 77, 293).value, 2598, 15);
  const ti = kIntegral('ti64', 4.2, 293);
  assert.equal(ti.from, 20, 'Ti-6Al-4V data start at 20 K: not extrapolated');
  for (const k of Object.keys(KFITS)) assert.ok(conductivity(k, 300) > 0 && kIntegral(k, 77, 293).value > 0, k);
  assert.ok(kIntegral('g10w', 77, 293).value < kIntegral('ti64', 77, 293).value / 5, 'G-10 is the low-heat-leak support');
});

test('the screen: toughness in the cold, oxygen and hydrogen', () => {
  const sc = (name: string, T: number) => screen(MATERIALS.find((m) => m.name === name)!, T)!;
  const ti = sc('Ti-6Al-4V (Gr 5)', 90.2);
  assert.equal(ti.s.lox, 'bad'); assert.match(ti.s.loxNote, /PROHIBITED/);
  assert.equal(sc('Stainless 316L', 4.2).tough, 'ok');
  assert.equal(sc('D6AC (AMS 6431)', 77).tough, 'bad');
  assert.equal(sc('D6AC (AMS 6431)', 219).tough, 'warn', 'a −54 °C cold soak: check the impact data');
  assert.equal(sc('9% Ni cryogenic steel', 77.4).tough, 'ok'); assert.equal(sc('9% Ni cryogenic steel', 20.3).tough, 'bad');
  assert.equal(sc('Kovar (FeNi29Co17)', 77).tough, 'warn');
  assert.equal(sc('Stainless 304L', 20).s.h2, 'warn'); assert.equal(sc('Stainless 316L', 20).s.h2, 'ok');
  assert.equal(sc('Monel 400', 90).s.gox, 'ok'); assert.equal(sc('Inconel 718', 90).s.gox, 'warn');
  assert.equal(sc('Ti-6Al-4V ELI (Gr 23)', 20.3).tough, 'ok'); assert.equal(sc('Ti-6Al-4V (Gr 5)', 20.3).tough, 'warn');
  assert.equal(SCREEN_MATERIALS.length, MATERIALS.length - 1, 'every material but the propellant');
  assert.equal(serviceClassFor(MATERIALS.find((m) => m.family === 'prop')!), undefined);
  assert.ok(serviceFor(MATERIALS.find((m) => m.name === 'Kovar (FeNi29Co17)')!)!.notes.some((n) => /F15/.test(n)));
});

test('the matrix: every class rated in every fluid, in plain text', () => {
  for (const s of SERVICE) {
    for (const f of FLUIDS) assert.ok(['ok', 'warn', 'bad'].includes(rating(s, f)), `${s.key} ${f.key}`);
    assert.ok(!/—/.test(s.name + s.cold + s.loxNote + s.goxNote + s.h2Note), `no em dash in ${s.key}`);
    assert.ok(s.okK >= s.warnK, s.key);
  }
  const lox = fluid('lox')!, lh2 = fluid('lh2')!, k = (key: string) => SERVICE.find((s) => s.key === key)!;
  for (const key of ['ti-eli', 'ti-ab', 'ti-b', 'mg']) assert.equal(rating(k(key), lox), 'bad', key);
  assert.equal(rating(k('al'), lh2), 'ok'); assert.equal(rating(k('cs'), lox), 'bad');
  assert.equal(toughness(k('aus'), 4), 'ok');
});

test('the conductivity table on the page (three significant figures)', () => {
  const sf = (v: number) => Number(v.toPrecision(3));
  const rows: [string, number, number][] = [['g10w', 137, 154], ['ptfe', 56.4, 67.9], ['ti64', 1160, 1300], ['in718', 1820, 2100], ['ss', 2600, 2910], ['al6061', 27600, 31000], ['cu', 91000, 164000]];
  for (const [k, a, b] of rows) { assert.equal(sf(kIntegral(k, 77, 293).value), a, `${k} 77 K`); assert.equal(sf(kIntegral(k, 20, 293).value), b, `${k} 20 K`); }
});

test('the contraction table on the page', () => {
  const rows: [string, number, number][] = [['aus', 0.280, 0.300], ['al', 0.389, 0.415], ['cu', 0.304, 0.325], ['in718', 0.224, 0.239], ['fe', 0.191, 0.210], ['ti64', 0.162, 0.174], ['invar', 0.040, 0.040], ['ptfe', 1.940, 2.115], ['g10w', 0.210, 0.238]];
  for (const [k, a, b] of rows) { assert.equal(pct(k, 77).toFixed(3), a.toFixed(3), `${k} 77 K`); assert.equal(pct(k, 20).toFixed(3), b.toFixed(3), `${k} 20 K`); }
});
