#!/usr/bin/env node
// asciify command line: measure, check, wordmark, previews, fonts, bitmap, scene, image, colorway, text, animate, play.
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, extname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inflateSync, deflateSync } from 'node:zlib';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { measure, check, BANDS, wordmark, previews, interpret, hasFont, registerFont, fontNames, FONTS, parseBitmap, renderHalfblocks, scaleBitmap, bitmapMap, geometry, renderScene, decodePNG, decodeBMP, imageToBitmap, imageToSketch, classify, grayscale, preset, colorwayNames, makeColorway, fitColorway, fitContrast, BACKGROUNDS, parseColor, toHex, colorizeText, colorizeBitmap, colorizeSketch, fg, RESET, htmlText, htmlBitmap, htmlSketch, render, encodePNG, parseFont, rasterizeText, rasterizeGrid, imageFromGrid, imageFromBitmap, imageFromFrame, svgFromBitmap, svgFromGrid, frameFromText, frameToText, paintFrame, frameFromBitmap, ansiFrame, htmlFrame, clipToJSON, clipFromJSON, animate, parseEffects, effectNames, encodeGIF } from 'asciify-core';

const FIGLET_VERSION = '1.11.4';
const [command, ...rest] = process.argv.slice(2);
const args = [], flags = {};
const regions = [];   // --region KEY=COLOR, repeatable
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--region' && rest[i + 1]) { regions.push(rest[i + 1]); i++; }
  else if (rest[i].startsWith('--')) { const next = rest[i + 1]; if (next === undefined || next.startsWith('--')) flags[rest[i].slice(2)] = ''; else { flags[rest[i].slice(2)] = next; i++; } } else args.push(rest[i]);
}
const note = (s) => process.stderr.write(`# ${s}\n`);
const num = (v) => (v === undefined ? undefined : Number(v));
const band = flags.band && /^\d+$/.test(flags.band) ? Number(flags.band) : flags.band;

// A figlet font that is not embedded: the cache under ~/.cache/asciify/fonts, then the figlet package on the jsDelivr CDN.
async function loadFont(name) {
  if (hasFont(name)) return;
  const dir = join(homedir(), '.cache', 'asciify', 'fonts');
  const file = join(dir, `${name}.flf`);
  if (existsSync(file)) { registerFont(name, readFileSync(file, 'utf8')); return; }
  const url = `https://cdn.jsdelivr.net/npm/figlet@${FIGLET_VERSION}/fonts/${encodeURIComponent(name)}.flf`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`no figlet font named "${name}" (${res.status} from ${url})`);
  const flf = await res.text();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, flf);
  registerFont(name, flf);
  note(`fetched ${name} from the figlet package and cached it at ${file}`);
}

// An image file as RGBA pixels: PNG and BMP decode here; on macOS anything else goes through sips, and SVG through Quick Look first.
async function readImage(file) {
  const ext = extname(file).toLowerCase();
  if (ext === '.png') return decodePNG(readFileSync(file), inflateSync);
  if (ext === '.bmp') return decodeBMP(readFileSync(file));
  if (process.platform !== 'darwin') throw new Error(`only PNG and BMP decode without macOS; convert ${basename(file)} to PNG first`);
  const tmp = join(tmpdir(), `asciify-${process.pid}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  try {
    if (ext === '.svg') {
      // Quick Look draws an SVG faithfully only when its root has a viewBox and no fixed width or height; otherwise it lays the
      // file out like a page, small and top-left. So a temporary copy gets the fixed size moved into a viewBox.
      let svg = readFileSync(file, 'utf8');
      const root = svg.match(/<svg\b[^>]*>/i)?.[0];
      let aspect = 1;   // width over height of the drawing, to crop the square canvas Quick Look pads it into
      if (root) {
        const attr = (n) => root.match(new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
        const w = parseFloat(attr('width')), h = parseFloat(attr('height'));
        const vb = attr('viewBox')?.trim().split(/[\s,]+/).map(Number);
        if (vb?.length === 4 && vb[2] > 0 && vb[3] > 0) aspect = vb[2] / vb[3];
        else if (w > 0 && h > 0) aspect = w / h;
        let fixed = root.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
        if (!vb && w > 0 && h > 0) fixed = fixed.replace(/<svg\b/i, `<svg viewBox="0 0 ${w} ${h}"`);
        svg = svg.replace(root, fixed);
      }
      const copy = join(tmp, basename(file));
      writeFileSync(copy, svg);
      execFileSync('qlmanage', ['-t', '-s', '1024', '-o', tmp, copy], { stdio: 'ignore' });
      const img = await decodePNG(readFileSync(`${copy}.png`), inflateSync);
      if (img.width !== img.height || Math.abs(aspect - 1) < 1e-6) return img;
      const cw = aspect >= 1 ? img.width : Math.round(img.width * aspect), ch = aspect >= 1 ? Math.round(img.height / aspect) : img.height;
      const x0 = Math.floor((img.width - cw) / 2), y0 = Math.floor((img.height - ch) / 2), data = new Uint8ClampedArray(cw * ch * 4);
      for (let y = 0; y < ch; y++) data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + cw) * 4), y * cw * 4);
      return { width: cw, height: ch, data };
    }
    const out = join(tmp, 'image.bmp');
    execFileSync('sips', ['-s', 'format', 'bmp', file, '--out', out], { stdio: 'ignore' });
    return decodeBMP(readFileSync(out));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// Color: a preset by name, a saved colorway from ./.asciify/colorways/<name>.json, or a path to one. 'image' means the image's own colors.
const COLORWAY_DIR = join('.asciify', 'colorways');
function loadColorway(spec) {
  if (preset(spec)) return preset(spec);
  for (const file of [join(COLORWAY_DIR, `${spec}.json`), spec]) {
    if (file.endsWith('.json') && existsSync(file)) return { name: spec, ...JSON.parse(readFileSync(file, 'utf8')) };
  }
  throw new Error(`no colorway named "${spec}". Presets: ${colorwayNames().join(', ')}. Saved colorways live in ${COLORWAY_DIR}/.`);
}
const MONO = { name: 'mono', stops: ['#e6e6e6'], shadow: '#7a7a7a', accent: '#ffffff' };
const depth = flags.depth ?? (/truecolor|24bit/i.test(process.env.COLORTERM ?? '') ? 'truecolor' : '256');
const theme = flags.theme ?? (flags.ground === 'light' ? 'light' : 'dark');   // a light ground for a sketch means a light theme for its raster
// The plain form is the default. --color implies ANSI on a terminal unless NO_COLOR is set; --format decides outright.
function outputFormat() {
  if (flags.format) return flags.format;
  if (!flags.color) return 'text';
  if (process.env.NO_COLOR) { note('NO_COLOR is set, so this is the plain form'); return 'text'; }
  if (!process.stdout.isTTY) { note('output is not a terminal, so this is the plain form; pass --format ansi to force color'); return 'text'; }
  return 'ansi';
}
// Write the art in the chosen format. `forms` supplies the plain text and builders for ansi, html, png, and svg.
// --out writes to that file instead of stdout; the only file the command ever writes, and only when asked.
async function deliver(forms) {
  const format = outputFormat();
  let out;
  if (format === 'text') out = forms.text;
  else if (format === 'ansi') out = forms.ansi();
  else if (format === 'html') out = forms.html();
  else if (format === 'svg') out = await forms.svg();
  else if (format === 'png') out = await forms.png();
  else throw new Error(`unknown format: ${format}. Formats: text, ansi, html, svg, png.`);
  if (flags.out !== undefined && flags.out !== '') { writeFileSync(flags.out, out); note(`wrote ${flags.out}`); return; }
  if (format === 'png' && process.stdout.isTTY) throw new Error('PNG is binary: redirect it to a file or pass --out FILE');
  process.stdout.write(out);
}
const pngOf = (image) => encodePNG(image, deflateSync);
const px = () => num(flags.px) ?? 8, cellW = () => num(flags.cell) ?? 8;
const ground = (pal) => ('transparent' in flags ? null : parseColor(pal.background));

// A Google Fonts family by name: the CSS endpoint hands a TrueType URL to a plain user agent; fetched once and cached.
async function googleFont(family) {
  const dir = join(homedir(), '.cache', 'asciify', 'fonts'), file = join(dir, `google-${family.replace(/[^A-Za-z0-9]+/g, '-')}.ttf`);
  if (!existsSync(file)) {
    const css = await fetch(`https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const url = css.ok ? (await css.text()).match(/url\((https:[^)]+\.ttf)\)/)?.[1] : null;
    if (!url) throw new Error(`no Google Fonts family named "${family}" (${css.status})`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not fetch ${family} (${res.status})`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
    note(`fetched ${family} from Google Fonts and cached it at ${file}`);
  }
  return file;
}
// The outline font: --font-file, or --google NAME, else DejaVu Sans Mono fetched once from the npm CDN and cached.
async function rasterFont() {
  if (flags['font-file']) return parseFont(readFileSync(flags['font-file']));
  if (flags.google) return parseFont(readFileSync(await googleFont(flags.google)));
  const dir = join(homedir(), '.cache', 'asciify', 'fonts'), file = join(dir, 'DejaVuSansMono.ttf');
  if (!existsSync(file)) {
    const url = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSansMono.ttf';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`could not fetch DejaVu Sans Mono (${res.status} from ${url}); pass --font-file with a .ttf`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
    note(`fetched DejaVu Sans Mono for the ASCII glyphs and cached it at ${file}`);
  }
  return parseFont(readFileSync(file));
}
const needsFont = (text) => [...text].some((ch) => ch !== ' ' && ch !== '\n' && ch.codePointAt(0) < 127);
// raster forms for a character grid (wordmarks, sketches): geometric cells plus the outline font for ASCII glyphs
function gridRasters(text, pal, dir) {
  const opts = async () => ({ cellW: cellW(), cellH: cellW() * 2, font: needsFont(text) ? await rasterFont() : null, palette: pal, direction: dir });
  return {
    png: async () => { const r = rasterizeGrid(text, await opts()); if (r.missing.length) note(`no painter for: ${r.missing.join(' ')}`); return pngOf(imageFromGrid(r, { background: ground(pal) })); },
    svg: async () => { const r = svgFromGrid(text, { ...(await opts()), background: ground(pal) }); if (r.missing.length) note(`no painter for: ${r.missing.join(' ')}`); return r.svg; },
  };
}
const bitmapRasters = (bitmap, pal, dir, rc) => ({
  png: async () => pngOf(imageFromBitmap(bitmap, { px: px(), palette: pal, regionColors: rc.ansi, direction: dir, background: ground(pal) })),
  svg: async () => svgFromBitmap(bitmap, { palette: pal, regionColors: rc.ansi, direction: dir, background: ground(pal) }),
});
const palettes = (cw) => ({ dark: fitColorway(cw, 'dark'), light: fitColorway(cw, 'light') });
// --region KEY=COLOR pins a region's color; ANSI takes the theme's fitted color, HTML carries both themes
function regionColors() {
  const ansi = {}, html = {};
  for (const spec of regions) {
    const [key, color] = spec.split('=');
    if (!key || !color) throw new Error(`--region wants KEY=COLOR, not "${spec}"`);
    const rgb = parseColor(color);
    ansi[key] = fitContrast(rgb, BACKGROUNDS[theme]);
    html[key] = { dark: fitContrast(rgb, BACKGROUNDS.dark), light: fitContrast(rgb, BACKGROUNDS.light) };
  }
  return { ansi, html };
}
const direction = () => flags.direction;

// Animation: play a clip in place, write the web player, or the embeddable snippet.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function play(clip, { speed = 1, loop } = {}) {
  const out = process.stdout;
  if (!out.isTTY) { out.write(frameToText(clip.frames[clip.frames.length - 1])); note('output is not a terminal, so this is the final frame'); return; }
  const restore = () => out.write('\x1b[?25h');
  process.on('SIGINT', () => { restore(); out.write('\n'); process.exit(0); });
  out.write('\x1b[?25l');
  let i = 0, first = true;
  for (;;) {
    if (!first) out.write(`\x1b[${clip.height}A`);
    out.write(ansiFrame(clip.frames[i], { depth }));
    first = false;
    await sleep(1000 / (clip.fps * speed));
    i++;
    if (i >= clip.frames.length) {
      if (loop === false || (clip.loopFrom === null && !loop)) break;
      i = loop && clip.loopFrom === null ? 0 : clip.loopFrom;
    }
  }
  restore();
}
function webPlayer(clip, { alt, ground = '#111111' }) {
  const id = `asciify-${Math.abs(clip.frames.length * 2654435761 + clip.width * 40503 + clip.height) % 0xffffff}`.padEnd(8, '0');
  const frames = clip.frames.map((f) => htmlFrame(f));
  const font = '"SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
  return `<style>
.${id}{display:inline-block;padding:1em;background:${ground};color:#e6e6e6}
.${id} pre{margin:0;font:14px/1 ${font};letter-spacing:0;font-variant-ligatures:none;white-space:pre}
</style>
<div class="${id}"><pre role="img" aria-label="${alt.replace(/"/g, '&quot;')}">\n${frames[frames.length - 1]}</pre></div>
<script>(function(){var frames=${JSON.stringify(frames)},fps=${clip.fps},loopFrom=${JSON.stringify(clip.loopFrom)};
var pre=document.querySelector('.${id} pre');if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var i=0;function tick(){pre.innerHTML='\\n'+frames[i];i++;if(i>=frames.length){if(loopFrom===null)return;i=loopFrom;}setTimeout(tick,1000/fps);}tick();})();</script>
`;
}
function snippet(clip) {
  return `#!/usr/bin/env node
// An asciify animation, self-contained: import { play } from './this-file.mjs' and await play(), or run the file.
const clip = ${clipToJSON(clip)};
const RESET = '\\x1b[0m';
const code = (rgb, layer) => \`\\x1b[\${layer};2;\${rgb.join(';')}m\`;
const rgb = (h) => h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : null;
const line = (f, y, row) => { let out = '', cur = ''; [...row].forEach((ch, x) => { const fg = rgb(f.fg?.[y]?.[x]), bg = rgb(f.bg?.[y]?.[x]); const c = (fg ? code(fg, 38) : '') + (bg ? code(bg, 48) : ''); if (c !== cur) { out += (cur ? RESET : '') + c; cur = c; } out += ch; }); return out + (cur ? RESET : ''); };
const frameText = (f) => f.text.replace(/\\n$/, '').split('\\n').map((row, y) => line(f, y, row)).join('\\n') + '\\n';
export async function play({ speed = 1, loop = clip.loopFrom !== null } = {}) {
  const out = process.stdout, color = out.isTTY && !process.env.NO_COLOR;
  if (!color) { out.write(clip.frames[clip.frames.length - 1].text); return; }
  out.write('\\x1b[?25l');
  const restore = () => out.write('\\x1b[?25h');
  process.once('SIGINT', () => { restore(); out.write('\\n'); process.exit(0); });
  for (let i = 0, first = true; ; i++) {
    if (i >= clip.frames.length) { if (!loop) break; i = clip.loopFrom ?? 0; }
    if (!first) out.write(\`\\x1b[\${clip.height}A\`);
    out.write(frameText(clip.frames[i])); first = false;
    await new Promise((r) => setTimeout(r, 1000 / (clip.fps * speed)));
  }
  restore();
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) play();
`;
}

function wordmarkOptions() {
  const o = flags.style ? interpret(flags.style).options : {};
  if (flags.style) { const r = interpret(flags.style); if (r.ignored.length) note(`ignored style words: ${r.ignored.join(', ')}`); }
  if (flags.font) o.font = flags.font;
  if (flags.family) o.family = flags.family;
  if (flags.layout) o.layout = flags.layout;
  if (flags.spacing) o.letterSpacing = num(flags.spacing);
  if (flags.leading) o.leading = num(flags.leading);
  if (flags.align) o.align = flags.align;
  if (band) o.band = band;
  if (flags.rows) o.maxRows = num(flags.rows);
  return o;
}

function report(c) {
  for (const e of c.errors) console.log(`error    ${e.check}: ${e.message}`);
  for (const w of c.warnings) console.log(`warning  ${w.check}: ${w.message}`);
  console.log(c.ok ? `ok (${c.warnings.length} warning${c.warnings.length === 1 ? '' : 's'})` : `not ok (${c.errors.length} error${c.errors.length === 1 ? '' : 's'})`);
  process.exitCode = c.ok ? 0 : 1;
}

const usage = `usage: asciify measure <file>
       asciify check <file> [--mode text|wordmark|bitmap|sketch] [--band narrow|standard|wide|N] [--rows N] [--allow CHARS]
       asciify wordmark "TEXT" [--font F] [--family FAM] [--style "words"] [--band B] [--rows N] [--layout L] [--spacing N] [--leading N] [--align left|center|right]
       asciify previews "TEXT" [--family FAM] [--exclude F] [--count N] [--band B] [--rows N]
       asciify fonts [--family FAM]
       asciify image <file> [--mode auto|bitmap|sketch] [--cols N] [--band B] [--rows N] [--map]
                            bitmap: [--threshold 0-255] [--dither] [--ink auto|dark|light] [--bg white|black] [--no-despeckle]
                            sketch: [--ramp long|short|blocks] [--ground dark|light] [--edges N|off] [--no-stretch]
       asciify bitmap <file> [--scale N] [--map] [--band B] [--rows N]      rows of . and # (any other character names a region)
       asciify scene <file.mjs> [--scale S] [--map] [--band B] [--rows N]  a module exporting design {width, height} and scene(geometry, scale)
       asciify text "TEXT" --font-file F.ttf | --google "Family" [--size N] [--cols N] [--band B] [--rows N] [--threshold N] [--dither] [--map]   text set in any font becomes block art
       asciify animate <art.txt|-> [--reveal E,E:0.5] [--loop E,E:0.5] [--effects E] [--fps 12] [--seconds 2] [--loop-seconds 2] [--cycles 1] [--seed 1]
                       [--color CW] [--format json|txt|html|gif|play|snippet] [--out FILE] [--once|--forever] [--speed 1]
                       reveals: typewriter wipe dissolve rain static burn   loops: glitch crt phosphor interlace flicker vhs roll blink scroll matrix
                       color: hue-cycle pulse color-flicker gradient-scroll channel-offset glow   an effect takes :intensity and :key=value params
       asciify play <clip.json> [--speed 1] [--once|--forever]
       asciify colorway [--name N] [--primary C] [--secondary C] [--complementary C] [--save] [--out FILE]   a picker on a terminal
Color, on any art command: --color <preset|saved name|file.json> (presets: matrix, amber, mono, sunset, synthwave, bladerunner,
rad-sorcerer; 'image' in sketch mode uses the image's own colors), --theme dark|light, --depth truecolor|256, --direction
vertical|horizontal|diagonal, --format text|ansi|html|svg|png, --out FILE to write the result to a file, --alt "text" for imagery,
--region KEY=COLOR (repeatable) to pin a region's color, --px N image pixels per art pixel (rasters of bitmaps, default 8), --cell N
pixels per cell width (rasters of text, default 8, height is double), --transparent for no background, --font-file F.ttf for the
ASCII glyphs of a raster (default: DejaVu Sans Mono, fetched once and cached). The plain form is the default; --color implies ANSI
on a terminal unless NO_COLOR is set. The art goes to stdout; notes go to stderr. --map prints the pixel map with rulers instead.`;

try {
  if (command === 'measure' && args[0]) {
    const m = measure(readFileSync(args[0], 'utf8'));
    console.log(`${m.cols} x ${m.rows}  (columns in code points x rows)`);
  } else if (command === 'check' && args[0]) {
    report(check(readFileSync(args[0], 'utf8'), { mode: flags.mode, band, maxRows: num(flags.rows) ?? (flags.mode === 'sketch' ? 200 : 20), allow: flags.allow }));
  } else if (command === 'wordmark' && args[0]) {
    const o = wordmarkOptions();
    if (o.font) await loadFont(o.font);
    const r = wordmark(args[0], o);
    const cw = flags.color ? loadColorway(flags.color) : MONO, pal = palettes(cw);
    await deliver({ text: r.text, ansi: () => colorizeText(r.text, pal[theme], { depth, direction: direction() ?? cw.direction }), html: () => htmlText(r.text, { alt: r.alt, dark: { ...pal.dark, direction: direction() ?? cw.direction }, light: pal.light }), ...gridRasters(r.text, pal[theme], direction() ?? cw.direction) });
    note(`${r.font}, ${r.cols} x ${r.rows}, ${r.lines} line${r.lines === 1 ? '' : 's'}, ${r.fits ? 'fits' : 'does not fit'} the ${o.band ?? 'standard'} band`);
    note(`alt: ${r.alt}`);
    for (const e of r.check.errors) note(`error ${e.check}: ${e.message}`);
    for (const w of r.check.warnings) note(`warning ${w.check}: ${w.message}`);
    process.exitCode = r.check.ok ? 0 : 1;
  } else if (command === 'previews' && args[0]) {
    const list = previews(args[0], { family: flags.family, exclude: flags.exclude, count: num(flags.count), band, maxRows: num(flags.rows) });
    for (const p of list) {
      console.log(`## ${p.font}, ${p.cols} x ${p.rows}${p.fits ? '' : ', does not fit'}`);
      process.stdout.write(p.text);
    }
  } else if ((command === 'bitmap' || command === 'scene') && args[0]) {
    let bitmap;
    if (command === 'bitmap') {
      bitmap = parseBitmap(readFileSync(args[0], 'utf8'));
      if (flags.scale) bitmap = scaleBitmap(bitmap, Number(flags.scale));
    } else {
      const mod = await import(pathToFileURL(resolve(args[0])).href);
      const S = flags.scale ? Number(flags.scale) : 1;
      const w = Math.round(mod.design.width * S);
      let h = Math.round(mod.design.height * S); h += h % 2;
      bitmap = renderScene(mod.scene(geometry, S), { width: w, height: h, scale: S });
    }
    const art = renderHalfblocks(bitmap, { trim: command === 'scene' });
    const alt = flags.alt ?? `${basename(args[0])}, half-block art`;
    const cw = flags.color ? loadColorway(flags.color) : MONO, pal = palettes(cw);
    if ('map' in flags) process.stdout.write(bitmapMap(bitmap));
    else { const rc = regionColors(); await deliver({ text: art, ansi: () => colorizeBitmap(bitmap, pal[theme], { depth, direction: direction() ?? cw.direction, regionColors: rc.ansi }), html: () => htmlBitmap(bitmap, { alt, dark: { ...pal.dark, direction: direction() ?? cw.direction }, light: pal.light, regionColors: rc.html }), ...bitmapRasters(bitmap, pal[theme], direction() ?? cw.direction, rc) }); }
    const m = measure(art);
    note(`${bitmap.width} x ${bitmap.height} pixels, ${m.cols} x ${m.rows} cells`);
    note(`alt: ${alt}`);
    const c = check(art, { mode: 'bitmap', band: band ?? 'standard', maxRows: num(flags.rows) ?? 20 });
    for (const e of c.errors) note(`error ${e.check}: ${e.message}`);
    for (const w of c.warnings) note(`warning ${w.check}: ${w.message}`);
    process.exitCode = c.ok ? 0 : 1;
  } else if (command === 'image' && args[0]) {
    const img = await readImage(args[0]);
    const maxRows = num(flags.rows) ?? 200;
    const cols = num(flags.cols) ?? BANDS[band ?? 'standard'] ?? band;
    const kind = classify(grayscale(img, { bg: flags.bg === 'black' ? 0 : 255 })).kind;
    let mode = flags.mode ?? 'auto';
    if (mode === 'auto') mode = kind === 'logo' || cols < 60 ? 'bitmap' : 'sketch';
    note(`${basename(args[0])}: ${img.width} x ${img.height} pixels, looks like a ${kind}; ${mode} mode${flags.mode ? '' : ' chosen'}`);
    let art, c;
    if (mode === 'bitmap') {
      const r = imageToBitmap(img, { cols, maxRows, threshold: num(flags.threshold), dither: 'dither' in flags, ink: flags.ink, bg: flags.bg === 'black' ? 0 : 255, despeckle: !('no-despeckle' in flags) });
      art = renderHalfblocks(r.bitmap);
      const alt = flags.alt ?? `${basename(args[0])}, half-block art`;
      const cw = flags.color && flags.color !== 'image' ? loadColorway(flags.color) : MONO, pal = palettes(cw);
      if ('map' in flags) process.stdout.write(bitmapMap(r.bitmap));
      else { const rc = regionColors(); await deliver({ text: art, ansi: () => colorizeBitmap(r.bitmap, pal[theme], { depth, direction: direction() ?? cw.direction, regionColors: rc.ansi }), html: () => htmlBitmap(r.bitmap, { alt, dark: { ...pal.dark, direction: direction() ?? cw.direction }, light: pal.light, regionColors: rc.html }), ...bitmapRasters(r.bitmap, pal[theme], direction() ?? cw.direction, rc) }); }
      note(`${r.bitmap.width} x ${r.bitmap.height} pixels, ${r.bitmap.width} x ${r.bitmap.height / 2} cells; threshold ${r.threshold}, ${r.inkDark ? 'dark' : 'light'} ink${'dither' in flags ? ', dithered' : ''}`);
      note(`alt: ${alt}`);
      c = check(art, { mode: 'bitmap', band: cols, maxRows });
      if ('dither' in flags) {   // dithered output is texture by nature, so its speck and notch findings are one note, not a list
        const n = c.warnings.filter((w) => w.check === 'features' || w.check === 'separation').length;
        c = { ...c, warnings: c.warnings.filter((w) => w.check !== 'features' && w.check !== 'separation') };
        if (n) note(`dithered: ${n} feature and separation findings not listed, since dither is texture`);
      }
    } else {
      const r = imageToSketch(img, { cols, maxRows, ramp: flags.ramp, ground: flags.ground, edges: flags.edges === 'off' ? 0 : num(flags.edges), stretch: !('no-stretch' in flags), bg: flags.bg === 'black' ? 0 : 255 });
      art = r.text;
      const alt = flags.alt ?? `${basename(args[0])}, sketched in text`;
      if (flags.color === 'image') {
        await deliver({ text: art, ansi: () => colorizeSketch(art, r.rgb, r.cols, { depth }), html: () => htmlSketch(art, r.rgb, r.cols, { alt, ground: flags.ground ?? 'dark' }), png: async () => { throw new Error('a PNG or SVG of a sketch takes a colorway, not --color image'); }, svg: async () => { throw new Error('a PNG or SVG of a sketch takes a colorway, not --color image'); } });
      } else {
        const cw = flags.color ? loadColorway(flags.color) : MONO, pal = palettes(cw);
        await deliver({ text: art, ansi: () => colorizeText(art, pal[theme], { depth, direction: direction() ?? cw.direction }), html: () => htmlText(art, { alt, dark: { ...pal.dark, direction: direction() ?? cw.direction }, light: pal.light }), ...gridRasters(art, pal[theme], direction() ?? cw.direction) });
      }
      note(`${r.cols} x ${r.rows} cells, ${flags.ramp ?? 'long'} ramp on a ${flags.ground ?? 'dark'} ground`);
      note(`alt: ${alt}`);
      c = check(art, { mode: 'sketch', band: cols, maxRows });
    }
    for (const e of c.errors) note(`error ${e.check}: ${e.message}`);
    for (const w of c.warnings) note(`warning ${w.check}: ${w.message}`);
    process.exitCode = c.ok ? 0 : 1;
  } else if (command === 'text' && args[0]) {
    if (!flags['font-file'] && !flags.google) throw new Error('text needs --font-file with a .ttf or .otf, or --google with a family name; the font is the point of this command');
    const fontName = flags['font-file'] ? basename(flags['font-file']) : flags.google;
    const font = await rasterFont();
    const size = num(flags.size) ?? 256;
    const cov = rasterizeText(font, args[0], { size, padding: Math.round(size / 8) });
    const data = new Uint8ClampedArray(cov.width * cov.height * 4);
    for (let i = 0; i < cov.width * cov.height; i++) { const v = Math.round(255 * (1 - cov.data[i])); data.set([v, v, v, 255], i * 4); }
    const maxRows = num(flags.rows) ?? 20;
    const cols = num(flags.cols) ?? BANDS[band ?? 'standard'] ?? band;
    const r = imageToBitmap({ width: cov.width, height: cov.height, data }, { cols, maxRows, threshold: num(flags.threshold), dither: 'dither' in flags, ink: 'dark', despeckle: !('no-despeckle' in flags) });
    const art = renderHalfblocks(r.bitmap);
    const alt = flags.alt ?? `${args[0]}, set in ${fontName} as block art`;
    const cw = flags.color ? loadColorway(flags.color) : MONO, pal = palettes(cw);
    note(`${args[0]} in ${fontName}: ${cov.width} x ${cov.height} pixels at ${size}px, to ${r.bitmap.width} x ${r.bitmap.height} pixels, ${r.bitmap.width} x ${r.bitmap.height / 2} cells`);
    note(`alt: ${alt}`);
    if ('map' in flags) process.stdout.write(bitmapMap(r.bitmap));
    else { const rc = regionColors(); await deliver({ text: art, ansi: () => colorizeBitmap(r.bitmap, pal[theme], { depth, direction: direction() ?? cw.direction, regionColors: rc.ansi }), html: () => htmlBitmap(r.bitmap, { alt, dark: { ...pal.dark, direction: direction() ?? cw.direction }, light: pal.light, regionColors: rc.html }), ...bitmapRasters(r.bitmap, pal[theme], direction() ?? cw.direction, rc) }); }
    const c = check(art, { mode: 'bitmap', band: cols, maxRows });
    for (const e of c.errors) note(`error ${e.check}: ${e.message}`);
    for (const w of c.warnings) if (w.check !== 'separation') note(`warning ${w.check}: ${w.message}`);   // letterforms join by design
    process.exitCode = c.ok ? 0 : 1;
  } else if (command === 'animate' && args[0]) {
    // the source: a text file of art, or - for stdin
    const source = args[0] === '-' ? readFileSync(0, 'utf8') : readFileSync(args[0], 'utf8');
    const cw = flags.color ? loadColorway(flags.color) : null;
    let base = frameFromText(source);
    if (cw) base = paintFrame(base, fitColorway(cw, theme), { direction: direction() ?? cw.direction });
    const effects = [...parseEffects(flags.reveal).map((e) => ({ ...e })), ...parseEffects(flags.loop), ...parseEffects(flags.effects)];
    for (const e of effects) { const kind = effectNames('reveal').includes(e.name) ? 'reveal' : effectNames('loop').includes(e.name) ? 'loop' : 'color'; if (flags.reveal && parseEffects(flags.reveal).some((r) => r.name === e.name) && kind !== 'reveal') throw new Error(`${e.name} is a ${kind} effect, not a reveal`); }
    const clip = animate(base, { effects, fps: num(flags.fps) ?? 12, revealSeconds: num(flags.seconds) ?? 2, loopSeconds: num(flags['loop-seconds']) ?? 2, cycles: num(flags.cycles) ?? 1, seed: num(flags.seed) ?? 1 });
    // the frame checks: every frame one size and under the limit; and when there is a reveal, its segment ends on the source
    const padded = (f) => frameToText(f, { pad: true }), plain = frameToText(base);
    const c = check(plain, { mode: 'text', band: 1000, maxRows: 1000, frames: clip.frames.map(padded), maxFrames: num(flags['max-frames']) ?? 240 });
    const hasReveal = effects.some((e) => effectNames('reveal').includes(e.name));
    if (hasReveal) c.errors.push(...check(plain, { mode: 'text', band: 1000, maxRows: 1000, frames: clip.frames.slice(0, clip.loopFrom ?? clip.frames.length).map(padded), source: padded(base) }).errors.filter((e) => e.check === 'frames'));
    c.ok = c.errors.length === 0;
    note(`${clip.frames.length} frames at ${clip.fps} fps, ${clip.width} x ${clip.height}${clip.loopFrom !== null ? `, loops from frame ${clip.loopFrom}` : ', plays once'}; effects: ${effects.map((e) => `${e.name}:${e.intensity}`).join(', ') || 'none'}; seed ${num(flags.seed) ?? 1}`);
    for (const e of c.errors) note(`error ${e.check}: ${e.message}`);
    if (!c.ok) { process.exitCode = 1; }
    const format = flags.format ?? 'json';
    const alt = flags.alt ?? `${basename(args[0] === '-' ? 'animation' : args[0])}, animated`;
    if (format === 'json') { const j = clipToJSON(clip) + '\n'; if (flags.out) { writeFileSync(flags.out, j); note(`wrote ${flags.out}`); } else process.stdout.write(j); }
    else if (format === 'txt') { const t = clip.frames.map((f, i) => `--- frame ${i} ---\n${frameToText(f)}`).join(''); if (flags.out) { writeFileSync(flags.out, t); note(`wrote ${flags.out}`); } else process.stdout.write(t); }
    else if (format === 'html') { const h = webPlayer(clip, { alt }); if (flags.out) { writeFileSync(flags.out, h); note(`wrote ${flags.out}`); } else process.stdout.write(h); }
    else if (format === 'snippet') { const sn = snippet(clip); if (flags.out) { writeFileSync(flags.out, sn); note(`wrote ${flags.out}`); } else process.stdout.write(sn); }
    else if (format === 'play') { await play(clip, { speed: num(flags.speed) ?? 1, loop: 'once' in flags ? false : 'forever' in flags ? true : undefined }); }
    else if (format === 'gif') {
      const font = clip.frames.some((f) => needsFont(frameToText(f))) ? await rasterFont() : null;
      const bgc = 'transparent' in flags ? null : parseColor(BACKGROUNDS[theme]);
      const images = clip.frames.map((f) => imageFromFrame(f, { cellW: cellW(), cellH: cellW() * 2, font, background: bgc }));
      const gif = encodeGIF(images, { fps: clip.fps, loop: clip.loopFrom !== null || 'forever' in flags });
      if (!flags.out && process.stdout.isTTY) throw new Error('GIF is binary: redirect it to a file or pass --out FILE');
      if (flags.out) { writeFileSync(flags.out, gif); note(`wrote ${flags.out}, ${images[0].width} x ${images[0].height} pixels, ${(gif.length / 1024).toFixed(0)} KB`); } else process.stdout.write(gif);
    } else throw new Error(`unknown animation format: ${format}. Formats: json, txt, html, gif, play, snippet.`);
  } else if (command === 'play' && args[0]) {
    const clip = clipFromJSON(readFileSync(args[0], 'utf8'));
    await play(clip, { speed: num(flags.speed) ?? 1, loop: 'once' in flags ? false : 'forever' in flags ? true : undefined });
  } else if (command === 'colorway') {
    const swatch = (hex) => `${fg(parseColor(hex), depth)}██████${RESET} ${hex}`;
    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
    const ask = async (label, key, required) => {
      let value = flags[key];
      while (value === undefined || value === '') {
        if (!rl) { if (required) throw new Error(`--${key} is required when not on a terminal`); return undefined; }
        value = (await rl.question(`${label}${required ? '' : ' (enter to derive)'}: `)).trim();
        if (!value && !required) return undefined;
        try { parseColor(value); } catch (e) { process.stdout.write(`${e.message}\n`); value = ''; }
      }
      if (key !== 'name') process.stdout.write(`  ${swatch(toHex(parseColor(value)))}\n`);
      return value;
    };
    const name = flags.name ?? (rl ? (await rl.question('name: ')).trim() : undefined);
    if (!name) throw new Error('--name is required');
    const cw = makeColorway({ name, primary: await ask('primary', 'primary', true), secondary: await ask('secondary', 'secondary', false), complementary: await ask('complementary', 'complementary', false) });
    const p = fitColorway(cw, theme);
    process.stdout.write(`\n${name}\n  fill    ${cw.stops.map((h) => swatch(h)).join('  ')}\n  shadow  ${swatch(cw.shadow)}\n  accent  ${swatch(cw.accent)}\n\n`);
    process.stdout.write(colorizeText(render('ASCIIFY', 'ANSI Regular').text, p, { depth }) + '\n');
    const out = flags.out ?? join(COLORWAY_DIR, `${name}.json`);
    let save = 'save' in flags;
    if (!save && rl) save = /^y/i.test((await rl.question(`save to ${out}? [y/N] `)).trim());
    rl?.close();
    if (save) {
      mkdirSync(join(out, '..'), { recursive: true });
      writeFileSync(out, JSON.stringify({ stops: cw.stops, shadow: cw.shadow, accent: cw.accent }, null, 2) + '\n');
      note(`saved ${out}; use it with --color ${flags.out ? out : name}`);
    } else note('not saved');
  } else if (command === 'fonts') {
    const names = fontNames({ family: flags.family });
    const w = Math.max(4, ...names.map((n) => n.length));
    const row = (a, b, c, d, e) => console.log(`${a.padEnd(w)}  ${b.padEnd(10)}  ${c.padEnd(7)}  ${String(d).padStart(4)}  ${String(e).padStart(10)}`);
    row('font', 'family', 'blessed', 'rows', 'per letter');
    for (const name of names) { const f = FONTS[name]; row(name, f.family, f.blessed ? 'yes' : '', f.rows, f.perLetter.toFixed(1)); }
  } else {
    console.log(usage);
    process.exitCode = command ? 1 : 0;
  }
} catch (e) {
  note(String(e.message ?? e));
  process.exitCode = 1;
}
