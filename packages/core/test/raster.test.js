import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { paintCell, fontNames, fontGlyphs, render, rasterizeGrid, imageFromGrid, imageFromBitmap, svgFromBitmap, svgFromGrid, encodePNG, decodePNG, parseBitmap, parseFont, rasterizeText, imageToBitmap, renderHalfblocks, components, toGrid, fitColorway, PRESETS } from '../index.js';

const count = (grid) => grid.reduce((n, v) => n + (v ? 1 : 0), 0);
const GEORGIA = '/System/Library/Fonts/Supplemental/Georgia.ttf';

test('every non-ASCII glyph the embedded fonts use has a geometric painter', () => {
  const glyphs = new Set();
  for (const name of fontNames()) for (const ch of fontGlyphs(name)) if (ch.codePointAt(0) > 126) glyphs.add(ch);
  const missing = [...glyphs].filter((ch) => !paintCell(ch, 8, 16));
  assert.deepEqual(missing, []);
  assert.ok(glyphs.size >= 30);
  assert.equal(paintCell('A', 8, 16), undefined, 'letters need a font');
});

test('block cells fill the right fractions and shades the right densities', () => {
  assert.equal(count(paintCell('█', 4, 8)), 32);
  assert.equal(count(paintCell('▀', 4, 8)), 16);
  assert.equal(count(paintCell('▄', 4, 8)), 16);
  assert.equal(count(paintCell('▌', 4, 8)), 16);
  assert.equal(count(paintCell('░', 4, 8)), 8);
  assert.equal(count(paintCell('▒', 4, 8)), 16);
  assert.equal(count(paintCell('▓', 4, 8)), 24);
  const top = paintCell('▀', 4, 8);
  assert.ok([0, 1, 2, 3].every((x) => top[x] === 1) && [0, 1, 2, 3].every((x) => top[7 * 4 + x] === 0));
});

test('box drawing: single lines through the center, double lines as two, corners joined', () => {
  const w = 8, h = 16;
  const at = (g, x, y) => g[y * w + x];
  const hz = paintCell('─', w, h);
  assert.equal(count(hz), 8);
  assert.ok(at(hz, 0, 7) === 1 && at(hz, 7, 7) === 1);
  const dbl = paintCell('═', w, h);
  assert.equal(count(dbl), 16);
  assert.ok(at(dbl, 3, 5) === 1 && at(dbl, 3, 9) === 1 && at(dbl, 3, 7) === 0, 'two lines with a gap');
  const corner = paintCell('╔', w, h);
  assert.ok(at(corner, 1, 5) === 1 && at(corner, 7, 5) === 1 && at(corner, 1, 15) === 1, 'outer lines reach the edges');
  assert.ok(at(corner, 5, 9) === 1 && at(corner, 7, 9) === 1 && at(corner, 5, 15) === 1, 'inner lines too');
  assert.ok(at(corner, 0, 0) === 0 && at(corner, 3, 3) === 0, 'nothing above or left of the corner');
  assert.ok(count(paintCell('┃', w, h)) > count(paintCell('│', w, h)), 'heavy is thicker');
  assert.equal(count(paintCell('╭', w, h)), count(paintCell('┌', w, h)));
  assert.ok(count(paintCell('╱', w, h)) >= h);
});

test("a wordmark's PNG decodes back through our own decoder to the rasterized grid", async () => {
  const art = render('WIZ', 'ANSI Regular').text;
  const raster = rasterizeGrid(art, { cellW: 4, cellH: 8 });
  assert.deepEqual(raster.missing, []);
  const image = imageFromGrid(raster, { background: [0, 0, 0], color: [255, 255, 255] });
  const back = await decodePNG(await encodePNG(image, deflateSync), inflateSync);
  assert.deepEqual([back.width, back.height], [raster.cols * 4, raster.rows * 8]);
  assert.deepEqual([...back.data], [...image.data]);
  let lit = 0;
  for (let i = 0; i < back.width * back.height; i++) if (back.data[i * 4] === 255) lit++;
  assert.equal(lit, count(raster.data));
  const transparent = imageFromGrid(raster);
  assert.equal(transparent.data[(0 * transparent.width + 8) * 4 + 3], 0, 'no background means alpha zero in the gap after the W');
  assert.equal(transparent.data[3], 255, 'and full alpha on the W');
});

test('rasters of a bitmap: px per art pixel, region colors, and SVG rects per run', () => {
  const bitmap = parseBitmap('##..\n##..\n', '');
  const palette = fitColorway({ name: 'x', ...PRESETS.mono }, 'dark');
  const img = imageFromBitmap(bitmap, { px: 3, palette, background: [1, 2, 3] });
  assert.deepEqual([img.width, img.height], [12, 6]);
  assert.deepEqual([...img.data.slice(0, 4)], [230, 230, 230, 255]);
  assert.deepEqual([...img.data.slice((0 * 12 + 11) * 4, (0 * 12 + 11) * 4 + 4)], [1, 2, 3, 255]);
  const svg = svgFromBitmap(bitmap, { palette });
  assert.equal((svg.match(/<rect/g) || []).length, 1, 'a solid block is one rect');
  assert.ok(svg.includes('viewBox="0 0 4 2"'));
  const two = svgFromBitmap(parseBitmap('AB\n..\n'), { palette, regionColors: { B: [255, 0, 0] } });
  assert.ok(two.includes('fill="#ff0000"'));
});

test('the outline rasterizer fills text from a system font, and text becomes block art', { skip: !existsSync(GEORGIA) && 'Georgia is not on this machine' }, async () => {
  const font = parseFont(readFileSync(GEORGIA));
  const cov = rasterizeText(font, 'A', { size: 40 });
  assert.ok(cov.width > 15 && cov.height > 20, `${cov.width} x ${cov.height}`);
  const ink = cov.data.reduce((n, v) => n + v, 0);
  assert.ok(ink > 100 && ink < cov.width * cov.height / 2, `ink ${ink}`);
  assert.ok(cov.data.every((v) => v >= 0 && v <= 1));
  const word = rasterizeText(font, 'HI', { size: 200, padding: 20 });
  const data = new Uint8ClampedArray(word.width * word.height * 4);
  for (let i = 0; i < word.width * word.height; i++) { const v = Math.round(255 * (1 - word.data[i])); data.set([v, v, v, 255], i * 4); }
  const r = imageToBitmap({ width: word.width, height: word.height, data }, { cols: 40, ink: 'dark' });
  const pieces = components(toGrid(r.bitmap), { value: true, connectivity: 8 }).filter((p) => p.size >= 4);
  assert.equal(pieces.length, 2, 'H and I');
  const art = renderHalfblocks(r.bitmap);
  assert.ok(art.includes('█'));
  const grid = rasterizeGrid('A█\n', { cellW: 8, cellH: 16, font });
  assert.deepEqual(grid.missing, []);
  assert.ok(count(grid.data.subarray(0, 8)) >= 0 && count(grid.data) > 128, 'the letter and the block both painted');
  const svg = svgFromGrid('A█\n', { cellW: 8, cellH: 16, font });
  assert.ok(svg.svg.includes('<path d="') && svg.svg.includes('<rect'));
});
