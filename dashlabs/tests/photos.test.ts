import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionFromFile } from '../src/lib/caption.ts';

test('photo descriptions come from the file name', () => {
  assert.equal(captionFromFile('/src/photos/products/pen-launcher/02-on-the-desk.jpg'), 'on the desk');
  assert.equal(captionFromFile('01_golden_retriever.JPG'), 'golden retriever');
  assert.equal(captionFromFile('side view.png'), 'side view');
});

test('camera file names give no description (a numbered fallback is used)', () => {
  for (const f of ['IMG_4512.jpg', 'DSC0042.jpg', 'PXL_20261101_101010.jpg', '03.jpg']) assert.equal(captionFromFile(f), '', f);
});
