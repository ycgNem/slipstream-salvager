# Slipstream Salvager (working title)

A pixel-art top-down action roguelike about a small, fast scrap robot that rips parts off enemies
with high-speed passes and bolts them onto itself. Your movement is your weapon: only a hit at full
speed does damage, and every part you bolt on changes how you move and attack.

This is **a short run**: six yards, about 15 minutes, ending in a boss, The Compactor, that you
take apart one move at a time. You pick your route by driving out through exit gates. There are
four enemies (the Rammer, the Snapper, the Hopper and the Bouncer, with variants), six parts on
three mounts (Booster, Jump Jets, Grip Treads, Springs, Plow, Jaws), terrain (boost strips, oil,
ramps, crusher plates), and three chassis to drive (the Scrapper, the Skiff and the Hauler, picked
in the Garage). Hull and parts carry from yard to yard. There's a daily run and a Log of what
you've met.

- **Play online:** https://ycgnem.github.io/slipstream-salvager/ (add `?debug` for the tuning panel and flat mode; press ` or F1 in play).
- **Play locally:** double-click `Play.bat` (or `npm run dev`).
- **Docs:** `PLAN.md` (the game), `ROADMAP.md` (milestones), `DECISIONS.md` (why), `STYLE.md` (art
  rules), `PROGRESS.md` (what's built), `HANDOFF.md` (how to run everything; read first), `CHANGELOG.md`
  (patch notes for players).

TypeScript + Vite, one HTML canvas, no engine. Browser and Windows (Electron).
