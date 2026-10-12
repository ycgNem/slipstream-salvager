# Slipstream Salvager (working title)

A pixel-art top-down action roguelike about a small, fast scrap robot that rips parts off enemies
with high-speed passes and bolts them onto itself. Your movement is your weapon: only a hit at full
speed does damage, and every part you bolt on changes how you move and attack.

This is **a short run**: five yards, about 10-15 minutes. You pick your route by driving out
through exit gates. There are two enemies (the Rammer and the Snapper, with plow and jaw variants)
and four parts on three mounts (Booster, Grip Treads, Plow, Jaws). Hull and parts carry from yard
to yard.

- **Play online:** https://ycgnem.github.io/slipstream-salvager/ (add `?debug` for the tuning panel and flat mode; press ` or F1 in play).
- **Play locally:** double-click `Play.bat` (or `npm run dev`).
- **Docs:** `PLAN.md` (the game), `ROADMAP.md` (milestones), `DECISIONS.md` (why), `STYLE.md` (art
  rules), `PROGRESS.md` (what's built), `HANDOFF.md` (how to run everything; read first), `CHANGELOG.md`
  (patch notes for players).

TypeScript + Vite, one HTML canvas, no engine. Browser and Windows (Electron).
