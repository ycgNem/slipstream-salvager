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
| **Slipstream** | ≥ 190 | **damage by where you hit** (front 1, side 2, back 4), or **tears off a part** (see 4.3, 4.4) | keep all your speed and pass through |

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
and is **knocked loose**, cracked, onto the floor; your hull is untouched. Drive over it to tow it
again and bolt it back on, before a charging Rammer runs it over and crushes it. A cracked part that
takes a second hit **shatters** (DECISIONS #58). With nothing bolted on, the hit costs a hull pip.
Any hit also knocks a towed part loose. Living Rammers are the only source of new parts.

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
- **Its slipstream:** a charge that passes within 24 px of you without hitting you drags you along
  in its wake: you're lifted to at least 220 px/s (Slipstream), so a tight dodge sets up the
  counter-pass (DECISIONS #61). Dodging wide is safe; dodging close pays.
- **Recovers** after the charge: skids for 0.9 s, steaming, unable to turn. This is the opening. A
  charge into a wall or pillar rebounds it ~24 px off the surface into the same recovery (no extra
  stun, so parking by a pillar earns nothing). A charge into another Rammer puts both into recovery,
  with no damage.
- A charge hit knocks your bolted part loose (or costs **1 hull pip** if you have none), throws you
  along the lane and kills your momentum.
- At most two Rammers wind up at once, so a crowd stays readable.
- **HP 3, and an armored front** (DECISIONS #55, #70). Where a Slipstream hit lands decides what it does:
  within 60° of its front it **glances** off the plating for 1; on a side it does 2; in the back it
  **tears the booster off** (no damage), or, once the booster is gone, does 4, which wrecks it. So the
  decisive pass is the one after its charge, from behind; a side hit and one more also wreck it, and
  chipping at its front always works, slowly.
- **The joust:** a Slipstream Rip that meets a charge nose to nose (within 30° of head-on) stops it
  dead and stuns it for 1.3 s, back exposed, and you pass through unhurt (DECISIONS #56). A skill
  move with a window of a few frames.
- **Stripped:** once its booster is torn off it can't charge any more. It limps (35 px/s), turns
  slowly (2.5 rad/s, so a fast circle gets round its front) and does a short telegraphed shove
  (0.5 s windup, 70 px) when you're within 140 px. Weaker, never harmless (DECISIONS #59).

### 4.4 The part: the Booster

- **Tearing it off:** a **Slipstream-tier** rip that strikes the Rammer's **rear** (within 70° of
  straight behind it) tears the booster off. **The tearing hit does no damage**: all of it goes into
  the part, so tearing and wrecking are always two separate passes. **Wrecking a Rammer wrecks its
  booster.** The charge-and-recover rhythm is what gives you the window to get behind it, and while
  its back is open (locked, charging, skidding or stunned) the booster glints gold (DECISIONS #60).
  (While it recovers or is stunned, its facing snaps to its sprite's direction, so the rear you see
  is the rear the game uses.)
- **Wave 1 safety net:** the first Rammer can't be wrecked while it still has its booster (it stops
  at 1 HP), so every new player gets to see a tear-off. If you keep hitting its front instead, the
  second Slipstream hit at 1 HP shakes the booster loose onto the floor, so nobody is stuck in wave 1
  (DECISIONS #33, #55).
- **Grabbing it:** your claw keeps hold of what it tears off. The part is **towed behind you on a
  short cable** (a trailing point on a spring), swinging with your momentum.
- **Bolting it on:** tap *Bolt on*, and bolting takes 0.7 s (ratchet clicks, wrench sparks). It works
  while moving, but your steering is halved, and a Rip or a hit cancels it. So the smart move is to
  get clear first. The Scrapper has one mount for it (rear); bolting a second booster drops the
  first.
- **What it does: you inherit the Rammer's charge, weakness included.**
  - **The Rip becomes the Burn.** *Hold* the button to rev (a tap shorter than 0.15 s is still a
    plain Rip; DECISIONS #57): your steering locks to your current heading, your own lane is painted ahead of you (in teal, the speed color), and thrust climbs past
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

---

## 8. The short run (Milestone 3)

Written 2026-10-12 after M2. The owner said the slice "looks good" and to continue as planned, so
this is ROADMAP's M3 outline made concrete: a sequence of arenas in a 10-15 minute run, a handful of
parts across body slots, a second enemy type, no escalating timer. Every addition is held to the
removal test: each part changes a verb (how you turn, what your hit does, what your body does on
contact), and each comes off an enemy that visibly moves that way.

### 8.1 The run

- **Five yards**, each one screen (640 × 360) with its own layout and 2-3 waves, about 2 minutes
  each. Yard 1 is always **The Ring** (the slice's three Rammer waves, the tutorial). Yards 2-4 are
  chosen by you from the middle pool. Yard 5 is always **The Heap**, the mixed finale.
- **Choosing the next yard is driving.** When a yard is cleared, two exit gates open in its walls,
  each with a sign: the next yard's name and the icon of the part its enemies carry. Drive out
  through the one you want. No menu, no stopping (DECISIONS #64).
- **Between yards:** your hull is patched by 1 pip (max 5), and your bolted parts and the part on
  your cable come with you. Loose parts on the floor stay behind.
- **Escalation is composition, never a clock** (#22): the later you visit a middle yard, the more
  enemies its last wave sends (one more per depth past 2).
- **The end:** clearing The Heap, or being scrapped, shows the run's results: yards cleared, time,
  parts torn off, your final build, and the best run so far. *Again* starts a new run at once.

### 8.2 Three mounts

The Scrapper has three mounts, each tied to one verb, so parts compose instead of stacking numbers:

| Mount | Verb it changes | Parts |
|---|---|---|
| **Rear** | how you accelerate (and what holding Rip does) | Booster |
| **Sides** | how you turn and brake | Grip Treads |
| **Front** | what your hits and your body do on contact | Plow, Jaws |

Bolting a part puts it on its mount; a part already there drops to the floor (a swap). The HUD shows
the three slots. **A hit knocks off the part on the side it came from** (a hit from behind takes the
rear part, from a side the treads, from the front the front part); if that mount is empty, the next
part in the order sides, rear, front; only with nothing bolted on does the hull take it. A part
knocked loose is cracked, and a cracked part that takes another hit shatters (#58).

**Enemies wear their parts on the same mounts**, and a Slipstream hit on the zone where a part sits
tears it off: the back tears a rear part, a side the treads, the front a front part, except the
Plow, which only comes off in a joust (8.4).

### 8.3 The second enemy: the Snapper

A small, fast tread-bot that hunts in packs. The Rammer punishes straight lines and rewards a juke;
the Snapper punishes **stopping and braking**, and you beat it by out-turning it, looping behind it and
ripping its tracks. (Measured in M3, DECISIONS #79: its snap needs a clear line, so a pillar loop
doesn't trouble it, but parking or a brake-pivot near it gets bitten. The Grip Treads, a hairpin with
no stop, are the answer to it.)

- Small (the Scrapper's size, radius 8), **HP 2**, top speed **170** (under Slipstream: at
  Slipstream you outrun it; at Cruise it catches you), turns fast and faces where it's going.
- **Hunts** you on an intercept line. A camper looping a pillar gets cut off. Close in and unable to
  snap yet, it **circles** you ~72 px out, side on (DECISIONS #69).
- **Snap:** within 64 px and roughly facing you, it stops and winds up for 0.45 s (a short red lane,
  its own width, tracking for 0.25 s then locked), then lunges 80 px at 330 px/s. A bite is a hit.
  1.5-2.5 s between snaps.
- **Power-slide:** after a snap, or when you get behind it, it slides round on its treads to face
  you again (about 0.6 s), broadside.
- **Its treads come off from the side or the back** (they run the length of it). A Slipstream hit
  there tears its **Grip Treads** off, so the efficient kill strips it instead of wrecking it
  (DECISIONS #79). Its front glances (1). Once stripped, a side hit does 2 and the back 4, and
  either wrecks it.
- At most two Snappers wind up at once. A stripped Snapper limps (110 px/s), turns slowly and can't
  slide, but still snaps.
- **Jaw Snapper:** the same bot with **Jaws** on its front. Its bite latches on and flings you (a hit
  and a long throw). A Slipstream hit on its front tears the Jaws off.

### 8.4 The new parts

- **Grip Treads** (sides; from the Snapper). Turning ×1.35 at every speed, and you grip harder (turn
  scrub starts at ×1.4 the sideways pull); top speed ×0.92 (221). **The brake becomes a
  power-slide:** pushing hard against your motion at speed no longer stops you; you slide round to
  the new direction (about 0.35 s for a full reversal) and keep most of your speed (a 180° slide
  from top speed exits at Slipstream). The base body brakes, stops and pivots. So the treads' line is
  the **hairpin**: strike, slide round, strike again. Weakness, inherited: the low top speed leaves
  little margin above Slipstream.
- **Plow** (front; from the Plow Rammer, which wears it on its front with a booster on its back).
  **Contact becomes a hit:** at Slipstream, driving your front into an enemy (within 50° of your
  heading) is a hit as if you'd Ripped, and you plough on through; at Cruise it shoves and cancels a
  windup without bouncing you. A ram commits like a Rip: the same 0.45 s cooldown before the next
  ram or Rip. **A charge that hits your front is blocked:** the charger is stopped and stunned, and
  you're knocked back with nothing lost. Weakness, inherited: heavy, so the run-up is slower
  (acceleration above 60 px/s ×0.65: Slipstream takes about 1.2 s and 140 px, so the Plow's line is
  the long straight run-up). On a Plow Rammer the plow makes its front take no damage at all
  ("CLANG"), and it only comes off in a joust.
- **Jaws** (front; from the Jaw Snapper). **A hit latches and slings:** a Slipstream hit (Rip or
  Burn) bites on and whips you once all the way round the enemy in 0.2 s, then flings you back out
  the way you came, 40 px/s faster (DECISIONS #67). The damage lands as normal. Every hit reverses
  you at speed: pinball between enemies. A joust doesn't bite: you go on past to its open back.
  Weakness, inherited: the swing is locked; you can't steer out of it, and another enemy's charge or
  snap can catch you mid-swing.
- **Booster** (rear): as in 4.4.
- Flat mode: every bolted part adds +1 damage and changes nothing about how you move (#50).

### 8.5 The yards

| Yard | Layout | Salvage | Waves (at depth 2) |
|---|---|---|---|
| **The Ring** (always 1st) | 4 pillars | Booster | 1 Rammer (safety net); 2 Rammers; 3 Rammers |
| **The Kennel** | a forest of small pillars | Grip Treads | 2 Snappers; 3 Snappers; 1 Rammer + 3 Snappers |
| **Long Lanes** | two long low walls: three straight lanes | Booster | 2 Rammers; 2 Rammers + 1 Snapper; 3 Rammers + 1 Snapper |
| **The Plow Pit** | open bowl round one big pillar | Plow | 1 Plow Rammer; 1 Plow Rammer + 1 Rammer; 2 Plow Rammers + 1 Snapper |
| **Jaw Yard** | four corner blocks round an open cross | Jaws | 2 Jaw Snappers; 2 Jaw Snappers + 1 Rammer; 3 Jaw Snappers + 1 Snapper |
| **The Heap** (always 5th) | broken ring of scrap piles | everything | Rammer + 2 Snappers + Jaw Snapper; Plow Rammer + 2 Jaw Snappers + Rammer; 2 Rammers + Plow Rammer + 2 Snappers + Jaw Snapper |

Each yard's first visit shows one hint about its enemy ("HIT ITS SIDE WHILE IT SLIDES", "JOUST ITS
CHARGE TO TEAR THE PLOW OFF", ...), and each new part shows one hint about its verb when first
bolted on.

### 8.6 Not in M3 (on purpose)

A boss, more than two enemy types, currency, shops, meta-progression between runs, healing beyond
the yard patch, story, a map screen, key rebinding in the UI and the art overhaul (M4).

---

## 9. The expansion (Milestones 6-9)

Written 2026-10-12 after 0.2.0 went live. The owner: "looks good get started on next milestones so
we can make this game more expansive". So the game grows in four milestones, each held to the
removal test like everything before it:

| | What grows | Why it passes the removal test |
|---|---|---|
| **M6** | Two new enemies and two new parts, a second choice on the rear and side mounts, two new yards | Each part changes a verb (what holding Rip does, what a wall does to you), and each comes off an enemy that visibly moves that way |
| **M7** | Terrain: boost strips, oil slicks, jump ramps and crusher plates; three new yards | The floor changes how everything moves, so a yard's layout is a set of lines, not just obstacles |
| **M8** | A boss you dismantle, The Compactor, at the end of a six-yard run | Its parts are its moves: tear one off and that move is gone, and it's yours to bolt on mid-fight |
| **M9** | The Garage: two more chassis, unlocks, a log of what you've met | A chassis is a different movement model, not a stat bonus; unlocks add variety, never power |

The art for each milestone's new sprites is code-drawn first (at the final names and sizes) and
then drawn with the pixel-art-studio skill by background agents while the next milestone is built.
A public release (0.3.0) happens only when the owner says so.

**Still out, on purpose:** a scrolling camera (one screen is a pillar), currency and shops, stat
upgrades, healing beyond the yard patch, story.

### 9.1 M6: the Hopper and the Jump Jets

**The Hopper.** A squat scrap frog with jump jets on its back. The Rammer punishes straight lines and
the Snapper punishes stopping; the Hopper punishes **hiding**: it leaps over pillars and walls, so
cover doesn't save you, and it punishes **loitering where it will land**.

- Radius 10, **HP 3**, front armored (1), side 2, back 4 or the tear, like the Rammer.
- **Stalks** slowly (30 px/s), turning to face you (5 rad/s).
- **The leap:** when you're 70-220 px away, it crouches for 0.6 s. A **red ring** (radius 28) is
  painted on the floor where it will land: it tracks the point you'll be at (the Rammer's lead) for
  0.35 s, then locks for 0.25 s. Then it leaps: 0.55 s in the air, over everything (bodies, pillars,
  low walls; never out of the arena). While airborne it can't be hit and touches nothing. It lands
  with a **slam**: anyone inside the ring takes a hit, loose parts there are crushed, and other
  enemies are shoved out.
- **Stuck:** after landing it's stuck for 1.0 s, legs buried, steaming: the opening. Its back glints.
- **Too close** (under 70 px): it stomps where it stands instead (0.45 s crouch, a ring of 30 round
  itself, locked at once, a little hop and a slam). Lingering by it is punished.
- At most two Hoppers crouch at once. A Cruise hit cancels a crouch, like any windup.
- **Its Jump Jets come off from behind** (a Slipstream hit in its back, best while it's stuck).
  Stripped, it can't leap: it waddles (25 px/s) and only stomps.

**The Jump Jets** (rear; from the Hopper). They replace what holding Rip does, so they and the
Booster are the rear mount's two choices.

- A tap is still a plain Rip. **Hold Rip to crouch:** you keep your speed (no thrust, no coasting)
  and steer at half rate, and a **teal ring** shows where you'll land: ahead of you, your speed ×
  the air time.
- **Let go to leap:** 0.4 s in the air along your heading (at least 120 px/s, so a standing leap
  still clears a lane). In the air you can't steer, and nothing can touch you: charges, snaps, bites
  and slams pass under you, and you sail over pillars and low walls (never the ring wall).
- **The landing is a hit:** every enemy within 24 px of where you land takes a hit at your tier (the
  tier you leapt at), on the zone you land on. Land behind a Rammer and you tear its booster off.
- **Inherited weakness:** the landing sticks you, like the Hopper. For 0.25 s you have no control and
  lose 15% of your speed, and you can't leap again for 0.5 s after landing.
- The line it gives you: over the top. The Booster goes *through* a lane, the jets go *over* it.

### 9.2 M6: the Bouncer and the Springs

**The Bouncer.** A round pinball of a bot in a ring of coil springs. It punishes **standing in a
lane you can't see the end of**: its rolls bounce off walls and pillars and come back faster.

- Radius 9, **HP 2**. It faces the way it rolls; front 1 (glances), side 2, back 4.
- **Drifts** toward you slowly (40 px/s) between rolls.
- **The roll:** within 260 px and in sight, it winds up for 0.6 s: a red lane to the first wall or
  pillar, **plus the first bounce's stub** (60 px), tracking for 0.35 s, locked for 0.25 s. Then it
  rolls at 230 px/s. Each wall or pillar it hits **reflects** it and adds 30 px/s (up to 330). After
  3 bounces or 2.4 s it slows to a stop and is **dizzy** for 0.9 s: the opening.
- A rolling Bouncer is a lunge: touching it is a hit, a joust stops it, a Plow blocks it, it crushes
  loose parts. At most two wind up at once.
- **Its Springs come off from the side** (or the back): cut across its roll at Slipstream, or hit it
  while it's dizzy. Stripped, its first wall stops it dead, stunned for 1.0 s.
- Bouncing off another enemy puts both into recovery, like a charge.

**The Springs** (sides; from the Bouncer). They change what walls do to you, so they and the Grip
Treads are the side mount's two choices.

- A **head-on hit on a wall or pillar bounces you off** instead of clanking: you keep all your speed
  plus 25 px/s (up to 330). A Rip or a Burn that hits a wall bounces and **keeps going** on the new
  line; the Booster's wall stun is gone (the springs take it).
- Bumping an enemy outside a Rip bounces you off at full speed (instead of losing 60%), but it still
  starts its quick windup.
- **Inherited weakness:** springy, not grippy. Turning ×0.85 at speed and turn scrub starts at ×0.8
  the sideways pull: you corner badly, and the walls are how you turn.
- The line it gives you: the bank shot. The treads turn round anywhere; the springs need a wall.

**Spring Rammer** (a variant): a Rammer with Springs on its sides. Its charge bounces off the first
wall or pillar and carries on for the rest of its length. Its springs tear from the side.

### 9.3 M6: the yards

| Yard | Layout | Salvage | Waves (at depth 2) |
|---|---|---|---|
| **The Hurdles** | rows of short low walls (hurdles) | Jump Jets | 2 Hoppers; 2 Hoppers + 1 Snapper; 3 Hoppers + 1 Rammer |
| **The Pinball** | a diamond of pillars and posts (bumpers) | Springs | 2 Bouncers; 3 Bouncers; 2 Bouncers + Spring Rammer + 1 Snapper |

The middle pool is now six yards; a run still visits three of them, two choices at each exit. The
Heap gains a Hopper in its first wave and a Bouncer and a Spring Rammer in its last, and its sign
says "ALL SIX PARTS". Each new enemy and part gets one hint.

### 9.4 M7: terrain (outline; detailed when M7 starts)

Floor features that change how **every** body moves, drawn on the floor under everything:
- **Boost strips** (teal chevrons): driving over one roughly along its arrow lifts you to Slipstream
  (and a Snapper or Bouncer too). Yards get fast lines you can plan round.
- **Oil slicks:** no grip. On oil you can't steer, thrust or brake; you keep your line. A charging
  Rammer that hits oil slides further; a Snapper on oil can't turn.
- **Jump ramps:** drive over one at Cruise or faster and you're airborne for a moment (the Jump
  Jets' air, without the slam).
- **Crusher plates** (danger red): every few seconds a plate flashes, then slams. Whatever is on it
  takes a hit, enemies included: bait a charge onto one.
- Three new yards built round them (for example *The Slick*, *The Ramps*, *The Press*), and the
  middle pool grows to nine.

### 9.5 M8: The Compactor and a six-yard run (outline)

- **The Compactor:** a boss 64 px across that wears a Plow (front), Springs (sides) and a Booster
  (rear). Each part is one of its moves: the Booster gives it a huge charge, the Springs make the
  charge ricochet, the Plow makes its front take nothing and block. Tear a part off and that move is
  gone, and the part is yours to bolt on mid-fight. Once all three are off its core opens and it
  stomps like a Hopper; three hits to its back finish it.
- It calls in a Snapper or two through the gates every so often, so you're never without spares.
- The run becomes six yards: The Ring, three middle yards, The Heap, then The Compactor's yard.

### 9.6 M9: The Garage (outline)

- **Two more chassis**, each its own movement model (the removal test: different lines, not bigger
  numbers): the **Skiff** (light: faster, turns tighter, 3 hull, parts weigh it down more) and the
  **Hauler** (heavy: slower to build speed, 7 hull, bumps shove enemies like a Cruise hit).
- **Unlocks** by playing (clear a run, tear 25 parts off, joust 10 charges...): chassis and run
  modifiers. Never stat upgrades.
- **The Log:** every enemy and part you've met, with its line.
- **Daily run:** one seed a day, the same for everyone.
