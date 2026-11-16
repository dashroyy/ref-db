// Photo checklist for custom figurines. Pure; tested in tests/guides.test.ts.

export interface PhotoItem {
  id: string;
  label: string;
  why: string;
  required: boolean;
}

export const PHOTO_ITEMS: PhotoItem[] = [
  { id: 'front', label: 'Front, eye level', why: 'The face and the proportions come from this one.', required: true },
  { id: 'side', label: 'Side profile', why: 'Nose, chin and hair depth can’t be guessed from the front.', required: true },
  { id: 'back', label: 'Back', why: 'Hair, tail, hood, backpack: whatever is behind.', required: true },
  { id: 'threeq', label: 'Three-quarter view', why: 'Ties the front and side together.', required: false },
  { id: 'full', label: 'Full body, standing', why: 'Needed for full figures: posture, legs, shoes.', required: false },
  { id: 'detail', label: 'Close-ups of details', why: 'Glasses, collar tag, logo, markings, a favourite toy.', required: false },
  { id: 'light', label: 'Even daylight, no flash', why: 'Hard shadows hide the shape of a face.', required: true },
];

export function readiness(checked: string[]) {
  const have = new Set(checked);
  const missing = PHOTO_ITEMS.filter((i) => i.required && !have.has(i.id));
  const done = PHOTO_ITEMS.filter((i) => have.has(i.id)).length;
  return { ready: missing.length === 0, missing, done, total: PHOTO_ITEMS.length };
}
