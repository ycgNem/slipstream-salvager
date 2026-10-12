# Decisions log

Every design and technical decision, with its reason. Numbered; never renumbered. Claude makes
default calls on small things while working alone and logs them here; the owner can overrule any of
them. **"Pending Qn"** means it's a default waiting on the owner's answer to that question in
`ROADMAP.md` section 1. Once answered, the entry is updated to say so.

1. **Name and folder.** Working title *Slipstream Salvager*. The project lives at
   `C:\Users\jacks\Documents\slipstream-salvager`, a new git repo, next to Sprocket & Sprout (S&S).
   It's a new game, not a sequel.
2. **Branches.** Work on `works`; `main` is what's live. No GitHub remote yet (see #24).
3. **Node.** The portable Node 22 at `C:\Users\jacks\tools\node-v22.20.0-win-x64`, as in S&S. The
   `.bat` files put it on PATH.
4. **Reuse boundary.** Copied from S&S: the engine layer (loop, RNG, input, audio engine and synth,
   sfxr), the atlas and pixel helpers, particles and shake, the font, UI kit and overlap audit, the
   e2e harness, the art scripts, Electron, the Pages workflow, the service worker, the `.bat` files and
   the build configs. Not copied: S&S's sim, data, windows, app, renderer, songs, art or doc content.
   *Why:* the brief, and S&S's lesson that the game layer is the part that has to be new.
5. **Pure, deterministic simulation.** `src/sim` takes an input frame per tick and emits events; no
   DOM, no audio, no `Math.random`. *Why:* S&S's 408 tests came from this, and determinism lets bots
   and replays check the feel of the loop without a person.
6. **640 × 360 logical canvas, one-screen arena, no scrolling camera.** Whole-number scaling with a
   letterbox. *Why:* "readable arena" in the brief; at this size a 20 px robot has room to loop, and
   nothing is ever off screen. S&S's camera was also built around a ~640 × 360 view.
7. **3/4 top-down view, 8 facing directions, pixel art never rotated.** The exact heading shows
   through the trail, afterimages and cable, drawn as pixel geometry. *Pending Q9.*
8. **Absolute steering, keyboard + gamepad from M1, no mouse in play.** *Pending Q8.*
9. **The attack is a button: the Rip.** A 0.16 s committed lunge; the damage tier is locked at the
   moment of the press, with up to 12° of aim assist. *Pending Q1.*
10. **Three absolute speed tiers**: Crawl < 110 px/s (nothing), Cruise 110–190 (no damage; shoves
    and cancels a windup), Slipstream ≥ 190 (2 damage, or tears a part off). *Pending Q2.*
11. **The slice's enemy is the Rammer**: slow but fast-turning stalker, telegraphed lane charge
    (tracks with lead, then locks), a recovery skid, at most two winding up at once, weaker shove once
    stripped, HP 4. Details revised by #30. *Why:* its attack is itself a momentum move, so it teaches
    the player's own verbs, and its recovery window is the natural moment for a pass.
12. **"You become what you rip."** Every part carries its owner's way of moving, weakness included.
    The Booster turns the Rip into the Burn (hold to rev in a locked line with your own lane painted,
    release to pierce; rev into a wall and you're stunned 0.6 s), with top speed 270 and turning at
    speed 3 rad/s. *Pending Q3.*
13. **Tear-off rule.** Only a Slipstream-tier hit on the part's side tears it off, and that hit does
    no damage; wrecking an enemy wrecks its parts. *Pending Q4.*
14. **Grab, tow, bolt.** Torn parts are grabbed and towed on a short cable (a trailing point on a
    spring); tapping *Bolt on* starts a 0.7 s bolt that works while moving, halves steering, and is
    cancelled by a Rip or a hit. *Pending Q5.*
15. **Parts are armor; hull is 5 pips.** A hit shatters the bolted part instead of costing hull.
    No healing in the slice. *Pending Q6.*
16. **One part in M1: the Booster.** Grip Treads is the first candidate after the playtest.
    *Pending Q7.*
17. **The slice is three waves** (1, 2, 3 Rammers) in one arena, then results and an instant
    restart. *Pending Q10.*
18. **A live tuning panel** in dev and `?debug` builds: every movement and combat constant, editable
    while playing, with a button that copies the values to paste into `src/data/tuning.ts`.
    *Why:* the owner decides whether the movement feels good; this lets the playtest produce
    numbers, not only adjectives.
19. **Sound in M1:** synthesized SFX for every action, a continuous engine hum whose pitch follows
    speed, and one short music loop written in S&S's notation. *Why:* sound is half of movement
    feedback; one loop is cheap and can be muted (N).
20. **Art overhaul tool: SpriteCook** (the pixel-art plugin enabled on the owner's account), with
    PixelLab's free `pixelart_workbench` for exact pixel fixes and PixelLab generation as a fallback.
    No generation of any kind until the owner approves the loop. *Why:* the owner said "pixel art
    plugin"; SpriteCook is the one enabled.
21. **Data rule: every part declares a behavior change.** A part with only stat multipliers fails
    the data test. *Why:* "no passive upgrades that are mostly bigger numbers".
22. **No escalating difficulty timer.** Pressure comes from discrete waves and their composition, never
    from a clock. *Why:* the brief.
23. **Saves.** The slice stores only settings and best results in localStorage. S&S's versioned save
    and migration code is copied but unused until runs exist.
24. **No GitHub repo yet.** The Pages workflow is set up locally; the owner playtests with `Play.bat`.
    Creating the repo and pushing wait for the owner. *Pending Q11.*
25. **Docs are law once the build starts.** Changing PLAN, STYLE or ROADMAP mid-build happens on
    purpose, with an entry here. *Why:* S&S's drift lesson.
26. **Reserved colors.** Teal means speed, red and magenta mean danger, gold means salvage, and none
    of them is used for anything else (STYLE.md). *Why:* readability pillar; with three colors carrying
    the game's state, the HUD becomes optional.
27. **Design review before code.** A critic agent reviewed the slice spec (2026-10-12) and found that
    the first draft's best play was tapping enemies at medium speed and orbiting them, not build
    speed / pass / escape. Adopted: #28–#32 and the revised #10–#15. Not adopted: cutting Electron,
    the service worker, the Pages workflow, the screenshot sweep and sprite coverage from M0 (the
    owner's brief asks for them), and cutting the music loop (#19). Adopted as a simplification: no
    save scaffolding is copied, and key rebinding stays in code (no UI) for the slice.
28. **Flat mode.** A switch in the dev tuning panel that removes the one thing: rips do the same
    damage at any speed, and parts give only their stat changes. *Why:* it makes the removal test
    something the owner can play as an A/B instead of imagine.
29. **Movement numbers.** Two-stage acceleration (900 px/s² below 60 px/s, 180 above: Slipstream in
    ~0.8 s and ~90 px); coast half-life 0.3 s; turning faster than 5 rad/s scrubs speed; the brake
    threshold is 150° with hysteresis. *Why:* the first numbers reached Slipstream in 0.34 s (no
    run-up), drifted 260 px when you let go (floaty), and the 135° threshold flickered on keyboard
    diagonals.
30. **The Rammer can't be orbited or parked against.** It turns fast while stalking (its back only
    shows when it has committed), aims its charge with half your velocity as lead, uses a quick 0.45 s
    windup within 80 px (0.85 s beyond), starts that quick windup when you bump it, rebounds off walls
    and pillars into the normal 0.9 s recovery (no long stun), and two Rammers colliding both recover
    with no damage. *Why:* orbiting at Cruise dodged every charge; parking by a pillar and sidestepping
    earned free stuns.
31. **8 directions without lying about angles.** A 3 px heading tick at the true angle off the claw;
    up to 12° of aim assist on the Rip; the Rammer's facing snaps to its sprite's direction while it
    recovers or is stunned (so the rear you see is the rear the game uses); telegraph lanes are drawn
    at the body's full width with two edge lines and dither.
32. **Every new player sees a tear-off.** Wave 1's Rammer can't be wrecked while it still has its
    booster (it stops at 1 HP), and a tearing hit does no damage, so tearing and wrecking are always
    separate passes.
