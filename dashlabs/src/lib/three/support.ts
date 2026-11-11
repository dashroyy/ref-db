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
 * Adaptive quality for a render loop. Call `tick(ms)` with each frame's draw
 * time. On a device that can't keep up it steps down: first sharpness and
 * shadows, then half the frame rate. Returns whether to skip this frame.
 */
export function governor(renderer: { setPixelRatio(n: number): void; shadowMap: { enabled: boolean } }) {
  let n = 0, sum = 0, level = 0, flip = false;
  return {
    tick(ms: number) {
      sum += ms;
      if (++n < 30) return;
      const avg = sum / n;
      n = sum = 0;
      if (avg > 24 && level === 0) {
        level = 1;
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
      } else if (avg > 30 && level === 1) level = 2;
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
