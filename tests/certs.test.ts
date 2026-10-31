import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certRank, hrcToHv, hvToHrc, hrcToHb, hbToHrc, utsFromHrc, reviewCert, accept, rateAt, zeroAcceptN, type CertInputs } from '../src/lib/certs.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('certificate types rank 2.1 < 2.2 < 3.1 < 3.2', () => {
  assert.ok(certRank('2.1') < certRank('2.2') && certRank('2.2') < certRank('3.1') && certRank('3.1') < certRank('3.2'));
  assert.equal(certRank('CoC'), 0);
});

test('hardness conversions for steel', () => {
  assert.equal(hrcToHv(40), 392); close(hrcToHv(43), 424.4, 1e-9); close(hvToHrc(hrcToHv(47.3)), 47.3, 1e-9);
  assert.equal(hrcToHb(50), 481); close(hbToHrc(421), 45, 1e-9); assert.ok(Number.isNaN(hrcToHb(58)));
  close(utsFromHrc(45), 1472, 1); close(utsFromHrc(30), 997, 1);
});

const closure: CertInputs = {
  required: '3.1', supplied: '3.1', specDrawing: 'AMS 6431', specCert: 'AMS6431', issueDrawing: '', issueCert: '',
  condDrawing: 'Hardened and double tempered', condCert: 'hardened and double-tempered', heatPart: 'H 41872', heatCert: 'H41872',
  minUts: 1520, minYs: 1450, minEl: 8, uts: 1586, ys: 1475, el: 9, hrc: 43, steel: true, testDir: 'L', loadDir: 'ST', signed: true, source: 'distributor-with-mill',
};

test('worked example: the closure forging certificate', () => {
  const r = reviewCert(closure);
  assert.equal(r.bad, 0); assert.equal(r.verdict, 'query');
  const f = (item: string) => r.findings.find((x) => x.item === item)!;
  assert.equal(f('Hardness ÷ UTS').status, 'warn'); assert.match(f('Hardness ÷ UTS').text, /1401 MPa, 12% below/);
  assert.equal(f('Test direction').status, 'warn');
  assert.equal(f('Specification').status, 'ok', 'spaces and case do not matter');
  assert.equal(reviewCert({ ...closure, hrc: 47, testDir: 'ST' }).verdict, 'accept');
  assert.equal(reviewCert({ ...closure, heatCert: 'H41873' }).verdict, 'reject');
  assert.equal(reviewCert({ ...closure, supplied: '2.2' }).verdict, 'reject');
  assert.equal(reviewCert({ ...closure, required: null, hrc: 47, testDir: 'ST' }).verdict, 'incomplete');
  assert.equal(reviewCert({ ...closure, uts: 1500 }).findings.find((x) => x.item === 'UTS')!.status, 'bad');
  assert.equal(reviewCert({ ...closure, specDrawing: '' }).findings.find((x) => x.item === 'Specification')!.status, 'bad');
});

test('attribute sampling', () => {
  close(accept(13, 0, 0.01), 0.99 ** 13, 1e-12);
  close(accept(5, 1, 0.2), 0.8 ** 5 + 5 * 0.2 * 0.8 ** 4, 1e-12);
  close(rateAt(13, 0, 0.1), 1 - 0.1 ** (1 / 13), 1e-9, 'LTPD'); close(rateAt(13, 0, 0.95), 1 - 0.95 ** (1 / 13), 1e-9, 'AQL');
  assert.equal(zeroAcceptN(0.05, 0.95), 59); assert.equal(zeroAcceptN(0.1, 0.9), 22);
  assert.ok(accept(50, 1, 0.02) > accept(50, 0, 0.02));
});
