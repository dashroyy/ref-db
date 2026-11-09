// Lab status — shown on the home page status board (REF·DB's mission-control
// board, for a print farm). Update by hand when things change; the board shows
// the date so visitors know how fresh it is.

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

/** Rough lead time in days from the queue: each printer clears about 2 jobs a day. */
export function leadTimeDays(queued: number, printers: Printer[]): [number, number] {
  const active = printers.filter((p) => p.state !== 'maintenance').length || 1;
  const days = Math.ceil(queued / (active * 2));
  return [Math.max(2, days + 2), Math.max(4, days + 5)];
}
