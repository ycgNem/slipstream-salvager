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
- **The leap:** when you're 44-220 px away, it crouches for 0.6 s. A **red ring** (radius 28) is
  painted on the floor where it will land: it tracks the point you'll be at, leading you fully (a
  steady line is always under it; only a juke clears it) for 0.35 s, then locks for 0.25 s. Then it leaps: 0.55 s in the air, over everything (bodies, pillars,
  low walls; never out of the arena). While airborne it can't be hit and touches nothing. It lands
  with a **slam**: anyone inside the ring takes a hit, loose parts there are crushed, and other
  enemies are shoved out.
- **The shockwave:** a slam that only just misses you (within 12 px of the hit) lifts you to
  Slipstream, like a charge's slipstream. Dodging close pays (DECISIONS #83, #92).
- **Stuck:** after landing it's stuck for 1.3 s, legs buried, steaming: the opening. Its back glints.
  It waits 1.6-2.6 s before the next leap.
- **Too close** (under 44 px), or bumped: it stomps where it stands instead (0.45 s crouch, a ring
  of 34 round itself, locked at once, a little hop and a slam). Lingering by it is punished.
- At most two Hoppers crouch at once. A Cruise hit cancels a crouch, like any windup.
- **Its Jump Jets come off from behind** (a Slipstream hit in its back, best while it's stuck).
  Stripped, it can't leap: it waddles (25 px/s) and only stomps.

**The Jump Jets** (rear; from the Hopper). They replace what holding Rip does, so they and the
Booster are the rear mount's two choices.

- A tap is still a plain Rip. **Hold Rip to crouch:** you keep your speed (no thrust, no coasting)
  and steer at half rate, and a **teal ring** shows where you'll land: ahead of you, your speed ×
  the air time.
- **Let go to leap:** 0.4 s in the air along your heading (at least 40 px/s: a standing hop is
  small, and lands at the tier you really had). In the air you can't steer, and nothing can touch you: charges, snaps, bites
  and slams pass under you, and you sail over pillars and low walls (never the ring wall).
- **The landing is a hit:** every enemy within 24 px of where you land takes a hit at your tier (the
  tier you leapt at), on the zone **you came at it from**: come down on a Rammer from behind and
  you tear its booster off; go over its front and you strike the front. The Jaws don't bite on a
  landing. Coming down on a pillar or low wall puts you at its edge along your line.
- **Inherited weakness:** the landing sticks you, like the Hopper. For 0.25 s you have no control and
  lose 15% of your speed, and you can't leap again for 0.5 s after landing.
- The line it gives you: over the top. The Booster goes *through* a lane, the jets go *over* it.

### 9.2 M6: the Bouncer and the Springs

**The Bouncer.** A round pinball of a bot in a ring of coil springs. It punishes **standing in a
lane you can't see the end of**: its rolls bounce off walls and pillars and come back faster.

- Radius 9, **HP 2**. It faces the way it rolls; its round chrome front takes nothing (a clang)
  unless you joust its roll; side 2, back 4.
- **Drifts** to about 140 px from you (40 px/s) between rolls, backing off if you come closer, and
  comes round a pillar to see you. It won't start a roll with another enemy in the way.
- **The roll:** within 260 px and in sight, it winds up for 0.6 s: a red lane to the first wall or
  pillar, **plus the first bounce's stub** (60 px), tracking for 0.35 s, locked for 0.25 s. Then it
  rolls at 230 px/s. Each wall or pillar it hits **reflects** it and adds 30 px/s (up to 330). After
  3 bounces or 2.4 s it slows to a stop and is **dizzy** for 0.9 s: the opening.
- A rolling Bouncer is a lunge: touching it is a hit, a joust stops it, a Plow blocks it, it crushes
  loose parts. At most two wind up at once.
- **Its Springs come off from the side** (or the back): cut across its roll at Slipstream, or hit it
  while it's dizzy. Stripped, its first wall stops it dead, stunned for 0.8 s.
- Bouncing off another enemy puts both into recovery, like a charge.

**The Springs** (sides; from the Bouncer). They change what walls do to you, so they and the Grip
Treads are the side mount's two choices.

- A **head-on hit on a wall or pillar bounces you off** instead of clanking: you keep 90% of your
  speed. A Rip or a Burn that hits a wall bounces and **keeps going** on the new line; the Booster's
  wall stun is gone (the springs take it). Revving, the bounce launches the Burn along the new line:
  the bank shot.
- Bumping an enemy outside a Rip bounces you off at 90% (instead of losing 60%), but it still
  starts its quick windup.
- **Inherited weakness:** springy, not grippy. Turning ×0.85 at speed and turn scrub starts at ×0.8
  the sideways pull: you corner badly, and the walls are how you turn.
- The line it gives you: the bank shot. The treads turn round anywhere; the springs need a wall.

**Spring Rammer** (a variant): a Rammer with Springs on its sides. Its charge bounces off the first
wall or pillar and carries on for the rest of its length. Its springs tear from the side.

### 9.3 M6: the yards

| Yard | Layout | Salvage | Waves (at depth 2) |
|---|---|---|---|
| **The Hurdles** | two long low walls split the yard into three lanes, with narrow gaps at their ends and middle: going round costs distance, leaping is the shortcut | Jump Jets | 2 Hoppers; 2 Hoppers + 1 Snapper; 3 Hoppers + 1 Rammer |
| **The Pinball** | four low walls facing each other across the yard round a pillar bumper, posts in the corners: a straight line goes back and forth | Springs | 2 Bouncers; 3 Bouncers; 2 Bouncers + Spring Rammer + 1 Snapper |

The middle pool is now six yards; a run still visits three of them, two choices at each exit. The
Heap (two waves since DECISIONS #97) gains a Hopper in its first wave and a Bouncer and a Spring Rammer in its last, and its sign
says "ALL SIX PARTS". Each new enemy and part gets one hint.

### 9.4 M7: terrain

Floor features that change how bodies move, painted on the floor under everything, on the 16 px
grid. Each one is a line you can plan round, so a yard is a set of lines, not just obstacles. All
of it is data (`floor` on an arena) and the same for you and the enemies where it says so.

- **Boost strips** (teal chevrons, 16 px wide, pointing one of four ways). Driving over one within
  60° of its arrow lifts you to at least **250 px/s** (past your top speed, so it falls back after)
  for as long as you're on it. It works for a Snapper (to 220) and a rolling Bouncer (+40) too.
  Teal, because it's speed.
- **Oil slicks** (black, glossy). With your middle on oil you have **no grip**: you can't steer,
  thrust or brake, and you keep your line (drag almost nothing). A Rip still lunges, the Booster's
  rev still pushes (it's a rocket), and the Jump Jets still leap. A Snapper or a stalking Rammer on
  oil can't turn; a Rammer's skid on oil slides twice as far.
- **Jump ramps** (32 × 32, an arrow). Drive over one at Cruise or faster within 45° of its arrow and
  you're **airborne for 0.35 s**: over bodies, attacks, pillars and low walls, like the Jump Jets'
  leap, but the landing is clean (no hit, no recoil). With the Jump Jets bolted on, a ramp launch
  lands with their hit.
- **Crusher plates** (32 × 32). Every 3 s a plate warns for 0.8 s (flashing danger red), then slams:
  whatever stands on it **below Cruise** takes a hit (at speed you're over it before it lands;
  DECISIONS #97). You lose a part or a hull pip; **an enemy takes 2 damage** (a Snapper or Bouncer
  is wrecked, a Rammer or Hopper left at 1); a lunging enemy is over it too. Airborne bodies are
  safe. Make them stop on one: a windup, a skid, a stuck landing. Each plate has its own phase,
  shown by its warning.

New yards (the middle pool becomes nine):

| Yard | Layout | Salvage | Waves (at depth 2) |
|---|---|---|---|
| **The Slick** | an oil lake in the middle, boost strips round it like a racetrack | Grip Treads, Booster | 2 Snappers; 2 Snappers + 1 Rammer; 3 Snappers + 1 Rammer |
| **The Jumps** | three low walls across the yard with a ramp in front of each, both ways | Booster, Jump Jets | 2 Rammers; 1 Rammer + 1 Hopper; 2 Rammers + 2 Hoppers |
| **The Press** | a grid of six crusher plates, posts at the corners | Plow, Booster | 1 Plow Rammer + 1 Rammer; 2 Rammers + 1 Snapper; 2 Plow Rammers + 2 Snappers |

### 9.5 M8: The Compactor and a six-yard run

**The Compactor** is the run's last yard: a boss you take apart. It's a crusher truck 64 px across
(radius 20, **HP 18**) that wears three parts, and **each part is one of its moves**:

| Part (mount) | Its move | How it comes off | Without it |
|---|---|---|---|
| **Booster** (rear) | a huge charge: a 1.0 s windup (tracks 0.6 s, locks 0.4 s), a 40 px lane, 300 px/s, running 140 px past you (260-460) | a Slipstream hit in its back (best while it skids) | it can't charge; it shoves (0.6 s windup, 90 px) |
| **Springs** (sides) | its charge **bounces** off walls and pillars, twice, and carries on | a Slipstream hit on its side (or its back once the booster's gone) | a charge into a wall stops it dead, **stunned 1.8 s** |
| **Plow** (front) | its front takes nothing ("CLANG") | **only a joust**: a Slipstream Rip into its charging (or shoving) front | its front glances for 1 |

- Like every enemy, a hit on a zone with a part tears the part (no damage) and your claw keeps it:
  **you can bolt the boss's own parts on mid-fight.** A zone whose part is gone takes damage as
  usual: front 1, side 2, back 4.
- It's slow (40 px/s) and turns slowly (3 rad/s), so a fast circle gets behind it, but its charge
  reads your line like the Rammer's. After a charge it skids for 1.2 s, back open.
- **Core open:** with all three parts off it can only **leap like a Hopper**: a 0.8 s crouch with a
  ring of 44 that tracks you then locks, 0.7 s in the air, a slam, stuck 1.6 s. The shockwave rule
  holds (a near miss lifts you to Slipstream).
- **It calls for help:** every 16 s, if fewer than two others are in the yard, a Snapper comes in
  through the farthest gate. More spares, and more trouble.
- The yard: **The Compactor**, an open floor round two pillars set off the gates' line (to bounce
  off and to hide behind), with two crusher plates along each long wall, where a charge into the
  wall leaves it stunned. The plates hit it too.
- **It can't be wrecked while it wears a part** (the safety net), so every fight ends in the
  core-open act; each tear names the move it took, and core open and stuck after a landing, every
  side of it counts as its back. Wrecking it takes the Snappers it called down with it
  (DECISIONS #97).
- A boss bar on the top wall band, left of the north gate: its name and a pip per hull point.
- It ploughs through other enemies: a charge that meets one makes *it* recoil, not the boss.

**The run becomes six yards:** The Ring, three middle yards (from nine), The Heap, The Compactor.
The Heap has one exit, to the Compactor. Clearing it wins the run.

### 9.6 M9: The Garage

**Two more chassis.** Each is its own movement model, so each draws different lines (the removal
test: a chassis that only changed numbers would fail it). The speed tiers stay the same marks for
every body (Crawl < 110, Cruise < 190, Slipstream), so what each chassis changes is how you get to
Slipstream and how you keep it.

| | **Scrapper** (the default) | **Skiff** (light) | **Hauler** (heavy) |
|---|---|---|---|
| Hull | 5 | 3 | 7 |
| Top speed | 240 | 270 | 230 |
| Acceleration above 60 px/s | 180 | 220 | 160 |
| Turn rate (rest -> top) | 14 -> 4 | 10 -> 3.4 | 12 -> 4.4 |
| Turn scrub starts at | 900 px/s^2 | 1300 | 800 |
| Coast half-life | 0.3 s | 0.9 s | 0.25 s |
| Brake | 900 px/s^2 | 300 | 1200 |
| Bumping an enemy | you bounce off, losing 60% | you bounce off, losing 60%, thrown 40% further by hits | **a shove**: like a Cruise hit (it's pushed 24 px and its windup is cancelled), you keep 85% |
| Parts | | **each bolted part costs 6% top speed** | |

- **The Skiff glides.** It holds Slipstream through a full-lock turn (270 x 3.4 is under its scrub
  line) and coasts nearly a second, but it turns wide, can hardly brake, and three hits scrap it.
  Its line is the big sweeping arc, and it wants few parts.
- **The Hauler bullies.** It's slower to Slipstream and its Slipstream band is narrower (230
  against 190), so a hard turn drops it out. But it walks into enemies: a bump is a shove that cancels a
  windup at any speed, and it has seven hull. Its line is in close, interrupting, then a run-up.
- Each has its own body sprite (`pl:<chassis>:...`, the Scrapper's sizes and mounts) and carries
  the same parts on the same mounts.

**The Garage** is where a run starts: PLAY on the title opens it.
- Pick a chassis (a card each: the body, its name, its line in a sentence; a locked one shows how
  to unlock it) and any unlocked **run modifiers**, then START.
- **Unlocks**, by playing, never stat upgrades:
  - The Skiff: tear 20 parts off (over all your runs).
  - The Hauler: joust 10 charges.
  - **Bare Bones** (modifier): your parts don't carry between yards; every yard starts bare, so
    every yard's salvage is the build. Unlock: clear The Heap.
  - **No Breather** (modifier): the next wave comes in as soon as one is cleared. Unlock: win a
    run.
- What's unlocked and the lifetime counts persist (localStorage, like the bests).

**The Log** (title -> LOG): every enemy and every part, a card each with its sprite, its name and
its line ("A ROLL THAT BOUNCES OFF WALLS - CUT ACROSS IT"), and your counts (met, torn off,
wrecked). One you haven't met is a dark silhouette and "???".

**The daily run** (title -> DAILY): one seed a day from the date, the same for everyone, always the
Scrapper with no modifiers. The title shows today's best (yards, time). Played again, it's the same
yards, choices and waves.
