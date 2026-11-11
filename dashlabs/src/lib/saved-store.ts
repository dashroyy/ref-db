// "Saved for later": product ids in the visitor's browser (no account needed).

const KEY = 'dashlabs.saved.v1';
const EVENT = 'dashlabs:saved';

export function readSaved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked — the list just won't persist */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: ids }));
}

export const isSaved = (id: string) => readSaved().includes(id);
export function toggleSaved(id: string): boolean {
  const ids = readSaved();
  const on = !ids.includes(id);
  write(on ? [id, ...ids] : ids.filter((x) => x !== id));
  return on;
}
export function onSavedChange(fn: (ids: string[]) => void) {
  window.addEventListener(EVENT, (e) => fn((e as CustomEvent<string[]>).detail));
  window.addEventListener('storage', (e) => e.key === KEY && fn(readSaved()));
}

/** Wire every [data-save="productId"] button on the page: pressed state + toggling. */
export function wireSaveButtons(root: ParentNode = document) {
  const sync = () =>
    root.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) => {
      const on = isSaved(b.dataset.save!);
      b.setAttribute('aria-pressed', String(on));
      b.title = on ? 'Saved — click to remove' : 'Save for later';
    });
  root.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((b) => {
    if (b.dataset.saveWired) return;
    b.dataset.saveWired = '';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const on = toggleSaved(b.dataset.save!);
      b.classList.remove('pop');
      void b.offsetWidth;
      if (on) b.classList.add('pop');
    });
  });
  sync();
  onSavedChange(sync);
}
