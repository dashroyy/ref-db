import { SITE } from '../data/site.ts';

const fmt = new Intl.NumberFormat(SITE.locale, { style: 'currency', currency: SITE.currency });

/** 1999 → "$19.99" */
export const money = (cents: number) => fmt.format(cents / 100);
