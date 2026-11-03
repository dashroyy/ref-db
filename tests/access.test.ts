import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEADS, corners, socketOd, headRadius, minWall, minPitch, maxOnCircle, pitchOnCircle, handForce, swingArc, ratchetSwing, insertion, thermalGap } from '../src/lib/access.ts';

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('head sizes and the socket around them', () => {
  assert.deepEqual([HEADS[10].hexAF, HEADS[10].hexK, HEADS[10].shcsDk, HEADS[10].shcsKey, HEADS[10].cbore], [16, 6.4, 16, 8, 18]);
  near(corners(16), 18.475, 0.001);
  near(socketOd(16), 24.315, 0.001); // a typical 16 mm socket is 22–24 mm across
  near(headRadius(10, 'hex'), 9.238, 0.001);
  assert.equal(headRadius(10, 'shcs'), 8);
});

test('wall, pitch and the bolt circle of the aft closure', () => {
  const od = socketOd(16);
  near(minWall(od, 1), 13.16, 0.01);
  const p = minPitch(od, headRadius(10, 'hex'), 1);
  near(p, 22.40, 0.01);
  near(pitchOnCircle(285, 30), 29.80, 0.01); // chord pitch of 30 bolts on the 285 mm circle
  assert.equal(maxOnCircle(285, p), 39);
  assert.ok(pitchOnCircle(285, maxOnCircle(285, p)) >= p && pitchOnCircle(285, maxOnCircle(285, p) + 1) < p);
});

test('wrench, insertion and thermal gap', () => {
  assert.equal(handForce(60, 250), 240);
  near(swingArc(250, 5), 21.82, 0.01);
  assert.equal(ratchetSwing(72), 5);
  assert.equal(insertion(40, 6.4, 2), 48.4);
  // aluminium part 200 mm inside a steel housing 200 mm, 0.2 mm gap at 20 °C, at +60 °C
  near(thermalGap(0.2, 200, 23.4e-6, 200, 11.7e-6, 40), 0.2 - 200 * 11.7e-6 * 40, 1e-12);
  assert.ok(thermalGap(0.2, 200, 23.4e-6, 200, 11.7e-6, 40) > 0 && thermalGap(0.05, 200, 23.4e-6, 200, 11.7e-6, 40) < 0);
});
