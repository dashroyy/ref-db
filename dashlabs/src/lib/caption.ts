// Small pure text helpers for owner content (tested in tests/photos.test.ts):
// photo descriptions from file names, and build-log dates.

/** "02-on-the-desk.jpg" → "on the desk"; "IMG_1234.jpg" → "" */
export function captionFromFile(file: string): string {
  const base = file.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '');
  if (/^(img|dsc|pxl|photo|image)[-_ ]?\d+/i.test(base)) return '';
  return base
    .replace(/^\d+[-_ .]*/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

/** "2026-10" → "Oct 2026"; "2026-10-14" → "14 Oct 2026" */
export function formatLogDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m) return d;
  const month = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return day ? `${day} ${month} ${y}` : `${month} ${y}`;
}
