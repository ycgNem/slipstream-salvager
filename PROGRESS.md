# Progress

What's built. Newest first.

## 2026-10-12 — 0.3.0 published

`main` fast-forwarded to `works` and pushed; the Pages workflow tested, built and deployed it
(DECISIONS #100). The site is https://ycgnem.github.io/slipstream-salvager/.

## 2026-10-12 — M8c, M9: The Garage, and both milestones verified

- **M9, The Garage** (#93-#95): two more chassis, the Skiff (glides, never slows in a turn, 3 hull)
  and the Hauler (bumps stop windups, 7 hull); the Garage screen with unlocks (each chassis by its
  own verb) and two run modifiers (Bare Bones, No Breather); the Log; the daily run.
- **The art** for The Compactor, its parts at 2x, and the M7 terrain (boost strips, oil, ramps,
  crusher plates) is imported; the Hauler wears wide side parts (`part:bigtreads`).
- **Reviews acted on:** the M7-M8 visual QA and critic (#96-#97: the boss can't be skipped apart,
  crusher plates pass the removal test, a shorter run) and the M9 ones (#98-#99: the Hauler's bump
  no longer makes camping the best strategy, the Skiff's parts cost it glide, unlock gates, No
  Breather made real, four bugs, focus and the Log's scales).
- **Checks:** 171 tests, typecheck, the smoke test, the screenshot sweep with 0 overlaps, coverage
  773 names (0 missing), the strategy-bot guards at their baselines. The search bot clears every
  yard with every chassis (12 yards: Skiff 574 s, Scrapper 622 s, Hauler ~680 s).

## 2026-10-12 — M6-M8: the expansion (new salvage, terrain, The Compactor)

The owner asked to "make this game more expansive" (DECISIONS #82). Published in 0.3.0:
- **M6, new salvage** (#83-#86, #89): the Hopper (leaps with a ring telegraph, slams, stuck) and
  the Jump Jets (hold to crouch, let go to leap; the landing is a hit); the Bouncer (rolls that
  bounce off walls) and the Springs (you bounce off walls instead of clanking); the Spring Rammer;
  The Hurdles and The Pinball. The pixel art for all of it is imported.
- **M7, terrain** (#87-#88): boost strips, oil, jump ramps, crusher plates; The Slick, The Jumps,
  The Press. Nine middle yards.
- **M8, The Compactor** (#90): a boss you take apart, each worn part one of its moves; core open it
  leaps like a Hopper; it calls Snappers in. The run is six yards: The Heap leads to it.
- **The critic's M6 review, fixed** (#91-#92): the rev limit, leaps striking the zone you came
  from and leading you fully, Bouncers keeping their distance, new Hurdles and Pinball layouts,
  and more. Guard tests for each.
- **Checks:** 148 tests, typecheck, the smoke test, 44 screenshots with 0 overlaps, coverage 685
  names (0 missing), the strategy-bot guards. The search bot clears every yard on every seed
  (35-85 s; the boss 35-38 s).

## 2026-10-12 — M5: 0.2.0 published

- **Live:** the owner said to push live. `main` was fast-forwarded to `works` and both were
  pushed, and the Pages workflow deployed 0.2.0 to https://ycgnem.github.io/slipstream-salvager/
  (DECISIONS #81).
- **The final visual QA pass is fixed** (DECISIONS #80):
  - Exit signs are tested clear of every wall in every yard.
  - The side gates sit on the wall grid.
  - The tier is right when you enter a yard.
  - The treads show on the diagonals.
- **Checks:** 86 tests.
- **Windows:** the installer and portable `.exe` for 0.2.0 are built in `release/`, not uploaded.

## 2026-10-12 — M3 reviews fixed, M4 art, 0.2.0 built

- **The critic's review of the run** (DECISIONS #79). Every fix was re-checked with its scripts.
  - Rammers no longer stall at corners: 0 stalls in every layout, against 54-60% of placements in
    Long Lanes and Jaw Yard before.
  - Snappers' treads tear from the back too, so the Snapper yards hand out parts: the Kennel gives
    8-9 tears per clear instead of 0-4.
  - Charges run 120 px past you (220-340 px), so the counter-pass works from any distance: 210 of
    210 chases tear.
  - No loose part lands out of reach.
  - The Jaws don't bite on a joust and can be hit mid-swing.
  - The Plow has a slower run-up and a ram cooldown.
  - Long Lanes has a middle gap.
  - Exit signs show the part names and the size of the last wave.
- **Pacing:** the critic's search bot is now `scripts/pacing/`. It clears each yard in 40-50 s with
  almost no hits, so a person should take about 2-3 min a yard.
- **Visual QA's 12 findings fixed** (DECISIONS #78):
  - exit signs on the floor, under bodies;
  - floating texts stack and stay off the HUD;
  - crackle by max HP;
  - the wipe card;
  - visible cracks and glints;
  - the near track over the body;
  - the claw ring past a front part;
  - scenes don't write your best record.
- **M4, the art overhaul** (DECISIONS #76-#77). Two art agents drew with the pixel-art-studio skill.
  - **Environment:** the floor, walls, scrap skips (pillar, post, tower), gates, dust, steam,
    smoke and sparks.
  - **Robots and parts:** the Snapper (every state and direction), the treads, plow and jaws, and
    a matching set of four part icons.
  - 147 of 365 sprites are imported. The Scrapper, Rammer, booster, plume and slash stay
    code-drawn: they come from the same sculptor and a redraw didn't clearly beat them.
  - The bottom wall row now sits on its collision.
- **0.2.0:** the version shows on the title screen, the service worker cache is v2, and the patch
  notes are in `CHANGELOG.md`.
  - The web build is 182 KB.

## 2026-10-12 — M3: a short run

PLAN.md section 8, built in phases 3a-3d (DECISIONS #64-#75).

- **The run:** five yards.
  - The Ring first, The Heap last.
  - In between, three of four middle yards, each a new layout: The Kennel (posts), Long Lanes (two
    long walls), The Plow Pit (a central tower) and Jaw Yard (four blocks).
  - You choose the next yard by driving out through one of two exit gates. The sign under each gate
    shows that yard's salvage.
  - Hull, bolted parts and the towed part carry over, and you get +1 hull after each yard.
  - A wipe plays between yards, and you drive into the next one through the opposite gate, still
    moving.
  - Later yards add enemies to the last wave.
  - Run results show yards cleared, time, tears, wrecks, jousts, top speed and your build. The title
    screen shows your best run.
- **Three mounts** on the player and on enemies (rear, sides, front). Enemies are data: a kind plus
  parts on mounts.
- **One tear rule for every part:** a teal hit on the side of an enemy where a part sits tears that
  part off. A Plow comes off only in a joust.
- **Four parts:**
  - **Booster:** speed and the Burn.
  - **Grip Treads:** grip, and a power-slide when you pull back at speed.
  - **Plow:** ram at teal; it blocks a charge that meets your front.
  - **Jaws:** bite on at teal, whip round and fling back out 40 px/s faster.
- **The Snapper:** a small, fast hunter.
  - It snaps short after a 0.45 s windup with its own lane.
  - It slides after a snap, which opens its sides.
  - Between snaps it circles you.
  - It has a Plow Rammer and a Jaw Snapper variant.
- **The HUD** shows three part slots. New hints cover each part, each enemy variant and the exits.
- **Rammers** have 3 HP. The slipstream catches at 24 px.
- **Placeholder art:** every new sprite is code-drawn (Snapper, three parts, posts, tower).
- **Tests:** the drafter bot, M3 unit tests, and a run test (bots play every yard on many seeds
  without breaking the sim). 81 tests.

## 2026-10-12 — M2: tune the loop (the critic's open points, as defaults)

The owner said "looks good, continue as planned" with no notes, so M2 took the critic's open points
(DECISIONS #55-#63). Each is a tuning-panel number; the M1 rule is one setting away.

- **Hit zones:** a Rammer's front is armored (a Slipstream hit there glances for 1), a side takes 2,
  the back tears the booster or, once it's off, takes 4 and wrecks it. The decisive pass is from
  behind, after the charge.
- **The joust:** a Slipstream Rip nose to nose into a charge stops it and stuns it 1.3 s ("JOUST!").
- **The slipstream:** a charge that just misses you lifts you to 220 px/s ("SLIPSTREAM!"), so a close
  dodge sets up the counter-pass.
- **Parts are knocked loose, cracked,** instead of shattering; a second hit shatters a cracked part,
  and a charge crushes loose parts it runs over.
- **A tap with the Booster is a plain Rip;** holding past 0.15 s revs the Burn.
- **Stripped Rammers** turn slowly and shove from 140 px; the booster **glints gold** while a
  Rammer's back is open.
- Bots: hit-and-run aims behind, chases the tail of a charge and regrabs loose parts. 61 tests.

## 2026-10-12 — Published for the playtest

- GitHub repo https://github.com/ycgNem/slipstream-salvager (public) with Pages deploying from `main`. Playable at
  https://ycgnem.github.io/slipstream-salvager/ (DECISIONS #54).

## 2026-10-12 — M1d: the critic's review, bugs and pillar breaks fixed

- **Softlock fixed:** a Rammer could shove you through the wall and the wave never ended. The walls
  now only push inward (DECISIONS #52).
- **Turning costs speed, as PLAN said it would:** an enemy orbit sits at Cruise, and a full-lock U-turn
  drops you out of Slipstream. A pillar loop or a 45° swerve keeps it (#47). Bots spend 20-25% of
  fight time at Slipstream instead of nearly all of it.
- **The Rammer's aim catches a steady line or a steady loop** (true intercept at 80%, reading your
  curve), and a juke clears it (#48, #49). The pillar camper dropped from 21-23 clears in 40 runs to
  7-11. Hit-and-run clears 14-25 of 40.
- **Flat mode removes both halves of the removal test:** the Booster becomes a plain +1 damage part
  there, with no movement change (#50). The turret, brawler and matador deal nothing in normal play
  but do damage in flat mode.
- **Hints and feedback:** the tear hint says when the back shows, a Burn hint appears after bolting,
  capped wave 1 hits read as "no damage", and damaged Rammers crackle (#51).
- **Dev and tests:** START WITH THE BOOSTER in the tuning panel. The hit-and-run bot was rewritten
  for the new movement, and there are new guards: no one leaves the arena over 40 full-slice seeds,
  the camper loses, and the Booster widens the tightest Slipstream circle (#53). 53 tests.

## 2026-10-12 — Milestone 1: the first playable slice (stopped for the owner's playtest)

- **The sim** (`src/sim/`, pure, deterministic, 60 Hz):
  - Movement: two-stage acceleration (Slipstream in ~0.8 s / ~90 px), a turn rate that falls with
    speed, turn scrub, 0.3 s coast, brake-skid-pivot with hysteresis, overspeed decay, glancing wall
    slides vs head-on clanks.
  - Three absolute speed tiers. Crawl clanks, Cruise shoves and cancels a windup, and only
    Slipstream damages or tears.
  - The Rip: a 0.16 s committed lunge, tier locked at the press, 12° aim assist, pass-through,
    hit-stop, a 0.12 s input buffer.
  - The Rammer: a fast-turning stalker that walks round pillars, with near and far windups, lead aim,
    a full-width telegraph lane that locks, a charge, a skid, rebounds off walls and pillars, and
    Rammer-on-Rammer recovery. At most two wind up at once. A bump starts its quick windup, and once
    stripped it only shoves.
  - Salvage: tear-off only on Slipstream rear hits (no damage), wrecking destroys parts, the wave 1
    safety net with its shake-loose way out, the towed part on a spring cable, pickups, tap-to-bolt
    (0.7 s while moving), swap, and parts as armor (a hit shatters the part before the hull).
  - The Booster: top speed 270, turning ×0.65, and the Burn (hold to rev in a locked line with your
    own lane, release to pierce, rev into a wall and you're stunned).
  - Waves: 3 waves (1, 2, 3 Rammers) with banners, gate warnings, a breather, and results.
  - Flat mode, the removal test as an A/B.
- **Presentation:**
  - Code-drawn placeholder art at the final names and sizes (the art agent's
    `src/render/art/code/`).
  - The renderer: cached floor, gates, skid marks, telegraph lanes, shadows, y-sorted bodies with
    mounted parts, the cable, the claw's tier glow and heading tick, dithered afterimages, wind
    lines, dust, sparks, a gold tear burst, floating text, hit flashes, shake and the wave banner.
  - The HUD (hull, wave, part slot, bolt progress, speed gauge with both marks) and three one-time
    hints in the world.
  - Pause, results with a best clear, and settings (volumes, music, shake, hints).
  - The dev tuning panel with live editing, flat mode and Copy.
  - Procedural SFX for every event, an engine hum that follows speed and whines while revving, a
    small jsfxr bank, and one music loop ("Scrap Ring").
- **Checks:**
  - 48 unit tests at first (53 after the critic pass), including the removal-test guards: the turret deals 0 damage and loses; the
    brawler and the matador do worse than hit-and-run; hit-and-run clears wave 1 on ≥ 6/8 seeds with
    ≤ 1 hit on average; the route flip holds.
  - The smoke test passes with zero console errors, and the screenshot sweep has 18 scenes with zero
    overlap issues.
  - The bots script (`scripts/bots.ts`).

## 2026-10-12 — Milestone 0: engine and scaffolding

- Project at `Documents\slipstream-salvager`, git branches `works` and `main`.
- Copied from Sprocket & Sprout and trimmed: the loop, RNG, the sfxr wrapper, the music player and
  its notation, the atlas, pixel helpers, the font, the overlap audit, the art scripts, the Electron
  wrapper, the Pages workflow, the service worker and the `.bat` files.
- New: input with gamepad, the palette names, the 640×360 whole-number scaler, the UI kit with
  key/pad navigation, `e2e/serve.mjs` (each e2e script starts its own server), the smoke test, the
  screenshot sweep, sprite coverage, the code-drawn icons, and the `qa-screens` and `indie-critic`
  agents.
- `npm run build` gives ~130 KB. `npm run dist:win` produced the installer and portable exe.

## 2026-10-12 — Planning

- PLAN, STYLE, ROADMAP, DECISIONS, PROGRESS and HANDOFF were written, and a design review
  revised the slice before any code (DECISIONS #27).

## Milestones

| Milestone | Status |
|---|---|
| M0 — Engine and scaffolding | done |
| M1a — Movement and speed feedback | done |
| M1b — The Rip and the Rammer | done |
| M1c — Salvage and the Booster | done |
| M1d — Verify, hand over for playtest | done |
| M2 — Tune the loop | done (critic's points as defaults) |
| M3 — A short run | done (5 yards, 4 parts, the Snapper) |
| M4 — Art overhaul | done (147 imported; robots kept from the sculptor) |
| M5 — First public build | done (0.2.0 live on GitHub Pages) |
