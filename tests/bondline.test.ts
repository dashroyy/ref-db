import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webCompliance, freeAxialStrain, axialModulus, grainEnd, axialLoad, bondMargin } from '../src/lib/bondline.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const GRAIN = { a: 50, b: 150, L: 980, E: 3.6, alphaP: 100e-6, alphaC: 12.3e-6, dT: -100, h: 3, Gb: 1.5 };

test('web compliance: the closed form against a direct integration through the web', () => {
  const a = 50, b = 150, G = 1.2, q = 1, N = 20000, dr = (b - a) / N;
  // w(r) relative to the bond: the integral of τ/G from r out to b, with τ = q(r² − a²)/(2r)
  const w: number[] = new Array(N + 1).fill(0);
  for (let i = N - 1; i >= 0; i--) {
    const rm = a + (i + 0.5) * dr;
    w[i] = w[i + 1] + ((q * (rm * rm - a * a)) / (2 * rm) / G) * dr;
  }
  let num = 0;
  for (let i = 0; i < N; i++) { const rm = a + (i + 0.5) * dr; num += ((w[i] + w[i + 1]) / 2) * 2 * Math.PI * rm * dr; }
  const avg = num / (Math.PI * (b * b - a * a)), tauB = (q * (b * b - a * a)) / (2 * b);
  close(webCompliance(a, b, G) / (avg / tauB), 1, 1e-6);
});

test('free axial strain and axial modulus: the closed forms against the energy of the displacement field', () => {
  // incompressible annulus, held at r = b by the case (which moves α_c·ΔT·b), free bore; strain energy G·Σe² per volume
  const a = 50, b = 150, G = 1.2, aP = 100e-6, aC = 12.3e-6, dT = -100, m = b / a, A = Math.PI * (b * b - a * a);
  const U = (ez: number) => {
    const Ar = (3 * aP * dT - ez) / 2, C = b * b * (aC * dT - Ar);
    let s = 0; const N = 4000, dr = (b - a) / N;
    for (let i = 0; i < N; i++) {
      const r = a + (i + 0.5) * dr, er = Ar - C / (r * r) - aP * dT, et = Ar + C / (r * r) - aP * dT, e = ez - aP * dT;
      s += G * (er * er + et * et + e * e) * 2 * Math.PI * r * dr;
    }
    return s;
  };
  // U is quadratic in the axial strain: its minimum and curvature from three points
  const h = 1e-3, x0 = aC * dT, u0 = U(x0 - h), u1 = U(x0), u2 = U(x0 + h);
  const curv = (u0 - 2 * u1 + u2) / (h * h), xMin = x0 - (h * (u2 - u0)) / (2 * (u0 - 2 * u1 + u2));
  close((xMin - aC * dT) / freeAxialStrain(m, aP - aC, dT), 1, 1e-4, 'the free axial strain relative to the case');
  close(curv / (axialModulus(3 * G, m) * A), 1, 1e-4, 'the axial stiffness E(1 + m²/3)·A');
  // a thin layer on a rigid case, free on its inner face, takes 1.5·Δα·ΔT
  close(freeAxialStrain(1 + 1e-9, 1e-4, -100), 1.5 * 1e-4 * -100, 1e-9);
});

test('the grain end: the closed form against a numerical solution of the shear-lag equation', () => {
  const g = grainEnd({ ...GRAIN, L: 300 });
  // u'' = λ²u on [0, L/2], u(0) = 0, u'(L/2) = |ε|: shoot on the slope at the middle
  const solve = (s0: number) => {
    let u = 0, v = s0; const N = 30000, dx = 150 / N;
    for (let i = 0; i < N; i++) { const k1u = v, k1v = g.lambda ** 2 * u; const um = u + 0.5 * dx * k1u, vm = v + 0.5 * dx * k1v; u += dx * vm; v += dx * g.lambda ** 2 * um; }
    return { u, v };
  };
  const one = solve(1);
  const slope0 = Math.abs(g.eps) / one.v; // linear in the starting slope
  close(solve(slope0).u, g.uEnd, 1e-6, 'end movement');
  close(g.tauEnd, g.uEnd / g.c, 1e-12);
  // limits: a short grain moves by its free shrinkage; along the bond the shear falls to zero in the middle
  const short = grainEnd({ ...GRAIN, L: 2 });
  close(short.uEnd, Math.abs(short.eps) * 1, 1e-6);
  close(grainEnd(GRAIN).at(490).tau, 0, 1e-12);
});

test('the 300 mm grain: hand values', () => {
  const g = grainEnd(GRAIN);
  close(g.sigmaR, 3.6 * 8 * 87.7e-6 * 100, 1e-12, 'the radial tension of the grain page: 0.25 MPa');
  close(g.eps, (3 * 87.7e-6 * -100 * 10) / 12, 1e-12, 'm = 3: 2.5 times the free bar');
  close(g.Eeff, 14.4, 1e-12);
  close(g.cBond, 2, 1e-12);
  close(g.len, 162.7, 0.1); close(g.uEnd, 3.551, 1e-3); close(g.tauEnd, 0.1287, 1e-4);
  assert.ok(g.webShare > 0.9, 'the web, not the bond layer, sets the compliance');
});

test('acceleration and slump: equilibrium and the displacement through the web', () => {
  const a = 50, b = 150, s = axialLoad(a, b, 1800, 15, 1.2);
  close(s.tau * 2 * Math.PI * b, s.q * Math.PI * (b * b - a * a), 1e-9, 'the bond carries the weight of the web');
  close(s.tau, 15 * s.perG, 1e-15);
  // slump: the integral of τ(r)/G from the bore to the bond
  let w = 0; const N = 20000, dr = (b - a) / N;
  for (let i = 0; i < N; i++) { const r = a + (i + 0.5) * dr; w += ((s.q * (r * r - a * a)) / (2 * r) / 1.2) * dr; }
  close(s.slump, w, 1e-9);
  close(axialLoad(a, b, 1800, 1, 1.2).slump, 0.0533, 1e-4, 'the 300 mm grain hardly slumps');
  close(axialLoad(500, 1850, 1800, 1, 1.2).slump, 9.26, 0.01, 'a 3.7 m grain slumps 9 mm');
});

test('bond margin', () => {
  close(bondMargin(0.25, 1, 0.6, 1.5), 0.6 / 0.375 - 1, 1e-12);
  assert.ok(bondMargin(0.25, 3, 0.6, 1.5) < 0, 'the same stress at a termination three times higher fails');
});
