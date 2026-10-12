# Slipstream Salvager — Style bible

The rules every sprite follows, from the first code-drawn placeholder to the final art. Change this
file on purpose, never by drift, and log the change in `DECISIONS.md`.

**Phase rule:** until the owner approves the gameplay loop, all art is **drawn by code** in
`src/render/art/code/`. It uses the **final sprite names, frame sizes and anchors** below, so the
art overhaul replaces pixels and nothing else. No AI art generation before the owner says so.

## The look in one paragraph

A scrappy little robot tearing around a scrapyard ring. Warm, rusty, hand-patched metal on the
player; heavier, colder, bolted-plate enemies; a dim, low-contrast floor so everything that moves
pops. Color does the talking: **speed is teal**, **danger is red**, **salvage is gold**. Light from
the upper left, a dark plum outline, soft plum shadows. Never pure black, never flat cold gray.
Kinetic and playful, never grim.

## View

- **3/4 top-down** ("high top-down"): you see the top of the robot and a little of its front, so
  height and facing read. The floor is a flat plane; nothing is drawn in isometric.
- **8 facing directions**, named `e se s sw w nw n ne`. A body faces the 8-way direction nearest its
  heading, with 6° of hysteresis so it doesn't flicker on a boundary.
- **Pixel art is never rotated.** The exact heading (finer than 8 ways) is shown by things drawn as
  pixel geometry instead: the speed trail, afterimages, the tow cable and the heading pip.
- West-side facings (`sw w nw`) may be mirrors of east-side ones for placeholders. The final art
  decides per sprite whether a mirror is acceptable (mirroring moves the light to the upper right).

## Grid and sizes

The game draws on a **640 × 360** logical canvas, scaled by whole numbers only.

| Thing | Frame (px) | Anchor (px) | Art inside | Collision |
|---|---|---|---|---|
| Floor and wall tile | 16 × 16 | (0, 0) | full | walls are solid squares |
| **Player body** ("Scrapper") | **32 × 32** | (16, 20) | 18–20 wide, 16–20 tall | circle r = 8 at the anchor |
| **Rammer** | **40 × 40** | (20, 26) | 26–30 wide, 22–26 tall | circle r = 11 at the anchor |
| Mounted part overlay | 16 × 16 | (8, 8) | ≤ 14 × 14 | none (part of the body) |
| Loose part (pickup) | 16 × 16 | (8, 12) | ≤ 14 × 12 | circle r = 7 |
| Part icon (HUD) | 16 × 16 | (0, 0) | 14 × 14 | — |
| Pillar | 32 × 40 | (0, 8) | footprint 32 × 32, top face 8 px tall | square 32 × 32 |
| Gate (wall opening) | 32 × 16 in the top and bottom walls, 16 × 32 in the side walls | (0, 0) | — | open while a Rammer enters |
| Spark, dust, steam, smoke | 8 × 8 | (4, 4) | — | — |
| Claw slash | 32 × 32 | (16, 16) | — | — |
| Booster plume | 16 × 16 | (8, 8) | — | — |
| Stun stars | 16 × 8 | (8, 8) | — | — |
| Shadow | 16 × 6, 24 × 8, 32 × 10 | center | — | — |
| Hull pip | 8 × 8 | (0, 0) | — | — |

The **anchor** is the point drawn at the object's world position: for bodies, the center of the
footprint, where the shadow sits and the collision circle is centered.

**Mount points.** Each body lists, per direction, the pixel offset of each mount from its anchor and
whether the part draws in front of or behind the body (`src/data/chassis.ts`, `src/data/enemies.ts`).
The same `part:booster:*` sprite is used on the Rammer and on the player: the thing you tear off is
visibly the thing you bolt on.

## Sprite names

Every sprite is asked for by name; the renderer doesn't know if it's code-drawn or imported.
Grammar: `group:thing[:state][:dir][:frame]`.

| Name | Frames | Notes |
|---|---|---|
| `t:floor:<0-3>` | 1 | four floor variants, chosen by a hash of the tile position |
| `t:wall:<mask>` | 1 | 4-bit neighbor mask (0–15) |
| `ob:pillar` | 1 | |
| `ob:gate:<h\|v>:<closed\|open\|warn>` | 1 | `h` in the top/bottom walls, `v` in the sides; `warn` blinks via the renderer, not frames |
| `pl:scrapper:drive:<dir>:<0-1>` | 2 | treads roll; frame advances with distance travelled, not time |
| `pl:scrapper:rip:<dir>:<0-1>` | 2 | claw thrust out |
| `pl:scrapper:hurt:<dir>` | 1 | |
| `en:rammer:stalk:<dir>:<0-1>` | 2 | |
| `en:rammer:windup:<dir>:<0-1>` | 2 | crouched; the renderer adds a ±1 px shake |
| `en:rammer:charge:<dir>:<0-1>` | 2 | |
| `en:rammer:skid:<dir>` | 1 | |
| `en:rammer:stunned:<dir>:<0-1>` | 2 | |
| `part:booster:<dir>` | 1 | mounted overlay, used on both bodies |
| `pickup:booster` | 1 | the loose part (towed or on the floor); the renderer bobs it |
| `icon:part:booster` | 1 | HUD |
| `fx:plume:<dir>:<0-1>` | 2 | booster flame |
| `fx:slash:<tier>:<dir>:<0-2>` | 3 | tier = `crawl`, `cruise`, `slip` |
| `fx:spark:<0-2>`, `fx:dust:<0-3>`, `fx:steam:<0-3>`, `fx:smoke:<0-3>` | — | |
| `fx:stars:<0-3>` | 4 | stun |
| `fx:shadow:<s\|m\|l>` | 1 | |
| `ui:hull:<full\|empty>` | 1 | |

The coverage script (`npm run coverage`) lists every name the game asks for and fails if one has no
art. The overhaul works from that list.

## Palette

**Resurrect 64** by Kerrie Lake, same as Sprocket & Sprout (`src/data/palette.ts`). Never under 48
colors in use across the game. Additions only when a test sprite proves a gap, written here with the
reason.

```
 0-4  #2e222f #3e3546 #625565 #966c6c #ab947a   warm neutrals (plum-black .. taupe)
 5-9  #694f62 #7f708a #9babb2 #c7dcd0 #ffffff   cool neutrals
10-15 #6e2727 #b33831 #ea4f36 #f57d4a #ae2334 #e83b3b   reds
16-18 #fb6b1d #f79617 #f9c22b                   orange .. gold
19-23 #7a3045 #9e4539 #cd683d #e6904e #fbb954   rust .. amber
24-28 #4c3e24 #676633 #a2a947 #d5e04b #fbff86   olive .. pale yellow
29-33 #165a4c #239063 #1ebc73 #91db69 #cddf6c   greens
34-38 #313638 #374e4a #547e64 #92a984 #b2ba90   sage
39-43 #0b5e65 #0b8a8f #0eaf9b #30e1b9 #8ff8e2   teals
44-48 #323353 #484a77 #4d65b4 #4d9be6 #8fd3ff   blues
49-53 #45293f #6b3e75 #905ea9 #a884f3 #eaaded   purples
54-57 #753c54 #a24b6f #cf657f #ed8099           roses
58-63 #831c5d #c32454 #f04f78 #f68181 #fca790 #fdcbb0   magenta .. peach
```

## Color language (hard rules, because readability is a pillar)

| Meaning | Colors (indices) | Used for | Never used for |
|---|---|---|---|
| **Speed** | teals 40–43, blue 48 | Slipstream glow, afterimages, wind lines, the gauge's top band, the player's Burn lane | enemies, danger |
| Cruise | lime 32–33 | claw ring and gauge band at Cruise | (not amber: that's the player's body, and 23 is salvage; DECISIONS #45) |
| Crawl | cool neutrals 6–7 | claw and gauge at Crawl | |
| **Danger** | reds 11, 12, 15 and magenta 59–60 | telegraph lanes, charge flash, hurt flash, gate warning | anything friendly or decorative |
| **Salvage** | gold 18, amber 23, pale yellow 28 | parts, the tow cable glint, the "torn off" burst | enemy bodies |
| Player body | rust and orange 20–22, 16, cream 63, plum outline 0 | the Scrapper | |
| Rammer body | blues and slate 44–46, purple 50, sage 35 | the Rammer, so it reads as "not you" at a glance | |
| Arena | warm neutrals 1–5, olive 24–25 | floor, walls, pillars; low contrast against each other | |

Outline: `#2e222f` (0), 1 px, on every body, part and pickup. Shadows: plum 0 at ~35% as a solid
dithered ellipse, never blurred. Light from the upper left: the top-left edges of a body get the
lightest ramp color.

## Motion and feedback rules

- Every player input answers within **one tick** visibly (sprite, dust, sound), the Dead Cells rule.
- Speed must be readable **without the HUD**: a claw ring by tier (lime at Cruise, teal at
  Slipstream), dust at Cruise, dithered afterimages (every 4 ticks) and wind lines at Slipstream,
  engine hum pitch.
- Sparks and stun stars are white, frost and orange, never gold (gold means salvage).
- Dimming behind menus is a checker of ink pixels, not alpha.
- Hit-stop freezes the sim, not the renderer: particles keep moving through a freeze.
- Screen shake is in whole pixels, at most 3 px, and can be turned off in Settings.
- Telegraphs are drawn **under** bodies and **over** the floor, as pixel lines and dither, never as
  alpha gradients that blur. A lane is drawn at the charging body's **full width**: two edge lines
  plus dither between them, dashed while it's still aiming, solid and flashing once locked. Enemy
  lanes are red (danger); the player's own Burn lane is teal (speed).
- The **heading tick** is a 3 px pixel line off the claw at the true heading angle, in the current
  tier's color, because the body sprite only has 8 directions.
- Flashes (hurt, hit) are palette swaps to a single color for 2 ticks, never white-out alpha.

## Pixel rules (hard)

1. Integer positions on screen; world positions may be fractional in the sim but are rounded when
   drawn.
2. Whole-number scaling only, `imageSmoothingEnabled = false`.
3. Pixel art is never rotated or drawn at a fractional scale.
4. Procedural shapes (lanes, cables, trails, the gauge) are drawn on the 640 × 360 grid with
   Bresenham lines and pixel circles, in palette colors.
5. No blur, glow filters or gradients. Glow is a ring of palette pixels.

## Code-drawn placeholder rules (now)

- One generator per sprite family in `src/render/art/code/`, registered by name with the atlas.
- Shapes, not detail: a readable silhouette, the outline, the body color ramp (3 shades), and the
  thing that matters for play made obvious (the Rammer's booster, the claw).
- Sizes and anchors exactly as in the table above.

## The art overhaul (later, only after the owner approves the loop)

- **Generator:** the SpriteCook plugin (the pixel-art plugin enabled on the owner's account), with
  PixelLab's free `pixelart_workbench` for exact pixel fixes. PixelLab generation, which S&S used,
  stays available as a fallback (DECISIONS #20).
- **Pipeline:** the same as S&S: generate, snap to Resurrect 64, pack into PNG sheets plus JSON
  (name, rectangle, anchor) under `src/art/`, with raw generations and recipes in `art/<group>/` so
  every import can be rerun. Fix what the generator can't draw by script, not by hand.
- **Checks:** contact sheet of each batch, the screenshot sweep, the coverage script.
- Settings per asset kind (model, size, view, outline) get written here when the overhaul starts.
