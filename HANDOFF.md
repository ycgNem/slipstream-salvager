# Handoff

Read this first, every session.

## Where things stand (2026-10-12)

- Planning is done: `PLAN.md` (the game, the slice, the architecture), `STYLE.md` (art rules and
  sprite names), `ROADMAP.md` (milestones with paste-ready prompts), `DECISIONS.md` (#1–#32).
- A critic agent reviewed the slice spec before any code; its fixes are in (DECISIONS #27–#32).
- **Blocked on the owner:** the open questions in `ROADMAP.md` section 1 (Q1–Q11). When the answers
  come in, update the "Pending Qn" entries in `DECISIONS.md` (and PLAN/ROADMAP where an answer changes
  the design), then start Milestone 0.
- No code, no git history yet.

## Next step

Once the questions are answered, paste the M0 prompt from `ROADMAP.md` section 2.

## Notes for M0 (couplings found in S&S's engine layer)

Checked 2026-10-12: these "engine" files import S&S game code and need cutting when copied.
- `engine/audio/audio.ts` imports S&S's `Game` type (it reads game state for ambience) and its
  `songs.ts`. Keep the synth and SFX plumbing, drop the `Game` hooks, write a new `songs.ts`.
- `ui/ui.ts` imports `ITEMS` for item icons and `ui/skin.ts` for wood/paper/brass panel skins. Drop
  the item helpers; keep one or two code-drawn panel styles that fit this game.
- `render/particles.ts`, `render/art/pixel.ts`, `render/art/pixbuf.ts`, `ui/cursor.ts` import the
  palette's named colors (`C.amber` etc.). The new `src/data/palette.ts` keeps Resurrect 64's
  indices but uses this game's names (speed, danger, salvage, ...).
- `engine/loop.ts`, `engine/rng.ts`, `engine/input.ts` (action list aside), `render/atlas.ts`,
  `render/shake.ts`, `ui/font.ts`, `ui/audit.ts` and `engine/audio/sfxr.ts` are clean.

## Environment

- Windows 11, no admin rights. Portable Node 22 at `C:\Users\jacks\tools\node-v22.20.0-win-x64`:
  prepend it to PATH in each shell (`$env:PATH = "C:\Users\jacks\tools\node-v22.20.0-win-x64;$env:PATH"`).
- git 2.55 is installed.
- Sprocket & Sprout's repo, the source of the engine layer, is at
  `C:\Users\jacks\Documents\sprocket-and-sprout` (branch `works`). Treat it as **read-only**.
- Playwright uses the installed Chrome (`PW_CHANNEL=chrome`), as in S&S.

## How to run (once M0 exists)

- Play: double-click `Play.bat` (or `npm run dev`). Add `?debug` to the address for the tuning panel.
- Tests: `npm test`. Typecheck: `npm run typecheck`.
- Smoke test: `npm run e2e` (needs the dev server running). Screenshot sweep: `npm run screens`.
  Sprite coverage: `npm run coverage`.
- Web build: `Package for web.bat`. Windows app: `Build desktop app.bat`.

## Releasing

Not set up yet: there's no GitHub repo (DECISIONS #24). When there is, pushing `main` deploys the
website; push only when the owner says so.
