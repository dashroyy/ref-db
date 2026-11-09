// Pen Launcher physics: spring → launch speed → trajectory. Pure functions;
// tested in tests/launcher.test.ts. The worked example on
// /learn/pen-launcher-physics/ uses DEFAULT_LAUNCH and is asserted in the test.
//
// Model: a spring of stiffness k pulled back x stores ½kx². Only a fraction η
// (efficiency) reaches the pen as kinetic energy — the rest goes into the
// plunger's own mass, friction and vibration. The pen then flies as a
// projectile from desk height with NO air drag, so real ranges are shorter,
// especially for light pens at high speed.

export const G = 9.81; // m/s²

export interface LaunchInput {
  k: number; // spring stiffness, N/m
  drawMm: number; // pull-back distance, mm
  efficiency: number; // 0–1
  penGrams: number; // pen mass, g
  angleDeg: number; // launch angle above horizontal
  heightM: number; // launch height above the floor, m
}

export const DEFAULT_LAUNCH: LaunchInput = {
  k: 300,
  drawMm: 40,
  efficiency: 0.5,
  penGrams: 6,
  angleDeg: 35,
  heightM: 0.75,
};

export interface LaunchResult {
  springJ: number; // energy stored in the spring
  penJ: number; // kinetic energy given to the pen
  speed: number; // m/s
  flightS: number; // s
  range: number; // m, horizontal distance to the floor
  peak: number; // m, highest point above the floor
}

export function launch(i: LaunchInput): LaunchResult {
  const x = Math.max(0, i.drawMm) / 1000;
  const m = Math.max(1e-6, i.penGrams / 1000);
  const springJ = 0.5 * Math.max(0, i.k) * x * x;
  const penJ = springJ * Math.min(1, Math.max(0, i.efficiency));
  const speed = Math.sqrt((2 * penJ) / m);
  const a = (i.angleDeg * Math.PI) / 180;
  const vx = speed * Math.cos(a);
  const vy = speed * Math.sin(a);
  const h = Math.max(0, i.heightM);
  const flightS = (vy + Math.sqrt(vy * vy + 2 * G * h)) / G;
  return {
    springJ,
    penJ,
    speed,
    flightS,
    range: vx * flightS,
    peak: h + (vy > 0 ? (vy * vy) / (2 * G) : 0),
  };
}

/** Points along the flight path, for drawing. [x, y] in metres. */
export function trajectory(i: LaunchInput, steps = 40): [number, number][] {
  const r = launch(i);
  const a = (i.angleDeg * Math.PI) / 180;
  const vx = r.speed * Math.cos(a);
  const vy = r.speed * Math.sin(a);
  const pts: [number, number][] = [];
  for (let s = 0; s <= steps; s++) {
    const t = (r.flightS * s) / steps;
    pts.push([vx * t, Math.max(0, i.heightM + vy * t - 0.5 * G * t * t)]);
  }
  return pts;
}

/** The launch angle (whole degrees) that gives the longest range from this height. */
export function bestAngle(i: LaunchInput): number {
  let best = 0;
  let bestRange = -1;
  for (let deg = 0; deg <= 80; deg++) {
    const r = launch({ ...i, angleDeg: deg }).range;
    if (r > bestRange) {
      bestRange = r;
      best = deg;
    }
  }
  return best;
}
