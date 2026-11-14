// "Ready to send" dialog for order requests and custom requests. Opening an
// email app from a web page fails for many people (webmail users, no default
// app), so the message is shown on the page with three ways to send it: open
// the email app, copy the message, or copy the address.
// With ORDER_DELIVERY 'netlify-form', sendRequest() posts it straight to you
// instead and only falls back to this dialog if that fails.
import { deliver, type Delivery } from './deliver.ts';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export interface SendOptions {
  title: string;
  lead: string;
  to: string;
  subject: string;
  text: string;
  reference?: string;
  /** shown as a final 'I've sent it' button; runs when pressed */
  onSent?: { label: string; done: string; run: () => void };
  /** a line shown above the steps (e.g. why direct sending fell back to email) */
  note?: string;
}

function newDialog(): HTMLDialogElement {
  document.querySelector('.dl-send')?.remove();
  const d = document.createElement('dialog');
  d.className = 'dl-send';
  d.addEventListener('click', (e) => e.target === d && d.close());
  d.addEventListener('close', () => d.remove());
  document.body.appendChild(d);
  return d;
}

function showDone(d: HTMLDialogElement, done: string, to: string, reference?: string) {
  d.innerHTML = `<div class="s-done"><span class="s-cube" aria-hidden="true"></span><b>${esc(done)}</b>${
    reference ? `<p>Your reference is <span class="s-ref">${esc(reference)}</span>. Keep it handy.</p>` : ''
  }<p>I usually reply within a day or two. No reply after three days? Check your spam folder, or email
  <a href="mailto:${esc(to)}">${esc(to)}</a>.</p><button type="button" class="btn btn--primary" data-close>Done</button></div>`;
  d.querySelector<HTMLButtonElement>('[data-close]')!.addEventListener('click', () => d.close());
  if (!d.open) d.showModal();
  d.querySelector<HTMLButtonElement>('[data-close]')!.focus();
}

/**
 * Send a request: straight to the shop when `direct` is given (Netlify Forms),
 * otherwise, or if that fails, through the "ready to send" email dialog.
 */
export async function sendRequest(o: SendOptions & { onSent: NonNullable<SendOptions['onSent']> }, direct?: Delivery) {
  if (!direct) return showSendDialog(o);
  const d = newDialog();
  d.innerHTML = `<div class="s-done s-sending" role="status"><span class="s-cube" aria-hidden="true"></span><b>Sending…</b><p>Sending your ${direct.form === 'order' ? 'order request' : 'request'} to DashLabs.</p></div>`;
  d.showModal();
  if (await deliver(direct)) {
    o.onSent.run();
    showDone(d, o.onSent.done, o.to, o.reference);
    return d;
  }
  d.close();
  return showSendDialog({ ...o, note: 'It couldn’t be sent from here just now, so send it by email instead. Nothing is lost.' });
}

export function showSendDialog(o: SendOptions) {
  const d = newDialog();
  const mailto = `mailto:${o.to}?subject=${encodeURIComponent(o.subject)}&body=${encodeURIComponent(o.text)}`;
  d.innerHTML = `
    <div class="s-head"><span class="live-dot"></span><b>${esc(o.title)}</b>${o.reference ? `<span class="s-ref">${esc(o.reference)}</span>` : ''}</div>
    <p class="s-lead">${esc(o.lead)}</p>${o.note ? `<p class="s-note" role="alert">${esc(o.note)}</p>` : ''}
    <ol class="s-steps">
      <li><a class="btn btn--primary" href="${esc(mailto)}" data-open>Open my email app</a><span>The message is filled in for you. Just press send.</span></li>
      <li><button type="button" class="btn" data-copy>Copy the message</button><span>No email app? Paste it into Gmail, Outlook or any mail, to <b class="s-to">${esc(o.to)}</b> <button type="button" class="s-mini" data-copy-to>copy address</button></span></li>
    </ol>
    <label class="s-lbl" for="dl-send-text">Your message</label>
    <textarea id="dl-send-text" readonly rows="9">${esc(o.text)}</textarea>
    <div class="s-foot"><span class="s-status" role="status"></span><span class="s-actions">${
      o.onSent ? `<button type="button" class="btn btn--primary" data-sent>${esc(o.onSent.label)}</button>` : ''
    }<button type="button" class="btn" data-close>${o.onSent ? 'Not yet' : 'Done'}</button></span></div>`;
  const status = d.querySelector<HTMLElement>('.s-status')!;
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = `${what} copied`;
    } catch {
      const ta = d.querySelector('textarea')!;
      ta.focus();
      ta.select();
      status.textContent = 'Press Ctrl/⌘ C to copy';
    }
  };
  d.querySelector('[data-copy]')!.addEventListener('click', () => copy(o.text, 'Message'));
  d.querySelector('[data-copy-to]')!.addEventListener('click', () => copy(o.to, 'Address'));
  d.querySelector('[data-close]')!.addEventListener('click', () => d.close());
  d.querySelector('[data-sent]')?.addEventListener('click', () => {
    o.onSent!.run();
    showDone(d, o.onSent!.done, o.to, o.reference);
  });
  d.showModal();
  return d;
}
