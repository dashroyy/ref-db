// Tiny checks with no Three.js import, so pages can decide whether to load 3D at all.

export function webglOK(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Adaptive quality for a render loop. Call `tick(ms)` on every animation frame
 * with the time since the previous one: that interval includes everything the
 * browser had to do (our JavaScript, drawing, compositing), so it shows the
 * real cost. On a device that can't keep up it steps down: first sharpness and
 * shadows, then half the frame rate, then it gives up so a still can be shown.
 */
export function governor(renderer: { setPixelRatio(n: number): void; shadowMap: { enabled: boolean } }) {
  let n = 0, sum = 0, level = 0, flip = false, since = performance.now();
  return {
    /**
     * Returns 'give-up' when even the lightest setting is too slow for this
     * device (still over 45 ms a frame): the caller should stop and show a still.
     * Judged every 20 frames or every second, whichever comes first, so a very
     * slow device is caught quickly. Pauses (hidden tab, scrolled away) are ignored.
     */
    tick(ms: number): 'give-up' | void {
      if (ms > 1000) return; // a pause, not slowness
      sum += ms;
      n++;
      if (n < 20 && performance.now() - since < 1000) return;
      const avg = sum / n;
      n = sum = 0;
      since = performance.now();
      // hopeless (under ~8 frames a second): stop straight away
      if (avg > 120) return 'give-up';
      if (avg > 24 && level === 0) {
        level = 1;
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
      } else if (avg > 30 && level === 1) level = 2;
      else if (avg > 45 && level === 2) return 'give-up';
    },
    /** Use only after the visitor asked for the live version: never give up again. */
    stay() {
      level = Math.max(level, 2);
      this.tick = () => undefined;
    },
    /** true on frames to skip (level 2 draws every other frame) */
    skip() {
      flip = !flip;
      return level === 2 && flip;
    },
  };
}

export const calm = () =>
  document.documentElement.classList.contains('motion-off') || matchMedia('(prefers-reduced-motion: reduce)').matches;
