# Commands

Every command prints the art to stdout and its notes to stderr. Run them as `node scripts/asciify.mjs <command>` from the skill folder, or with the full path to the script from anywhere. Exit code 1 means a check error; the render is not delivered until it is fixed.

## Shared flags for art commands

| flag | meaning |
| --- | --- |
| `--band narrow\|standard\|wide\|N` | the width limit: 44, 78 (default), 120, or a number of columns |
| `--rows N` | the row limit, 20 by default for wordmarks and imagery, none for images |
| `--color NAME\|FILE` | a preset colorway, a saved one, or a colorway file; `image` in sketch mode means the image's own colors |
| `--theme dark\|light` | fit the colors to a dark (default) or light ground |
| `--depth truecolor\|256` | color depth; the default follows the terminal |
| `--direction vertical\|horizontal\|diagonal` | the gradient's direction |
| `--format text\|ansi\|html\|svg\|png` | the output form; text is the default, ansi is implied by `--color` on a terminal |
| `--out FILE` | write the result to a file, the one file a command writes, only because the user asked |
| `--alt "text"` | the alt text for imagery |
| `--region KEY=COLOR` | pin a region's color; repeatable |
| `--px N` | image pixels per art pixel in a raster of a bitmap, 8 by default |
| `--cell N` | pixels per cell width in a raster of text, 8 by default; the height is double |
| `--transparent` | no background in a raster |
| `--font-file F.ttf` | the outline font for ASCII glyphs in a raster, and for `text`; DejaVu Sans Mono by default |
| `--map` | print the pixel map with rulers instead of the art (bitmap, scene, image in bitmap mode, text) |

## wordmark

`wordmark "TEXT" [--font F] [--family FAM] [--style "words"] [--layout L] [--spacing N] [--leading N] [--align left|center|right]`

Renders the text, stepping down the ladder until it fits the band: the preferred font, ANSI Regular if the preferred was ANSI Shadow, two lines broken at the most even space, Calvin S, Small. Style words: shadow, solid, heavy, compact, plain, small, italic, small caps, outline, gothic, and the family names block, box, sans, serif, script, 3d, retro, decorative. Typography: tight or loose, with kerning, tracking, letter-spacing, leading, or line-height beside it; centered; right. `--layout` takes figlet's default, full, fitted, controlled smushing, universal smushing. Any figlet font not embedded loads by exact name over the network once and is cached.

## previews

`previews "TEXT" [--family FAM] [--exclude F] [--count N]` renders alternates from a family, fitting ones first, each with a header line naming the font and its size.

## fonts

`fonts [--family FAM]` lists the embedded fonts with family, blessing, rows, and columns per letter.

## bitmap and scene

`bitmap <file> [--scale N]` renders a bitmap text file: rows of `.` and `#`, or letters naming regions; scale by whole numbers only. `scene <file.mjs> [--scale S]` renders a scene module that exports `design {width, height}` and `scene(geometry, scale)`; blank rows at the top and bottom are cropped.

## image

`image <file> [--mode auto|bitmap|sketch] [--cols N]`, with `--threshold 0-255`, `--dither`, `--ink auto|dark|light`, `--bg white|black`, `--no-despeckle` for bitmap mode and `--ramp long|short|blocks`, `--ground dark|light`, `--edges N|off`, `--no-stretch` for sketch mode. PNG and BMP decode anywhere; JPEG, GIF, TIFF, and SVG on a Mac. The notes name the mode chosen and why. Sketch mode needs 60 columns or more.

## text

`text "TEXT" --font-file F.ttf | --google "Family" [--size N] [--cols N] [--threshold N] [--dither]` fills the letterforms at `--size` pixels (256 by default) and converts them through bitmap mode.

## colorway

`colorway [--name N] [--primary C] [--secondary C] [--complementary C] [--save] [--out FILE]` is the picker: on a terminal it asks for what is missing, shows swatches and the derived slots, previews a word, and saves to `.asciify/colorways/<name>.json` on a yes. With every flag given it runs without prompts.

## animate and play

`animate <art.txt|-> [--reveal E,E:0.5] [--loop E] [--effects E] [--fps 12] [--seconds 2] [--loop-seconds 2] [--cycles 1] [--seed 1] [--format json|txt|html|gif|play|snippet] [--once|--forever] [--speed 1] [--max-frames 240]` makes a clip from a file or from stdin. Effects: reveals typewriter, wipe, dissolve, rain, static, burn; loops glitch, crt, phosphor, interlace, flicker, vhs, roll, blink, scroll, matrix; color hue-cycle, pulse, color-flicker, gradient-scroll, channel-offset, glow. An effect takes `:intensity` and `:key=value` parameters. `play <clip.json> [--speed 1] [--once|--forever]` replays a saved clip in place.

## check and measure

`check <file> [--mode text|wordmark|bitmap|sketch] [--allow CHARS]` runs the legibility checks: size, hygiene, and frames are errors; glyph set, feature size, separation, and themes are warnings. `measure <file>` prints the width in code points and the row count.
