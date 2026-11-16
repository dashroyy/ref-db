// Order desk helpers (pure; tested in tests/desk.test.ts). Reads the text of an
// order email (the customer's order request, or the "PAID order" notice) back
// into what a packing slip and gift card need.

export interface SlipItem {
  qty: number;
  name: string;
  detail: string; // options and personalised text, if any
}

export interface ParsedOrder {
  reference: string;
  items: SlipItem[];
  gift: boolean;
  giftNote: string;
  name: string;
  email: string;
  subtotal: number | null; // cents, from "Subtotal: $x" (order requests)
  paid: number | null; // cents, from "Total paid: $x" (PAID notices)
  shipTo: string[];
}

const PRICE_TAIL = /\s+—\s+\$[\d,]+\.\d{2}\s*$/;

export function parseOrderText(text: string): ParsedOrder {
  const lines = text.replace(/\r/g, '').split('\n');
  const reference = /DL-\d{6}-[A-Z0-9]{4}/.exec(text)?.[0] ?? '';
  const items: SlipItem[] = [];
  let gift = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('•')) continue;
    const body = line.slice(1).trim().replace(PRICE_TAIL, '');
    if (/^gift wrap\b/i.test(body)) {
      gift = true;
      continue;
    }
    const m = /^(\d+)\s*[×x]\s*(.+)$/.exec(body);
    if (!m) continue;
    // "Name (options) — "note"" or "Name (options)"
    const rest = m[2];
    const open = rest.indexOf(' (');
    const name = open > 0 ? rest.slice(0, open) : rest.replace(/\s+—\s+.*$/, '');
    const detail = open > 0 ? rest.slice(open + 2).replace(/\)(\s+—\s+(.*))?$/, (_, __, note) => (note ? ` · ${note}` : '')) : (/\s+—\s+(.*)$/.exec(rest)?.[1] ?? '');
    items.push({ qty: Number(m[1]), name: name.trim(), detail: detail.trim() });
  }
  if (/^GIFT:/m.test(text)) gift = true;
  // notes can run over several lines: everything up to the closing quote that ends a line
  const giftNote = (/Gift note:\s*["“]([\s\S]*?)["”][ \t]*$/m.exec(text) ?? /^GIFT:.*?Note:\s*["“]([\s\S]*?)["”][ \t]*$/m.exec(text))?.[1] ?? '';
  const name = (/^(?:Name|Customer):\s*(.+)$/m.exec(text)?.[1] ?? '').trim();
  const shipTo: string[] = [];
  const at = lines.findIndex((l) => /^Ship to:\s*$/.test(l.trim()));
  if (at >= 0) for (const l of lines.slice(at + 1)) {
    if (!l.trim()) break;
    shipTo.push(l.trim());
  }
  const money = (re: RegExp) => {
    const m = re.exec(text);
    return m ? Math.round(Number(m[1].replace(/,/g, '')) * 100) : null;
  };
  const email = (/^Email:\s*(\S+@\S+)\s*$/m.exec(text)?.[1] ?? '').trim();
  return {
    reference,
    items,
    gift: gift || !!giftNote,
    giftNote,
    name,
    email,
    subtotal: money(/^Subtotal:\s*\$([\d,]+\.\d{2})/m),
    paid: money(/^Total paid:\s*\$([\d,]+\.\d{2})/m),
    shipTo,
  };
}

// ---------------------------------------------------------------------------
// Reply drafts, matching docs/EMAIL-TEMPLATES.md

export type ReplyKind = 'total' | 'shipped' | 'review';
export interface ReplyExtras {
  shipping?: number; // cents ('total')
  shipBy?: string; // e.g. "Fri 21 Nov" ('total')
  tracking?: string; // ('shipped')
  signOff?: string; // your name
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const firstName = (n: string) => n.trim().split(/\s+/)[0] || 'there';
const itemList = (o: ParsedOrder) => o.items.map((i) => `${i.qty} × ${i.name}${i.detail ? ` (${i.detail})` : ''}`);
/** "the Pen Launcher" for one item, "your order" for several */
const what = (o: ParsedOrder) => (o.items.length === 1 ? `the ${o.items[0].name}` : 'your order');

export function replyDraft(kind: ReplyKind, o: ParsedOrder, x: ReplyExtras = {}): { subject: string; body: string } {
  const hi = `Hi ${firstName(o.name)},`;
  const sign = `${x.signOff?.trim() || '[your name]'}, DashLabs`;
  const ref = o.reference ? ` ${o.reference}` : '';
  if (kind === 'total') {
    const ship = x.shipping ?? null;
    const total = o.subtotal !== null && ship !== null ? o.subtotal + ship : null;
    return {
      subject: `Your DashLabs order${ref}`,
      body: [
        hi,
        '',
        'Thanks for your order! Here\'s the total:',
        '',
        ...itemList(o).map((l) => `- ${l}`),
        ...(o.gift ? ['- Gift wrap with your note'] : []),
        o.subtotal !== null ? `- Subtotal: ${usd(o.subtotal)}` : '',
        `- Shipping: ${ship !== null ? usd(ship) : '$[x]'}`,
        `- Total: ${total !== null ? usd(total) : '$[x]'}`,
        '',
        `I'll send a secure invoice in a moment; you can pay by card. Printing starts as soon as it's paid, and your order should ship by ${x.shipBy?.trim() || '[date]'}.`,
        '',
        'Thanks,',
        sign,
      ]
        .filter((l, i, a) => l !== '' || a[i - 1] !== '')
        .join('\n'),
    };
  }
  if (kind === 'shipped') {
    return {
      subject: 'Your DashLabs order is on its way',
      body: [
        hi,
        '',
        `${cap(what(o))} is printed, checked and on its way. Tracking: ${x.tracking?.trim() || '[link or number]'}.`,
        '',
        'A few care tips: keep it out of hot cars and direct sun, and clean it with lukewarm water and a soft brush.',
        '',
        "If anything arrives damaged, send me a photo within 14 days and I'll put it right.",
        '',
        sign,
      ].join('\n'),
    };
  }
  return {
    subject: 'How did it turn out?',
    body: [
      hi,
      '',
      `I hope ${what(o)} arrived safely. If you have a minute, I'd love to hear what you think, and to see a photo of it in its new home. With your OK I'd share your words (and photo) on the site.`,
      '',
      'Thanks again for ordering from a one-person lab.',
      '',
      sign,
    ].join('\n'),
  };
}
