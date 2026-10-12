# Handoff

Read this first, every session.

## Where things stand (2026-10-12)

- **Milestone 0 and Milestone 1 are built. Stopped for the owner's playtest.** Nothing past M1 gets
  built until the owner says the core loop works (ROADMAP.md "Scope fence").
- The owner approved every default in ROADMAP.md section 1 (Q1–Q11). DECISIONS.md runs #1–#43.
- Branch `works` has everything; `main` is the planning commit. No GitHub remote (DECISIONS #24).

## How to playtest (for the owner)

1. Double-click **`Play.bat`**. It starts the game and opens your browser at `http://localhost:5173`.
   Keep the black window open while you play.
2. For the **tuning panel and flat mode**, use `http://localhost:5173/?debug` (in the dev server it's
   always on). Press **`** (backtick) or **F1** in play to open it.
3. Controls:

   | | Keyboard | Gamepad |
   |---|---|---|
   | Steer | WASD / arrows | left stick |
   | Rip (hold with the Booster to rev a Burn) | Space or J | A or RT |
   | Bolt on (tap while towing) | E or K | Y or X |
   | Pause | Esc or P | Start |
   | Music on/off | N | |

4. What's there: three waves in one arena. Wave 1 is one Rammer, wave 2 two, wave 3 three. Build
   speed until the claw turns teal, hit a Rammer's back to tear its booster off, tap E to bolt it on,
   and feel how the Burn changes your lines. Your bolted part is your armor: a hit shatters it
   instead of costing hull.
5. **The playtest questions** are in ROADMAP.md section 3. Question 8 asks you to play once with
   **flat mode** on (it removes the one thing: speed stops mattering for damage and the Booster loses
   its Burn). If that's about as fun, the identity isn't carrying the game yet.
6. If movement feels off, change the numbers in the tuning panel while you play, press **COPY** and
   paste what it copies into your notes. Those are the numbers I'll put in `src/data/tuning.ts`.

The Windows app also builds: double-click `Build desktop app.bat`; the installer and portable `.exe`
land in `release/` (checked once on 2026-10-12, 0.1.0).

## What's next

After the playtest, M2 is "tune the loop" (ROADMAP.md section 4): each of the owner's notes becomes
one change commit ending "DECISIONS #N". Start the session with: *"Read ROADMAP.md and HANDOFF.md.
Here are my playtest notes: …"*.

Open points from building M1 to raise with the owner (also in DECISIONS):
- **The pillar rail** (#39): grazing a pillar turns you without losing speed. It might be a fun
  technique or an exploit; the playtest decides.
- **The wave 1 safety net's way out** (#33): three Slipstream hits on the first Rammer's front at
  1 HP shake its booster loose. That's a new rule, added because a bot got stuck.
- Gamepad support is written against the standard mapping but **untested on hardware**.

## How to run everything (for sessions)

Put the portable Node first in every shell:
`export PATH="/c/Users/jacks/tools/node-v22.20.0-win-x64:$PATH"` (bash) or
`$env:PATH = "C:\Users\jacks\tools\node-v22.20.0-win-x64;$env:PATH"` (PowerShell).

| What | Command | Notes |
|---|---|---|
| Play (dev) | `npm run dev` | port 5173; `.claude/launch.json` has a `game` entry on 5190 |
| Typecheck | `npm run typecheck` | |
| Unit tests | `npm test` | 48 tests: movement, combat, salvage, data, and the removal-test guards (bots on 8 seeds) |
| Strategy bots | `npx vite-node scripts/bots.ts` | prints what each bot achieved; use it when tuning |
| Smoke test | `npm run e2e` | starts its own server; real key presses; must end with zero console errors |
| Screenshot sweep | `npm run screens` (or `-- slip burn`) | every scene in `src/app/debug.ts`, PNGs + overlap audit in `e2e/out/screens/` |
| Sprite coverage | `npm run coverage` | every name in `src/render/names.ts` has art of the right size and anchor |
| Code-art sheet | `node e2e/artsheet.mjs` | every sprite at 3x, and all 8 directions with the booster mounted |
| Web build | `npm run build` / `Package for web.bat` | `dist/`, about 130 KB |
| Windows app | `npm run dist:win` / `Build desktop app.bat` | `release/` |
| App icons | `npm run icons` | code-drawn placeholder icon into `public/` and `build/` |

Agents in `.claude/agents/`: `qa-screens` (visual QA, read-only) and `indie-critic` (design critique,
read-only). The `art-director` comes with the art overhaul (M4).

## Code map

- `src/sim/`: the rules, pure and deterministic. `world.ts` (state), `tick.ts` (system order),
  `body.ts` (movement), `rip.ts` (Rip, Burn, tiers, tear-off), `rammer.ts` (AI, lanes, contacts),
  `salvage.ts` (tow, pickups, bolting, armor), `waves.ts`, `events.ts`, `bots.ts` (strategy bots).
- `src/data/`: `tuning.ts` (every number), `parts.ts`, `arena.ts`, `waves.ts`, `palette.ts`,
  `dirs.ts`, `mounts.ts` (where parts sit on bodies; the claw tip).
- `src/render/`: `atlas.ts` (sprites by name, from S&S), `renderer.ts`, `fx.ts`, `pixgeom.ts`
  (lanes, lines, silhouettes), `names.ts` (every sprite name + size), `art/code/` (the placeholders).
- `src/ui/`: `ui.ts` (kit with key/pad navigation), `font.ts` and `audit.ts` (from S&S), `hud.ts`,
  `hints.ts`.
- `src/app/`: `app.ts` (scaler, screens), `play.ts` (one encounter on screen; `autopilot` hook),
  `tuning.ts` (dev panel, flat mode), `settings.ts`, `debug.ts` (scenes for the sweep).
- `src/engine/`: loop, rng, input + gamepad, audio (synth SFX, engine hum, sfxr bank, music player
  and the one song).

## Environment

- Windows 11, no admin rights. git 2.55.
- Sprocket & Sprout's repo (`C:\Users\jacks\Documents\sprocket-and-sprout`) was the source of the
  engine layer. It is **read-only** for this project.
- Playwright uses the installed Chrome (`PW_CHANNEL=chrome` by default in `e2e/serve.mjs`).
- The e2e scripts start their own Vite server on a free port unless `BASE=` is set.

## Releasing

Not set up: there's no GitHub repo (DECISIONS #24). When there is one, pushing `main` deploys the
website through `.github/workflows/deploy.yml`. Push only when the owner says so.
