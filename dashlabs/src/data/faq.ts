// FAQ entries: the FAQ page, its structured data, and site search all read these.
// Draft policies — review and adapt them to your situation (and local law)
// before launch. Payment processors require visible refund and shipping policies.
import { SITE, PROMISES, CHECKOUT_MODE } from './site.ts';
import { PRODUCTS } from './catalog.ts';

// "3–7 days"; whole weeks read as weeks ("7–14" → "1–2 weeks")
const span = ([a, b]: [number, number]) => (a % 7 === 0 && b % 7 === 0 ? `${a / 7}–${b / 7} weeks` : `${a}–${b} days`);
const customLead = PRODUCTS.filter((p) => p.category === 'custom' && p.leadTimeDays).map((p) => p.leadTimeDays!);
const customSpan: [number, number] = customLead.length
  ? [Math.min(...customLead.map((l) => l[0])), Math.max(...customLead.map((l) => l[1]))]
  : SITE.defaultLeadTimeDays;

export interface Faq {
  id: string; // anchor on /faq/ (/faq/#shipping)
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    id: 'lead-time',
    q: 'How long does an order take?',
    a: `Stock designs usually ship in ${span(SITE.defaultLeadTimeDays)}. Custom figurines take ${span(customSpan)} because they are modelled for you first. Each product page shows its own estimate.`,
  },
  {
    id: 'payment',
    q: 'How do I pay?',
    a:
      CHECKOUT_MODE === 'stripe'
        ? 'By card, at checkout: you pay on Stripe’s secure page and get a receipt and invoice by email straight away. Custom pieces are quoted first, then invoiced.'
        : 'You send an order request and I email you a secure invoice you can pay by card. Instant online checkout is coming soon.',
  },
  {
    id: 'materials',
    q: 'What materials do you use?',
    a: 'Mostly PLA+ for detail and colour, PETG where parts need to be tougher, and TPU for flexible bits. Prints are not food-safe unless stated.',
  },
  {
    id: 'online-models',
    q: 'Can you print a model I found online?',
    a: 'Only if its licence allows prints to be sold, or the designer gives permission. Many free models are licensed for personal use only — I respect that, so I check every design before printing it to sell.',
  },
  {
    id: 'returns',
    q: 'Returns and refunds',
    a: `Items arriving damaged or faulty are reprinted or refunded — send a photo within ${PROMISES.returnDays} days of delivery. Because custom pieces are made just for you, they can\'t be returned for change of mind once you\'ve approved the preview.`,
  },
  {
    id: 'shipping',
    q: 'Shipping',
    a: 'Shipping is calculated on your invoice based on size and destination. Everything is packed to survive the trip.',
  },
  {
    id: 'privacy',
    q: 'Your photos and data',
    a: 'Photos you send for a commission are only used to make your piece. I won\'t post your custom piece online without asking you first.',
  },
];
