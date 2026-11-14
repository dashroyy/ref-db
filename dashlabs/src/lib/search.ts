// Site search: small, forgiving, no server. The index is built at build time
// (components/Search.astro); this ranks it against what a shopper types.
//   • filler words are ignored ("how do I", "a", "for my")
//   • everyday words map onto the site's words ("how much" → price, "delivery" → shipping)
//   • plurals and one-letter typos still match ("figurnes", "launchers")
//   • if no result has every word, the best partial matches are shown instead

export interface SearchItem {
  t: string; // title
  d: string; // one-line description
  h: string; // link
  k: string; // code shown on the left (DL-F01, L02, TOOL…)
  c: string; // accent colour
  x: string; // right-hand label (price, Guide, Page…)
  s: string; // extra words to match
}

const STOP = new Set(
  'a an and are can could do does for from get have how i in is it me my of on or the to want what where which will with would you your'.split(' '),
);

// everyday word → words the site uses
const SYNONYMS: Record<string, string[]> = {
  much: ['price', 'cost'],
  cost: ['price'],
  costs: ['price'],
  price: ['cost', 'estimator'],
  pricing: ['price', 'cost'],
  cheap: ['price', 'under'],
  expensive: ['price'],
  quote: ['price', 'quote'],
  pay: ['payment', 'invoice'],
  paying: ['payment', 'invoice'],
  card: ['card', 'payment'],
  invoice: ['payment'],
  delivery: ['shipping', 'ship'],
  deliver: ['shipping', 'ship'],
  post: ['shipping'],
  postage: ['shipping'],
  send: ['shipping', 'ship'],
  long: ['lead', 'ship', 'days'],
  fast: ['lead', 'ship', 'days'],
  when: ['lead', 'ship', 'days'],
  return: ['returns', 'refund'],
  refund: ['returns', 'refund'],
  broken: ['returns', 'refund', 'damaged'],
  damaged: ['returns', 'refund'],
  present: ['gift'],
  birthday: ['gift'],
  christmas: ['gift'],
  xmas: ['gift'],
  dog: ['pet'],
  cat: ['pet'],
  puppy: ['pet'],
  animal: ['pet'],
  memorial: ['pet'],
  person: ['mini-me', 'figurine'],
  selfie: ['mini-me', 'photo'],
  myself: ['mini-me'],
  face: ['mini-me', 'photo'],
  statue: ['figurine'],
  figure: ['figurine'],
  model: ['figurine', 'stl', 'file'],
  file: ['stl'],
  obj: ['stl'],
  '3mf': ['stl'],
  upload: ['stl'],
  plastic: ['material', 'pla'],
  filament: ['material', 'pla'],
  strong: ['material', 'petg'],
  outdoor: ['outside', 'asa', 'live'],
  outside: ['asa', 'live'],
  pen: ['launcher'],
  business: ['cards'],
  logo: ['cards', 'custom'],
  name: ['keychain', 'personalised'],
  keyring: ['keychain'],
  personalized: ['personalised'],
  custom: ['custom', 'commission'],
  contact: ['about', 'email'],
  email: ['about', 'contact'],
  basket: ['cart'],
  checkout: ['cart'],
};

const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
const stem = (w: string) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** One edit apart (insert, delete or substitute), for typo tolerance on longer words. */
function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** The words that matter in a query, each with the alternatives it may match. */
export function queryTerms(q: string): string[][] {
  const words = tokens(q);
  const kept = words.filter((w) => !STOP.has(w));
  // a query made only of filler ("how", "what") keeps its words rather than matching everything
  return (kept.length ? kept : words).map((w) => [...new Set([stem(w), ...(SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? []).map(stem)])]);
}

// a word matches whole words (short words), the start of a word, a code, or a word one typo away
function altHits(alt: string, hay: string[], hayText: string): boolean {
  if (/\d/.test(alt)) return hayText.includes(alt); // codes like f01, 3mf
  return hay.some((h) => h === alt || (alt.length >= 4 && h.startsWith(alt)) || (alt.length >= 5 && h.length >= 4 && oneEdit(alt, h)));
}

function termHits(term: string[], hay: string[], hayText: string): boolean {
  return term.some((alt) => altHits(alt, hay, hayText));
}

/** Rank the index for a query: best first, at most `limit`. */
export function searchIndex(index: SearchItem[], q: string, limit = 8): SearchItem[] {
  const terms = queryTerms(q);
  if (!terms.length) return index.slice(0, limit);
  const scored = index.map((it, order) => {
    const hayText = `${it.t} ${it.s} ${it.k}`.toLowerCase();
    const hay = tokens(hayText).flatMap((w) => [stem(w), ...(w.includes('-') ? w.split('-') : [])]);
    const title = it.t.toLowerCase();
    const matched = terms.filter((t) => termHits(t, hay, hayText)).length;
    const first = terms[0];
    const titleRank = first.some((a) => title.startsWith(a)) ? 0 : first.some((a) => title.includes(a)) ? 1 : 2;
    // fewer missed words first, then title matches, then products/guides/tools before plain pages
    const score = (terms.length - matched) * 10 + titleRank + (it.x === 'Page' ? 0.5 : 0) + order / 1000;
    return { it, matched, score };
  });
  const all = scored.filter((r) => r.matched === terms.length);
  const pool = all.length ? all : scored.filter((r) => r.matched > 0 && r.matched >= Math.ceil(terms.length / 2));
  return pool
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((r) => r.it);
}
