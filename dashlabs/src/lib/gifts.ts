// Gift finder: three questions → up to three suggestions from the catalog.
// Pure; tested in tests/guides.test.ts.

import { PRODUCTS, type Product } from '../data/catalog.ts';

export const WHO = [
  { id: 'partner', label: 'Partner' },
  { id: 'family', label: 'Family' },
  { id: 'friend', label: 'Friend' },
  { id: 'coworker', label: 'Coworker' },
  { id: 'kid', label: 'A kid' },
  { id: 'petlover', label: 'Pet lover' },
] as const;
export const VIBE = [
  { id: 'sentimental', label: 'Sentimental' },
  { id: 'fun', label: 'Fun' },
  { id: 'practical', label: 'Practical' },
] as const;
export const BUDGET = [
  { id: '15', label: 'Under $15', max: 1500 },
  { id: '30', label: 'Under $30', max: 3000 },
  { id: '60', label: 'Under $60', max: 6000 },
  { id: 'any', label: 'No limit', max: Infinity },
] as const;

export type WhoId = (typeof WHO)[number]['id'];
export type VibeId = (typeof VIBE)[number]['id'];
export type BudgetId = (typeof BUDGET)[number]['id'];

// Who and what each product suits. Add a line when you add a product
// (the tests fail if one is missing).
export const GIFT_TAGS: Record<string, { who: WhoId[]; vibe: VibeId[] }> = {
  'cust-person': { who: ['partner', 'family', 'friend'], vibe: ['sentimental', 'fun'] },
  'cust-pet': { who: ['petlover', 'family', 'partner'], vibe: ['sentimental'] },
  'orig-pen-launcher': { who: ['coworker', 'friend', 'kid'], vibe: ['fun'] },
  'cards-standard': { who: ['coworker', 'friend'], vibe: ['practical'] },
  'orig-cable-organizer': { who: ['coworker', 'partner', 'family'], vibe: ['practical'] },
  'mto-flexi-dragon': { who: ['kid', 'friend'], vibe: ['fun'] },
  'mto-vase': { who: ['family', 'partner'], vibe: ['practical', 'sentimental'] },
  'mto-keychain': { who: ['kid', 'friend', 'family', 'partner', 'petlover'], vibe: ['sentimental', 'practical'] },
};

export interface GiftPick {
  product: Product;
  score: number;
  overBudget: boolean;
}

/**
 * Best matches first. Products within budget always come before ones over it;
 * if nothing fits the budget, the closest-priced matches are returned and
 * flagged, so the finder never comes back empty.
 */
export function suggest(a: { who: WhoId; vibe: VibeId; budget: BudgetId }, catalog: Product[] = PRODUCTS, n = 3): GiftPick[] {
  const max = BUDGET.find((b) => b.id === a.budget)?.max ?? Infinity;
  const scored = catalog.map((product) => {
    const t = GIFT_TAGS[product.id];
    const score = (t?.who.includes(a.who) ? 2 : 0) + (t?.vibe.includes(a.vibe) ? 1 : 0);
    return { product, score, overBudget: product.price > max };
  });
  const rank = (x: GiftPick, y: GiftPick) => y.score - x.score || x.product.price - y.product.price;
  const within = scored.filter((s) => !s.overBudget && s.score > 0).sort(rank);
  if (within.length >= n) return within.slice(0, n);
  const fallback = scored.filter((s) => !s.overBudget && s.score === 0).sort(rank);
  const over = scored.filter((s) => s.overBudget && s.score > 0).sort((x, y) => x.product.price - y.product.price);
  // some real matches: show just those, rather than pad with unrelated items
  if (within.length) return within;
  return (over.length ? over : fallback).slice(0, n);
}
