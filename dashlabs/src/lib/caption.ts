// Photo descriptions from file names (pure; tested in tests/photos.test.ts).

/** "02-on-the-desk.jpg" → "on the desk"; "IMG_1234.jpg" → "" */
export function captionFromFile(file: string): string {
  const base = file.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '');
  if (/^(img|dsc|pxl|photo|image)[-_ ]?\d+/i.test(base)) return '';
  return base
    .replace(/^\d+[-_ .]*/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}
