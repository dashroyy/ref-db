// Print price estimate: from a part's size, material, infill and quality to grams,
// print hours and a price. Pure functions; unit-tested in tests/estimate.test.ts.
// The worked example on /learn/pricing/ is the default input and is asserted there.
//
// The model, in one paragraph: the part is its bounding box times a shape factor
// (how much of the box is actually object). A print is a solid skin plus a
// partly-hollow inside, so material = skin + infill × the rest. Skin volume is
// approximated from the surface area of a cube of the same volume times the wall
// thickness. Print time is mass ÷ a throughput that depends on layer height.
// Price = filament + machine time + handling, plus margin, rounded up to $1.
//
// It is a screening estimate. Real slicer numbers can differ by ±30%.

import { materialById, type MaterialId } from '../data/materials.ts';

export const SHAPES = [
  { id: 'block', label: 'Chunky / boxy (organiser, stand)', factor: 0.6 },
  { id: 'organic', label: 'Organic (figurine, animal, bust)', factor: 0.35 },
  { id: 'thin', label: 'Thin and spindly (frames, models)', factor: 0.15 },
  { id: 'flat', label: 'Flat plate (card, sign, coaster)', factor: 0.9 },
] as const;
export type ShapeId = (typeof SHAPES)[number]['id'];

export const QUALITIES = [
  { id: 'draft', label: 'Draft · 0.28 mm layers', layerMm: 0.28, gramsPerHour: 25 },
  { id: 'standard', label: 'Standard · 0.20 mm layers', layerMm: 0.2, gramsPerHour: 15 },
  { id: 'fine', label: 'Fine · 0.12 mm layers', layerMm: 0.12, gramsPerHour: 8 },
] as const;
export type QualityId = (typeof QUALITIES)[number]['id'];

// Your shop rates. PLACEHOLDERS — set your own before using the estimate to quote.
export const RATES = {
  machinePerHour: 1.0, // USD per printer hour: electricity, wear, nozzle, maintenance
  handling: 3.0, // USD per job: slicing, removing supports, cleanup, packing
  margin: 0.4, // 40% on top of cost
  wallMm: 1.2, // skin thickness: 3 walls × 0.4 mm nozzle
  flexSlowdown: 0.5, // TPU prints at about half speed
  minimum: 5, // USD, smallest job
};

export interface EstimateInput {
  w: number; // cm
  d: number; // cm
  h: number; // cm
  shape: ShapeId;
  material: MaterialId;
  infill: number; // 0–1
  quality: QualityId;
  qty: number;
}

export interface Estimate {
  volume: number; // cm³ of object (not material)
  shell: number; // cm³ of solid skin
  material: number; // cm³ of plastic
  grams: number;
  hours: number; // per part
  cost: { filament: number; machine: number; handling: number; margin: number };
  each: number; // USD, before rounding
  total: number; // USD for qty, rounded up to whole dollars, at least the minimum
}

export const DEFAULT_INPUT: EstimateInput = {
  w: 8,
  d: 8,
  h: 10,
  shape: 'organic',
  material: 'pla',
  infill: 0.15,
  quality: 'standard',
  qty: 1,
};

export function estimate(input: EstimateInput, rates = RATES): Estimate {
  const shape = SHAPES.find((s) => s.id === input.shape) ?? SHAPES[0];
  const quality = QUALITIES.find((q) => q.id === input.quality) ?? QUALITIES[1];
  const mat = materialById(input.material) ?? materialById('pla')!;
  const infill = Math.min(1, Math.max(0, input.infill));
  const qty = Math.max(1, Math.floor(input.qty) || 1);

  const volume = Math.max(0, input.w) * Math.max(0, input.d) * Math.max(0, input.h) * shape.factor;
  const area = 6 * Math.pow(volume, 2 / 3); // cm², cube of the same volume
  const shell = Math.min(volume, area * (rates.wallMm / 10));
  const material = shell + (volume - shell) * infill;
  const grams = material * mat.density;
  const speed = quality.gramsPerHour * (mat.id === 'tpu' ? rates.flexSlowdown : 1);
  const hours = grams / speed;

  const filament = (grams / 1000) * mat.pricePerKg;
  const machine = hours * rates.machinePerHour;
  const handling = rates.handling;
  const margin = (filament + machine + handling) * rates.margin;
  const each = filament + machine + handling + margin;
  // Handling is per job, so for qty > 1 it is charged once.
  const totalRaw = each * qty - handling * (1 + rates.margin) * (qty - 1);
  const total = Math.max(rates.minimum, Math.ceil(totalRaw));

  return { volume, shell, material, grams, hours, cost: { filament, machine, handling, margin }, each, total };
}

/** "4 h 38 min" */
export function formatHours(h: number): string {
  const mins = Math.round(h * 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return hh ? `${hh} h ${mm} min` : `${mm} min`;
}
