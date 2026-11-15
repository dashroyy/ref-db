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
  return { reference, items, gift: gift || !!giftNote, giftNote, name, shipTo };
}
