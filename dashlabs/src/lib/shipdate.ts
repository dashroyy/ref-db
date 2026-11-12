// "Ships by" estimates. Pure; tested in tests/guides.test.ts.
// Lead times are counted in working days (Mon–Fri) from the day after ordering.

/** The date n working days after `from` (weekends skipped). */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  let left = Math.max(0, Math.round(n));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/** Earliest and latest ship dates for a lead time of [lo, hi] working days. */
export function shipWindow(now: Date, lead: [number, number]): [Date, Date] {
  return [addWorkingDays(now, lead[0]), addWorkingDays(now, lead[1])];
}

/** The slower of two lead times (e.g. a product's own and the lab's current queue). */
export const slower = (a: [number, number], b: [number, number]): [number, number] => [Math.max(a[0], b[0]), Math.max(a[1], b[1])];

/** "Mon 16 – Fri 20 Nov" / "Fri 27 Nov – Wed 2 Dec" */
export function formatWindow([a, b]: [Date, Date], locale = 'en-US'): string {
  const mon = (d: Date) => d.toLocaleDateString(locale, { month: 'short' });
  const f = (d: Date) => `${d.toLocaleDateString(locale, { weekday: 'short' })} ${d.getDate()}`;
  return a.getMonth() === b.getMonth() ? `${f(a)} – ${f(b)} ${mon(b)}` : `${f(a)} ${mon(a)} – ${f(b)} ${mon(b)}`;
}
