// The player for the staged explainer animations (Explainer.astro). An explainer is a list of stages, each with a
// duration. A state function turns the progress of each stage (0 before it starts, 1 after it ends) into SVG
// attributes, keyed by the data-k attribute of each element. The server renders the end state with the same function,
// so the figure is complete before the script runs and without it.

export type Attrs = Record<string, string | number>;
export type State = Record<string, Attrs>;
export type StateFn = (p: number[]) => State;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Smoothstep: starts and stops gently. */
export const ease = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** The progress of the part of a stage between the fractions a and b of it: 0 before a and 1 after b. */
export const seg = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
/** Rounds to 2 decimals, so the attributes stay short and the server and the browser write the same text. */
export const r2 = (x: number) => Math.round(x * 100) / 100;
/** The attributes of a state entry without its text, to spread on an element in a template. */
export const attrs = (a: Attrs | undefined): Attrs => {
  const { text: _text, ...rest } = a ?? {};
  return rest;
};

/** The end of each stage, from the start of the timeline. */
export const ends = (ms: number[]) => {
  let s = 0;
  return ms.map((d) => (s += d));
};

/** The progress (0 to 1) of each stage at the time t. */
export const progress = (ms: number[], t: number) => {
  let s = 0;
  return ms.map((d) => {
    const u = clamp01((t - s) / d);
    s += d;
    return u;
  });
};

/** The stage that the time t is in. The end of a stage belongs to that stage, because the player stops there. */
export const stageAt = (ms: number[], t: number) => {
  const e = ends(ms);
  const k = e.findIndex((x) => t <= x + 1e-6);
  return k < 0 ? ms.length - 1 : k;
};

/** The first stop after t. The stops are the start and the end of each stage. */
export const nextStop = (ms: number[], t: number) => {
  const e = ends(ms);
  return e.find((x) => x > t + 1e-6) ?? e[e.length - 1];
};

/** The last stop before t. */
export const prevStop = (ms: number[], t: number) => {
  const stops = [0, ...ends(ms)];
  for (let i = stops.length - 1; i >= 0; i--) if (stops[i] < t - 1e-6) return stops[i];
  return 0;
};

/** The start of the stage k. */
export const stageStart = (ms: number[], k: number) => (k <= 0 ? 0 : ends(ms)[k - 1]);

/**
 * Connects the controls of one explainer figure. It never starts by itself. It shows the end state first (the same
 * as the server render). Play runs to the end, Next runs to the end of the next stage, Back and the scrubber jump.
 * Under PAUSE MOTION or reduced motion, Play and Next jump to the next stop and do not animate.
 */
export function mountExplainer(root: HTMLElement, state: StateFn) {
  const items = [...root.querySelectorAll<HTMLElement>('[data-ex-step]')];
  const ms = items.map((li) => Number(li.dataset.ms) || 2500);
  if (!ms.length) return;
  const total = ends(ms)[ms.length - 1];
  const q = <T extends Element>(s: string) => root.querySelector<T>(s);
  const play = q<HTMLButtonElement>('[data-ex-play]');
  const next = q<HTMLButtonElement>('[data-ex-next]');
  const back = q<HTMLButtonElement>('[data-ex-back]');
  const scrub = q<HTMLInputElement>('[data-ex-scrub]');
  const count = q<HTMLElement>('[data-ex-count]');
  const els = new Map<string, Element>();
  root.querySelectorAll('[data-k]').forEach((el) => els.set(el.getAttribute('data-k')!, el));
  const doc = document.documentElement;
  const calm = () => {
    try {
      return doc.classList.contains('motion-off') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return doc.classList.contains('motion-off');
    }
  };

  let t = total;
  let target = total;
  let raf = 0;
  let last = 0;
  let shownStage = -1;

  const apply = (s: State) => {
    for (const k in s) {
      const el = els.get(k);
      if (!el) continue;
      const a = s[k];
      for (const n in a) {
        const v = String(a[n]);
        if (n === 'text') {
          if (el.textContent !== v) el.textContent = v;
        } else if (el.getAttribute(n) !== v) el.setAttribute(n, v);
      }
    }
  };

  const show = () => {
    apply(state(progress(ms, t)));
    const k = stageAt(ms, t);
    if (k !== shownStage) {
      shownStage = k;
      items.forEach((li, i) => (i === k ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
      if (count) count.textContent = `Step ${k + 1} of ${ms.length}`;
    }
    if (scrub) scrub.value = String(Math.round((t / total) * 1000));
    if (back) back.disabled = t <= 1e-6;
    if (next) next.disabled = t >= total - 1e-6;
    if (play) {
      const label = raf ? 'Pause' : t >= total - 1e-6 ? 'Replay' : 'Play';
      const text = `${raf ? '❚❚' : '▶'} ${label}`;
      if (play.textContent !== text) {
        play.textContent = text;
        play.setAttribute('aria-label', label);
      }
    }
  };

  const halt = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const tick = (now: number) => {
    // a long gap (a background tab) moves the animation by one frame only, not by the gap
    t = Math.min(target, t + Math.min(now - last, 50));
    last = now;
    if (t < target) raf = requestAnimationFrame(tick);
    else raf = 0;
    show();
  };

  const runTo = (to: number) => {
    halt();
    target = to;
    if (calm()) {
      t = to;
      show();
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(tick);
    show();
  };

  const jump = (to: number) => {
    halt();
    t = target = to;
    show();
  };

  play?.addEventListener('click', () => {
    if (raf) {
      halt();
      show();
      return;
    }
    if (t >= total - 1e-6) {
      if (calm()) return jump(0);
      t = 0;
    }
    runTo(calm() ? nextStop(ms, t) : total);
  });
  next?.addEventListener('click', () => {
    if (raf) jump(nextStop(ms, t));
    else runTo(nextStop(ms, t));
  });
  back?.addEventListener('click', () => jump(prevStop(ms, t)));
  scrub?.addEventListener('input', () => jump((Number(scrub.value) / 1000) * total));
  root.querySelectorAll<HTMLButtonElement>('[data-ex-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = Number(b.dataset.exGo);
      jump(stageStart(ms, k));
      runTo(ends(ms)[k]);
    }),
  );

  // PAUSE MOTION while it runs: finish the stage at once
  new MutationObserver(() => {
    if (raf && calm()) jump(target);
  }).observe(doc, { attributes: true, attributeFilter: ['class'] });
  // off the screen: stop, and do not start again by itself
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      if (raf && es.some((e) => !e.isIntersecting)) {
        halt();
        show();
      }
    }).observe(root);
  }
  show();
}
