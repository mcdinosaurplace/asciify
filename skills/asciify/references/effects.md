# Effects

Generated from the engine. Every effect is a pure function of the frame, the time, its intensity from 0 (nothing) to 1 (full), and the seed, so a run reproduces. Stack them in order: `--reveal typewriter --loop crt:0.6,glitch:0.3 --effects hue-cycle:0.2`. Parameters follow the intensity: `scroll:1:direction=up:gap=2`. Reveals run once from nothing to the art; loops cycle over the finished art; color effects change colors only and show only in color.

## reveals

| effect | what it does |
| --- | --- |
| typewriter | cells appear in reading order |
| wipe | a straight edge sweeps across; direction=left|right|up|down |
| dissolve | cells appear at random |
| rain | columns fill from the top with staggered starts |
| static | noise resolves into the art |
| burn | the art burns in with a bright fringe |

## loops

| effect | what it does |
| --- | --- |
| glitch | rows displace sideways and glyphs burst |
| crt | a bright band sweeps down with a short trail |
| phosphor | the band with a long decaying trail |
| interlace | alternate rows dim and swap each frame |
| flicker | brightness jitters and cells drop out |
| vhs | a torn band jitters sideways with noise |
| roll | the frame rolls vertically like a slipped hold |
| blink | the art blinks off for part of the cycle |
| scroll | a seamless marquee; direction=left|right|up|down, gap=N |
| matrix | glyph rain falls through the empty cells |

## color effects

| effect | what it does |
| --- | --- |
| hue-cycle | every color rotates around the hue wheel |
| pulse | brightness breathes |
| color-flicker | brightness jitters |
| gradient-scroll | the gradient slides along its direction |
| channel-offset | red and blue split sideways, the glitch look |
| glow | a dim halo pulses in the cells around the art |
