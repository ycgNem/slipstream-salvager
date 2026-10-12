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

*Milestone 2, tune the loop (2026-10-12). The owner played M1 and said "looks good, continue as
planned", with no notes. So M2 took the critic's open points from HANDOFF.md as defaults. Each one is
a number in the tuning panel, and the M1 rule is one setting away (given with each).*

55. **Hit zones and an armored front.** A Slipstream hit within 60° of an enemy's front glances off
    for 1, a side hit does 2, and a back hit tears the part off or, once the part is gone, does 4
    (enough to wreck a Rammer). *Why:* the critic's front-only bot cleared 34 of 40 runs against
    hit-and-run's 17, because hitting a Rammer head-on while it stalked did full damage. The tear and
    the charge-and-recover rhythm were optional. Now the decisive pass is the one from behind after a
    charge, and chipping at the front still works, slowly, so nobody gets stuck. The wave 1 safety
    net now shakes the booster loose after two hits at 1 HP (it was three) to make up for the slower
    damage. *M1 rule:* `frontDamage` 2, `rearDamage` 2.
56. **The joust.** A Slipstream Rip that meets a charge nose to nose (front zone, and your heading
    within 30° of head-on) does its 1, stops the charge dead and stuns the Rammer for 1.3 s with its
    back exposed. You pass through unhurt (as in M1). "JOUST!" in white, a slam and a big hit-stop.
    *Why:* the critic found the head-on Rip into a charge already won outright in a ~6-frame window,
    with no feedback. Kept as a skill move, with its own payoff (the stun opens its back), not cut.
    The 30° rule came from the camper bot, which got 56 jousts by accident with a front-zone-only
    check. *Off:* `joustDeg` 0.
57. **A tap with the Booster is a plain Rip.** Pressing Rip starts the rev, but for the first 0.15 s
    nothing locks (you steer and accelerate normally); let go inside that and you get the plain Rip.
    Held longer, the heading locks, the lane and the rev whine come in, and letting go launches the
    Burn. *Why:* a tap was an instant Burn locked for 0.43 s over ~106 px, worse than a Rip (#41;
    the critic). The new hint already said to hold. *M1 rule:* `burnTapTime` 0.
58. **Parts are knocked loose, not shattered.** A hit knocks your bolted part off to the side of the
    hit, cracked, onto the floor. Tow it and bolt it again; a cracked part that takes a second hit
    shatters. A charging Rammer that runs over a loose part crushes it. *Why:* the critic measured the
    Booster on for only 10-27% of fight time, because the first hit destroyed it, so a player barely
    got to use the part the slice is about. Getting it back is a movement task (a loose part in a
    busy arena), not a free refill: you lose the part's behavior until you've towed it and spent
    0.7 s bolting. This revises #15 and Q6. *M1 rule:* `partLives` 1.
59. **A stripped Rammer limps and turns slowly** (2.5 rad/s instead of 6) and shoves within 140 px
    (was 90). *Why:* with an armored front, a stripped Rammer that turned to face you as fast as ever
    and rarely attacked was a stalemate: the bots circled it forever. Now a fast circle gets round
    its front, and it attacks often enough to open its back.
60. **The booster glints when the back is open.** While a Rammer is locked, charging, skidding or
    stunned, its booster gets a blinking gold outline. *Why:* the critic found the tear target (a
    ~3 px nozzle) hard to read at 1x; gold is the salvage color, so it says "take this now".
61. **The slipstream.** A Rammer's charge that passes within 16 px of you (edge to edge) without
    hitting you lifts you to at least Slipstream + 30 (220 px/s), once per charge: "SLIPSTREAM!" in
    teal, wind lines and the Slipstream sound. *Why:* with the decisive hit now from behind, the
    natural counter is to dodge and chase the tail, but a dodge left you too slow to strike before
    the skid ended (the bots were under Cruise at the start of 2 skids in 3). The game is named for
    this: a close dodge pays you in speed. Dodging wide is still safe. *Off:* `draftGap` 0.
62. **Coasting stays as it was.** The critic suggested a 0.6 s half-life above Cruise; it's a feel
    call with no playtest behind it, and #29 set 0.3 deliberately ("responsive, not Asteroids"). Left
    for the owner's tuning panel.
63. **The bots and guards after #55-#61.** Hit-and-run now aims behind a committed Rammer, only cuts
    in on a stalking one whose flank is turned, chases the tail of a charge that has gone past, and
    goes back for parts on the floor. The full-slice guard runs 600 s instead of 300 (fights take more
    passes now). Measured over 40 seeds at 600 s: hit-and-run clears 15 (dealing 152-164 of its damage
    from behind), the camper 3. Wave 1: hit-and-run clears 6 of 8, 0.6 hits taken per run. The bot
    is weaker than a person at getting behind a Rammer; the guards compare strategies, they don't
    measure difficulty.

*Milestone 3, a short run (2026-10-12; PLAN.md section 8).*

64. **The M3 plan.** Five yards (The Ring first, The Heap last, three of four middle yards chosen on
    the way), three mounts each tied to one verb (rear: acceleration, sides: turning, front: contact),
    one new enemy (the Snapper, with a Jaw variant) and three new parts (Grip Treads, Plow, Jaws),
    plus the Plow Rammer. **The next yard is chosen by driving out through one of two exit gates**,
    each signed with the yard's name and the part it carries. *Why:* "a run of arenas" with build
    variety (the RoR2 reference) needs a choice of salvage, and making the choice a drive-through
    keeps the robot moving (pillar 1) instead of stopping at a menu. Each new part changes a verb and
    comes off an enemy that visibly moves that way (pillar 3). Escalation is the number of enemies by
    depth, never a clock (#22). Not in M3: a boss, currency, shops, meta-progression.
65. **The art tool is the pixel-art-studio skill**, not SpriteCook (#20). Every sprite is drawn by a
    deterministic build script (`pixel-art/<family>/build.py`, Resurrect 64, Pillow), exported and
    packed through the existing import script into `src/art/`, and registered by name by the new
    `src/render/art/imported.ts`. *Why:* the owner asked for it (2026-10-12). A build script can be
    rerun and edited, so the art stays exact and on the palette, and nothing costs credits.
66. **How the mounts and parts are built.** Enemies are data (`kind` plus parts on the same three
    mounts as yours), and one rule tears any part: a Slipstream hit on the zone where it sits (back:
    rear, side: the treads, front: the front part), except the Plow, which only comes off in a joust.
    A hit on you knocks off the part on the side it came from (else the next in the order sides,
    rear, front). Every part's behavior is a flag the sim checks (`attack: burn`, `brake: slide`,
    `contact: plow`, `onHit: latch`), so flat mode switches them all off in one place (#50).
67. **The Jaws whip you once round and fling you back out the way you came** (0.2 s, +40 px/s),
    rather than a half-turn that left you on the far side facing back in. *Why:* a 180° orbit ends
    with you heading straight back into the enemy you just bit. The full whip makes the Jaws a
    rebound: hit and come back out, faster, so a pass never leaves you in the middle of a pack.
68. **The Plow blocks a charge or snap that meets your front** (within 50° of your heading): the
    attacker is stunned as in a joust, you're knocked back, nothing is lost. On a Plow Rammer the
    plowed front takes no damage at all ("CLANG! JOUST IT").
69. **Snappers circle you between snaps.** Close in and unable to snap (cooling down, or two already
    winding up), a Snapper circles ~72 px out, each its own way round, side on to you; it only
    bump-snaps when its cooldown is ready. Snap windup 0.45 s (0.25 tracking, 0.2 locked), cooldown
    1.5-2.5 s, top speed 170, snap range 64. *Why:* the first version drove straight into you, every
    bump started a point-blank snap you couldn't dodge, and a pack of three killed both bots in 15-60
    s. Circling also shows its side, which is where the treads come off.
70. **Rammer HP 3** (was 4). Front 1, side 2, back 4 (or the tear). *Why:* with the armored front
    (#55), The Ring's six Rammers took the bots 250-400 s; a side hit plus any other hit now wrecks
    one, and the back still wrecks it in one pass. The wave 1 safety net now holds after one side
    hit and shakes the booster loose two hits later.
71. **The slipstream is easier to catch: 24 px edge to edge** (was 16), still once per charge.
72. **Between yards you drive in through the gate opposite the one you left by, still moving**
    (150 px/s), so the run never stops (pillar 1). Enemies keep coming in through the gates farthest
    from you. The exits are the side gates (one exit, the east gate, before The Heap). While a cleared
    yard's exits are open, their stretch of wall lets you through.
73. **Placeholder art for the M3 sprites is code-drawn** with the same sculptor as the slice
    (`src/render/art/code/m3.ts`), at the final names and sizes, so the game never shows a missing
    sprite while the pixel-art-studio sheets (#65) are drawn.
74. **The drafter bot, and what the run test checks.** `drafterBot` plays the loop the M2 rules
    are built round: bait a Rammer, step just out of the locked lane, catch the slipstream, chase
    the tail, hit the back; kite Snappers at Slipstream and cut in when one slides. The bots are much
    weaker than a person in crowds, so the run test checks the sim (no NaNs, nobody leaves the arena,
    every exit works, damage gets dealt), not difficulty. Difficulty is the critic's and the owner's
    call.
75. **Dev conveniences:** `?yard=kennel` (in debug builds) starts a run in that yard; the tuning
    panel's START WITH row bolts any part on for the whole run.
76. **M4, the art overhaul, family by family.** Two art agents worked with the pixel-art-studio
    skill, one on the environment and one on the robots and parts. Each family went in only if it
    beat its placeholder at 1x in play (STYLE.md "The art overhaul").
    - **Imported:**
      - The floor: fine grit, no per-tile feature, so no 16 px lattice.
      - The walls: chamfered barrier blocks.
      - The pillar, post and tower: olive scrap skips heaped with junk.
      - The gates: olive slatted doors; red chevrons and lamps when they warn, a dark passage when
        open.
      - Dust, steam, smoke and sparks.
      - The Snapper, the three new parts and their pickups.
      - The four part icons, drawn as one set.
    - **Kept:** the Scrapper, the Rammer, the booster, the plume, the slash, stars, shadows and the
      hull pips, all from the code sculptor.
    - Smoke moved to plum 0/2/6 (1/2/5 was invisible on the floor).
    - Obstacles rise 8 px above their footprint, with a 12 px front face. A literal "8 px top face"
      would give the tower a 48 px front wall.
    - *Why:* the new floor and skips read as a scrapyard. The old floor read as bricks with a
      repeated olive mark.
77. **Fixes the art pass turned up:**
    - The bottom wall row is drawn flush with the bottom edge, on its collision (it was 8 px low,
      under the south gate).
    - The background re-renders once the imported sheets load.
    - Sprites pre-warm after the sheets load. An imported-only name draws blank while its sheet
      loads, instead of as missing.
    - The Snapper's jaws follow its head on the snap, windup and stun.
78. **Fixes from the M3 visual QA:**
    - **The exit signs are painted on the floor**, under bodies, parts and texts. Before, they hid
      the player and loose parts.
    - **Floating texts stack:** a second text at the same spot goes above or below the first.
      They stay clear of the wall bands, the HUD and the screen edges, and the overlap audit now
      sees them and the banner.
    - **Damaged enemies crackle relative to their own max HP:** slowly once hurt, fast at 1 HP. A
      full-health Snapper crackled before, because its max is 2.
    - **The wipe:** it holds still while the screen is frozen. The HUD, hints and signs hide while
      the cover is full, and the yard name is white (gold is for salvage).
    - **A crack is a white zigzag with an ink edge,** so it shows on gold and dark steel. The
      results' build icons show it too.
    - **The tear glint is a white outline;** gold on gold didn't show.
    - **Side parts:** facing east or west, the near track is drawn over the body.
    - **The claw's tier ring** moves to the front edge of a Plow or Jaws and gets an ink edge.
    - **The screenshot scenes don't write to the best record,** and a run counts on its first tick.
    - "SCRAPPED" is lilac, not danger red.
79. **Fixes from the critic's M3 review.** It measured with a search bot that tries 52 input plans
    every 0.1 s, with a human reaction delay. That bot is a skill ceiling, not a person. The fixes
    marked "verified" were tested by the critic in a patched copy, then re-checked with its scripts
    after landing.
    - **Rammers no longer stall at corners** (verified: 0 stalls in 2,042 placements, all six
      layouts).
      - Before, they never reached a hidden player in 54% of Long Lanes placements and 60% of
        Jaw Yard ones.
      - A corner that can't see you now costs +150.
      - A corner goal is kept inside the walls.
      - Arrival counts at 8 px.
    - **A Snapper's treads tear from the back as well as the side** when its rear mount is empty.
      - *Why:* back hits wrecked it (4 against HP 2), so the Kennel and Jaw Yard handed out almost
        no parts: 21 of 28 hits wrecked a Snapper still wearing its treads.
      - Tears in the Kennel went from 0-4 to 7-9.
    - **A charge runs 120 px past where you were when its lane locked**, within 220-340 px
      (`chargeOver`, `chargeMin`, `chargeMax`). The lane shows the real length.
      - *Why:* the flat 260 px charge stopped too close to you after a far launch. The counter-pass
        tore 0 of 84 times from 190-220 px out; now it's 210 of 210 at every distance.
      - The critic's floor was 160. At 120 seeds, 160 let the pillar camper clear 41 against
        hit-and-run's 59: short charges end by its pillar. A 220 floor gives 27 against 76.
    - **Loose parts are pushed out of pillars, low walls and blocks** (5 of 156 had landed out of
      reach; 0 now).
    - **The Jaws:**
      - Another enemy's lunge can hit you mid-swing; the one you're biting can't.
      - A joust doesn't bite: you go on to the stunned enemy's open back.
      - PLAN 8.4 now says what the code does: a full turn round the enemy, not 180°.
    - **The Plow:** run-up acceleration ×0.65 (was 0.8), and a ram has the Rip's 0.45 s cooldown.
      *Why:* a ram had no button, no cooldown and no commitment, and its weakness was barely felt.
    - **Long Lanes:** each wall has a 64 px gap in the middle, so the lanes join. The middle
      corridor with Rammers at both ends was where players got pinned.
    - **Exit signs** name the parts in text and show the size of the yard's last wave at that
      depth. *Why:* the icons mean nothing before you've met a part, and the yards' difficulty
      didn't show.
    - **Not changed:** Rammer HP, armor, skid time and the draft gap. The search bot clears every
      yard in 30-60 s with almost no hits, so the numbers aren't the problem; the rule bots are
      weaker than a person (#63, #74).
    - **PLAN 8.3** now says the Snapper punishes stopping and braking, not loops. Measured: a
      pillar loop is safe from it, because its snap needs a clear line.
    - **Left for the owner:** whether the Snapper's post-snap slide should be a real opening. The
      critic got the side showing 52-82% of the time with a 2.5 rad/s slide turn and a 0.9 s
      slide, but no chase reached it. Flat mode is *easier* for a skilled player, so the A/B
      question is "which was more fun", not "which was harder".
80. **The final visual QA pass** (on the 0.2.0 build).
    - **Exit signs:**
      - Their layout is a pure function (`src/ui/signs.ts`), at most 96 px wide. The Heap's says
        "ALL FOUR PARTS".
      - A sign sits 4 px below its gate.
      - A test checks that no sign, in any yard, at any depth, to any destination, covers a wall,
        block or post. Before, the Heap's sign hid part of a Long Lanes wall, and Jaw Yard's signs
        covered its blocks.
    - **Floating texts:** they keep off the signs, and when every slot is taken, the older texts
      at that spot make way.
    - **The side gates:** they sit on the 16 px wall grid (160-192), so no sliver of wall shows.
      Their spawns stay at y 180. *Why:* with spawns at 176, the pillar camper cleared 68 of 160
      seeds against 35; hit-and-run was unchanged at 97.
    - **The tier on entry:** you enter a yard with the tier set for your speed, so the gauge
      doesn't say CRAWL at 150.
    - **The treads:** the near tread guard is drawn over the body on the diagonals too (it nearly
      vanished under the Scrapper), and a cracked one shows its crack on that guard.
    - **SCRAPPED is mist,** brighter than lilac on the panel.
    - **Left for the art's next pass:**
      - A Plow Rammer facing east or west shows two small gold blocks, one at each end. A broader
        blade would separate front from back.
      - A Jaw Snapper on a diagonal is four similar gold pieces.
81. **0.2.0 is published** (2026-10-12; the owner: "commit and push live").
    - `main` was fast-forwarded to `works` and both pushed. The Pages workflow tests, builds and
      deploys.
    - The service worker cache is `salvager-v2`, so players who already had 0.1.0 open get the new
      build after a reload.
    - The Windows builds stay local in `release/`. Uploading them to a GitHub release is a separate
      call for the owner.
    - The push didn't start the Pages workflow, so it was started by hand (`gh workflow run
      deploy.yml --ref main`, run 38282185933, success). The live bundle has "0.2.0" and the
      service worker is `salvager-v2`.

82. **The expansion plan, M6-M9** (2026-10-12; the owner after 0.2.0: "looks good get started on
    next milestones so we can make this game more expansive"). PLAN.md section 9, ROADMAP section 6.
    - **M6:** two enemies and two parts, so the rear and side mounts each have a second choice. The
      Hopper (it leaps over cover and slams where it lands) gives the Jump Jets (hold Rip to crouch,
      let go to leap over everything; the landing is a hit by zone). The Bouncer (rolls that
      ricochet and speed up) gives the Springs (walls bounce you off at speed).
    - **M7:** terrain that changes how every body moves (boost strips, oil, ramps, crusher plates).
    - **M8:** a boss you take apart, The Compactor; its parts are its moves.
    - **M9:** the Garage: chassis as movement models, unlocks of variety (never power), a log, a
      daily seed.
    - *Why:* "more expansive" read as more build variety (RoR2, the plan's feel reference), more
      yards that play differently, a climax and reasons to replay, each held to the removal test.
      A scrolling camera, currency, shops and stat upgrades stay out.
    - Each milestone's new sprites are code-drawn first, then drawn with pixel-art-studio in
      background agents while the next milestone is built. Publishing 0.3.0 waits for the owner.
83. **The Hopper, as built** (PLAN.md 9.1).
    - It leaps at you from 44-220 px: a 0.6 s crouch with a red ring (radius 28) that leads you like
      the Rammer's lane, then locks; 0.55 s in the air, over obstacles, untouchable; a slam in the
      ring; stuck 1.3 s. Closer than 44 px, or bumped, it stomps where it stands (ring 34).
    - **The shockwave** (new): a slam that only just misses you (within 24 px of the ring) lifts you
      to Slipstream, like the Rammer's slipstream (#61).
    - *Why:* the search bot (`scripts/pacing/`) dodged every ring but almost never got a pass in:
      a dodged slam left it slow and heading away, and The Hurdles timed out on 2 of 4 seeds with
      0% of the time at Slipstream. With the shockwave, a 1.3 s stuck window and 1.6-2.6 s between
      leaps, it clears 6 of 6 in about 64 s (the Ring: ~50 s), 9-23 shockwaves a yard.
    - The stomp's trigger is 44 px, not PLAN's first 70: a 30 px ring round itself could never
      reach a player 70 px away.
84. **The Jump Jets, as built** (PLAN.md 9.1).
    - The rear mount's second choice: they replace what holding Rip does, like the Booster. A tap
      is a plain Rip. Held: crouched, speed held, steering ×0.5, a teal ring where you'll land.
      Let go: 0.4 s in the air along your heading (at least 120 px/s), untouchable, over pillars and
      low walls; the ring wall still stops you (you slide along it).
    - The landing is a hit at the tier you leapt at, on every enemy within 24 px (plus its radius),
      by the zone you land on, so landing behind a Rammer tears its booster. Then 0.25 s stuck and
      15% of your speed gone; no leap or Rip for 0.5 s after.
    - Code: `p.air` and `p.recoil` on the player; airborne bodies skip contacts, hits, aim assist,
      slams and pickups (`airborne()` for enemies). The leap's release tick doesn't steer.
85. **The Bouncer, the Springs and the Spring Rammer, as built** (PLAN.md 9.2).
    - The Bouncer winds up 0.6 s (a lane to the first wall plus the first bounce's 60 px stub, from
      `reflectAt`), rolls at 230, +30 a bounce up to 330, slows after 3 bounces or 2.4 s and is
      dizzy 0.9 s. A roll is a lunge while it's faster than 80 px/s.
    - Springs on you: a head-on wall or pillar hit reflects you at full speed +25 (no clank, and a
      Rip, rev or Burn keeps going; no wall stun); an enemy bump keeps all your speed. Weakness:
      turning ×0.85 at speed, turn scrub from ×0.8 the pull. The route test: pushing on into walls
      holds Slipstream over 60% of the time with Springs, far less without.
    - Springs on a Rammer: its charge bounces once. On a Bouncer: every bounce. Bumping a Bouncer
      starts its roll, like the others' bump reactions.
86. **M6's yards and the run.**
    - **The Hurdles:** ten 48×16 low walls in three staggered rows; the gate lanes, the middle and
      the sign areas are open. **The Pinball:** a diamond of four pillars and four corner posts.
    - The middle pool is six yards; a run still visits three. The Heap's first wave has a Hopper,
      its last a Spring Rammer and a Bouncer; its sign says "ALL SIX PARTS" with the icons packed
      at 16 px so it stays within 104 px.
    - The tuning panel's START WITH row has six 3-letter buttons.
    - The search bot (`scripts/pacing/mpc.ts`) now clones the leap and counts a landed Hopper as
      open.
87. **M7, terrain, as built** (PLAN.md 9.4).
    - Terrain is data: `floor` on an arena, patches on the 16 px grid (`boost` and `ramp` point one
      of four ways; a `crusher` has a phase). `src/sim/terrain.ts` runs it; oil lives in steering
      (`body.ts`) and in the enemies' movement (`enemies.ts`).
    - **Boost strips:** within 60° of the arrow you're held at 250 px/s or more while on it (a
      hunting Snapper 220, a rolling Bouncer 300). One whoosh as you hit it.
    - **Oil:** no steering, thrust or brake, coasting with a 3 s half-life. The Booster's rev
      pushes, a Rip lunges and the Jump Jets leap. On oil a stalking or hunting enemy can't turn,
      and a skid or shove slides twice as far.
    - **Ramps:** at Cruise or faster within 45° of the arrow: 0.35 s in the air (the leap's rules:
      over everything, untouchable), a clean landing. With the Jump Jets on, the landing is theirs.
    - **Crusher plates:** a 3 s beat from the tick count: 0.8 s warning (flashing red), the slam,
      0.3 s down. You on it: a hit. An enemy on it: 2 damage (it goes through the wave 1 safety
      net like any damage). Airborne bodies are safe; loose parts on it are crushed.
    - *Why these four:* each one is a line (a fast lane, a commitment, a jump, a beat to lure into),
      so the removal test holds: without momentum none of them would matter.
88. **M7's yards.** The Slick (an oil lake, a clockwise racetrack of boost strips, Snappers), The
    Jumps (two low walls with a ramp each side, Rammers and Hoppers) and The Press (six plates on
    staggered beats, Plow Rammers). The middle pool is nine. The search bot clears each on every
    seed (the Slick ~35 s at 60% Slipstream, the Press ~47 s, the Jumps ~71 s). A two-part exit
    sign uses short names ("TREADS + BOOSTER"), so it stays within 104 px.
89. **Fixes from the M6 visual QA.**
    - The Hopper's ring stays on the floor (locked, flashing) through its whole flight, not only the
      crouch: the flight is when you dodge it.
    - A Spring Rammer's lane shows its bounce stub for the rest of its charge, like a Bouncer's.
      Stubs are dim and dashed, so a near head-on bounce doesn't tangle with the lane.
    - Your landing ring is where you'll really come down: inside the ring wall and off obstacles,
      while crouched and in the air.
    - No afterimages while you're in the air (they stayed on the floor under the lifted body).
    - The Springs: bigger coils set further out on the Scrapper, and a wide pair
      (`part:bigsprings`) on a Rammer, whose hull hid the normal pair facing north or south.
    - A crouching Hopper sits lower and wider and shakes for its whole windup.
    - No speed blue on the Bouncer's visor. The tuning panel underlines the START WITH parts that
      are on, in gold.
90. **M8, The Compactor, as built** (PLAN.md 9.5).
    - A fifth enemy kind, `compactor` (`src/sim/compactor.ts`), wearing Booster, Springs and Plow.
      Each part is a move: the Booster its charge (a Rammer's lane at 40 px wide and 300 px/s,
      locked 0.4 s), the Springs bounce that charge off walls and pillars twice, the Plow makes its
      front take nothing. Without the Booster it shoves; without the Springs a charge into a wall
      stuns it 1.8 s; with nothing left its core is open and it leaps like a Hopper (ring 44).
    - The Hopper's leap became shared code (`hopper.ts` `stepLeap`, `leapSpec`), flagged by a new
      `leap` on the enemy so a crouch can't be confused with a charge's windup.
    - Its charge ploughs through other enemies (they recoil, it doesn't), its slipstream lifts you
      like a Rammer's, and every 16 s it calls a Snapper in through the farthest gate if fewer than
      two others are in the yard.
    - **HP 18, not the plan's 12.** With 12 the search bot wrecked it in ~30 s, quicker than The
      Ring (50 s) or The Heap (60 s); hull barely moved the strip phase (plow by joust ~11 s,
      springs ~13 s, booster 16-32 s) but stretches the core-open act. At 18: 35-38 s for the bot,
      every seed, about two minutes for a person.
    - The yard (`FOUNDRY`, "THE COMPACTOR"): two pillars to bounce it off, a crusher plate in each
      corner. The run is six yards: The Heap's one exit leads to it; clearing it wins.
    - Its art is code-drawn at 2 px per unit (`m8.ts`); its parts are the small parts' models at
      2x, so the booster you tear off it is the booster you bolt on. A boss bar sits on the top
      wall band left of the north gate. A first-time hint: "EACH PART IS ONE OF ITS MOVES".
91. **The critic's M6 review** (the agent's report, 2026-10-12). Fixed with M8: a Spring Rammer's
    bounce count now resets every windup (it only ever bounced once), and nothing lifts you in the
    air, a charge's slipstream included. The rest (Bouncers parking and cancelling each other,
    holding Rip with Springs + Booster, the Hopper's ring missing a fast straight line, the
    Bouncer dying fastest head-on, a leap landing behind anything, a standing leap making speed,
    the new yards playing alike, the new parts being sidegrades) is the next phase, 8b.
92. **M8b: the rest of the critic's M6 review** (DECISIONS #91).
    - **The rev has a limit** (`revMax` 1.0 s, then the Burn launches itself), and with Springs a
      wall bounce mid-rev launches it along the new line (the bank shot is one Burn). The critic's
      hold-Rip bot (Springs + Booster, never aims) cleared The Ring and Jaw Yard unhit; now it
      clears 0 of 6 Pinballs and is scrapped in 5.
    - **A lunge your rip only shoved or clanked off still hits you**; only one your rip went
      through at Slipstream (or the one you're biting) can't. Revving into a charge's side at a
      crawl no longer makes you unhittable.
    - **Leaps strike the zone you came from** (your heading against its facing), not where you
      land: the ring is no longer a reticle that goes round every front and plow. A standing hop's
      landing is at the tier you really had (`leapMin` 120 -> 40). The Jaws don't bite on a landing,
      so the landing's stick stays. Landing on a solid puts you at its edge along your line, never
      round its side.
    - **Leaps lead you fully** (`leapLead` 1.0, the Hopper's and the core-open Compactor's), so a
      steady straight line is always under the ring and only a juke clears it; the shockwave band
      is 12 px past the hit (was ~24), so a lift is for a tight dodge, not a fast line.
    - **Bouncers keep about 140 px off** (backing away if you close in, coming round a pillar to see
      you) and won't start a roll with another enemy in its first 70 px, so two no longer park at
      your side and roll into each other. A guard test parks a player at every yard's start for a
      minute: every yard hits it (the Pinball used to hit it 0 times). Its front clangs unless you
      joust its roll (head-on was its quickest death); HP stays 2. (HP 3 was tried: it only made
      every route longer.)
    - **Springs:** a head-on bounce keeps 90% of your speed with no kick (was 100% + 25), so the
      walls still turn you but it costs something.
    - **The Hurdles** are two long low walls splitting the yard into three lanes (32-48 px gaps at
      their ends and middle), so going round costs distance and a leap is the shortcut. **The
      Pinball** is four facing low walls round a pillar bumper (a first try, longer walls and no
      pillar, was slower for every loadout). In the critic's layout probe
      (`scripts/pacing/layout.ts`, its own waves, 8 seeds) the Pinball takes 70 s with Springs,
      67 s with the Grip Treads and 78 s bare: the Springs help, but the Treads still edge them.
      The search bot puts the Hurdles at 69-74 s and the Pinball at ~80 s, the longest middle
      yards: watch both in playtesting.
    - The search bots can't show what a shortcut is worth: even with the critic's leap plans
      (`scripts/pacing/hleap.ts`) the bot is slower with the Jets, because its value only looks a
      moment ahead. Judge the Jets in the Hurdles by play, not by the bot.
