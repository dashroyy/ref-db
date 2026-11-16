// Pre-rendered 3D thumbnails (public/thumbs/). `npm run thumbs` regenerates
// them and the list below; anything not in the list is rendered in the
// visitor's browser instead, so a new product works before its image exists.
import list from './thumbs.json';

const have = new Set(list as string[]);
export const thumbKey = (shape: string, color: string) => `${shape}-${color.replace('#', '')}`;

/** The image path for a shape + colour, or undefined when it hasn't been rendered yet. */
export function thumbSrc(shape: string, color: string): string | undefined {
  // THUMBS=off (used by `npm run thumbs`) forces in-browser rendering so the generator can capture it
  if (typeof process !== 'undefined' && process.env.THUMBS === 'off') return undefined;
  const k = thumbKey(shape, color);
  return have.has(k) ? `/thumbs/${k}.webp` : undefined;
}
