# Worked examples

Two ways to design imagery: a hand-typed bitmap for most icons, and a scene module when curves or several scales are needed.

## A hand-typed bitmap: the heart

`references/examples/heart.txt` is 28 pixels wide and 18 rows tall, an even number of rows because every cell holds two pixels. Rows of `.` are off, `#` on. The lobes are two circles that meet at the top; the point is a single pair of pixels at the bottom, which is the smallest feature that still reads.

```
......####........####......
....########....########....
...##########..##########...
..########################..
..########################..
..########################..
...######################...
....####################....
.....##################.....
......################......
.......##############.......
........############........
.........##########.........
..........########..........
...........######...........
............####............
.............##.............
............................```

Rendered with `node scripts/asciify.mjs bitmap references/examples/heart.txt`, 28 columns by 9 rows:

```
    ▄▄████▄▄    ▄▄████▄▄
  ▄██████████▄▄██████████▄
  ████████████████████████
   ▀████████████████████▀
     ▀████████████████▀
       ▀████████████▀
         ▀████████▀
           ▀████▀
             ▀▀
```

The notes that came with it: `# 28 x 18 pixels, 26 x 9 cells `. The map, `--map`, prints the pixels with rulers so a count can be checked before judging the art; its first rows:

```
    0         1         2
    0123456789012345678901234567
  0 ......####........####......
    ....########....########....
    ...##########..##########...
    ..########################..
```

Scaling by a whole number keeps every edge crisp. `--scale 2` gives 56 columns by 18 rows:

```
            ████████                ████████
        ████████████████        ████████████████
      ████████████████████    ████████████████████
    ████████████████████████████████████████████████
    ████████████████████████████████████████████████
    ████████████████████████████████████████████████
      ████████████████████████████████████████████
        ████████████████████████████████████████
          ████████████████████████████████████
            ████████████████████████████████
              ████████████████████████████
                ████████████████████████
                  ████████████████████
                    ████████████████
                      ████████████
                        ████████
                          ████
```

Regions: replace `#` with letters to name parts of the image, and each letter gets its own color slot when the art is colored; two regions in one cell render exactly.

## A scene module: the grimoire

`references/examples/badge.mjs` draws a closed grimoire seen from the front cover: a spine on the left, a clasp that clamps the right edge, and a cover between them. It exports a `design` size in pixels and a `scene(geometry, scale)` that returns layers, bottom first. The spine is a rectangle with three bands cut across it; the cover is a rectangle with a frame one pixel inside its edge, a ring and a four-point star at its center, and four corner crosses, each a union of two bars, all subtracted from the cover as negative space; the cover and the clasp both carry `gap: 1`, and the clasp reaches two pixels past the cover's right edge. Render it with `node scripts/asciify.mjs scene references/examples/badge.mjs --scale 1.5 --rows 40`; add `--map` to see the three regions, `S`, `B`, and `C`, and `--color sunset` to color them by area, or `--region C=#ffd166` to pin the clasp.

## The rules these follow

- A four-point star reads at a radius of 2.5 pixels or more; a band needs two pixels; a buckle two or three. Below that, drop the feature.
- Leave a one-pixel gap wherever one shape crosses another; in a scene that is the layer's `gap`.
- No marks outside the shapes: no scattered texture, no offset copies as shadows.
- Design at the smallest band the image must survive, then scale by whole numbers. A different aspect is a redesign.
- Check the map before judging the render, and read the notes: a speck, a notch, or a thin bridge is reported by pixel position.
