# Progress

What's built. Newest first.

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
  - 48 unit tests, including the removal-test guards: the turret deals 0 damage and loses; the
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
| M2+ | waiting for the owner's playtest |
