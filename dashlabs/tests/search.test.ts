import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchIndex, queryTerms, type SearchItem } from '../src/lib/search.ts';

const item = (t: string, s: string, x = 'Page'): SearchItem => ({ t, d: '', h: `/${t}`, k: '', c: '', x, s });
const INDEX = [
  item('Pet portrait figurine', 'dog cat custom figurines', '$35'),
  item('Mini-Me figurine', 'person photos custom figurines', '$45'),
  item('Pen Launcher', 'originals launcher desk', '$24'),
  item('What a print costs, and why', 'price estimator learn guide', 'Guide'),
  item('Choosing a material', 'PLA PETG TPU learn guide', 'Guide'),
  item('Shipping', 'shipping invoice destination', 'FAQ'),
  item('Returns and refunds', 'returns refund damaged', 'FAQ'),
  item('Gift finder', 'gift present ideas quiz', 'Tool'),
];
const titles = (q: string) => searchIndex(INDEX, q).map((i) => i.t);

test('filler words are dropped', () => {
  assert.deepEqual(queryTerms('how do I pay').length, 1);
});

test('everyday phrasing finds the right page', () => {
  assert.equal(titles('how much')[0], 'What a print costs, and why');
  assert.equal(titles('delivery')[0], 'Shipping');
  assert.equal(titles('refund')[0], 'Returns and refunds');
  assert.equal(titles('birthday present')[0], 'Gift finder');
  assert.deepEqual(titles('my dog'), ['Pet portrait figurine']); // not PETG
});

test('plurals and one-letter typos still match', () => {
  assert.ok(titles('figurnes').includes('Mini-Me figurine'));
  assert.equal(titles('launchers')[0], 'Pen Launcher');
});

test('partial matches are offered when nothing has every word', () => {
  assert.equal(titles('pen zebra')[0], 'Pen Launcher');
  assert.deepEqual(titles('zzqx'), []);
});

test('an empty query lists the start of the index', () => {
  assert.equal(searchIndex(INDEX, '  ').length, INDEX.length);
});
