---
name: asciify
description: "Make terminal-legible ASCII and block-character art: wordmarks and banners from figlet fonts, pixel icons and badges drawn as half-block bitmaps, image files and photos converted to ASCII art, text set in any font as pixels, colored HTML, SVG, PNG, and animated GIF output, and animations such as typewriter reveals, glitch, CRT scan, and marquee loops. Use this skill for every request for ASCII art, a banner, a wordmark, an ASCII or terminal logo, a README header, a CLI splash or startup screen, a terminal badge, a pixel icon, block letters, an ASCII or text version of an image, logo, or photo, an animated or glitching banner, or a web hero set in ASCII, even a one-word request, and even when figlet, an image library, or hand-drawing looks quicker: it measures widths in code, steps fonts down to fit, and runs legibility checks. Makes only the asset asked for and never places it into other files unasked. Not for diagrams, flowcharts, tables, boxes around ordinary text, emoji art, or sprites."
---

# asciify

Art that reads in a terminal and on a web page: wordmarks, pixel imagery, converted images, color, rasters, and animation, all through one script, `scripts/asciify.mjs`, which needs only Node 20 or newer. Legibility governs every choice: structure over tone, hard edges, contrast, a gap between shapes, and every width counted in code points by the script rather than by eye.

## How to work

- **Deliberate and scoped.** Make only the asset the user asked for. Show it in chat in a fenced block. Write a file only when the user asks or names a destination, through `--out`, one file per asset. Never edit another file: a README, a CLI, a page. Offer placement instead, and place only when the user agrees, one placement at a time.
- **Wordmarks: render first.** The text alone is enough. Take the width and the surface from the request (a README or a CLI means the standard band of 78 columns, a phone or a half pane means the narrow band of 44, a web page allows the wide band of 120), render, show, then offer a second font or width. Style words and typography terms from the request go in `--style`; a named font goes in `--font`; previews by family come from `previews`.
- **Logos: lead with a symbol.** A logo means a mark, not just a name in a font: when the request says logo and not logotype, wordmark, or banner, lead with a composition, a symbol beside or above the wordmark, and offer the wordmark alone as the alternative. A composition is imagery, so ask first for the surface and the size band unless the request already gives them.
- **Imagery: ask first.** One question fixes the surface and the size band before designing, because a bitmap is designed to its grid and a redesign is real work. Then design, then map, then render.
- **Image files: recommend a mode.** The `image` command names the mode it chose and why; pass that reasoning on. Photos want sketch mode at 60 columns or more; logos, icons, and high-contrast art want bitmap mode. A pasted image is a reference to redraw by eye, since the script cannot see the chat.
- **Read the notes.** Every command prints the art to stdout and its notes to stderr: the font, the measured size, whether it fits, the alt text, and any check findings. Errors mean the render is not delivered until fixed; warnings go to the user with the art.
- **Say what is not built.** If a request needs something the script does not do, say so plainly and stop rather than improvise around it.

## Wordmarks

`wordmark "TEXT"` renders the text and steps down a ladder until it fits the band: ANSI Shadow, then ANSI Regular, then two lines broken at the most even space, then Calvin S, then Small. The nine blessed fonts are ANSI Shadow (the default; block letters with a baked shadow), ANSI Regular, Delta Corps Priest 1 (heavy), DOS Rebel (heavy with a shadow), Electronic (an outlined LCD look), Pagga (compact block), Calvin S (compact box-drawing), and Standard and Small (plain ASCII for places without block glyphs). Fifty fonts are embedded across the families block, box, sans, serif, script, 3d, retro, and decorative, and any other figlet font loads by exact name; `references/fonts.md` shows every one on a sample word. Style words the user may say map to fonts: shadow, solid, heavy, compact, plain, small, italic, small caps, outline, gothic, and the family names. Typography terms map to controls: tight or loose kerning and tracking, leading, centered.

## Imagery

Design as a pixel bitmap, rows of `.` for off and `#` for on, or letters that name regions. A cell is one pixel wide and two pixels tall, so design in square pixels with an even number of rows; the renderer shows the top pixel as ▀, the bottom as ▄, both as █. Hand-type the bitmap at the smallest band it must survive and scale up by whole numbers only; a different aspect is a redesign. For curves, or for a design that must render at several scales, write a scene module like `references/examples/badge.mjs`, which builds layers from `rect`, `ellipse`, `star`, `line`, `polygon`, `union`, `subtract`, and `outline`; a layer placed over another gets `gap: 1`, which clears one pixel around it in the layers below. `references/examples.md` walks through both.

The rules, applied while designing and then checked by the script: a four-point star needs a radius of 2.5 pixels or more, a band two pixels, a buckle two or three; below that, drop the feature rather than shrink it. Leave a one-pixel gap wherever a shape crosses another. No marks outside the shapes. Run `--map` to see the pixel grid with rulers and verify counts before judging the art.

A logo composition is a symbol and a wordmark: design the symbol as a bitmap at the band it must survive, render it, then set it above or beside the wordmark with one blank row or column between them, whichever fits the band and the twenty-row splash limit. Assemble the two renders into one text by hand, then run `measure` and `check --mode wordmark` on the assembled text, since wordmark mode allows the block and box-drawing glyphs both parts use, and `bitmap --map` on the symbol alone for the feature checks. Alt text names both parts, for example "a ferry above the word FERRY in ANSI Shadow".

## Images

`image <file>` converts by pixels: PNG anywhere; JPEG, GIF, TIFF, BMP, and SVG on a Mac. Bitmap mode thresholds to black and white, judges which side is ink from the border, and drops specks; `--dither` gives a photo the one-bit look. Sketch mode puts one ramp character per cell, draws edges as strokes, and refuses below 60 columns. The ramp reads on a dark ground by default; a README on white wants `--ground light`.

## Text in any font

`text "TEXT" --font-file F.ttf` or `--google "Family"` fills the letterforms at a large size and converts them through bitmap mode, so a Garamond or Inter wordmark keeps its letterforms as pixels. The user's own font takes precedence over the figlet fonts whenever they name one.

## Color

Monochrome is the default and the plain form is always the canonical asset. `--color <preset>` adds a colorway: matrix, amber, mono, sunset, synthwave, bladerunner, rad-sorcerer, or one the user established with the `colorway` picker, which saves to `.asciify/colorways/<name>.json` only on a yes. The fill runs a gradient, vertical by default, and a font's shadow glyphs take the darker slot; on multi-region bitmaps each region gets a slot, and `--region KEY=COLOR` pins one. Depth follows the terminal. `--theme light` fits the colors to a light ground. Every colorway is fitted per theme so the contrast check passes. `references/colorways.md` lists the presets and their fitted stops.

## Formats and placement

`--format` chooses text (default), ansi, html, svg, or png. ANSI is implied by `--color` on a terminal and dropped under `NO_COLOR` or when piped, unless forced. HTML is a `pre` with `role="img"` and the alt text, CSS variables for both themes, and print rules; several snippets can share a page. SVG and PNG come from a geometric rasterizer for block and box glyphs and from an outline font for ASCII glyphs. For a README, a fenced block with no language tag in the plain form; colored README art needs a PNG or SVG file. For a CLI, the snippet prints the plain form when output is not a terminal or `NO_COLOR` is set, keeps to the narrow variant under 80 columns, and never animates at startup unless the user turns it on. Every render comes with alt text: the text and the style for a wordmark, one line from the request for imagery.

## Animation

Pipe any render into `animate -` or point it at a file. Reveals build the art up once: typewriter, wipe, dissolve, rain, static, burn. Loops cycle over the finished art: glitch, crt, phosphor, interlace, flicker, vhs, roll, blink, scroll (a seamless marquee), matrix. Color effects change colors only: hue-cycle, pulse, color-flicker, gradient-scroll, channel-offset, glow. Effects stack in the order given with an intensity after a colon. A reveal takes two seconds at twelve frames per second and plays once; a loop cycles every two seconds; the seed reproduces a run. Formats: json (the frames file), txt, html (the web player, which honors reduced motion), gif, play (in the terminal), and snippet (a self-contained script for a CLI splash). `references/effects.md` describes each effect.

## Commands

Every flag and command is in `references/commands.md`. The ones used most:

- `node scripts/asciify.mjs wordmark "TEXT" [--font F] [--family FAM] [--style "words"] [--band narrow|standard|wide] [--color CW] [--format F] [--out FILE]`
- `node scripts/asciify.mjs previews "TEXT" --family FAM [--count N]`
- `node scripts/asciify.mjs bitmap <file> [--scale N] [--map]` and `scene <file.mjs> [--scale S] [--map]`
- `node scripts/asciify.mjs image <file> [--mode auto|bitmap|sketch] [--cols N] [--dither] [--ground light]`
- `node scripts/asciify.mjs text "TEXT" --font-file F.ttf | --google "Family"`
- `node scripts/asciify.mjs animate <art.txt|-> [--reveal E] [--loop E] [--effects E] [--color CW] [--format json|txt|html|gif|play|snippet]`
- `node scripts/asciify.mjs check <file> [--mode M] [--band B]`, `measure <file>`, `fonts [--family FAM]`, `colorway`, `play <clip.json>`
