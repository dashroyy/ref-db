import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSI, fromSI, timeToLoseCc, decay, holdFor, accumulation, accumulateFor, convert, gas, viscousQ, molecularQ, viscousDiameter, meanFreePath } from '../src/lib/leak.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const rel = (a: number, b: number, r: number, msg?: string) => assert.ok(Math.abs(a / b - 1) <= r, `${msg ?? ''} ${a} vs ${b}`);

test('units', () => {
  close(toSI(1, 'mbarls'), 0.1, 1e-12); close(fromSI(toSI(1, 'atmccs'), 'mbarls'), 1.01325, 1e-9);
  close(fromSI(toSI(60, 'sccm'), 'atmccs'), 1, 1e-12); close(fromSI(1, 'torrls'), 7.50062, 1e-4);
  close(timeToLoseCc(toSI(1, 'mbarls')), 1, 1e-12, '1 mbar·L/s loses 1 bar·cm³ each second');
  rel(timeToLoseCc(toSI(1e-6, 'mbarls')) / 86400, 11.57, 0.001);
});

const port = { V: 12e-6, pAbs: 801325, t: 600, dp: 150, dT: 0.05, T: 293.15, resP: 20, resT: 0.02 };

test('worked example: pressure decay between the closure seals', () => {
  const d = decay(port);
  close(d.thermal, 136.7, 0.1, 'a 0.05 K fall at 8 bar'); close(d.dpLeak, 13.3, 0.1);
  rel(fromSI(d.Q, 'atmccs'), 2.63e-6, 0.01); rel(fromSI(d.Qraw, 'atmccs'), 2.96e-5, 0.01); rel(fromSI(d.dQ, 'atmccs'), 1.62e-5, 0.01);
  const allow = toSI(1e-5, 'atmccs');
  assert.ok(d.Qraw > allow && d.Q + d.dQ > allow && d.Q < allow, 'uncorrected fails, corrected is inconclusive');
  rel(holdFor(allow, port.V, d.dpUnc), 975, 0.001);
  close(decay({ ...port, dT: 0, resT: 0 }).dpUnc, 20 * Math.SQRT2, 1e-9);
});

test('worked example: helium accumulation hood', () => {
  const a = accumulation({ V: 5e-3, t: 600, dC: 0.05e-6, resC: 0.1e-6, frac: 1 });
  rel(fromSI(a.minTotal, 'atmccs'), 8.33e-7, 0.001); close(a.total, a.qHe, 0);
  close(accumulation({ V: 5e-3, t: 600, dC: 0.05e-6, resC: 0.1e-6, frac: 0.1 }).total, a.qHe * 10, 1e-18, 'a 10% helium fill: divide by the fraction');
  rel(accumulateFor(toSI(1e-5, 'atmccs'), { V: 5e-3, resC: 0.1e-6, frac: 1 }), 50, 1e-9);
});

test('tracer gas to service gas', () => {
  const allow = toSI(1e-5, 'atmccs');
  const c = convert({ q: allow, test: gas('he'), p1t: 801325, p2t: 101325, service: gas('air'), p1s: 10.101325e6, p2s: 101325, L: 3e-3 });
  rel(c.viscous / allow, 175, 0.01); rel(c.molecular / allow, 5.31, 0.01);
  rel(c.d, 1.665e-6, 0.01); assert.equal(c.regimeService, 'viscous'); assert.equal(c.regimeTest, 'transitional');
  rel(viscousQ(c.d, 3e-3, 801325, 101325, gas('he')), allow, 1e-9, 'the equivalent capillary passes the test rate');
  rel(viscousDiameter(viscousQ(2e-6, 1e-3, 3e5, 1e5, gas('n2')), 1e-3, 3e5, 1e5, gas('n2')), 2e-6, 1e-9);
  rel(molecularQ(1e-7, 1e-3, 2e5, 1e5, gas('he')) / molecularQ(1e-7, 1e-3, 2e5, 1e5, gas('ar')), Math.sqrt(39.948 / 4.0026), 1e-9, 'molecular flow scales as 1/√M');
  rel(meanFreePath(gas('he'), 101325) * 1e6, 0.189, 0.01);
});
