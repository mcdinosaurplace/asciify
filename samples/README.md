# Samples

Sample renders from asciify, run from the repository root: wordmarks, color formats, pixel imagery, and one animation.

## Wordmarks

- asciify-ansi-shadow.txt, 47 columns by 6 rows: `asciify wordmark "ASCIIFY"` (ANSI Shadow, the default wordmark font)
- asciify-calvin-s.txt, 17 by 3: `asciify wordmark "ASCIIFY" --font "Calvin S"`
- asciify-pagga.txt, 28 by 3: `asciify wordmark "ASCIIFY" --font "Pagga"`
- asciify-dos-rebel.txt, 75 by 8: `asciify wordmark "ASCIIFY" --font "DOS Rebel"`

## Color

- asciify-synthwave.html: `asciify wordmark "ASCIIFY" --color synthwave --format html --out asciify-synthwave.html` (a pre with both themes and print rules)
- asciify-synthwave.svg: `asciify wordmark "ASCIIFY" --color synthwave --format svg --out asciify-synthwave.svg` (the same render, as SVG)
- asciify-synthwave.png: `asciify wordmark "ASCIIFY" --color synthwave --format png --out asciify-synthwave.png` (the same render, as PNG)

## Pixel imagery

- heart.txt, 26 by 9: `asciify bitmap skills/asciify/references/examples/heart.txt` (a hand-typed pixel grid rendered as half-blocks)

## Animation

- asciify-typewriter-glitch.gif, 48 frames at 12 frames per second, 376 by 96 pixels: `asciify animate asciify-ansi-shadow.txt --reveal typewriter --loop glitch --color amber --format gif --out asciify-typewriter-glitch.gif`
