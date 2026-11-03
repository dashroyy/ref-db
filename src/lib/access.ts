// Envelope and access: the space a fastener needs to be fitted, tightened and inspected, not only the space it
// occupies. Head sizes of ISO metric hex bolts and socket-head cap screws, the outside diameter of the socket, the
// distance to a wall and the pitch to the next fastener, the hand force and swing of a wrench, the straight path to
// insert a bolt, and how a gap changes with temperature. Units: mm, N, N·m, °C.

export type Head = 'hex' | 'shcs';

/** ISO 4014/4017 hex bolts and ISO 4032 nuts (across flats s, head height k); ISO 4762 socket-head cap screws
 * (head ⌀ dk, key s, k = d) with the DIN 974-1 counterbore. Nominal values. */
export const HEADS: Record<number, { hexAF: number; hexK: number; shcsDk: number; shcsKey: number; cbore: number }> = {
  3: { hexAF: 5.5, hexK: 2, shcsDk: 5.5, shcsKey: 2.5, cbore: 6.5 },
  4: { hexAF: 7, hexK: 2.8, shcsDk: 7, shcsKey: 3, cbore: 8 },
  5: { hexAF: 8, hexK: 3.5, shcsDk: 8.5, shcsKey: 4, cbore: 10 },
  6: { hexAF: 10, hexK: 4, shcsDk: 10, shcsKey: 5, cbore: 11 },
  8: { hexAF: 13, hexK: 5.3, shcsDk: 13, shcsKey: 6, cbore: 15 },
  10: { hexAF: 16, hexK: 6.4, shcsDk: 16, shcsKey: 8, cbore: 18 },
  12: { hexAF: 18, hexK: 7.5, shcsDk: 18, shcsKey: 10, cbore: 20 },
  14: { hexAF: 21, hexK: 8.8, shcsDk: 21, shcsKey: 12, cbore: 24 },
  16: { hexAF: 24, hexK: 10, shcsDk: 24, shcsKey: 14, cbore: 26 },
  20: { hexAF: 30, hexK: 12.5, shcsDk: 30, shcsKey: 17, cbore: 33 },
  24: { hexAF: 36, hexK: 15, shcsDk: 36, shcsKey: 19, cbore: 40 },
};
export const HEAD_SIZES = Object.keys(HEADS).map(Number);

/** Across-corners of a hexagon. */
export const corners = (af: number) => af / Math.cos(Math.PI / 6);

/**
 * Typical outside diameter of a standard 6-point socket: the across-corners of the hexagon plus two walls of about
 * 0.12·s + 1 mm. Real sockets differ by maker and drive size: measure the one you will use.
 */
export const socketOd = (af: number) => corners(af) + 2 * (0.12 * af + 1);

/** The radius that the head itself occupies: corners of a hex, or the head of a cap screw. */
export const headRadius = (d: number, head: Head) => (head === 'hex' ? corners(HEADS[d].hexAF) / 2 : HEADS[d].shcsDk / 2);

/** Minimum distance from the fastener axis to a wall, for the tool (socket radius) or the head, plus a clearance. */
export const minWall = (toolOd: number, c: number) => toolOd / 2 + c;

/** Minimum pitch to the next fastener: the tool on one fastener must clear the head of its neighbour. */
export const minPitch = (toolOd: number, neighbourR: number, c: number) => toolOd / 2 + neighbourR + c;

/** How many fasteners fit on a circle of diameter D at a minimum pitch (chord). */
export const maxOnCircle = (D: number, pitch: number) => Math.floor(Math.PI / Math.asin(Math.min(1, pitch / D)));

/** Chord pitch of n equally spaced fasteners on a circle of diameter D. */
export const pitchOnCircle = (D: number, n: number) => D * Math.sin(Math.PI / n);

/** Hand force (N) to apply a torque T (N·m) with a wrench of effective length L (mm). */
export const handForce = (T: number, L: number) => (T * 1000) / L;

/** Arc swept by the hand (mm) for a swing angle (degrees) at radius L. */
export const swingArc = (L: number, deg: number) => (L * deg * Math.PI) / 180;

/** Smallest swing of a ratchet with n teeth, degrees; a hexagon needs 60° (30° if the spanner can be flipped). */
export const ratchetSwing = (teeth: number) => 360 / teeth;

/** Straight approach length needed to insert a bolt: shank length plus head height plus a clearance. */
export const insertion = (length: number, headHeight: number, c: number) => length + headHeight + c;

/**
 * Gap between a part (length L1, expansion α1) inside a housing (length L2, α2) at a temperature change ΔT from the
 * assembly temperature: g = g0 + (α2·L2 − α1·L1)·ΔT. Negative means the parts touch.
 */
export const thermalGap = (g0: number, L1: number, a1: number, L2: number, a2: number, dT: number) => g0 + (a2 * L2 - a1 * L1) * dT;
