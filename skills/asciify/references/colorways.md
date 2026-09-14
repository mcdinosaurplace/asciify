# Colorways

Generated from the engine. A colorway has fill stops (a gradient, vertical by default), a shadow slot for a font's shadow glyphs and secondary regions, and an accent. Every slot is fitted per theme until it reads at 4.5 to 1 on that theme's background, so the stops below are the brand colors, not always the rendered ones. A user establishes their own with the `colorway` picker; it saves to `.asciify/colorways/<name>.json` only on a yes.

| preset | look | stops | shadow | accent |
| --- | --- | --- | --- | --- |
| matrix | greens | #00ff41 #008f11 | #003b00 | #9dffb0 |
| amber | CRT phosphor | #ffb000 #ff7a00 | #5a2d00 | #ffe08a |
| mono | one light gray | #e6e6e6 | #7a7a7a | #ffffff |
| sunset | yellow to pink to purple | #ffd166 #ef476f #7b2cbf | #2b1440 | #ffe8a3 |
| synthwave | orange through magenta to cyan | #ff9a00 #ff2e97 #00d4ff | #3a0a4d | #fff36b |
| bladerunner | aqua to steel blue to dark teal, pink accent; from the 1982 film | #5fe3c7 #2e8db0 #2b6c7a | #12303a | #f08ca8 |
| rad-sorcerer | acid green, aqua, hot pink, violet with a black outline; from the Wizard of Barge tarot | #c4f24a #6ee7d8 #f566a9 #9a6fdc | #101010 | #f6e23c |

## Fitted for a dark ground

| preset | stops as rendered on #111111 |
| --- | --- |
| matrix | #00ff41 #009412 |
| amber | #ffb000 #ff7a00 |
| mono | #e6e6e6 |
| sunset | #ffd166 #ef476f #a05eda |
| synthwave | #ff9a00 #ff2e97 #00d4ff |
| bladerunner | #5fe3c7 #2e8db0 #368798 |
| rad-sorcerer | #c4f24a #6ee7d8 #f566a9 #9a6fdc |

## Fitted for a light ground

| preset | stops as rendered on #ffffff |
| --- | --- |
| matrix | #008a23 #008a10 |
| amber | #9e6d00 #bd5a00 |
| mono | #767676 |
| sunset | #996b00 #e51446 #7b2cbf |
| synthwave | #a86600 #e60073 #007f99 |
| bladerunner | #17836c #297d9c #2b6c7a |
| rad-sorcerer | #608009 #168375 #e10f71 #8c5ad7 |
