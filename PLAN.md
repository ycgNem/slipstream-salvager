# Slipstream Salvager — Plan

Working title. Written 2026-10-12, before any game code. This is a new game, not a sequel to
Sprocket & Sprout (S&S): it reuses S&S's **engine layer and workflow** only. None of S&S's rules,
content, data or art carry over.

`STYLE.md` has the art rules, `ROADMAP.md` the milestones (each with a paste-ready prompt),
`DECISIONS.md` every call made and why, `PROGRESS.md` what's built, `HANDOFF.md` where the last
session stopped.

---

## 1. The pitch

A pixel-art action roguelike about a small, fast scrap robot that rips components off enemies with
high-speed passes and bolts them onto its own body.

**The one thing:** your movement *is* your weapon. How fast you're going when you strike decides
what the strike does, and every part you bolt on changes how you accelerate, turn and attack. The
basic fight is: **build speed → make one decisive pass → get clear → (bolt on what you tore off)**.

**Tone:** scrappy, kinetic, playful.

**Feel references (one quality each, nothing else):**
- *Risk of Rain 2*: run-to-run build variety. Not its combat loop, pacing, timer or structure.
- *Dead Cells*: responsive movement and clear movement feedback (every input answers at once, and
  you can always tell what your body is doing).

## 2. The removal test

> "If you removed momentum-driven attacks and body parts that change how you move, what's left
> would just be a familiar equipment-based action roguelike."

Every feature is checked against it. A feature earns its place only if it makes speed, steering
or the body matter more. If a feature would still make sense in a stand-and-shoot roguelike, it
is suspect.

### How the first slice proves or disproves it

The first slice (Milestone 1) contains **only** the two things the test names, plus one enemy
built to push on them. There is no loot table, no stats screen, no currency, no meta layer to hide
behind. So:

- **If the slice is fun**, the fun can only be coming from momentum combat and a part that changes
  movement. The identity carries the game. → proceed.
- **If the slice is flat**, nothing else is propping it up, and we learn that now, cheaply, before
  any content exists. → re-tune or re-think the mechanic, not add systems around it.

It is checked three ways:

1. **Flat mode: the removal test, playable.** A switch in the dev tuning panel removes the one
   thing: damage stops depending on speed (every rip hits as hard), and the Booster stops changing
   how you move (no Burn, no speed or turning changes) and becomes a plain +1 damage part
   (DECISIONS #50). The owner plays the same three waves both ways. If flat mode is
   about as much fun, the identity isn't carrying the game yet.
2. **Automated guards (in the test suite, run on every build).** Scripted bots play the slice on 8
   seeds:
   - *Turret* (stands still, spams the attack) must deal **zero** damage and lose.
   - *Brawler* (stays close and taps at medium speed) and *Matador* (waits for a charge, sidesteps,
     counters) must both do worse than *Hit-and-run* (run up, pass, loop out) on damage dealt per
     hit taken.
   - *Hit-and-run* must clear wave 1 taking at most one hit on average.
   - *Route flip:* on the base body, a bot that loops tightly around pillars must beat a bot that
     drives long straight lanes; **with the Booster bolted on, the order must flip.** This is the
     check that the part changes *how you play*, not just a number.
   - *Data rule:* every part must declare a behavior change, not only stat multipliers.
3. **Owner playtest (the real verdict).** Questions in `ROADMAP.md` M1 "Playtest questions", such
   as: *Did you ever want to stop moving? Could you tell your speed without looking at the HUD?
   After bolting on the Booster, did you take different lines?*

## 3. Design pillars

1. **Speed is the weapon.** Only a fast hit does damage. Slow contact does nothing, or hurts you.
2. **Commit, pass, escape.** Attacks are short committed lunges you can't steer. You pass *through*
   the target and keep your momentum, which is how you get clear. Lingering near an enemy is
   dangerous.
3. **You become what you rip.** Every part you steal carries its owner's way of moving. Rip a
   Rammer's booster and you inherit the Rammer's charge, *including its weakness*. This rule keeps
   parts from becoming "bigger numbers".
4. **Readable at a glance.** One screen, no scrolling camera, every threat telegraphed, your speed
   readable from the robot itself (glow, trail, engine pitch), not only from the HUD.
5. **Small and proven before big.** No content beyond the slice until the owner says the loop works.

**Things we don't do** (from the brief): stationary combat as the best strategy; a difficulty timer
that constantly escalates; passive upgrades that are mostly bigger numbers; a big inventory; lots of
content before the movement-and-salvage loop is proven.

---

## 4. The first slice (Milestone 1), in full

One arena, one player body, one enemy type, one salvageable part. All numbers are starting values
in `src/data/` and will be tuned in playtest (the dev tuning panel edits them live). This section was
revised after a design review that found degenerate strategies in the first draft (DECISIONS #27).

### 4.1 The arena: "The Ring"

- One screen: **640 × 360** logical pixels, scaled up by whole numbers to fit the window
  (×2 = 1280×720, ×3 = 1920×1080). No camera movement; everything is always on screen.
- A scrapyard floor ringed by a 16 px wall (interior 608 × 328), with four **pillars** (32 × 32) set
  so there are lanes to loop around them and long straights between them.
- Walls and pillars are solid. Hitting them glancingly slides along them; hitting head-on costs most
  of your speed (sparks, clank, no damage).

### 4.2 The player: the "Scrapper" chassis

**Controls (absolute direction):** hold a direction and the robot accelerates and curves toward it.
Releasing coasts briefly. Pushing hard against your motion brakes and skids, then pivots.

| Input | Keyboard | Gamepad |
|---|---|---|
| Steer / thrust | WASD or arrows | Left stick (analog) |
| **Rip** (attack) | Space or J | A or Right trigger |
| **Bolt on** (tap) | E or K | Y or X |
| Pause | Esc | Start |

**Movement model** (velocity = heading × speed; units px/s):

| Value | Base Scrapper | Notes |
|---|---|---|
| Top speed | 240 | about 2.5 s to cross the arena |
| Acceleration | 900 below 60 px/s, 180 above | instant to get moving; reaching Slipstream takes ~0.8 s and ~90 px of fairly straight driving |
| Turn rate | 14 rad/s at rest → 4 rad/s at top | tight at low speed; turning circle ~60 px at top speed |
| **Turn scrub** | a turn pulling more than 900 px/s² sideways (speed × turn rate) bleeds speed | you can't orbit an enemy at full speed and a full-lock U-turn drops you out of Slipstream, but a pillar loop or a 45° swerve keeps it (DECISIONS #47) |
| Coast drag | half-life 0.3 s (~100 px of drift from top speed) | responsive, not Asteroids |
| Brake/skid | 900 px/s² when pushing >150° against motion (with hysteresis) | then pivots to the new direction below 60 px/s |

**Speed tiers** (absolute, the same marks for every body):

| Tier | Speed | What a Rip does | You afterwards |
|---|---|---|---|
| Crawl | < 110 | nothing (clank) | you bounce off and stop |
| Cruise | 110–190 | **no damage**: shoves the enemy 24 px and **cancels its windup** | keep 85% of your speed |
| **Slipstream** | ≥ 190 | **2 damage**, or **tears off a part** (see 4.4) | keep all your speed and pass through |

So Cruise is a defensive tool (interrupt a charge) and only Slipstream hurts. Damage always needs a
run-up.

The tier is shown on the robot itself: the claw glows grey / amber / teal, dust kicks up at Cruise,
afterimages and wind lines appear at Slipstream, and the engine hum rises in pitch with speed. A
small tick off the claw shows your exact heading (the sprite only has 8 directions). The HUD has a
speed gauge with the two marks.

**Rip** (the only attack): a 0.16 s lunge straight ahead with the claw. Can't steer during it.
**The tier is locked when you press**, so the lunge's own boost can't turn a crawl into a
slipstream. Up to 12° of aim assist toward an enemy in front, so the 8-direction sprites never make
a pass miss by a body width. You pass through enemy bodies during the lunge. Cooldown 0.45 s.
Hit-stop (2 / 4 / 7 frames by tier), screen shake, sparks.

**Hull:** 5 pips. No healing in the slice. At 0: "Scrapped" → results → instant restart.

**Your parts are your armor:** when a hit lands and you have a part bolted on, the *part* takes it
and **shatters**, and your hull is untouched. With nothing bolted on, the hit costs a hull pip. Any
hit also knocks a towed part loose (it lands nearby; drive over it to grab it again). Living Rammers
are the only source of spare parts.

### 4.3 The enemy: the Rammer

A heavy scrap bot with a **booster bolted to its back**. It is the slice's whole threat.

- **Stalks** toward you slowly (45 px/s) but **turns quickly to face you** (6 rad/s), so its back is
  hidden unless it's committed to a charge, recovering or stunned.
- **Telegraphed charge.** A lane the full width of its body is painted on the floor ahead of it,
  showing exactly where it will go. It aims where you'll be when the charge arrives (80% of the way
  there, reading your current line *or* curve), so a steady line or a steady loop gets clipped and a
  juke clears it (DECISIONS #48, #49).
  - **Far** (more than 80 px away): 0.85 s windup. It tracks you for 0.5 s (dashed lane), then the
    lane **locks** for 0.35 s (solid, flashing) and it can't turn.
  - **Close** (80 px or less): a quick 0.45 s windup (0.2 s tracking, 0.25 s locked). Lingering is
    punished.
  - Then it charges straight along the lane at 330 px/s for up to ~260 px.
- **Bumping it** outside a Rip bounces you off and starts its quick windup.
- **Recovers** after the charge: skids for 0.9 s, steaming, unable to turn. This is the opening. A
  charge into a wall or pillar rebounds it ~24 px off the surface into the same recovery (no extra
  stun, so parking by a pillar earns nothing). A charge into another Rammer puts both into recovery,
  with no damage.
- A charge hit shatters your bolted part (or costs **1 hull pip** if you have none), throws you along
  the lane and kills your momentum.
- At most two Rammers wind up at once, so a crowd stays readable.
- **HP 4:** two Slipstream rips wreck it.
- **Stripped:** once its booster is torn off it can't charge any more. It limps (35 px/s) and does a
  short telegraphed shove (0.5 s windup, 70 px). Weaker, never harmless.

### 4.4 The part: the Booster

- **Tearing it off:** a **Slipstream-tier** rip that strikes the Rammer's **rear** (within 70° of
  straight behind it) tears the booster off. **The tearing hit does no damage**: all of it goes into
  the part, so tearing and wrecking are always two separate passes. Any other Slipstream hit does 2
  damage. **Wrecking a Rammer wrecks its booster.** The charge-and-recover rhythm is what gives you
  the window to get behind it. (While it recovers or is stunned, its facing snaps to its sprite's
  direction, so the rear you see is the rear the game uses.)
- **Wave 1 safety net:** the first Rammer can't be wrecked while it still has its booster (it stops
  at 1 HP), so every new player gets to see a tear-off. If you keep hitting its front instead, the
  third Slipstream hit at 1 HP shakes the booster loose onto the floor, so nobody is stuck in wave 1
  (DECISIONS #33).
- **Grabbing it:** your claw keeps hold of what it tears off. The part is **towed behind you on a
  short cable** (a trailing point on a spring), swinging with your momentum.
- **Bolting it on:** tap *Bolt on*, and bolting takes 0.7 s (ratchet clicks, wrench sparks). It works
  while moving, but your steering is halved, and a Rip or a hit cancels it. So the smart move is to
  get clear first. The Scrapper has one mount for it (rear); bolting a second booster drops the
  first.
- **What it does: you inherit the Rammer's charge, weakness included.**
  - **The Rip becomes the Burn.** *Hold* the button to rev: your steering locks to your current
    heading, your own lane is painted ahead of you (in teal, the speed color), and thrust climbs past
    your top speed toward 330. *Release* to lunge at whatever tier you reached, piercing through
    everything in the lane. Touching an enemy while revving releases it automatically. **Revving into
    a wall stuns you for 0.6 s**, just like a Rammer. Tuned so a burn from rest reaches Slipstream in
    ~0.6 s: faster than driving there, but in a straight line you can't change.
  - Movement: top speed 240 → 270, and the turn rate drops by a third at every speed (14 → 9.1 rad/s
    at rest, 4 → 2.6 at top; the turning circle at top speed is ~105 px, which still fits the
    arena). Tight pillar loops no longer hold Slipstream (DECISIONS #39).
  - The result: the base Scrapper gets its speed from loops around pillars; the Booster gets it from
    straight committed lanes. Different lines, not bigger numbers.
  - Look: the booster sits on your back and fires a plume when you thrust; brighter while revving.

### 4.5 The encounter

Three waves in The Ring: 1 Rammer, then 2, then 3. Two seconds of breather and a "WAVE 2" banner
between waves; new Rammers enter through gates in the wall after a 1 s warning marker. Clearing
wave 3 shows the results: time, hull left, parts torn off, and *Again* / *Title*. A first-time player
sees three short hints, each shown once, in the world rather than in a checklist: "Build speed — the
claw turns teal", "Hit it from behind at teal to tear its booster off", "Tap E to bolt it on".
Expected length: 2–4 minutes.

### 4.6 Not in the slice (on purpose)

A run structure, more arenas or biomes, a second enemy type, more parts beyond the Booster, any
currency, shops, meta-progression, story, healing, a build screen, key rebinding in the UI (binds
live in code for now), saves beyond settings, an art overhaul and a long music score. Each waits for
the owner's verdict on the loop.

---

## 5. Tech

Same stack as S&S, for the same reasons (see the S&S handoff part 2):

| Part | Choice |
|---|---|
| Language and build | TypeScript (strict) + Vite 5 |
| Engine | None. One `<canvas>`, 2D context, `imageSmoothingEnabled = false` |
| Loop | Fixed 60 ticks/s simulation, drawing on `requestAnimationFrame` (`src/engine/loop.ts`) |
| Resolution | 640 × 360 logical, whole-number scaling, letterboxed (DECISIONS #6) |
| Input | Keyboard + **Gamepad API** (new; analog steering suits momentum) |
| UI | Canvas immediate-mode UI kit + S&S's bitmap pixel font |
| Art | Code-drawn placeholders at the **final sprite names and sizes**, asked for by name through the atlas; an art overhaul only after the owner approves the loop |
| Sound | Web Audio: synthesized SFX + a jsfxr bank; music in text notation played by the S&S synth. A continuous engine hum whose pitch follows speed. |
| Saves | localStorage for settings and best results only. |
| Tests | Vitest for the rules (pure sim, headless) and the strategy bots; Playwright + headless Chrome for the smoke test, screenshot sweep with overlap audit, and sprite coverage |
| Website | GitHub Pages via GitHub Actions on push to `main` (tests first); set up locally, inert until a repo exists |
| Desktop | Electron + electron-builder → Windows setup and portable `.exe` |
| Offline | Service worker + web manifest |

Node: the portable Node 22 at `C:\Users\jacks\tools\node-v22.20.0-win-x64`, put on PATH by the
`.bat` files and by each session.

## 6. Architecture

The same rules that worked in S&S:

1. **The simulation is pure.** `src/sim` never touches the screen, sound or browser. It takes an
   input frame (stick vector, button states) per tick and returns events (`rip`, `hit`, `tear`,
   `clank`, `windup`, `charge`, `bolted`, `shatter`, ...) that the presentation layer turns into
   sound, particles, hit-stop and shake. The same sim runs the tests and the bots.
2. **Deterministic.** Seeded RNG, fixed tick, no `Math.random` in `src/sim`. Same seed + same inputs
   = same result, so a bug can be replayed from an input log.
3. **Content is data.** The chassis, parts, enemies, arena and waves are typed data in `src/data/`.
   A test checks every reference (wave → enemy, enemy → part, part → sprite).
4. **Parts are behavior modules, not stat sheets.** A part's data has `stats` (multipliers) *and*
   `behavior` (e.g. `attack: 'burn'`), and the data test fails if `behavior` is empty. Flat mode
   ignores `behavior` and speed-scaled damage, for the A/B removal test.
5. **Sprites are asked for by name** (`pl:scrapper:drive:se:1`, `en:rammer:windup:w:0`,
   `part:booster:n`). The renderer doesn't know whether a sprite is code-drawn or imported. A coverage
   script lists every name the game asks for.
6. **Systems run in a fixed order each tick:** input → player movement → rip/burn → enemies (AI,
   windup, charge) → collisions (walls, pillars, bodies) → hits and tear-offs → towed part and
   pickups → bolting → waves → events out.
7. **Hard pixel rules:** integer positions on screen, whole-number scaling only, **pixel art is never
   rotated**. Directions are drawn frames (8 directions). Telegraph lanes, trails, the heading tick
   and the cable are drawn as pixel geometry (Bresenham lines, pixel circles) on the 640 × 360 grid,
   never as rotated sprites.

## 7. Folder layout

```
src/
  main.ts
  engine/      FROM S&S: loop.ts, rng.ts, input.ts (+ gamepad.ts, new), audio/ (audio, sfxr, music; songs.ts new)
  sim/         NEW. The game's rules. No DOM.
    world.ts     the state of one encounter
    tick.ts      the fixed system order
    body.ts      the movement model (heading, speed, turn curve, scrub, brake, overspeed)
    rip.ts       the attack: tiers, lunge, burn, aim assist, hit resolution
    rammer.ts    the enemy brain, lead aim and charge
    salvage.ts   tear-off, towing, pickups, bolting, shatter
    arena.ts     walls, pillars, collision
    waves.ts     the encounter script
    events.ts    the event queue the presentation reads
    bots.ts      the strategy bots used by tests (turret, brawler, matador, hit-and-run, looper, laner)
  data/        NEW. palette.ts (Resurrect 64), chassis.ts, parts.ts, enemies.ts, arena.ts, waves.ts, tuning.ts
  render/      FROM S&S: atlas.ts, art/pixel.ts, art/pixbuf.ts, particles.ts, shake.ts
               NEW: renderer.ts, draw8.ts (8-direction picking), pixgeom.ts (lines, circles, dither),
                    fx.ts (trails, afterimages, sparks, hit-stop), art/code/ (placeholder generators by name)
  ui/          FROM S&S: font.ts, ui.ts (trimmed), audit.ts, cursor.ts
               NEW: hud.ts (speed gauge, hull, towed part, bolt progress), hints.ts
  app/         NEW: app.ts (title → play → results), play.ts, settings.ts, tuning.ts (dev panel + flat mode)
  art/         empty until the art overhaul (PNG sheets + JSON)
tests/         Vitest
e2e/           FROM S&S (adapted): smoke.mjs, screens.mjs (+ overlap audit), coverage.mjs
scripts/       FROM S&S (kept for the art overhaul): lib/png.mjs, lib/pixel.mjs, contact.mjs, sprites-import.mjs, sfx-design.mjs, make-icons.mjs
electron/      FROM S&S: main.cjs
public/        sw.js, manifest.webmanifest, icons
.github/workflows/deploy.yml   FROM S&S
.claude/agents/                adapted: indie-critic, qa-screens (art-director comes with the overhaul)
Play.bat, Package for web.bat, Build desktop app.bat   FROM S&S
```

**What is copied from S&S and what isn't.** Copied (then trimmed of S&S-specific names): the loop,
RNG, input, audio engine and synth, sfxr wrapper, atlas and pixel helpers, particles and shake, font,
UI kit and its overlap audit, the e2e harness, the art scripts, the Electron wrapper, the workflow, the
service worker, the `.bat` files, and the vite / vitest / tsconfig files. **Not copied:** anything in
S&S's `src/sim`, `src/data`, `src/ui/windows`, `src/app`, the renderer, the save system, the songs,
the art, the docs' content.
