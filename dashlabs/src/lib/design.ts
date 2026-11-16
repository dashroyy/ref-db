// Design-for-printing checks: common rules of thumb for FDM printing with a
// 0.4 mm nozzle. They are starting points, not guarantees; printers, materials
// and settings shift every one of them. Pure; tested in tests/guides.test.ts.

export type Verdict = 'good' | 'care' | 'problem';
export interface Check {
  id: 'overhang' | 'bridge' | 'wall' | 'clearance';
  verdict: Verdict;
  title: string;
  note: string;
}

export interface PartInput {
  overhangDeg: number; // angle from vertical: 0 = straight wall, 90 = flat ceiling
  bridgeMm: number; // longest unsupported span between two supports
  wallMm: number; // thinnest wall
  clearanceMm: number; // gap between parts that must move or fit together
}

export const DEFAULT_PART: PartInput = { overhangDeg: 45, bridgeMm: 20, wallMm: 1.2, clearanceMm: 0.3 };

/** Overhangs: up to 45° prints cleanly, 45–60° gets rough underneath, beyond that needs supports. */
export const overhang = (deg: number): Verdict => (deg <= 45 ? 'good' : deg <= 60 ? 'care' : 'problem');
/** Bridges: short spans print in mid-air; long ones sag. */
export const bridge = (mm: number): Verdict => (mm <= 30 ? 'good' : mm <= 60 ? 'care' : 'problem');
/** Walls: two passes of a 0.4 mm nozzle is the practical minimum; three is sturdy. */
export const wall = (mm: number): Verdict => (mm >= 1.2 ? 'good' : mm >= 0.8 ? 'care' : 'problem');
/** Clearance between mating parts: too tight fuses, too loose rattles. */
export const clearance = (mm: number): Verdict => (mm < 0.15 ? 'problem' : mm < 0.25 ? 'care' : mm <= 0.5 ? 'good' : 'care');

export function checkPart(p: PartInput): Check[] {
  const o = overhang(p.overhangDeg), b = bridge(p.bridgeMm), w = wall(p.wallMm), c = clearance(p.clearanceMm);
  return [
    {
      id: 'overhang',
      verdict: o,
      title: `Overhang ${p.overhangDeg}°`,
      note: o === 'good' ? 'Each layer rests on the one below. Prints cleanly.' : o === 'care' ? 'Printable, but the underside will be rough.' : 'Needs supports underneath, which leave marks. Can the part be turned or split?',
    },
    {
      id: 'bridge',
      verdict: b,
      title: `Bridge ${p.bridgeMm} mm`,
      note: b === 'good' ? 'Short enough to print straight across the gap.' : b === 'care' ? 'It will sag a little in the middle.' : 'Too long to span. Add a support or an arch.',
    },
    {
      id: 'wall',
      verdict: w,
      title: `Wall ${p.wallMm.toFixed(1)} mm`,
      note: w === 'good' ? 'Three nozzle passes or more. Sturdy.' : w === 'care' ? 'Two nozzle passes. Fine for decoration, fragile under load.' : 'Thinner than two nozzle passes. It may not print at all.',
    },
    {
      id: 'clearance',
      verdict: c,
      title: `Clearance ${p.clearanceMm.toFixed(2)} mm`,
      note: p.clearanceMm < 0.15 ? 'The parts will fuse together.' : p.clearanceMm < 0.25 ? 'A tight press fit. May need sanding.' : p.clearanceMm <= 0.5 ? 'Slides together and moves freely.' : 'Loose. It will rattle.',
    },
  ];
}

/** Overall: the worst single verdict. */
export const overall = (checks: Check[]): Verdict =>
  checks.some((c) => c.verdict === 'problem') ? 'problem' : checks.some((c) => c.verdict === 'care') ? 'care' : 'good';
