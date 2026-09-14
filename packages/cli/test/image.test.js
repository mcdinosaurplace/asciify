import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { encodePNG } from 'asciify-core';

const cli = new URL('../cli.js', import.meta.url).pathname;
const run = (...a) => execFileSync('node', [cli, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ons = (art) => (art.match(/[▀▄█]/g) || []).length;

test('the image command reads PNG on its own and, on macOS, JPEG, GIF, TIFF, and SVG through sips and Quick Look', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'asciify-'));
  try {
    const w = 64, h = 64, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(Math.hypot(x - 31.5, y - 31.5) <= 20 ? [0, 0, 0, 255] : [255, 255, 255, 255], (y * w + x) * 4);
    const png = join(dir, 'disc.png');
    writeFileSync(png, await encodePNG({ width: w, height: h, data }, deflateSync));
    const base = run('image', png, '--cols', '32');
    assert.equal(base.split('\n').length - 1, 16);
    const n = ons(base);
    assert.ok(n > 120 && n < 200, `a disc of about 160 cells, got ${n}`);
    if (process.platform !== 'darwin') return;
    for (const fmt of ['jpeg', 'gif', 'tiff']) {
      const file = join(dir, `disc.${fmt}`);
      execFileSync('sips', ['-s', 'format', fmt, png, '--out', file], { stdio: 'ignore' });
      const art = run('image', file, '--cols', '32');
      assert.ok(Math.abs(ons(art) - n) <= 8, `${fmt}: ${ons(art)} cells against ${n} from the PNG`);
    }
    const svg = join(dir, 'disc.svg');
    writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/><circle cx="32" cy="32" r="20" fill="black"/></svg>');
    const art = run('image', svg, '--cols', '32');
    assert.ok(Math.abs(ons(art) - n) <= 12, `svg: ${ons(art)} cells against ${n} from the PNG`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
