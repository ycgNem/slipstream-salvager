# Slipstream Salvager (working title)

A pixel-art top-down action roguelike about a small, fast scrap robot that rips parts off enemies
with high-speed passes and bolts them onto itself. Your movement is your weapon: only a hit at full
speed does damage, and every part you bolt on changes how you move and attack.

This is the **first playable slice**: one arena, one enemy (the Rammer), one part (the Booster),
three waves. Art is code-drawn placeholder art until the gameplay loop is approved.

- **Play online:** https://ycgnem.github.io/slipstream-salvager/ (add `?debug` for the tuning panel and flat mode; press ` or F1 in play).
- **Play locally:** double-click `Play.bat` (or `npm run dev`).
- **Docs:** `PLAN.md` (the game), `ROADMAP.md` (milestones), `DECISIONS.md` (why), `STYLE.md` (art
  rules), `PROGRESS.md` (what's built), `HANDOFF.md` (how to run everything; read first).

TypeScript + Vite, one HTML canvas, no engine. Browser and Windows (Electron).
