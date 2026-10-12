# Progress

What's built. Newest first.

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
| M3 — A short run | in progress |
