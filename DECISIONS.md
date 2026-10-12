# Decisions log

Every design and technical decision, with its reason. Numbered; never renumbered. Claude makes
default calls on small things while working alone and logs them here; the owner can overrule any of
them. **"Pending Qn"** means a default waiting on the owner's answer to that question in
`ROADMAP.md` section 1. On 2026-10-12 the owner approved every default (Q1–Q11).

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
   through the trail, afterimages and cable, drawn as pixel geometry. *Owner approved the default (Q9, 2026-10-12).*
8. **Absolute steering, keyboard + gamepad from M1, no mouse in play.** *Owner approved the default (Q8, 2026-10-12).*
9. **The attack is a button: the Rip.** A 0.16 s committed lunge; the damage tier is locked at the
   moment of the press, with up to 12° of aim assist. *Owner approved the default (Q1, 2026-10-12).*
10. **Three absolute speed tiers**: Crawl < 110 px/s (nothing), Cruise 110–190 (no damage; shoves
    and cancels a windup), Slipstream ≥ 190 (2 damage, or tears a part off). *Owner approved the default (Q2, 2026-10-12).*
11. **The slice's enemy is the Rammer**: slow but fast-turning stalker, telegraphed lane charge
    (tracks with lead, then locks), a recovery skid, at most two winding up at once, weaker shove once
    stripped, HP 4. Details revised by #30. *Why:* its attack is itself a momentum move, so it teaches
    the player's own verbs, and its recovery window is the natural moment for a pass.
12. **"You become what you rip."** Every part carries its owner's way of moving, weakness included.
    The Booster turns the Rip into the Burn (hold to rev in a locked line with your own lane painted,
    release to pierce; rev into a wall and you're stunned 0.6 s), with top speed 270 and turning at
    speed 3 rad/s. *Owner approved the default (Q3, 2026-10-12).*
13. **Tear-off rule.** Only a Slipstream-tier hit on the part's side tears it off, and that hit does
    no damage; wrecking an enemy wrecks its parts. *Owner approved the default (Q4, 2026-10-12).*
14. **Grab, tow, bolt.** Torn parts are grabbed and towed on a short cable (a trailing point on a
    spring); tapping *Bolt on* starts a 0.7 s bolt that works while moving, halves steering, and is
    cancelled by a Rip or a hit. *Owner approved the default (Q5, 2026-10-12).*
15. **Parts are armor; hull is 5 pips.** A hit shatters the bolted part instead of costing hull.
    No healing in the slice. *Owner approved the default (Q6, 2026-10-12).*
16. **One part in M1: the Booster.** Grip Treads is the first candidate after the playtest.
    *Owner approved the default (Q7, 2026-10-12).*
17. **The slice is three waves** (1, 2, 3 Rammers) in one arena, then results and an instant
    restart. *Owner approved the default (Q10, 2026-10-12).*
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
    Creating the repo and pushing wait for the owner. *Owner approved the default (Q11, 2026-10-12).*
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
33. **The wave 1 safety net has a way out.** If you keep hitting the first Rammer's front instead of
    its back, the third Slipstream hit at 1 HP shakes its booster loose onto the floor (not grabbed:
    you drive over it). *Why:* the hit-and-run bot got stuck in wave 1 forever on half the seeds; a
    player who hasn't learned the rear hit yet would too.
34. **The hit-and-run guard is 6 of 8 seeds.** The bot clears wave 1 within 90 s on at least 6 of 8
    seeds, takes at most one hit on average and is never scrapped; the other guards are as planned.
    *Why:* the bot is a simple script that sometimes fails to get behind the wave 1 Rammer in time;
    the guard is about the strategy winning, not the bot being perfect.
35. **HUD layout.** Hull and wave top left, the part slot top right, the speed gauge bottom left on
    the wall. *Why:* the top and bottom centers are gates, and the HUD covered them.
36. **Rammers walk round pillars.** When a pillar blocks its view of you, a Rammer heads for the
    pillar corner that makes the shorter trip. *Why:* they got stuck behind pillars, never saw you
    and never charged.
37. **Afterimages are dithered ghosts**, one every 4 ticks at Slipstream. *Why:* solid ones 12 px
    apart overlapped into one teal smear.
38. **Gates have an orientation** (`ob:gate:<h|v>:<state>`): the side walls need 16x32 openings.
    STYLE.md updated.
39. **The route flip is measured as share of time at Slipstream** over 40 s on two routes: tight loops
    44 px round a pillar, and the long middle corridor (with Burns when the Booster is on). Base: loops
    98%, lanes 68%. Booster: loops 68%, lanes 73%. The Booster cuts turning by a third at every speed
    (0.65x), not only at the top. **Found on the way:** grazing a pillar turns you without scrubbing
    speed (a "rail"); left in for the playtest, since it may be fun rather than a problem.
40. **Input forgiveness.** A Rip pressed up to 0.12 s early fires when it can, and presses during
    hit-stop are kept until the sim runs again. *Why:* Dead Cells-style responsiveness; lost presses
    feel like the game ignoring you.
41. **A tapped Rip with the Booster is an instant Burn** at your current tier (it revs and releases at
    once). Holding is still how you build a Burn.
42. **Rendering.** Everything is drawn into one 640x360 buffer and blitted at the largest whole-number
    scale that fits, letterboxed; the mouse is mapped back to logical pixels. *Why:* the pixel rules
    hold everywhere for free, UI included.
43. **The autopilot hook.** `Play.autopilot` lets a bot from `src/sim/bots.ts` drive the real game, so
    e2e scripts and the critic can watch the loop with all its feedback, not only the sim.
44. **Hints sit on the bottom wall band**, right of the gate, one at a time, shown when relevant. *Why:*
    the visual QA pass found the in-world hint text lying across locked lanes; in a fast action game a
    hint must never cover a threat. Floating text was shortened ("TORN OFF!", "BOLTED ON!") for the
    same reason.
45. **Cruise is lime** (32/33): the claw ring, the slash and the gauge band. *Why:* amber was the
    player's own body color and 23 is a salvage color, so Cruise didn't read from the robot alone.
    Grey, lime, teal reads as a clean warm-up.
46. **Color-rule fixes from the QA pass:** sparks and stun stars are white/frost/orange (they were
    gold, which means salvage), "YARD CLEARED" is white (it was speed teal), menus dim with an ink
    checker instead of alpha, the letterbox is palette ink, and the HUD's labels sit in the wall bands
    on ink strips so nothing covers the floor's edge.

*From the critic's review at the end of M1 (bugs and pillar breaks only; the rest went to the owner
as notes in HANDOFF.md):*

47. **Turn scrub works on lateral acceleration** (speed × turn rate above 900 px/s², at 1 px/s² of
    speed per px/s² over), replacing "turning faster than 5 rad/s". *Why:* the turn rate falls with
    speed, so above ~216 px/s nothing ever scrubbed and full-lock turning above ~175 px/s still gained
    speed. Slipstream was a state you kept forever, the opposite of PLAN 4.2. Now an enemy orbit
    (r about 30) sits at Cruise, a full-lock U-turn from top speed drops to about 140, and a pillar loop
    (r about 44) or a keyboard 45° step keeps Slipstream. The Booster's slower turning never pulls 900,
    so it keeps its speed through wide arcs and can't turn in tight: wide lines, not bigger numbers.
48. **The Rammer's lead solves the real intercept, at 80%.** *Why:* it divided the distance to where
    you *are* by the charge speed, which undershoots, so crossing its front in a straight line at
    60 px/s or more was never hit (PLAN said the reverse). Now a straight line at Crawl or Cruise
    is clipped near and far, a straight line at Slipstream is clipped up close, and a 45° juke clears
    most charges. At 100% even far Slipstream lines were caught every time; 80% keeps speed as a
    defence.
49. **The Rammer reads a steady curve, not only a straight line.** It extrapolates your recent turn
    rate (smoothed) along an arc. *Why:* the critic's "camper" circled one pillar and ripped whatever
    came close, and cleared 21-23 of 40 runs against hit-and-run's 13. A straight-line lead never
    catches a circle. Now the camper clears 7-11 of 40 and hit-and-run 14-25. Tried first and
    rejected: sending a blocked Rammer to a clear-view spot instead of the pillar corner (#36). It
    didn't hurt the camper and made hit-and-run worse.
50. **Flat mode removes both halves of the removal test.** Speed doesn't change damage (as before),
    and a bolted part no longer changes how you move (no Burn, no speed or turning changes); it adds
    +1 damage instead, the "bigger number" a familiar roguelike would give it. Parts are still
    armor. *Why:* the quote removes "body parts that change how you move", and the old flat mode kept
    the Booster's turning ×0.65. With #47 in place, the slow strategies that deal nothing in normal
    play (turret, brawler, matador) deal damage in flat mode, so the A/B can fail.
51. **Hints and feedback for the tear and the Burn.** The tear hint says when the back shows ("DODGE
    ITS CHARGE, THEN HIT ITS BACK AT TEAL"). A new teal hint after bolting says "HOLD SPACE TO REV A
    BURN, LET GO TO LAUNCH" (the Booster's blurb was never shown, and a tapped Burn is a worse Rip). A
    hit the wave 1 safety net absorbs gets a dull clank, no flash, a lighter hit-stop and "HIT ITS
    BACK!". A Rammer at 2 HP or less crackles with sparks, faster at 1 HP. *Why:* the critic found
    the tear couldn't be learned from the old hint, and capped hits looked like real ones ("why
    won't it die?").
52. **Nothing can be pushed out of the arena.** The walls are half-planes that only push inward, and
    every body push (player off a Rammer, Rammer off Rammer) is followed by a push-out. If a wall is
    behind you, the Rammer gives way instead. *Why:* a skidding Rammer could shove a stunned player
    8 px into the 16 px wall, and the next push-out exited the far side. The wave never ended (7 of
    400 critic runs).
53. **Bots and guards follow the new movement.** Hit-and-run circles the Rammer about 140 px out at
    speed, swerves past charges (at most ~45° off its line) instead of turning square, and cuts in
    for one pass. With the Booster it eases off to turn in, then revs a Burn. New guards: on 40
    full-slice seeds nobody leaves the arena and the camper clears under 60% of what hit-and-run
    does. In open floor the Booster's tightest Slipstream circle is at least 1.2× the base body's.
    In The Ring the base pillar loop must be clean (no wall clanks). The tuning panel gets START WITH
    THE BOOSTER for playtesting the part over a whole run. *Why:* the critic showed the old guards
    were tuned to their own seeds, nothing covered waves 2-3, and the route flip partly measured
    the top wall.

54. **The repo is on GitHub and the game is live** (https://github.com/ycgNem/slipstream-salvager, public; https://ycgnem.github.io/slipstream-salvager/). This replaces #24.
    *Why:* the owner asked for it to be committed, pushed and playable from a GitHub link (2026-10-12).
    It's public like Sprocket & Sprout and Last Watt, because GitHub Pages on a free plan needs a
    public repo. Pushing `main` deploys.

