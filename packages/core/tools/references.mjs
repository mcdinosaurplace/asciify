// Generates the skill's reference files from the engine, so they never drift: fonts, effects, colorways.
// Run from the repository root: node packages/core/tools/references.mjs
import { writeFileSync } from 'node:fs';
import { FONTS, fontNames, families, render, EFFECTS, PRESETS, fitColorway, toHex } from '../index.js';

const out = (name, text) => { writeFileSync(new URL(`../../../skills/asciify/references/${name}`, import.meta.url), text); console.log(`wrote references/${name}`); };

// fonts: a table per family and a sample of every embedded font
let fonts = `# Fonts\n\nGenerated from the engine. ${fontNames().length} fonts are embedded and work offline; any other figlet font loads by exact name. Columns per letter is the alphabet's width over 26; a word's real width is measured when it renders. Blessed fonts are the ones the ladder and the style words reach for.\n`;
for (const family of families()) {
  fonts += `\n## ${family}\n\n| font | blessed | rows | columns per letter |\n| --- | --- | --- | --- |\n`;
  for (const name of fontNames({ family })) { const f = FONTS[name]; fonts += `| ${name} | ${f.blessed ? 'yes' : ''} | ${f.rows} | ${f.perLetter.toFixed(1)} |\n`; }
}
fonts += `\n## Samples\n\nEvery embedded font on the word WIZ, so a family can be judged without a render.\n`;
for (const family of families()) for (const name of fontNames({ family })) { const r = render('WIZ', name); fonts += `\n### ${name} (${family}, ${r.cols} x ${r.rows})\n\n\`\`\`\n${r.text}\`\`\`\n`; }
out('fonts.md', fonts);

// effects
const NOTES = {
  typewriter: 'cells appear in reading order', wipe: 'a straight edge sweeps across; direction=left|right|up|down', dissolve: 'cells appear at random',
  rain: 'columns fill from the top with staggered starts', static: 'noise resolves into the art', burn: 'the art burns in with a bright fringe',
  glitch: 'rows displace sideways and glyphs burst', crt: 'a bright band sweeps down with a short trail', phosphor: 'the band with a long decaying trail',
  interlace: 'alternate rows dim and swap each frame', flicker: 'brightness jitters and cells drop out', vhs: 'a torn band jitters sideways with noise',
  roll: 'the frame rolls vertically like a slipped hold', blink: 'the art blinks off for part of the cycle', scroll: 'a seamless marquee; direction=left|right|up|down, gap=N',
  matrix: 'glyph rain falls through the empty cells', 'hue-cycle': 'every color rotates around the hue wheel', pulse: 'brightness breathes',
  'color-flicker': 'brightness jitters', 'gradient-scroll': 'the gradient slides along its direction', 'channel-offset': 'red and blue split sideways, the glitch look', glow: 'a dim halo pulses in the cells around the art',
};
let effects = `# Effects\n\nGenerated from the engine. Every effect is a pure function of the frame, the time, its intensity from 0 (nothing) to 1 (full), and the seed, so a run reproduces. Stack them in order: \`--reveal typewriter --loop crt:0.6,glitch:0.3 --effects hue-cycle:0.2\`. Parameters follow the intensity: \`scroll:1:direction=up:gap=2\`. Reveals run once from nothing to the art; loops cycle over the finished art; color effects change colors only and show only in color.\n`;
for (const kind of ['reveal', 'loop', 'color']) {
  effects += `\n## ${kind === 'color' ? 'color effects' : kind + 's'}\n\n| effect | what it does |\n| --- | --- |\n`;
  for (const [name, e] of Object.entries(EFFECTS)) if (e.kind === kind) effects += `| ${name} | ${NOTES[name]} |\n`;
}
out('effects.md', effects);

// colorways
const DESC = { matrix: 'greens', amber: 'CRT phosphor', mono: 'one light gray', sunset: 'yellow to pink to purple', synthwave: 'orange through magenta to cyan', bladerunner: 'aqua to steel blue to dark teal, pink accent; from the 1982 film', 'rad-sorcerer': 'acid green, aqua, hot pink, violet with a black outline; from the Wizard of Barge tarot' };
let cw = `# Colorways\n\nGenerated from the engine. A colorway has fill stops (a gradient, vertical by default), a shadow slot for a font's shadow glyphs and secondary regions, and an accent. Every slot is fitted per theme until it reads at 4.5 to 1 on that theme's background, so the stops below are the brand colors, not always the rendered ones. A user establishes their own with the \`colorway\` picker; it saves to \`.asciify/colorways/<name>.json\` only on a yes.\n\n| preset | look | stops | shadow | accent |\n| --- | --- | --- | --- | --- |\n`;
for (const [name, p] of Object.entries(PRESETS)) cw += `| ${name} | ${DESC[name]} | ${p.stops.join(' ')} | ${p.shadow} | ${p.accent} |\n`;
cw += `\n## Fitted for a dark ground\n\n| preset | stops as rendered on #111111 |\n| --- | --- |\n`;
for (const name of Object.keys(PRESETS)) cw += `| ${name} | ${fitColorway({ name, ...PRESETS[name] }, 'dark').stops.map(toHex).join(' ')} |\n`;
cw += `\n## Fitted for a light ground\n\n| preset | stops as rendered on #ffffff |\n| --- | --- |\n`;
for (const name of Object.keys(PRESETS)) cw += `| ${name} | ${fitColorway({ name, ...PRESETS[name] }, 'light').stops.map(toHex).join(' ')} |\n`;
out('colorways.md', cw);
