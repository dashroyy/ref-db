import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodicConduction, penetration, boreStrainCoefficients, boreCycles, yearDamage, eventDamage, residualStrength,
  omegaOf, DAY, YEAR, cabs, carg,
} from '../src/lib/thermalcycles.ts';
import { thermalBoreStrain } from '../src/lib/grain.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const ALPHA_P = 0.45 / (1770 * 1250), ALPHA_I = 0.25 / (1100 * 2000);
const SEC = { a: 0.05, b: 0.15, kP: 0.45, alphaP: ALPHA_P, tI: 0.002, kI: 0.25, alphaI: ALPHA_I }; // the 300 mm grain

test('periodic conduction: the slow limit, and the thick slab', () => {
  close(cabs(periodicConduction(SEC, 1e-14).mean), 1, 1e-9, 'a very slow cycle reaches all of the grain');
  // a thin shell of large radius is a slab: at one penetration depth the amplitude is e^−1 and the lag one radian
  const pc = periodicConduction({ a: 9, b: 10, kP: 0.45, alphaP: ALPHA_P, tI: 0, kI: 1, alphaI: 1 }, omegaOf(DAY), 4000, 0);
  const d = penetration(ALPHA_P, omegaOf(DAY)), i = pc.r.reduce((bi, r, j) => (Math.abs(r - (10 - d)) < Math.abs(pc.r[bi] - (10 - d)) ? j : bi), 0);
  close(cabs(pc.theta[i]), Math.exp(-1), 0.002); close(carg(pc.theta[i]), -1, 0.005);
  close(penetration(ALPHA_P, omegaOf(DAY)), 0.0748, 0.0005, '75 mm in a day');
  close(penetration(ALPHA_P, omegaOf(YEAR)), 1.43, 0.01, '1.4 m in a year');
});

test('the bore strain per kelvin is the cool-down strain of the grain page', () => {
  const { P, Cc } = boreStrainCoefficients(3, 100e-6, 12.3e-6);
  const g = thermalBoreStrain({ boreD: 100, od: 300, alphaP: 100e-6, alphaC: 12.3e-6, dT: -100, eRelaxed: 3.6, bulkK: 3500, pressure: 0, caseE: 205000, caseNu: 0.29, caseT: 1.377, kt: 1 });
  close((P - Cc) * 100, g, 1e-12);
  close(P - Cc, 0.00104, 0.000005);
});

test('the strain cycles at the bore: a small grain feels the day, a large one the season', () => {
  const small = boreCycles(SEC, 100e-6, 12.3e-6, 60, { Tmean: 15, As: 10, Ad: 6 });
  close(small.mean, 0.00104 * 45, 0.0002); close(small.season.gain, 1, 0.002); close(small.day.gain, 0.715, 0.005);
  close((small.day.lag * 24) / (2 * Math.PI), 2.7, 0.1, 'hours behind the air');
  const large = boreCycles({ ...SEC, a: 0.5, b: 1.5, tI: 0.006 }, 100e-6, 12.3e-6, 60, { Tmean: 15, As: 10, Ad: 6 });
  assert.ok(large.day.gain < 0.2 && large.season.gain > 0.95, 'a 3 m grain filters the day, not the season');
  // a cycle too fast for the propellant still moves the case: the gain tends to the case term
  const { P, Cc } = boreStrainCoefficients(3, 100e-6, 12.3e-6);
  const fast = boreCycles(SEC, 100e-6, 12.3e-6, 60, { Tmean: 15, As: 0, Ad: 1 });
  assert.ok(fast.day.gain > Cc / (P - Cc), 'the propellant still follows a little in a day');
});

test("Miner's rule over a year, events, and the strength that is left", () => {
  const flat = yearDamage(0.06, 0, 0.01, 0.25, 8);
  close(flat.D, 365 * (0.07 / 0.25) ** 8, 1e-15, 'no seasonal cycle: 365 equal days');
  const wavy = yearDamage(0.06, 0.015, 0.01, 0.25, 8);
  assert.ok(wavy.D > flat.D, 'the cold season adds more than the warm season takes away');
  close(eventDamage(20, 0.104, 0.25, 8), 20 * (0.104 / 0.25) ** 8, 1e-15);
  close(residualStrength(0.5, 8), 0.5 ** (1 / 8), 1e-15); assert.equal(residualStrength(1.2, 8), 0);
});

test('the worked example: the 300 mm grain in a cold depot', () => {
  const bc = boreCycles(SEC, 100e-6, 12.3e-6, 60, { Tmean: -5, As: 15, Ad: 8 });
  close(bc.mean, 0.0676, 0.0002); close(bc.epsS, 0.0156, 0.0001); close(bc.epsD, 0.00595, 0.00005); close(bc.peak, 0.0892, 0.0002);
  const yd = yearDamage(bc.mean, bc.epsS, bc.epsD, 0.25, 8);
  close(yd.D, 0.0345, 0.0005);
  const temperate = boreCycles(SEC, 100e-6, 12.3e-6, 60, { Tmean: 15, As: 10, Ad: 6 });
  const ydT = yearDamage(temperate.mean, temperate.epsS, temperate.epsD, 0.25, 8);
  assert.ok(yd.D / ydT.D > 10, 'the cold depot does more than ten times the damage');
});
