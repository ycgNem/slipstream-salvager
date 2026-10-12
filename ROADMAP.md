# Slipstream Salvager — Roadmap

Written 2026-10-12. `PLAN.md` is what the game is, `STYLE.md` the art rules, `DECISIONS.md` every
call and why, `PROGRESS.md` what's built, `HANDOFF.md` where the last session stopped.

**Status:** the owner approved every default in section 1 (2026-10-12). Building M0 and M1.

**How every session runs:** start with *"Read ROADMAP.md and HANDOFF.md"*, then paste the phase's
prompt. Build the phase, deciding small things alone and logging them in `DECISIONS.md`. Run the
phase's checks. Commit on `works`. **Push only when the owner says so** (pushing `main` deploys the
website).

**Scope fence:** nothing past Milestone 1 gets built until the owner has playtested M1 and said the
core loop works. That means no extra biomes, story, meta-progression or upgrade pool, no second
enemy, and no art generation.

---

## 1. Open questions for the owner

Each has a recommended default. Defaults that the owner doesn't overrule become decisions in
`DECISIONS.md` (they're already logged there as "default, pending").

| # | Question | Recommended default | Why |
|---|---|---|---|
| Q1 | **How do you attack?** A button-press **Rip** (short committed lunge, damage from the speed you had when you pressed), or **contact ramming** (touching an enemy at speed hurts it, no button)? | **Rip button.** | A button makes the pass a decision with timing; contact-only turns the game into bumper cars and makes it hard for parts to change *attack* behavior. |
| Q2 | **Speed tiers.** Three absolute tiers. Crawl: nothing. Cruise: **no damage**, but it shoves the enemy and cancels its windup. Slipstream: the only tier that does damage or tears parts off. | **Yes.** | The first draft let Cruise do damage, and a review showed that tapping enemies at medium speed beat the build-speed loop. Damage only at Slipstream means every hit needs a run-up. |
| Q3 | **"You become what you rip."** Every part carries its owner's movement *and weakness*. The Booster turns your Rip into the Rammer's charge: hold to rev in a locked straight line (your own lane painted ahead), release to burn through; rev into a wall and you're stunned like a Rammer. | **Yes, as a design rule for all parts.** | It's what stops parts from being bigger numbers. The base body gets speed from loops around pillars, the Booster from straight committed lanes, and a test checks that the best route actually flips. |
| Q4 | **Tear-off rule.** Only a Slipstream hit on the part's side (the booster is on the Rammer's back) tears it off. The tearing hit does no damage, and wrecking an enemy wrecks its parts. Wave 1's Rammer can't be wrecked until it's stripped. | **Yes.** | It forces the flank-at-full-speed pass, which is the whole fight, and guarantees every new player sees a tear-off. |
| Q5 | **Grab and bolt.** Torn parts are auto-grabbed and towed on a short cable; you *tap* Bolt on and it takes 0.7 s while you keep moving, with steering halved, cancelled by a Rip or a hit. | **Yes.** (Alternative: bolting is instant on grab.) | This creates the "get clear, then install" beat from your brief without ever stopping the robot. Tap, not hold, because E shares a finger with D. |
| Q6 | **Parts are armor.** A hit **shatters** your bolted part instead of costing hull. With nothing bolted on, a hit costs one of 5 hull pips. | **Yes.** | It gives later Rammers a reason to be salvaged (living Rammers are the only spares) and makes the body your health bar. The part shatters rather than dropping, so armor can't be re-bolted for free. |
| Q7 | **Second part in M1?** | **No, the Booster only.** First in line after the playtest: *Grip Treads* (tight turns, low top speed; the Rip becomes a pivot-spin), as the opposite feel. | Your brief says one part; one part keeps the playtest about the loop. |
| Q8 | **Controls.** Absolute steering (push left, the robot curves left), keyboard + gamepad from M1, no mouse during play. | **Yes.** (Alternative: tank/Asteroids steering.) | Absolute steering is the responsive, Dead Cells-friendly option; momentum comes from the turn curve, not the controls. An analog stick suits momentum. |
| Q9 | **View.** 3/4 top-down with 8-direction sprites, never rotated; the exact heading is shown by the trail, afterimages and cable. | **Yes.** (Alternative: 16 directions, which turn more smoothly but need twice the art.) | Keeps S&S's no-rotation rule and an art budget that's realistic. |
| Q10 | **Slice length.** Three waves in one arena (1, 2, 3 Rammers), then results and an instant restart. About 2–4 minutes. | **Yes.** | Long enough to bolt on a part and use it against a crowd, short enough to replay many times in one playtest. |
| Q11 | **GitHub repo.** Pages needs a repo. Should I create `slipstream-salvager` on your account (public, so Pages works on a free plan), or will you? | **Neither yet.** M0 writes the workflow locally and you playtest M1 with `Play.bat`. Create the repo when you want a web link. | Creating a repo and pushing are outward-facing; nothing needs them before the playtest. |

Smaller calls already made as defaults (change any by saying so): a 640 × 360 single-screen arena
with no scrolling camera (#6), a live tuning panel in dev/`?debug` builds (#18) with a **flat mode**
that switches the one thing off so you can play the removal test as an A/B (#28), SFX + an engine
hum whose pitch follows speed + one short music loop (#19), SpriteCook for the later art overhaul
(#20), and the review fixes to the movement numbers and the Rammer (#27, #29–#32).

---

## 2. Milestone 0 — Engine and scaffolding

**Goal:** an empty but real project: S&S's engine layer extracted, a blank playable screen, tests,
the screenshot sweep and the deploy pipeline all working, so M1 is pure game code.

**Builds:**
- `git init` with branches `works` (work) and `main` (live). No remote.
- `package.json` (name `slipstream-salvager`, same scripts and dev tools as S&S, `jsfxr`), `vite.config.ts`,
  `tsconfig.json`, `index.html`, `.gitignore`, `.gitattributes`.
- Copied from S&S and trimmed of S&S names: `src/engine/` (loop, rng, input, audio, sfxr, music);
  `src/render/atlas.ts`, `render/art/pixel.ts`, `render/art/pixbuf.ts`, `render/particles.ts`,
  `render/shake.ts`; `src/ui/font.ts`, `ui/ui.ts` (kit only), `ui/audit.ts`, `ui/cursor.ts`;
  `scripts/` art tools; `e2e/smoke.mjs`, `e2e/screens.mjs`, `e2e/coverage.mjs`; `electron/main.cjs`;
  `.github/workflows/deploy.yml`; `public/sw.js` + manifest; the three `.bat` files; `.claude/launch.json`.
- New: `src/engine/gamepad.ts` (Gamepad API, deadzone, merged into the input frame);
  `src/data/palette.ts` (Resurrect 64); `src/render/pixgeom.ts` (Bresenham line, pixel circle, dither);
  the 640 × 360 whole-number scaler with letterbox.
- **Blank playable screen:** title ("Slipstream Salvager", *Play*, *Settings*), an empty play screen
  with the arena's floor and walls as code-drawn tiles and a test marker driven by the input frame
  (keyboard or stick), pause menu, settings (volume, screen shake, key binds), FPS/debug overlay.
- The `qa-screens` and `indie-critic` agents in `.claude/agents/`, rewritten for this game.
- Placeholder app icons (code-drawn) for the manifest, favicon and Electron.

**Checks:** `npm run typecheck`, `npm test` (loop determinism, RNG, input frame + gamepad deadzone,
atlas name registry, palette size), `npm run build`, `npm run e2e` (smoke: title → play → move →
pause, zero console errors), `npm run screens` (title, play, pause, settings; zero overlap issues),
`npm run coverage`, and one `npm run dist:win` to prove the desktop build.

**Prompt:**
```
Read ROADMAP.md, HANDOFF.md, PLAN.md and STYLE.md. Build Milestone 0 exactly as ROADMAP.md
section 2 lists it. Copy engine-layer files from C:\Users\jacks\Documents\sprocket-and-sprout
(read-only; never modify that repo) and trim them of Sprocket & Sprout names and features this
game doesn't need. Copy no game rules, data, content or art. Put the portable Node at
C:\Users\jacks\tools\node-v22.20.0-win-x64 on PATH. Run every check in the section, fix what
fails, log decisions in DECISIONS.md, update PROGRESS.md and HANDOFF.md, commit on `works`.
Do not create a GitHub repo or push.
```

---

## 3. Milestone 1 — The smallest playable version of the one thing

**Goal:** the slice in `PLAN.md` section 4: build speed, make a pass, get clear, tear off the
Booster, bolt it on, and feel the difference. Code-drawn art at the final names and sizes. Then
**stop for the owner's playtest.**

Four phases, each a commit (or a few). One session may cover several.

### 1a — Movement and speed feedback

Builds: `sim/body.ts` (heading/speed model, two-stage acceleration, turn curve, turn scrub, coast,
brake/skid/pivot with hysteresis, overspeed decay), `sim/arena.ts` (walls, pillars, glancing slide vs
head-on clank), `data/chassis.ts`, `data/arena.ts`, `data/tuning.ts`; the Scrapper's code-drawn sprites
(8 directions) and heading tick; speed tiers and their feedback (claw glow, dust, afterimages, wind
lines, skid marks); the engine hum; the HUD speed gauge with the two marks; the dev tuning panel
(`?debug`, edits live, copies values to the clipboard; the flat-mode switch is wired in 1b/1c).

Checks: unit tests for time and distance to Slipstream on a straight line (~0.8 s, ~90 px), turning
circle at top speed, turn scrub (a tight orbit at Slipstream falls to Cruise), coast distance, brake
threshold with no flicker on a keyboard back-diagonal, glancing vs head-on wall hits, determinism
(input log replays to the same state hash).

```
Read ROADMAP.md and HANDOFF.md. Build M1 phase 1a (ROADMAP.md section 3, PLAN.md 4.1–4.2): the
movement model, arena collision, speed tiers with all their feedback, the engine hum, the HUD speed
gauge and the dev tuning panel. Code-drawn art at STYLE.md's names and sizes. Add the 1a tests, run
typecheck, tests, smoke and screens, log decisions, update PROGRESS/HANDOFF, commit on works.
```

### 1b — The Rip and the Rammer

Builds: `sim/rip.ts` (lunge, tier locked at press, aim assist, Cruise shove and windup cancel,
Slipstream damage, pass-through, hit-stop events), `sim/rammer.ts` (fast-turning stalk, near and far
windups with lead aim then lock, full-width telegraph lane, charge, skid, rebound off walls and
pillars, Rammer-on-Rammer recovery, facing snapped to 8 directions while recovering, the two-at-a-time
windup limit, bump-triggered quick windup, the stripped shove), hull and hurt, `sim/waves.ts` +
`data/waves.ts` (3 waves, gates, banners), the results and "Scrapped" screens; flat mode for damage;
`sim/bots.ts` with the turret, brawler (Cruise taps), matador and hit-and-run bots; SFX for rip by
tier, clank, charge whine, impact, wreck.

Checks: the **removal-test guards**: the turret deals 0 damage and loses; the brawler and the matador
each do worse than hit-and-run on damage dealt per hit taken; hit-and-run clears wave 1 on 8 seeds
averaging ≤ 1 hit. Unit tests for tier lock, Cruise does 0 damage and cancels a windup, near vs far
windup, lead aim, lock timing, wall rebound with no extra stun, Rammer-on-Rammer with no damage,
windup limit.

```
Read ROADMAP.md and HANDOFF.md. Build M1 phase 1b (ROADMAP.md section 3, PLAN.md 4.2–4.3 and 4.5):
the Rip, the Rammer with its telegraphed charge, hull, the three waves, results, and the strategy
bots. Add the 1b tests including the removal-test guards, run all checks, log decisions, update
PROGRESS/HANDOFF, commit on works.
```

### 1c — Salvage: tear, tow, bolt, and the Booster

Builds: `sim/salvage.ts` (tear-off on Slipstream rear hits with no damage, wreck destroys parts, the
wave-1 safety net, the towed part on a spring, pickups, tap-to-bolt with its costs, swap,
parts-as-armor shatter), `data/parts.ts` (the Booster: stats *and* behavior: the Burn with rev, lock,
own lane, release, auto-release on contact, wall stun), the plume, the cable drawn as pixel geometry,
bolting sparks and ratchet sound, the "torn off" gold burst, HUD part slot and bolt progress, the
three one-time hints, flat mode for the Booster, the short music loop.

Checks: the **route flip** (on the base body the pillar-looping bot beats the long-lane bot; with the
Booster the order flips); the **data rule** (every part has a non-empty `behavior`); tear-off only on
Slipstream + rear arc and for no damage; wreck destroys the booster; wave 1's Rammer stops at 1 HP
until stripped; bolt cancels on Rip and on hit; a hit shatters the bolted part before touching hull;
Burn from rest reaches Slipstream in ~0.6 s; revving into a wall stuns for 0.6 s.

```
Read ROADMAP.md and HANDOFF.md. Build M1 phase 1c (ROADMAP.md section 3, PLAN.md 4.4): tearing
off, towing, bolting and the Booster with its Burn attack, plus hints and the music loop. Add the 1c
tests (part feel check, data rule, tear-off rules, armor rule), run all checks, log decisions,
update PROGRESS/HANDOFF, commit on works.
```

### 1d — Verify and hand over for the playtest

Builds nothing new. Runs everything, fixes what it finds, and prepares the playtest.

Checks: typecheck, all tests, smoke, screens (title, play at each speed tier, a telegraph mid-windup,
hit-stop, towing, bolting, Booster burn, results, Scrapped, pause, settings, tuning panel; zero
overlap issues), coverage (every name has code art), a 60-second bot run per seed with no errors,
the `qa-screens` agent, then the `indie-critic` agent against PLAN.md's pillars. Fix the critic's
top items only if they are bugs or break a pillar; anything else goes to the owner as a note.

```
Read ROADMAP.md and HANDOFF.md. Run M1 phase 1d: every check, the qa-screens and indie-critic
agents, fix bugs and pillar breaks only. Write the playtest notes in HANDOFF.md (how to play, the
controls, the playtest questions, the critic's open points), update PROGRESS, commit on works, and
stop for the owner's playtest.
```

### Playtest questions (for the owner, after M1)

1. Did you ever want to stop moving? When, and why?
2. Could you tell how fast you were going without looking at the gauge?
3. Did a good pass feel *decisive*: a clear before, hit, after?
4. Was getting clear after a pass natural, or did you end up stuck next to enemies?
5. Did the Rammer's telegraph give you enough time? Too much?
6. After bolting on the Booster, did you take different lines or attack differently? Did you like it,
   or prefer the base body?
7. Movement: too floaty, too twitchy, or right? (Use the tuning panel and tell me the numbers.)
8. **Flat mode:** play the three waves once with flat mode on. Was it noticeably less fun? (If not,
   the identity isn't carrying the game yet.)
9. If you imagine this with ten parts and a run of arenas: is the loop strong enough to carry that?

---

## 4. After the playtest (outlines only; not started until the owner says so)

- **M2 — Tune the loop.** The owner's playtest notes, one commit each, logged as decisions. Possibly
  the second part (Grip Treads) as a contrast. Repeat playtests until the owner says the loop is
  serviceable.
- **M3 — A short run.** A sequence of arenas in a 10–15-minute run, a handful of parts across body
  slots, a second enemy type, no escalating timer. Planned only once M2 is signed off.
- **M4 — Art overhaul.** SpriteCook generation to STYLE.md's names and sizes, the import pipeline,
  coverage at 100%.
- **M5 — First public build.** GitHub repo, Pages, Windows installers, player-facing patch notes.

---

## 5. Hard rules (the `qa-screens` checklist)

1. Integer pixels and whole-number scaling only; nothing rotated; no blur.
2. Every sprite asked for by name, with an entry in STYLE.md's table.
3. `src/sim` never touches the DOM, audio or `Math.random`.
4. Danger colors are only used for danger, speed colors only for speed, gold only for salvage.
5. No text overlaps (the overlap audit must report zero).
6. No feature that would make sense unchanged in a stand-and-swing roguelike without a note in
   DECISIONS.md explaining how it serves the one thing.
