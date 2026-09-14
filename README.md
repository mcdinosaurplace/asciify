# asciify

Terminal-legible ASCII and block-character art: wordmarks, pixel icons, converted images, color, and animation, from a CLI or a Claude Code skill.

## Sample

Rendered with `node skills/asciify/scripts/asciify.mjs wordmark "ASCIIFY"` from the repository root:

```
 █████╗ ███████╗ ██████╗██╗██╗███████╗██╗   ██╗
██╔══██╗██╔════╝██╔════╝██║██║██╔════╝╚██╗ ██╔╝
███████║███████╗██║     ██║██║█████╗   ╚████╔╝
██╔══██║╚════██║██║     ██║██║██╔══╝    ╚██╔╝
██║  ██║███████║╚██████╗██║██║██║        ██║
╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚═╝╚═╝        ╚═╝
```

47 columns by 6 rows, in ANSI Shadow, the default wordmark font.

## Samples

More renders are in `samples/`, each with the command that made it.

## Install

For any agent, install the skill folder:

```
npx skills add mcdinosaurplace/asciify
```

Vercel's skills installer copies `skills/asciify/` into the agent's skills folder. The folder is self-contained: one bundled script, fifty figlet fonts inside, needing only Node 20 or newer.

For the terminal, install the CLI:

```
npm install -g asciify-cli
```

This installs the `asciify` command. Without installing, run it once with:

```
npx asciify-cli wordmark "TEXT"
```

Both carry the same engine, published as `asciify-core` on npm: plain JavaScript with no Node-only imports, so it runs in a browser too.

## Use

- `asciify wordmark "TEXT"` renders a wordmark, stepping down through the font ladder until the line fits the band.
- `asciify image photo.png` converts an image file, choosing bitmap or sketch mode and saying why.
- `asciify bitmap icon.txt` renders a hand-typed pixel grid as half-block characters.
- `asciify animate banner.txt --loop glitch --format gif --out splash.gif` loops an effect over a render and writes it as an animated GIF.

## Rules the skill works by

- Wordmarks render first. The text alone is enough, no question before the first draft.
- Imagery asks first. One question fixes the surface and the size band before anything is designed, because a bitmap is drawn to its grid and redrawing it is real work.
- Image files get a recommended mode. The `image` command names bitmap or sketch and says why: sketch for photos at 60 columns or more, bitmap for logos, icons, and high-contrast art.
- Everything shows in chat first, in a fenced block. A file is written only when asked, one file per asset.

## What it does not make

Diagrams, flowcharts, tables, boxes around ordinary text, emoji art, sprites. It makes only the asset asked for, and it never edits another file unasked.

## Layout

- `packages/core` the engine
- `packages/cli` the command line
- `skills/asciify` the skill (SKILL.md, references, the bundled script)

## Tests and evals

`npm test` runs 73 engine tests on Node 20 or newer. The skill itself is tested with headless Claude sessions against a fixed set of requests. The latest run passed 39 of 39 expectations with the skill, against 26 of 39 without it, and fired on 18 of 20 trigger queries.

## License

MIT. See `LICENSE`.
