import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = new URL('../cli.js', import.meta.url).pathname;
const run = (args, env = {}) => execFileSync('node', [cli, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });

test('a colorway saves from flags, loads by path, and colors a wordmark; NO_COLOR keeps the plain form', () => {
  const dir = mkdtempSync(join(tmpdir(), 'asciify-'));
  try {
    const out = join(dir, 'brand.json');
    run(['colorway', '--name', 'brand', '--primary', '#3366cc', '--secondary', '#cc3366', '--complementary', '#66cc33', '--save', '--out', out]);
    assert.ok(existsSync(out));
    const saved = JSON.parse(readFileSync(out, 'utf8'));
    assert.deepEqual(saved.stops, ['#3366cc', '#cc3366']);
    const ansi = run(['wordmark', 'HI', '--color', out, '--format', 'ansi', '--depth', 'truecolor']);
    assert.ok(ansi.includes('\x1b[38;2;'), 'truecolor escapes');
    const plain = run(['wordmark', 'HI', '--color', out], { NO_COLOR: '1' });
    assert.ok(!plain.includes('\x1b['), 'no escapes under NO_COLOR');
    const html = run(['wordmark', 'HI', '--color', 'synthwave', '--format', 'html']);
    assert.ok(html.includes('<pre role="img"') && html.includes('--g31:'));
    assert.throws(() => run(['wordmark', 'HI', '--color', 'nope', '--format', 'ansi']), /no colorway named/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
