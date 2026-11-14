// Direct delivery of order/custom requests through Netlify Forms (when
// ORDER_DELIVERY is 'netlify-form'). Netlify finds the matching hidden form in
// the built HTML (layouts/Base.astro), stores each submission and emails it to
// you. Nothing here needs a key.

export type RequestForm = 'order' | 'custom' | 'paid-order';

export interface Delivery {
  form: RequestForm;
  name: string;
  email: string;
  subject: string;
  message: string;
  reference?: string;
}

/** The fields Netlify expects, URL-encoded. */
export function encodeDelivery(d: Delivery): string {
  return new URLSearchParams({
    'form-name': d.form,
    'bot-field': '',
    reference: d.reference ?? '',
    name: d.name,
    email: d.email,
    subject: d.subject,
    message: d.message,
  }).toString();
}

/** Send it; true only when the host accepted it. */
export async function deliver(d: Delivery, timeoutMs = 12000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: encodeDelivery(d),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
