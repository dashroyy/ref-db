// Filament library. Used by the materials guide, the price estimator and the
// product pages. Values are TYPICAL figures from manufacturer technical data
// sheets (Prusament and Bambu Lab TDS, 2024–2025). Individual brands vary — treat
// them as a guide, not a guarantee.
//
// pricePerKg is what YOU pay for a spool (USD). Placeholder — set your own.

export type MaterialId = 'pla' | 'petg' | 'tpu' | 'asa' | 'silk';

export interface Material {
  id: MaterialId;
  name: string;
  short: string; // one-line personality
  density: number; // g/cm³
  heatC: number | null; // approx. heat deflection temperature, °C (null: no single meaningful figure)
  pricePerKg: number; // USD, your spool cost — placeholder
  hex: string; // display colour for the 3D spool ('rainbow' for silk)
  // 1–5 relative ratings, for the comparison chart. Judgement, not measurement.
  ratings: { detail: number; toughness: number; flex: number; heat: number; outdoor: number };
  goodFor: string;
  avoid: string;
}

export const MATERIALS: Material[] = [
  {
    id: 'pla',
    name: 'PLA',
    short: 'The crisp all-rounder',
    density: 1.24,
    heatC: 55,
    pricePerKg: 20,
    hex: '#ffab2e',
    ratings: { detail: 5, toughness: 2, flex: 1, heat: 1, outdoor: 2 },
    goodFor: 'Figurines, display pieces, business cards, anything that needs sharp detail and bright colour.',
    avoid: 'Hot cars, dishwashers, sunny windowsills — it softens at around 55 °C.',
  },
  {
    id: 'petg',
    name: 'PETG',
    short: 'The tough, practical one',
    density: 1.27,
    heatC: 70,
    pricePerKg: 22,
    hex: '#3dffc5',
    ratings: { detail: 3, toughness: 4, flex: 2, heat: 3, outdoor: 3 },
    goodFor: 'Parts that get used: launchers, clips, organisers, things that get dropped.',
    avoid: 'Ultra-fine detail; it is slightly stringier and glossier than PLA.',
  },
  {
    id: 'tpu',
    name: 'TPU 95A',
    short: 'Rubbery and unbreakable',
    density: 1.22,
    heatC: null,
    pricePerKg: 32,
    hex: '#ff6ec7',
    ratings: { detail: 2, toughness: 5, flex: 5, heat: 2, outdoor: 3 },
    goodFor: 'Phone bumpers, grips, feet, flexible straps, squishy toys.',
    avoid: 'Anything that must stay rigid. It prints slowly, so it costs more.',
  },
  {
    id: 'asa',
    name: 'ASA',
    short: 'Built for outside',
    density: 1.07,
    heatC: 93,
    pricePerKg: 28,
    hex: '#8f8cff',
    ratings: { detail: 3, toughness: 4, flex: 2, heat: 4, outdoor: 5 },
    goodFor: 'Garden, car and outdoor parts — it shrugs off sun and heat.',
    avoid: 'Tiny delicate detail; large flat parts can warp.',
  },
  {
    id: 'silk',
    name: 'Silk PLA',
    short: 'Shiny, metallic look',
    density: 1.24,
    heatC: 55,
    pricePerKg: 26,
    hex: 'rainbow',
    ratings: { detail: 4, toughness: 1, flex: 1, heat: 1, outdoor: 1 },
    goodFor: 'Vases, trophies, gifts — anything that should shimmer.',
    avoid: 'Parts under load; silk blends are weaker between layers.',
  },
];

export const materialById = (id: string) => MATERIALS.find((m) => m.id === id);

export const RATING_LABELS: Record<keyof Material['ratings'], string> = {
  detail: 'Detail',
  toughness: 'Toughness',
  flex: 'Flexibility',
  heat: 'Heat resistance',
  outdoor: 'Outdoor / UV',
};
