// Lab status — the print bays on the home page. Update by hand when things
// change; the board shows the date so visitors know how fresh it is. If it goes
// 3 weeks without an update, the site stops showing the queue as live (header,
// home board and ship dates fall back to the usual turnaround) until you update it.

export type PrinterState = 'printing' | 'idle' | 'maintenance';

export interface Printer {
  name: string;
  state: PrinterState;
  job?: string; // what it's printing (keep customer details out)
}

export const LAB_STATUS = {
  updated: '2026-11-09',
  acceptingOrders: true,
  queuedJobs: 3,
  // Example printers — rename to your real machines.
  printers: [
    { name: 'Printer 01', state: 'printing', job: 'Pen Launcher batch' },
    { name: 'Printer 02', state: 'idle' },
  ] as Printer[],
  note: 'Custom figurine slots open for this month.',
};

/** After this many days without an update, the site stops showing the queue as live. */
export const STALE_AFTER_DAYS = 21;

/** Whether a status dated `updated` (YYYY-MM-DD) is too old to show as live on `now`. */
export function isStale(updated: string, now: Date, days = STALE_AFTER_DAYS): boolean {
  const t = Date.parse(updated + 'T12:00:00Z');
  return !Number.isFinite(t) || now.getTime() - t > days * 86_400_000;
}

/** Rough lead time in days from the queue: each printer clears about 2 jobs a day. */
export function leadTimeDays(queued: number, printers: Printer[]): [number, number] {
  const active = printers.filter((p) => p.state !== 'maintenance').length || 1;
  const days = Math.ceil(queued / (active * 2));
  return [Math.max(2, days + 2), Math.max(4, days + 5)];
}
