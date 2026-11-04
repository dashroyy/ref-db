// The star map as an optional overlay, opened from the STAR MAP button beside the theme switch. Nothing of it loads
// with a page: the first click loads this module, three.js, the scene (./starmap-scene.ts), the styles and the page
// descriptions (/star-map.json). The page behind is hidden while the map is open; its sky and black hole stay as the
// backdrop. The map opens on the planet of the page you are on, with that zone marked.
import '../styles/starmap.css';
import { buildMap, EMBLEMS, TASKS, type MapData } from '../lib/starmap';
import { route, hrefOf, BRIEFING } from '../data/zones.mjs';
import { initStarMap } from './starmap-scene';

const base = import.meta.env.BASE_URL;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const two = (n: number) => String(n).padStart(2, '0');
const page = (path: string) => path.replace(/index\.html$/, '').replace(/\/?$/, '/');

let root: HTMLElement | null = null, building: Promise<HTMLElement> | null = null;
let opener: HTMLElement | null = null, savedHash = '';

/** The HUD of the map: the console frame, the phase panels, the briefing on the sun, the route strip. */
function hud(map: MapData) {
  const items = route();
  const pct = Math.round((map.v2 / map.total) * 100);
  const tasks = TASKS.map((t) => ({ ...t, item: items.find((i) => i.key === t.z) })).filter((t) => t.item);
  const brief = (slug: string) => `${base.replace(/\/$/, '')}/${slug}/`;
  return `
  <canvas class="sm-canvas" data-gl aria-hidden="true"></canvas>
  <div class="sm-vignette" aria-hidden="true"></div>
  <div class="sm-labels" data-labels aria-hidden="true"></div>
  <div class="sm-reticle off" data-reticle aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <div class="sm-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
  <header class="sm-top">
    <div class="sm-id">
      <span class="k"><span class="dot"></span>REF·DB · NAVIGATION CONSOLE</span>
      <span class="t">STAR MAP</span>
      <span class="crumb" data-crumb>SYSTEM</span>
    </div>
    <div class="sm-right">
      <dl class="sm-stats">
        <div><dt>ZONES IN v2</dt><dd>${map.v2}<small>/${map.total}</small></dd></div>
        <div><dt>PHASES</dt><dd>${map.planets.length}</dd></div>
        <div class="bar"><dt>REBUILD ${pct}%</dt><dd><i style="width:${pct}%"></i></dd></div>
      </dl>
      <button type="button" class="sm-close" data-close aria-label="Close the star map">✕ CLOSE</button>
    </div>
  </header>
  <aside class="sm-panel sm-plate" data-panel hidden aria-label="The zones of this phase">
    ${map.planets.map((p) => `
    <section data-phase="${p.k}" hidden style="--pc:${p.color}">
      <p class="k">PHASE ${p.index + 1} OF ${map.planets.length} · ${p.moons.filter((m) => !m.primer).length} ZONES</p>
      <h2>${esc(p.n)}</h2>
      <p class="s">${esc(p.sub)}</p>
      <p class="d">${esc(p.d)}</p>
      <p class="em">${esc(EMBLEMS[p.k]?.what ?? '')}</p>
      <ul>${p.moons.map((m) => `<li><a href="${m.href}" data-moon="${m.key}" class="${m.v2 ? '' : 'v1'}${m.primer ? ' primer' : ''}"><b>${m.primer ? '✦' : m.tag}</b><span>${esc(m.label)}</span>${m.v2 ? '' : '<em>v1</em>'}</a></li>`).join('')}</ul>
    </section>`).join('')}
  </aside>
  <aside class="sm-brief sm-plate" data-brief hidden aria-label="Overview briefing">
    <p class="k">${map.sun.tag} · ${esc(map.sun.label)} · THE SUN</p>
    <h2>REF<span>·</span>DB</h2>
    <p class="lead">Learn the concept, see it, then run the numbers. A working reference for solid rocket motor hardware (cases, grains, insulation, seals and materials). A newcomer can learn from it and an engineer can use it.</p>
    <div class="ways">
      <button type="button" data-open-search><b>01 · SEARCH</b><span>You know the word: press <kbd>/</kbd> and type it.</span></button>
      <a href="#sm-tasks" data-to-tasks><b>02 · START A TASK</b><span>You know the job: pick the question below.</span></a>
      <button type="button" data-route-start><b>03 · FOLLOW THE ROUTE</b><span>Fly to phase 1 and work outwards.</span></button>
    </div>
    <h3 id="sm-tasks">Start a task</h3>
    <ul class="tasks">${tasks.map((t) => `<li style="--pc: var(--ph-${t.item!.phase})"><a href="${hrefOf(t.item!, base)}"><b>${t.item!.tag}</b>${esc(t.q)}</a></li>`).join('')}</ul>
    <h3>How every page works</h3>
    <p class="seq">Intuition → analogy → diagram → equations → interactive tool → worked example → where it stops → on the drawing → references.</p>
    <p class="note">Reference aid only: typical guidance for early design and learning. Verify against the current standard and your programme's approved data before release.</p>
    <p class="links"><a href="${map.sun.href}">Overview page</a> · ${BRIEFING.map((x) => `<a href="${brief(x.slug)}">${esc(x.label)}</a>`).join(' · ')}</p>
  </aside>
  <div class="sm-card sm-plate" data-card hidden></div>
  <nav class="sm-route" aria-label="Phases">
    <button type="button" data-go="system" aria-pressed="true">◎ SYSTEM</button>
    <button type="button" data-go="sun" aria-pressed="false" style="--pc:#ffb35c"><b>☉</b> OVERVIEW</button>
    ${map.planets.map((p) => `<button type="button" data-go="${p.k}" aria-pressed="false" style="--pc:${p.color}"><b>${two(p.index + 1)}</b> ${esc(p.n)}</button>`).join('')}
  </nav>
  <div class="sm-ctl">
    <button type="button" data-zoom="in" aria-label="Zoom in">+</button>
    <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
  </div>
  <p class="sm-hint" aria-hidden="true">DRAG TO TURN · SCROLL TO ZOOM · ESC TO GO BACK</p>
  <p class="sm-live" data-live aria-live="polite"></p>
  <canvas class="sm-warp" data-warp hidden aria-hidden="true"></canvas>
  <div class="sm-index">
    <p class="sm-index-head">THE ROUTE · ${map.v2}/${map.total} ZONES IN v2 <button type="button" class="sm-close" data-close>✕ CLOSE</button></p>
    <a class="sun" href="${map.sun.href}"><b>${map.sun.tag}</b> ${esc(map.sun.label)}</a>
    ${map.planets.map((p) => `<div style="--pc:${p.color}"><p class="ph"><b>${two(p.index + 1)}</b> ${esc(p.n)} <span>${esc(p.sub)}</span></p>
      <ul>${p.moons.map((m) => `<li><a href="${m.href}" class="${m.v2 ? '' : 'v1'}"><b>${m.primer ? '✦' : m.tag}</b> ${esc(m.label)}</a></li>`).join('')}</ul></div>`).join('')}
  </div>`;
}

/** The zone of the page you are on: a moon's key, 'home' for the overview, or null. */
function hereOf(map: MapData) {
  const now = page(location.pathname);
  if (now === page(map.sun.href)) return 'home';
  for (const p of map.planets) for (const m of p.moons) if (!m.href.includes('?') && page(m.href) === now) return m.key;
  return null;
}

async function build() {
  let descs: Record<string, string> = {};
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/star-map.json`);
    if (r.ok) descs = ((await r.json()) as { descs?: Record<string, string> }).descs ?? {};
  } catch { /* the map works without the descriptions */ }
  const map = buildMap(base, descs);
  const el = document.createElement('section');
  el.className = 'sm'; el.tabIndex = -1; el.dataset.mode = 'system';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Star map: the route through REF·DB');
  el.innerHTML = hud(map);
  // shown before the scene starts, so its camera fits the real size of the screen from the first frame
  document.documentElement.classList.add('sm-open');
  document.body.appendChild(el);
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeStarMap()));
  el.querySelector('[data-to-tasks]')?.addEventListener('click', (e) => { e.preventDefault(); el.querySelector('#sm-tasks')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  try {
    initStarMap(el, map, { here: hereOf(map), close: () => closeStarMap() });
  } catch (e) {
    el.classList.add('sm-nogl'); // no WebGL: the plain index of every phase and zone
    try { console.warn('Star map: no 3D view.', (e as Error).message); } catch { /* console may be absent */ }
  }
  // Escape goes back a level inside the map (the scene handles that) and closes it from the system view
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || el.hidden || e.defaultPrevented) return;
    if (el.dataset.mode === 'system' || el.classList.contains('sm-nogl')) { e.preventDefault(); closeStarMap(); }
  });
  return el;
}

const expanded = (open: boolean) => document.querySelectorAll('[data-starmap-open]').forEach((b) => b.setAttribute('aria-expanded', String(open)));

/** Open the map, or close it if it is open. `fromLink`: opened by a #map link, so there is no hash to restore. */
export async function toggleStarMap(button?: HTMLElement | null, fromLink = false) {
  if (root && !root.hidden) { closeStarMap(); return; }
  opener = button ?? null;
  savedHash = fromLink ? '' : location.hash;
  // on a phone the button is in the site menu: close the menu first
  if (document.body.hasAttribute('data-mobile-menu-expanded')) document.querySelector<HTMLButtonElement>('starlight-menu-button button')?.click();
  document.documentElement.classList.add('sm-loading');
  try { root ??= await (building ??= build()); } catch (e) { document.documentElement.classList.remove('sm-open'); throw e; } finally { document.documentElement.classList.remove('sm-loading'); }
  root.hidden = false;
  document.documentElement.classList.add('sm-open');
  expanded(true);
  root.focus({ preventScroll: true });
}

export function closeStarMap() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.documentElement.classList.remove('sm-open');
  expanded(false);
  try { history.replaceState(null, '', location.pathname + location.search + savedHash); } catch { /* history can be blocked */ }
  opener?.focus({ preventScroll: true });
}
