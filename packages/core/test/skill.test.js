import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../../../', import.meta.url);
const skill = readFileSync(new URL('skills/asciify/SKILL.md', root), 'utf8');

test('the skill frontmatter: the name is asciify and the description stays under 1024 characters', () => {
  const fm = skill.split('---')[1];
  assert.match(fm, /^name: asciify$/m);
  const description = fm.match(/^description: "?(.+?)"?$/m)[1];
  assert.ok(description.length <= 1024, `${description.length} characters`);
  assert.ok(description.length > 200);
  assert.ok(!description.startsWith('"') && !description.endsWith('"'), 'quotes not stripped');
  assert.equal([...description].length, 1004, 'description is exactly 1004 code points');
});

test('every reference the skill names exists and the body stays short', () => {
  for (const ref of ['references/commands.md', 'references/fonts.md', 'references/effects.md', 'references/colorways.md', 'references/examples.md', 'references/examples/badge.mjs', 'references/examples/heart.txt', 'scripts/asciify.mjs']) {
    assert.ok(existsSync(new URL(`skills/asciify/${ref}`, root)), ref);
  }
  assert.ok(skill.split('\n').length < 500);
  for (const name of ['fonts.md', 'effects.md', 'colorways.md', 'examples.md', 'commands.md']) assert.ok(skill.includes(name), `SKILL.md points at ${name}`);
});
