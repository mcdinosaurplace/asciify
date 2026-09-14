// Style words and typography terms, turned into wordmark options. Unknown words are ignored and reported.
const BIGRAMS = [['small', 'caps'], ['drop', 'shadow'], ['letter', 'spacing'], ['line', 'height'], ['small', 'capitals'], ['dot', 'matrix']];
const FONT_WORDS = {
  shadow: 'ANSI Shadow', shadowed: 'ANSI Shadow', 'drop-shadow': 'ANSI Shadow',
  solid: 'ANSI Regular',
  heavy: 'Delta Corps Priest 1', bold: 'Delta Corps Priest 1', thick: 'Delta Corps Priest 1',
  compact: 'Calvin S', condensed: 'Calvin S', narrow: 'Calvin S',
  plain: 'Standard', ascii: 'Standard',
  small: 'Small', light: 'Small', thin: 'Small', tiny: 'Small',
  italic: 'Slant', oblique: 'Slant', slanted: 'Slant', slant: 'Slant',
  'small-caps': 'Small Caps', 'small-capitals': 'Small Caps',
  lcd: 'Electronic', outline: 'Sub-Zero', outlined: 'Sub-Zero', gothic: 'Fraktur', blackletter: 'Fraktur',
};
// 'retro' and 'terminal' mean the block-letter terminal look, not the LCD family, which 'lcd', 'digital', and 'dot-matrix' reach
const FAMILY_WORDS = { block: 'block', blocky: 'block', retro: 'block', terminal: 'block', box: 'box', sans: 'sans', 'sans-serif': 'sans', serif: 'serif', script: 'script', cursive: 'script', '3d': '3d', relief: '3d', digital: 'retro', 'dot-matrix': 'retro', decorative: 'decorative' };
const SPACING_NOUNS = new Set(['kerning', 'tracking', 'letter-spacing', 'spacing']);
const LEADING_NOUNS = new Set(['leading', 'line-height']);

/** @returns {{options: object, recognized: string[], ignored: string[]}} */
export function interpret(words) {
  const raw = words.toLowerCase().split(/[\s,]+/).filter(Boolean);
  const tokens = [];
  for (let i = 0; i < raw.length; i++) {
    const pair = BIGRAMS.find(([a, b]) => raw[i] === a && raw[i + 1] === b);
    if (pair) { tokens.push(`${pair[0]}-${pair[1]}`); i++; } else tokens.push(raw[i]);
  }
  const options = {}, recognized = [], ignored = [];
  tokens.forEach((t, i) => {
    const near = (set) => set.has(tokens[i - 1]) || set.has(tokens[i + 1]);
    if (t in FONT_WORDS) { options.font = FONT_WORDS[t]; recognized.push(t); }
    else if (t in FAMILY_WORDS) { options.family = FAMILY_WORDS[t]; recognized.push(t); }
    else if (t === 'tight' || t === 'kerned') { if (near(LEADING_NOUNS)) options.leading = 0; else options.layout = 'universal smushing'; recognized.push(t); }
    else if (t === 'loose' || t === 'wide' || t === 'spaced' || t === 'tracked' || t === 'airy') { if (near(LEADING_NOUNS) || t === 'airy') options.leading = 1; else { options.letterSpacing = 1; options.layout = 'full'; } recognized.push(t); }
    else if (t === 'centered' || t === 'center' || t === 'centred') { options.align = 'center'; recognized.push(t); }
    else if (t === 'right' || t === 'right-aligned') { options.align = 'right'; recognized.push(t); }
    else if (SPACING_NOUNS.has(t) || LEADING_NOUNS.has(t) || t === 'weight' || t === 'font') recognized.push(t);
    else ignored.push(t);
  });
  return { options, recognized, ignored };
}
