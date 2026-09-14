import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measure } from '../index.js';

const render = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('counts code points, not bytes', () => {
  const line = '█'.repeat(45);
  assert.equal(Buffer.byteLength(line), 135);
  assert.deepEqual(measure(line), { rows: 1, cols: 45, widths: [45] });
});

test('the Calvin S render measures 39 by 3', () => {
  assert.deepEqual(measure(render('05-wordmark-calvin-s.txt')), { rows: 3, cols: 39, widths: [39, 39, 39] });
});

test('the two-line ANSI Shadow render measures 65 by 12', () => {
  const m = measure(render('05-wordmark-list-sorcerer-two-lines.txt'));
  assert.equal(m.rows, 12);
  assert.equal(m.cols, 65);
});

test('a final newline is not a row, and an empty text has no rows', () => {
  assert.equal(measure('ab\ncd\n').rows, 2);
  assert.deepEqual(measure(''), { rows: 0, cols: 0, widths: [] });
});
