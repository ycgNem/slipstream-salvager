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
| **Snapper** (M3) | **32 × 32** | (16, 20) | 16–20 wide, 12–16 tall, low and wide | circle r = 8 at the anchor |
| **Hopper** (M6) | **40 × 40** | (20, 26) | 22–26 wide, 16–20 tall: a squat frog, big haunches | circle r = 10 at the anchor |
| **Bouncer** (M6) | **32 × 32** | (16, 20) | 15–17 across, round, 16–18 tall | circle r = 9 at the anchor |
| Mounted part overlay (rear and front mounts) | 16 × 16 | (8, 8) | ≤ 14 × 14 | none (part of the body) |
| Treads overlay (sides mount, M3) | 32 × 32 | (16, 20) | the two tread guards either side of the body's footprint | none |
| Springs overlay (sides mount, M6) | 32 × 32 | (16, 20) | a gold coil bumper either side of the body's footprint | none |
| Loose part (pickup) | 16 × 16 | (8, 12) | ≤ 14 × 12 | circle r = 7 |
| Part icon (HUD) | 16 × 16 | (0, 0) | 14 × 14 | — |
| Pillar | 32 × 40 | (0, 8) | footprint 32 × 32; rises 8 px above it (top face ~ the footprint, 12 px front face narrowing to the foot) | square 32 × 32 |
| Post (M3) | 16 × 24 | (0, 8) | footprint 16 × 16; rises 8 px, like the pillar | square 16 × 16 |
| Tower (M3) | 48 × 56 | (0, 8) | footprint 48 × 48; rises 8 px, like the pillar | square 48 × 48 |
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
| `ob:post`, `ob:tower` | 1 | M3 yards: a small and a big pillar, same look as `ob:pillar` |
| `ob:gate:<h\|v>:<closed\|open\|warn>` | 1 | `h` in the top/bottom walls, `v` in the sides; `warn` blinks via the renderer, not frames |
| `pl:scrapper:drive:<dir>:<0-1>` | 2 | treads roll; frame advances with distance travelled, not time |
| `pl:scrapper:rip:<dir>:<0-1>` | 2 | claw thrust out |
| `pl:scrapper:hurt:<dir>` | 1 | |
| `en:rammer:stalk:<dir>:<0-1>` | 2 | |
| `en:rammer:windup:<dir>:<0-1>` | 2 | crouched; the renderer adds a ±1 px shake |
| `en:rammer:charge:<dir>:<0-1>` | 2 | |
| `en:rammer:skid:<dir>` | 1 | |
| `en:rammer:stunned:<dir>:<0-1>` | 2 | |
| `en:snapper:hunt:<dir>:<0-1>` | 2 | M3. A small, low tread-bot with a snout; drawn *without* its treads (they're the `part:treads` overlay, so a stripped Snapper limps on bare axles) |
| `en:snapper:windup:<dir>:<0-1>` | 2 | crouched, snout down; the renderer adds a ±1 px shake |
| `en:snapper:snap:<dir>:<0-1>` | 2 | stretched forward, lunging |
| `en:snapper:slide:<dir>` | 1 | sliding sideways, leaning |
| `en:snapper:stunned:<dir>:<0-1>` | 2 | |
| `en:hopper:stalk:<dir>:<0-1>` | 2 | M6. A squat sage-green scrap frog, big haunches either side, pale eye domes; drawn *without* its jets (the `part:jets` overlay on its back) |
| `en:hopper:crouch:<dir>:<0-1>` | 2 | haunches folded, body low, about to spring; the renderer adds a ±1 px shake once its ring locks |
| `en:hopper:air:<dir>` | 1 | legs stretched out behind; the renderer lifts it up to 24 px off its shadow |
| `en:hopper:land:<dir>` | 1 | stuck: low, feet splayed, legs buried (also its stunned frame) |
| `en:bouncer:idle:<dir>:<0-1>` | 2 | M6. A round chrome pinball with a dark visor slit and a cap; drawn *without* its springs (the `part:springs` overlay round its middle) |
| `en:bouncer:windup:<dir>:<0-1>` | 2 | squashed down, about to roll |
| `en:bouncer:roll:<dir>:<0-1>` | 2 | rolling: a band round the ball moves between the frames (the renderer cycles faster at speed) |
| `en:bouncer:stunned:<dir>:<0-1>` | 2 | dizzy, wobbling side to side |
| `part:<booster\|plow\|jaws>:<dir>` | 1 | mounted overlay (16 × 16), used on every body that carries it: the booster on the rear mount, the plow and the jaws on the front mount |
| `part:treads:<dir>` | 1 | sides overlay (32 × 32, the body's anchor), drawn *under* the body so the guards stick out either side |
| `part:jets:<dir>` | 1 | M6. Rear overlay (16 × 16, like the booster): two upright gold jet canisters on a strap; the plume fires under it on a leap |
| `part:springs:<dir>` | 1 | M6. Sides overlay (32 × 32, like the treads): a gold coil bumper either side |
| `pickup:<booster\|treads\|plow\|jaws\|jets\|springs>` | 1 | the loose part (towed or on the floor); the renderer bobs it |
| `icon:part:<booster\|treads\|plow\|jaws\|jets\|springs>` | 1 | HUD slots |
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
| Arena | warm neutrals 1–5, olive 24–25 | floor, walls, pillars; low contrast against each other. Olive is the arena's painted steel: gate doors and the scrap skips | |

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

## The art overhaul (M4; the owner approved the loop on 2026-10-12)

- **Tool (DECISIONS #65):** the **pixel-art-studio** skill (`~/.claude/skills/pixel-art-studio`),
  the owner's choice: every sprite is drawn pixel by pixel by a deterministic Python build script,
  `pixel-art/<family>/build.py`, palette Resurrect 64 only, light from the upper left, the plum
  outline. The script is the source of truth; never hand-edit an exported PNG. Its exports go
  through the import pipeline below, unchanged.
- *Superseded:* the SpriteCook plugin (the pixel-art plugin enabled on the owner's account), with
  PixelLab's free `pixelart_workbench` for exact pixel fixes. PixelLab generation, which S&S used,
  stays available as a fallback (DECISIONS #20).
- **Pipeline:** `pixel-art/<family>/build.py` exports 1x PNG strips; a recipe
  `pixel-art/<family>/sprites.json` names every frame; `node scripts/sprites-import.mjs
  pixel-art/<family>/sprites.json` snaps to Resurrect 64 and packs `src/art/<family>.png` + `.json`;
  `src/render/art/imported.ts` registers every sheet in `src/art/` by name, and an imported frame
  wins over the code-drawn placeholder. Fix anything the import flags in the build script.
- **Checks:** the import's preview sheet (`e2e/out/art/<family>.preview.png`), the code-art sheet
  (`node e2e/artsheet.mjs`) for side-by-side comparison, the screenshot sweep, the coverage script.
- **The bar:** an imported family replaces the code-drawn one only if it reads better at 1x in play
  (silhouette, facing, the thing that matters for play: the claw, the booster, the Snapper's side).
  If it doesn't, it isn't imported and the placeholder stays.
- **What's imported (2026-10-12):**
  - The arena: floor, walls, pillar, post, tower, gates.
  - Dust, steam, smoke and sparks. Smoke is plum 0, 2 and 6: the old 1/2/5 vanished on the floor.
    Sparks are white, frost and orange, never gold.
  - The Snapper, the treads, plow and jaws (mounted and as pickups), and all four part icons.
- **Still code-drawn, because a redraw didn't clearly beat them at 1x:**
  - The Scrapper, the Rammer, the booster and its pickup, the plume and the slash.
  - Stars, shadows and the hull pips.
- The robots' build scripts share `pixel-art/_lib/sculpt.py`, a Python port of the code-art
  sculptor that matches it pixel for pixel. Hand-placed details (eyes, teeth, bands) go on top.
- West-side facings may be stored as mirrors (`flipX` in the recipe) where the light flip isn't
  noticeable at 1x; the build script decides per family.
