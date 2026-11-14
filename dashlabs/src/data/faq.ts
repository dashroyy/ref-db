// FAQ entries: the FAQ page, its structured data, and site search all read these.
// Draft policies — review and adapt them to your situation (and local law)
// before launch. Payment processors require visible refund and shipping policies.
export interface Faq {
  id: string; // anchor on /faq/ (/faq/#shipping)
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    id: 'lead-time',
    q: 'How long does an order take?',
    a: 'Stock designs usually ship in 3–7 days. Custom figurines take 1–2 weeks because they are modelled for you first. Each product page shows its own estimate.',
  },
  {
    id: 'payment',
    q: 'How do I pay?',
    a: 'Right now, you send an order request and I email you a secure invoice you can pay by card. Instant online checkout is coming soon.',
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
    a: 'Items arriving damaged or faulty are reprinted or refunded — send a photo within 14 days of delivery. Because custom pieces are made just for you, they can\'t be returned for change of mind once you\'ve approved the preview.',
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
