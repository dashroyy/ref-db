// "Ready to send" dialog for order requests and custom requests. Opening an
// email app from a web page fails for many people (webmail users, no default
// app), so the message is shown on the page with three ways to send it: open
// the email app, copy the message, or copy the address.

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function showSendDialog(o: { title: string; lead: string; to: string; subject: string; text: string; reference?: string }) {
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
    <div class="s-foot"><span class="s-status" role="status"></span><button type="button" class="btn" data-close>Done</button></div>`;
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
  d.addEventListener('click', (e) => e.target === d && d.close());
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}
