import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseBitmap, toGrid, renderHalfblocks, scaleBitmap, bitmapMap, halfblocksToPixels, geometry, renderScene, check } from '../index.js';

const root = new URL('../../../', import.meta.url);
const { rect, ellipse, star, line, polygon, union, subtract, outline } = geometry;
const count = (shape, w, h) => { let n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (shape(x, y, x, y)) n++; return n; };

test('parseBitmap: dots and spaces are off, other characters name regions, short rows pad, odd heights pad', () => {
  const b = parseBitmap('#A.\n.B\n#\n');
  assert.deepEqual([b.width, b.height], [3, 4]);
  assert.deepEqual(b.cells, [['#', 'A', null], [null, 'B', null], ['#', null, null], [null, null, null]]);
  assert.deepEqual(toGrid(b).rows[0], [true, true, false]);
});

test('renderHalfblocks and halfblocksToPixels round-trip', () => {
  const text = '#.#.\n.##.\n##..\n...#\n';
  const b = parseBitmap(text);
  const art = renderHalfblocks(b);
  assert.equal(art, '▀▄█\n▀▀ ▄\n');
  assert.deepEqual(halfblocksToPixels(art).rows, toGrid(b).rows);
});

test('scaleBitmap doubles both axes and rejects fractions', () => {
  const b = scaleBitmap(parseBitmap('#.\n.#\n'), 2);
  assert.deepEqual([b.width, b.height], [4, 4]);
  assert.equal(renderHalfblocks(b), '██\n  ██\n');
  assert.throws(() => scaleBitmap(parseBitmap('#\n'), 1.5), /whole number/);
});

test('bitmapMap has a tens row, a units row, and a label every ten rows', () => {
  const b = parseBitmap(Array(12).fill('#'.repeat(12)).join('\n') + '\n');
  const lines = bitmapMap(b).split('\n');
  assert.equal(lines[0], '    0         1');
  assert.equal(lines[1], '    012345678901');
  assert.equal(lines[2], '  0 ############');
  assert.equal(lines[3], '    ############');
  assert.equal(lines[12], ' 10 ############');
});

test('geometry primitives', () => {
  assert.equal(count(rect(2, 2, 4, 3), 10, 10), 6);
  assert.equal(count(ellipse(5, 5, 0.5, 0.5), 10, 10), 1);
  assert.ok(count(star(5, 5, 2.6), 11, 11) > 8 && count(star(5, 5, 1.3), 11, 11) <= 5, 'a star at radius 2.6 reads and one at 1.3 is a notch');
  assert.equal(count(line(0, 0, 9, 0, 1), 10, 1), 10);
  assert.equal(count(polygon([[0, 0], [10, 0], [10, 10], [0, 10]]), 20, 20), 100);
  assert.equal(count(union(rect(0, 0, 1, 1), rect(5, 5, 6, 6)), 10, 10), 8);
  assert.equal(count(subtract(rect(0, 0, 3, 3), rect(1, 1, 2, 2)), 10, 10), 12);
  assert.equal(count(outline(rect(0, 0, 4, 4), 1), 10, 10), 16);
});

test('renderScene: a layer with a gap clears the layer below around its mask, and a mask keeps occluding where the shape is cut', () => {
  const below = { key: 'B', shape: rect(0, 0, 9, 9) };
  const above = { key: 'A', shape: subtract(rect(4, 4, 6, 6), rect(5, 5, 5, 5)), mask: rect(4, 4, 6, 6), gap: 1 };
  const b = renderScene([below, above], { width: 10, height: 10 });
  assert.equal(b.cells[5][5], null, 'the cut pixel shows nothing, not the layer below');
  assert.equal(b.cells[4][4], 'A');
  assert.equal(b.cells[3][3], null, 'the gap clears the layer below');
  assert.equal(b.cells[2][2], 'B');
  assert.equal(b.cells[3][3], null);
});

test('the badge example reproduces the old render byte for byte at scale 1.5, and the old script live at three scales', async () => {
  const mod = await import(new URL('skills/asciify/references/examples/badge.mjs', root));
  const build = (S) => { const w = Math.round(mod.design.width * S); let h = Math.round(mod.design.height * S); h += h % 2; return renderScene(mod.scene(geometry, S), { width: w, height: h, scale: S }); };
  const reference = readFileSync(new URL('./fixtures/04-halfblock-69x26.txt', import.meta.url), 'utf8');
  assert.equal(renderHalfblocks(build(1.5), { trim: true }), reference);
  const script = new URL('./fixtures/halfblock-badge.mjs', import.meta.url).pathname;
  for (const S of [1, 1.5, 2]) {
    const live = execFileSync('node', [script, String(S)], { encoding: 'utf8' });
    assert.equal(renderHalfblocks(build(S)), live, `scale ${S}`);
  }
  const c = check(renderHalfblocks(build(1.5), { trim: true }), { mode: 'bitmap', maxRows: 40 });
  assert.equal(c.ok, true);
});
