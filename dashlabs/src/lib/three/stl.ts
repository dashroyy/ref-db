// STL upload: parse in the browser (the file never leaves the device), measure
// it, and turn it into a printed-plastic model for the viewer.

import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { printMaterial } from './print.ts';
import { meshStats, type MeshStats } from '../mesh.ts';

export interface LoadedPart {
  geometry: THREE.BufferGeometry; // millimetres, Z up (as in the file)
  stats: MeshStats;
}

/** Parse STL bytes (binary or ASCII) and measure the part. */
export function parseStl(data: ArrayBuffer): LoadedPart {
  const geo = new STLLoader().parse(data);
  const g = geo.index ? geo.toNonIndexed() : geo;
  return { geometry: g, stats: meshStats(g.attributes.position.array as ArrayLike<number>) };
}

/** A viewer-ready model: Y up, about 1.6 units across, centred, sitting on y = 0. */
export function partModel(part: LoadedPart, color: string): THREE.Group {
  const geo = part.geometry.clone();
  geo.rotateX(-Math.PI / 2); // STL is Z-up
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const size = box.getSize(new THREE.Vector3());
  const s = 1.6 / Math.max(size.x, size.y, size.z, 1e-6);
  geo.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeVertexNormals();
  const mat = printMaterial(color);
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/**
 * A sample part for people without an STL to hand: a twisted six-point star,
 * 64 mm across and 90 mm tall, closed so its volume is exact.
 */
export function samplePart(): LoadedPart {
  const shape = new THREE.Shape();
  const N = 12;
  for (let i = 0; i < N; i++) { // no repeated end point: Shape closes itself
    const a = (i / N) * Math.PI * 2;
    const r = i % 2 ? 24 : 32;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 90, steps: 45, bevelEnabled: false }).toNonIndexed();
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), x = p.getX(i), y = p.getY(i);
    const a = (z / 90) * (Math.PI / 3);
    p.setXY(i, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
  }
  return { geometry: geo, stats: meshStats(p.array as ArrayLike<number>) };
}
