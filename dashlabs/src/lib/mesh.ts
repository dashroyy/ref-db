// Mesh measurements for uploaded STL files. Pure; tested in tests/mesh.test.ts.
//
// Input is a flat list of triangle vertices [x1,y1,z1, x2,y2,z2, x3,y3,z3, ...]
// in millimetres (STL's usual unit). Volume uses the divergence theorem: the sum
// of signed tetrahedra from the origin to each triangle. It is exact for a
// closed (watertight) mesh, whatever its shape; an open mesh gives a wrong
// number, so `closed` reports whether the volume can be trusted.

export interface MeshStats {
  triangles: number;
  volumeMm3: number;
  areaMm2: number;
  size: { x: number; y: number; z: number }; // bounding box, mm
  closed: boolean; // every edge shared by exactly two triangles
}

export function meshStats(p: ArrayLike<number>): MeshStats {
  const n = Math.floor(p.length / 9);
  let vol = 0;
  let area = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const edges = new Map<string, number>();
  const key = (i: number) => `${p[i].toFixed(4)},${p[i + 1].toFixed(4)},${p[i + 2].toFixed(4)}`;
  const checkEdges = n <= 400_000; // skip the watertight check on huge files

  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const ax = p[o], ay = p[o + 1], az = p[o + 2];
    const bx = p[o + 3], by = p[o + 4], bz = p[o + 5];
    const cx = p[o + 6], cy = p[o + 7], cz = p[o + 8];
    // signed volume of the tetrahedron (origin, a, b, c)
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    // triangle area = |(b − a) × (c − a)| / 2
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    minX = Math.min(minX, ax, bx, cx);
    minY = Math.min(minY, ay, by, cy);
    minZ = Math.min(minZ, az, bz, cz);
    maxX = Math.max(maxX, ax, bx, cx);
    maxY = Math.max(maxY, ay, by, cy);
    maxZ = Math.max(maxZ, az, bz, cz);
    if (checkEdges) {
      const v = [key(o), key(o + 3), key(o + 6)];
      for (let e = 0; e < 3; e++) {
        const a = v[e], b = v[(e + 1) % 3];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    }
  }
  const closed = n > 0 && (!checkEdges || [...edges.values()].every((c) => c === 2));
  return {
    triangles: n,
    volumeMm3: Math.abs(vol),
    areaMm2: area,
    size: n ? { x: maxX - minX, y: maxY - minY, z: maxZ - minZ } : { x: 0, y: 0, z: 0 },
    closed,
  };
}

/** Does it fit the build volume (mm)? Checks every axis-aligned orientation. */
export function fitsBed(size: { x: number; y: number; z: number }, bed = { x: 256, y: 256, z: 256 }): boolean {
  const s = [size.x, size.y, size.z].sort((a, b) => a - b);
  const b = [bed.x, bed.y, bed.z].sort((a, b) => a - b);
  return s.every((v, i) => v <= b[i]);
}
