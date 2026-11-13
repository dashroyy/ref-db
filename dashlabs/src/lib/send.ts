// "Ready to send" dialog for order requests and custom requests. Opening an
// email app from a web page fails for many people (webmail users, no default
// app), so the message is shown on the page with three ways to send it: open
// the email app, copy the message, or copy the address.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function showSendDialog(o: {
  title: string;
  lead: string;
  to: string;
  subject: string;
  text: string;
  reference?: string;
  /** shown as a final 'I've sent it' button; runs when pressed */
  onSent?: { label: string; done: string; run: () => void };
}) {
  document.querySelector('.dl-send')?.remove();
  const d = document.createElement('dialog');
  d.className = 'dl-send';
  const mailto = `mailto:${o.to}?subject=${encodeURIComponent(o.subject)}&body=${encodeURIComponent(o.text)}`;
  d.innerHTML = `
    <div class="s-head"><span class="live-dot"></span><b>${esc(o.title)}</b>${o.reference ? `<span class="s-ref">${esc(o.reference)}</span>` : ''}</div>
    <p class="s-lead">${esc(o.lead)}</p>
    <ol class="s-steps">
      <li><a class="btn btn--primary" href="${esc(mailto)}" data-open>Open my email app</a><span>The message is filled in for you. Just press send.</span></li>
      <li><button type="button" class="btn" data-copy>Copy the message</button><span>No email app? Paste it into Gmail, Outlook or any mail, to <b class="s-to">${esc(o.to)}</b> <button type="button" class="s-mini" data-copy-to>copy address</button></span></li>
    </ol>
    <label class="s-lbl" for="dl-send-text">Your message</label>
    <textarea id="dl-send-text" readonly rows="9">${esc(o.text)}</textarea>
    <div class="s-foot"><span class="s-status" role="status"></span><span class="s-actions">${
      o.onSent ? `<button type="button" class="btn btn--primary" data-sent>${esc(o.onSent.label)}</button>` : ''
    }<button type="button" class="btn" data-close>${o.onSent ? 'Not yet' : 'Done'}</button></span></div>`;
  document.body.appendChild(d);
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
    d.innerHTML = `<div class="s-done"><span class="s-cube" aria-hidden="true"></span><b>${esc(o.onSent!.done)}</b>${
      o.reference ? `<p>Your reference is <span class="s-ref">${esc(o.reference)}</span>. Keep it handy.</p>` : ''
    }<p>I usually reply within a day or two. No reply after three days? Check your spam folder, or email
    <a href="mailto:${esc(o.to)}">${esc(o.to)}</a>.</p><button type="button" class="btn btn--primary" data-close>Done</button></div>`;
    d.querySelector('[data-close]')!.addEventListener('click', () => d.close());
  });
  d.addEventListener('click', (e) => e.target === d && d.close());
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}
