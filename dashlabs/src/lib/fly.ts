// Fly-to-cart: a little printed cube arcs from the button into the cart icon,
// then a toast confirms. Skipped (instant) under Motion off / reduced motion.

const calm = () =>
  document.documentElement.classList.contains('motion-off') || matchMedia('(prefers-reduced-motion: reduce)').matches;

const CUBE = `<svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
  <polygon points="20,4 35,12 20,20 5,12" fill="var(--c, #ffab2e)"/>
  <polygon points="5,12 20,20 20,36 5,28" fill="#6c47d6"/>
  <polygon points="20,20 35,12 35,28 20,36" fill="#4a2ca8"/></svg>`;

/** Animate a cube from `from` to the header cart; resolves when it lands. */
export function flyToCart(from: Element, color = '#ffab2e'): Promise<void> {
  const cart = document.querySelector('.cart');
  if (!cart || calm() || !('animate' in Element.prototype)) return Promise.resolve();
  const a = from.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  const el = document.createElement('div');
  el.innerHTML = CUBE;
  el.style.cssText = `position:fixed;left:0;top:0;z-index:100;pointer-events:none;--c:${color};filter:drop-shadow(0 0 10px ${color})`;
  document.body.appendChild(el);
  const x0 = a.left + a.width / 2 - 17, y0 = a.top + a.height / 2 - 17;
  const x1 = b.left + b.width / 2 - 17, y1 = b.top + b.height / 2 - 17;
  // arc out to the side and up, but never above the top of the window
  const mx = (x0 + x1) / 2 + Math.min(120, Math.abs(x1 - x0) * 0.25 + 40);
  const my = Math.max(14, (y0 + y1) / 2 - 90);
  const anim = el.animate(
    [
      { transform: `translate(${x0}px, ${y0}px) scale(0.4) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0 - 30}px) scale(1.2) rotate(-20deg)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${mx}px, ${my}px) scale(1) rotate(160deg)`, offset: 0.55 },
      { transform: `translate(${x1}px, ${y1}px) scale(0.35) rotate(360deg)`, opacity: 0.9 },
    ],
    { duration: 850, easing: 'cubic-bezier(0.45, 0, 0.25, 1)' },
  );
  return anim.finished.then(() => el.remove()).catch(() => el.remove());
}

let toastTimer = 0;
/** A small toast at the bottom of the screen. */
export function toast(html: string) {
  let t = document.querySelector<HTMLElement>('.dl-toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'dl-toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.innerHTML = html;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 3800);
}
