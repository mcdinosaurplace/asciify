// The figlet wrapper: the pure figlet build with fonts we load ourselves, so the same code runs in Node and a browser.
import figlet from 'figlet/browser';
import { FONTS } from './fonts.js';

const registered = new Set();
const extra = new Map();

/** Register a font that is not embedded, from its FLF text. */
export function registerFont(name, flf) {
  figlet.parseFont(name, flf);
  extra.set(name, flf);
  registered.add(name);
}

export const hasFont = (name) => name in FONTS || extra.has(name);
export const fontInfo = (name) => FONTS[name] ?? (extra.has(name) ? { family: 'unknown', blessed: false } : undefined);
export const fontNames = ({ family } = {}) => Object.keys(FONTS).filter((n) => !family || FONTS[n].family === family);
export const families = () => [...new Set(Object.values(FONTS).map((f) => f.family))];

function ensure(name) {
  if (registered.has(name)) return;
  if (!FONTS[name]) throw new Error(`unknown font: ${name}. Embedded fonts: ${Object.keys(FONTS).join(', ')}. Any other figlet font loads by name through the CLI.`);
  figlet.parseFont(name, FONTS[name].data);
  registered.add(name);
}

const trimEnds = (lines) => lines.map((l) => l.replace(/\s+$/, ''));
export const trimBlankRows = (lines) => {
  const out = [...lines];
  while (out.length && out[out.length - 1] === '') out.pop();
  while (out.length && out[0] === '') out.shift();
  return out;
};

/** One line of text in a font at unlimited width: rows with trailing spaces trimmed, the font's full height kept. */
export function renderRaw(text, name, { layout = 'default' } = {}) {
  ensure(name);
  return trimEnds(figlet.textSync(text, { font: name, width: 100000, whitespaceBreak: false, horizontalLayout: layout }).split('\n'));
}

/** The same with blank rows trimmed top and bottom. */
export const renderLine = (text, name, options) => trimBlankRows(renderRaw(text, name, options));

const glyphCache = new Map();
/** Every character the font's printable ASCII glyphs use, for the check's allow list. */
export function fontGlyphs(name) {
  if (!glyphCache.has(name)) {
    const set = new Set();
    for (let c = 33; c < 127; c++) for (const row of renderRaw(String.fromCharCode(c), name)) for (const ch of row) if (ch !== ' ') set.add(ch);
    glyphCache.set(name, [...set].join(''));
  }
  return glyphCache.get(name);
}
