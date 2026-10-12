# Handoff

Read this first, every session.

## Where things stand (2026-10-12)

- **M0-M5 are done: 0.2.0 is live.** The owner said M1 "looks good, continue as planned", and
  then to commit and push 0.2.0 live. So:
  - M2 took the critic's open points as defaults.
  - M3 built the short run from PLAN.md section 8, and both reviewers' findings are fixed.
  - M4 replaced the arena, the Snapper and the new parts with pixel-art-studio art.
  - M5 published 0.2.0 to https://ycgnem.github.io/slipstream-salvager/ (2026-10-12). The patch
    notes are in `CHANGELOG.md`.
  - Every call is in DECISIONS.md: #55-#63 are M2, #64-#75 M3, #76-#77 M4, #78-#80 the review
    fixes, #81 the release.
- **`main` and `works` are pushed and identical.** The Windows 0.2.0 installer and portable `.exe`
  are built in `release/` (not uploaded anywhere yet; see Releasing).
- Repo: https://github.com/ycgNem/slipstream-salvager (public; DECISIONS #54). Day-to-day work is on
  `works`.

## How to play the current build (for the owner)

1. Play it at **https://ycgnem.github.io/slipstream-salvager/** (add `?debug` for the tuning panel),
   or double-click **`Play.bat`** to run it locally at `http://localhost:5173` (keep the black window
   open while you play). The tuning panel is always on locally: press **`** (backtick) or **F1** in
   play. If the site still shows the old version, reload once: the service worker swaps to the new
   cache.
2. Controls:

   | | Keyboard | Gamepad |
   |---|---|---|
   | Steer | WASD / arrows | left stick |
   | Rip (hold with the Booster to rev a Burn) | Space or J | A or RT |
   | Bolt on (tap while towing) | E or K | Y or X |
   | Pause | Esc or P | Start |
   | Music on/off | N | |

3. **The run** (PLAN.md section 8): five yards in a row, about 10-15 minutes.
   - **The Ring** first (three waves of Rammers).
   - Then three of the four middle yards, picked by **driving out through one of two exit gates**.
     The sign under each gate shows the yard's salvage.
     - **The Kennel:** Snappers; salvage the Grip Treads.
     - **Long Lanes:** Rammers down two long lanes.
     - **The Plow Pit:** a Plow Rammer round a central tower.
     - **Jaw Yard:** Jaw Snappers among four blocks.
   - **The Heap** last.
   - Your hull, your bolted parts and the part on your cable carry over between yards. You get
     **+1 hull** after each yard.
4. **Four parts on three mounts**, each one changes how you move:
   - **Booster** (rear): faster, and the Burn.
   - **Grip Treads** (sides): pull back hard at speed to power-slide round.
   - **Plow** (front): drive into enemies at teal to ram them, and it blocks a charge head-on.
   - **Jaws** (front): a teal hit bites on, whips you round and slings you back out faster.
5. **How to get a part:** hit the side of an enemy that carries it, at teal (Slipstream).
   - A rear part comes off from behind, a side part from the side, a front part head-on.
   - A Plow comes off only in a joust: Rip its charge nose to nose.
   - Your parts are armor: a hit knocks one loose (cracked), and a second hit shatters it.
6. **Dev shortcuts (local dev server, or `?debug` on a debug build):**
   - `?yard=kennel` (or `lanes`, `pit`, `jaws`, `heap`) starts a run in that yard.
   - The tuning panel has **START WITH** toggles for each part, flat mode, every number and **COPY**.
7. **Defaults I chose for you, all reversible in the tuning panel** (DECISIONS #55-#75):
   - A Rammer's front is armored: a teal hit there does 1, a side does 2, the back tears or does 4.
     To go back to M1: `frontDamage` 2 and `rearDamage` 2.
   - **The joust:** a teal Rip into a charge's nose stuns it. Change it with `joustStun` / `joustDeg`.
   - **The slipstream:** a near miss by a charge lifts you to teal. Set `draftBoost` 0 to remove it.
   - **Parts are knocked loose** before they shatter. `partLives` 1 makes them shatter on the
     first hit.
   - A tapped Rip stays a Rip even with the Booster; only holding revs a Burn (`burnTapTime`).
   - Rammers have 3 HP (M1 had 4); `rammerHp`.
8. **Playtest questions for M3:**
   - Does the exit choice feel like a choice?
   - Does each part change how you play the next yard?
   - Is a 10-15 minute run the right length? The critic's estimate for a decent player is
     10-12 minutes.
   - Is any yard a wall?
   - Play one yard in **flat mode**. Ask "was it more fun?", not "was it harder?". Flat mode is
     *easier* for a skilled player, because there's no speed to keep up (DECISIONS #79).

The Windows app also builds: double-click `Build desktop app.bat`. The installer and portable
`.exe` land in `release/`.

## What's next

- **The owner's playtest of the run.** Start the session with: *"Read ROADMAP.md and HANDOFF.md.
  Here are my playtest notes: …"*. Each note becomes one commit ending "DECISIONS #N".
- **More art** (the list under open points). The art tool is the pixel-art-studio skill (the
  owner's call, DECISIONS #65). Each family is a `pixel-art/<family>/build.py` that draws the
  sprites; its `sprites.json` maps them to game names, and `node scripts/sprites-import.mjs` packs
  them into `src/art/`. Imported art replaces the code-drawn placeholder of the same name, so the
  game works with any subset.
- **What comes after the short run isn't planned yet.** ROADMAP section 4 ends at M5. Once the
  owner has played 0.2.0, the next step is to plan the next milestone in ROADMAP and PLAN, for
  example more parts and enemies, meta-progression, or polish.

Open points for the owner (also in DECISIONS):
- **Bot balance:** the rule bots in `src/sim/bots.ts` are weaker than a person. They rarely survive
  the middle yards, so the run test only checks that bots play every yard without breaking the sim,
  softlocking or leaving the arena (#74).
  - The critic's search bot (`scripts/pacing/`) is the pacing tool. It clears every yard in
    30-60 s with almost no hits; a decent player takes about 3-4x its fighting time.
  - The critic's call: the numbers are fine and the rule bots are just weak (#79).
- **Art for the next pass** (#80):
  - A broader Plow blade, so a Plow Rammer's front and back differ when it faces east or west.
  - Bigger jaws on the Jaw Snapper's diagonal frames.
  - Optionally redraw the Scrapper and the Rammer (still from the code sculptor).
- **The Snapper's slide** (#79): should the broadside slide after a snap be a real opening? Now the
  opening is to loop behind it and rip its treads from the back or side.
- **The pillar rail** (#39): grazing a pillar turns you without losing speed. It might be a
  technique or an exploit.
- **The wave 1 safety net's way out** (#33, now 2 hits, #55): two teal hits on the first Rammer's
  front at 1 HP shake its booster loose.
- **Coasting** (`coastHalf` 0.3 s): letting go of the stick drops you out of teal fast. The critic
  suggested 0.6 s. It's a feel call; try it in the panel.
- Gamepad support is written against the standard mapping but **untested on hardware**.

## How to run everything (for sessions)

Put the portable Node first in every shell:
`export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"` (bash) or
`$env:PATH = "C:\Users\jacks\tools\node-v22.20.0-win-x64;$env:PATH"` (PowerShell).

| What | Command | Notes |
|---|---|---|
| Play (dev) | `npm run dev` | port 5173; `.claude/launch.json` has a `game` entry on 5190 |
| Typecheck | `npm run typecheck` | |
| Unit tests | `npm test` | movement, combat, salvage, data, the M3 parts and Snapper (`m3.test.ts`), the run (`run.test.ts`) and the removal-test guards |
| Strategy bots | `npx vite-node scripts/bots.ts` | prints what each bot achieved; use it when tuning |
| Pacing (search bot) | `npx vite-node scripts/pacing/hrun.ts ring,kennel 1,2,3,4` | the critic's search bot, a skill ceiling: clear times, hits, tears per yard (header has the options) |
| Smoke test | `npm run e2e` | starts its own server; real key presses; must end with zero console errors |
| Screenshot sweep | `npm run screens` (or `-- slip burn`) | every scene in `src/app/debug.ts` (all five middle yards and the Heap included), PNGs + overlap audit in `e2e/out/screens/` |
| Sprite coverage | `npm run coverage` | every name in `src/render/names.ts` has art of the right size and anchor |
| Art sheet | `node e2e/artsheet.mjs` | every sprite at 3x; `IMPORTED=1` draws the imported art over the placeholders |
| Import art | `node scripts/sprites-import.mjs` | `pixel-art/<family>/sprites.json` → `src/art/<family>.png/.json` |
| Web build | `npm run build` / `Package for web.bat` | `dist/` |
| Windows app | `npm run dist:win` / `Build desktop app.bat` | `release/` |
| App icons | `npm run icons` | code-drawn placeholder icon into `public/` and `build/` |

Agents in `.claude/agents/`: `qa-screens` (visual QA, read-only) and `indie-critic` (design critique,
read-only).

## Code map

- `src/sim/`: the rules, pure and deterministic.
  - `world.ts`: state.
  - `tick.ts`: system order.
  - `body.ts`: movement; each part's stats and behaviors, the power-slide.
  - `rip.ts`: Rip, Burn, tiers, and the hit resolver (zones, tears, the joust, the Jaws' latch).
  - `enemies.ts`: what all enemies share: movement, walls, crushing loose parts, contacts with you,
    the Plow's ram and block, drafts.
  - `rammer.ts` and `snapper.ts`: each enemy's brain.
  - `salvage.ts`: tow, pickups, bolting per mount, armor.
  - `waves.ts`: waves, the yard clear, exits.
  - `run.ts`: the run (yards, choices, the loadout carried between yards).
  - `events.ts`.
  - `bots.ts`: strategy bots, including the drafter.
- `src/data/`:
  - `tuning.ts`: every number.
  - `parts.ts`: parts as data (stats, behaviors, how they tear).
  - `mounts.ts`: rear, sides and front, where they sit on each body.
  - `arena.ts`: six layouts.
  - `waves.ts`: enemy specs.
  - `yards.ts`: the run's yards.
  - Also `palette.ts` and `dirs.ts`.
- `src/render/`:
  - `atlas.ts`: sprites by name, from S&S.
  - `renderer.ts`.
  - `fx.ts`.
  - `pixgeom.ts`.
  - `names.ts`: every sprite name and size.
  - `art/code/`: the placeholders.
  - `art/imported.ts`: loads `src/art/*.png/.json` over the placeholders.
- `src/ui/`: `ui.ts`, `font.ts`, `audit.ts`, `hud.ts` (hull, wave, three part slots, gauge),
  `hints.ts` (one-time hints).
- `src/app/`:
  - `app.ts`: scaler and screens.
  - `play.ts`: a run on screen; yard banners, exit signs, the wipe between yards, run results.
  - `tuning.ts`: the dev panel.
  - `settings.ts`.
  - `debug.ts`: scenes for the sweep.
- `src/engine/`: loop, rng, input + gamepad, audio.
- `pixel-art/<family>/`: art sources (build scripts) for the overhaul.

## Environment

- Windows 11, no admin rights. git 2.55. Python 3 with Pillow (for the pixel-art-studio skill).
- Sprocket & Sprout's repo (`C:\Users\jacks\Documents\sprocket-and-sprout`) was the source of the
  engine layer. It is **read-only** for this project.
- Playwright uses the installed Chrome (`PW_CHANNEL=chrome` by default in `e2e/serve.mjs`).
- The e2e scripts start their own Vite server on a free port unless `BASE=` is set.

## Releasing

- Repo: https://github.com/ycgNem/slipstream-salvager (public). Site: https://ycgnem.github.io/slipstream-salvager/.
- Pushing `main` runs `.github/workflows/deploy.yml`: `npm ci`, `npm test`, `npm run build`, then
  deploys `dist/` to GitHub Pages (source: GitHub Actions). Check a run with `gh run list`.
- Day-to-day work happens on `works`. To release, fast-forward `main` to `works` and push both.
  **Push only when the owner says so.**
- **To publish a release** (when the owner says so), from `works` with everything committed:
  1. Bump `version` in `package.json` and the cache name in `public/sw.js`.
  2. Add the patch notes to `CHANGELOG.md`.
  3. `git checkout main`
  4. `git merge --ff-only works`
  5. `git push origin main works`
  6. `git checkout works`
  7. `gh run list` to watch the deploy.
- **0.2.0 was published this way on 2026-10-12** (DECISIONS #81).
- **The Windows builds aren't uploaded anywhere.** To attach them to a GitHub release, only with
  the owner's go-ahead:
  `gh release create v0.2.0 release/Slipstream-Salvager-Setup-0.2.0.exe release/Slipstream-Salvager-Portable-0.2.0.exe --notes-file CHANGELOG.md`
- The service worker caches the game (`public/sw.js`). Bump the cache name when a release must
  reach players who already have it open.
