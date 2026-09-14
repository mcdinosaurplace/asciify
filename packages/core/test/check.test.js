import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from '../index.js';

const render = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const issues = (r) => [...r.errors, ...r.warnings];
const has = (r, kind, re) => issues(r).some((i) => i.check === kind && re.test(i.message));
const kinds = (r) => [...new Set(issues(r).map((i) => i.check))];
// pixels (an array of strings of # and .) to half-block text, the inverse of the decoder, for building fixtures
const art = (rows) => {
  const out = [];
  for (let y = 0; y < rows.length; y += 2) {
    let line = '';
    for (let x = 0; x < rows[y].length; x++) {
      const t = rows[y][x] === '#', b = rows[y + 1]?.[x] === '#';
      line += t && b ? '█' : t ? '▀' : b ? '▄' : ' ';
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n') + '\n';
};

test('the Calvin S render passes as a wordmark with nothing to report', () => {
  assert.deepEqual(check(render('05-wordmark-calvin-s.txt'), { mode: 'wordmark' }), { ok: true, errors: [], warnings: [] });
});

test('the ANSI Shadow render passes as a wordmark', () => {
  assert.equal(check(render('05-wordmark-list-sorcerer-two-lines.txt'), { mode: 'wordmark' }).ok, true);
});

test('size: a line over the band is an error', () => {
  const r = check('█'.repeat(79) + '\n');
  assert.equal(r.ok, false);
  assert.ok(has(r, 'size', /line 1 is 79 columns, over the limit of 78/));
  assert.equal(check('█'.repeat(79) + '\n', { band: 'wide' }).ok, true);
  assert.equal(check('█'.repeat(45) + '\n', { band: 'narrow' }).ok, false);
  assert.equal(check('█'.repeat(45) + '\n', { band: 44 }).ok, false);
});

test('size: too many rows is an error', () => {
  const r = check('a\n'.repeat(21));
  assert.ok(has(r, 'size', /21 rows, over the limit of 20/));
  assert.equal(check('a\n'.repeat(21), { maxRows: 40 }).ok, true);
});

test('size: a double-width or zero-width character is an error', () => {
  assert.ok(has(check('漢\n'), 'size', /double-width/));
  assert.ok(has(check('🙂\n'), 'size', /double-width/));
  assert.ok(has(check('a​b\n'), 'size', /zero-width character U\+200B/));
});

test('hygiene: trailing space, tab, control character, escape code, CR, and a missing final newline are errors', () => {
  const cases = [['a \n', /trailing whitespace/], ['a\tb\n', /a tab/], ['a\x01b\n', /control character U\+0001/],
    ['\x1b[31ma\n', /escape code/], ['a\r\n', /carriage return/], ['a', /no final newline/]];
  for (const [text, re] of cases) {
    const r = check(text);
    assert.equal(r.ok, false, JSON.stringify(text));
    assert.ok(has(r, 'hygiene', re), JSON.stringify(text));
  }
});

test('glyphs: outside the safe blocks warns; outside a fixed set warns; allowed characters pass', () => {
  assert.ok(has(check('★\n'), 'glyphs', /"★" is outside the text glyph set/));
  assert.deepEqual(check('★\n', { allow: '★' }).warnings, []);
  assert.ok(has(check('╔═╗\n', { mode: 'bitmap' }), 'glyphs', /outside the bitmap glyph set/));
  assert.deepEqual(check('▀▄█\n', { mode: 'bitmap' }).warnings, []);
  assert.deepEqual(check(' .:-=+*#%@\n', { mode: 'sketch' }).warnings, []);
  assert.ok(has(check('▀\n', { mode: 'sketch' }), 'glyphs', /outside the sketch glyph set/));
});

test('features: a speck and a notch warn', () => {
  const speck = art(['#.........', '..........', '..........', '.....####.', '.....####.', '.....####.']);
  assert.ok(has(check(speck, { mode: 'bitmap' }), 'features', /a piece of 1 pixel at \(0, 0\) reads as a speck/));
  const notch = art(['######', '######', '##.###', '######', '######', '######']);
  assert.ok(has(check(notch, { mode: 'bitmap' }), 'features', /a hole of 1 pixel at \(2, 2\) reads as a notch/));
  const clean = art(['######', '######', '######', '######']);
  assert.deepEqual(check(clean, { mode: 'bitmap' }).warnings, []);
});

test('separation: a thin bridge between two shapes warns', () => {
  const rows = [];
  for (let y = 0; y < 6; y++) rows.push('######' + (y === 3 ? '#' : '.') + '######');
  const r = check(art(rows), { mode: 'bitmap' });
  assert.ok(has(r, 'separation', /2 shapes joined by a thin bridge/));
  const gapped = rows.map((row) => row.replace(/^(######).(######)$/, '$1.$2'));
  assert.ok(!has(check(art(gapped), { mode: 'bitmap' }), 'separation', /bridge/));
});

test('separation: two shapes meeting at a corner warn, and a staircase diagonal does not', () => {
  const corner = art(['##....', '##....', '..##..', '..##..']);
  assert.ok(has(check(corner, { mode: 'bitmap' }), 'separation', /meet only at a corner near \(1, 1\)/));
  const stairs = art(['#.....', '.#....', '..#...', '...#..', '....#.', '.....#']);
  assert.deepEqual(kinds(check(stairs, { mode: 'bitmap' })), []);
});

test('frames: a size mismatch, a wrong last frame, and too many frames are errors', () => {
  const a = 'ab\ncd\n', b = 'ab\ncd\nef\n';
  assert.ok(has(check(a, { frames: [a, b] }), 'frames', /differ in size: 2x2, 2x3/));
  assert.ok(has(check(a, { frames: [a, a], source: b }), 'frames', /last frame is not the source/));
  assert.ok(has(check(a, { frames: Array(241).fill(a) }), 'frames', /241 frames, over the limit of 240/));
  assert.equal(check(a, { frames: [a, a], source: a }).ok, true);
});

test('themes: low contrast in either theme warns, a color near a terminal background warns, good colors pass', () => {
  assert.ok(has(check('a\n', { colors: { light: ['#ffff00'] } }), 'themes', /#ffff00 on the light background #ffffff has a contrast of 1\.07 to 1/));
  assert.ok(has(check('a\n', { colors: { dark: ['#222222'] } }), 'themes', /#222222 on the dark background #111111/));
  assert.ok(has(check('a\n', { colors: { ansi: ['#050505'] } }), 'themes', /#050505 is too close to a black terminal background/));
  assert.ok(has(check('a\n', { colors: { ansi: ['#fafafa'] } }), 'themes', /too close to a white terminal background/));
  assert.deepEqual(check('a\n', { colors: { light: ['#1f4e79'], dark: ['#5fe3c7'], ansi: ['#5fe3c7'] } }).warnings, []);
});

test('the badge render passes as a bitmap with a raised row limit; its warnings are listed for tuning', (t) => {
  const r = check(render('04-halfblock-69x26.txt'), { mode: 'bitmap', maxRows: 40 });
  assert.equal(r.ok, true);
  for (const w of r.warnings) t.diagnostic(`${w.check}: ${w.message}`);
});
