import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIBRES, netting, geodesicAngle, angleAt, isotensoid, idealPvw, compositeCase, metalCase } from '../src/lib/composite.ts';
import { pressureBoreStrain } from '../src/lib/grain.ts';
import { MATERIALS, DEFAULTS } from '../src/lib/materials.ts';

const close = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('netting: the total fibre is 1.5·pR/σ at any angle up to 54.7°, where the hoops go to zero', () => {
  for (const a of [0, 10, 19.47, 30, 45, 54]) close(netting(12.5, 150, a, 3920).total, (3 * 12.5 * 150) / (2 * 3920), 1e-12, `α ${a}`);
  const magic = (Math.atan(Math.SQRT2) * 180) / Math.PI; // 54.7356°
  close(netting(10, 100, magic, 1000).hoop, 0, 1e-12);
  close(netting(10, 100, 0, 1000).helical, 0.5, 1e-12, 'axial fibres carry pR/2');
  assert.equal(netting(10, 100, 60, 1000).hoop, 0, 'above 54.7° the helicals carry the hoop load alone');
});

test('geodesic winding: R sin α = r0 (Clairaut), and the fibre turns at the polar opening', () => {
  close(geodesicAngle(150, 50), 19.4712, 1e-4);
  close(angleAt(1 / 3, 1 / 3), 90, 1e-9);
  close(angleAt(1, 0.5), 30, 1e-9);
});

test('isotensoid dome: closed forms for a small opening (Beta functions) and convergence', () => {
  const d = isotensoid(0);
  close(d.height, 0.59907, 2e-5, 'h/R = B(3/4,1/2)/4');
  close(d.massInt, 1.31103, 2e-5, 'the lemniscate constant / 2');
  close(d.volume, 0.43701, 2e-5, 'B(5/4,1/2)/4');
  for (const r0 of [0.1, 0.3, 0.5, 0.6]) {
    const a = isotensoid(r0, 400), b = isotensoid(r0, 4000);
    close(a.height, b.height, 1e-6); close(a.massInt, b.massInt, 1e-6); close(a.volume, b.volume, 1e-6);
    assert.ok(a.rhoC > r0 && a.rhoC < 1, 'the dome ends just outside the polar opening');
    close(a.profile.at(-1)!.z, a.height, 1e-9, 'the profile ends at the dome height');
  }
  assert.ok(isotensoid(0.5).height > isotensoid(0.2).height, 'a larger opening makes a taller dome');
});

test('every netting vessel has PV/W = σ/(3ρg): the dome integrals obey it for any opening', () => {
  for (const r0 of [0.05, 0.2, 1 / 3, 0.5, 0.65]) {
    const d = isotensoid(r0), k = 1 - r0 * r0;
    close((k * d.volume) / (Math.sqrt(k) * d.massInt), 1 / 3, 1e-6, `ρ0 ${r0}`);
  }
});

test('the 300 mm example case in T700: wall, mass, growth and PV/W', () => {
  const t700 = FIBRES.find((f) => f.key === 't700')!;
  const c = compositeCase({ idMm: 300, lengthMm: 1000, meop: 10, burstFactor: 1.25, r0Mm: 50, fibre: t700, efficiency: 0.8, vf: 0.6, boreMm: 100, bulkK: 3500 });
  close(c.alpha, 19.47, 0.01);
  close(c.wall, (3 * 12.5 * 150) / (2 * 3920 * 0.6), 1e-9);
  close(c.helical, 0.4484, 1e-4); close(c.hoop, 0.7474, 1e-4);
  close(c.rhoC, 1.56, 1e-12);
  close(c.mass, 2.009, 0.002);
  close(c.strain, 3136 / 230000, 1e-12);
  close(c.growthRadial, 2.045, 0.001); close(c.growthAxial, 13.63, 0.01);
  assert.ok(c.pvw < c.pvwIdeal && c.pvw > 0.99 * c.pvwIdeal, 'only the mean-radius wall of the cylinder separates them');
  close(idealPvw(3920, 0.6, 1.56) / 1000, 51.25, 0.01);
  close(c.boreStrain, 9 * c.strain + 4 * (c.strain + 10 / 3500), 1e-12);
});

test('the same case in D6AC matches the case-sizing example, and grows much less', () => {
  const m = MATERIALS.find((x) => x.key === DEFAULTS.caseSteel)!;
  const alloy = { uts: m.Ftu!, yield: m.Fty!, density: m.rho! / 1000, E: m.E!, nu: m.nu!, kic: m.kic };
  const s = metalCase({ idMm: 300, lengthMm: 1000, meop: 10, burstFactor: 1.25, weldEff: 0.9, boreMm: 100, bulkK: 3500 }, alloy);
  close(s.wall, 1.377, 0.001);
  close(s.mass, 11.77, 0.01);
  assert.equal(s.governs, 'burst');
  close(s.boreStrain, pressureBoreStrain({ boreD: 100, od: 300, alphaP: 0, alphaC: 0, dT: 0, eRelaxed: 1, bulkK: 3500, pressure: 10, caseE: m.E!, caseNu: m.nu!, caseT: s.wall, kt: 1 }), 1e-12);
  const t700 = FIBRES.find((f) => f.key === 't700')!;
  const c = compositeCase({ idMm: 300, lengthMm: 1000, meop: 10, burstFactor: 1.25, r0Mm: 50, fibre: t700, efficiency: 0.8, vf: 0.6, boreMm: 100, bulkK: 3500 });
  assert.ok(c.mass < 0.2 * s.mass, 'the netting shell is under a fifth of the steel one');
  assert.ok(c.boreStrain > 3 * s.boreStrain, 'and the grain bore strains more than three times as much');
});

test('fibre data are in sane ranges', () => {
  for (const f of FIBRES) {
    assert.ok(f.strength > 3000 && f.strength < 7000, f.name);
    assert.ok(f.E > 80 && f.E < 300, f.name);
    assert.ok(f.rho > 1.4 && f.rho < 2.6, f.name);
    assert.ok(f.strength / (f.E * 1000) < 0.05, `${f.name}: failure strain`);
  }
});
