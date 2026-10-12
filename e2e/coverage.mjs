// Sprite coverage: every name the game can ask for (src/render/names.ts) must have art. Prints how
// many come from imported sheets vs code-drawn placeholders, per family, and fails if any name has
// neither or its size/anchor differs from STYLE.md (spriteSpec). Writes e2e/out/coverage.json.
// Usage: node e2e/coverage.mjs [--list family]
import fs from 'node:fs';
import { serve, launch, OUT } from './serve.mjs';

const listFam = process.argv.includes('--list') ? process.argv[process.argv.indexOf('--list') + 1] : null;
const srv = await serve();
const { browser, page } = await launch();
let res;
try {
  await page.goto(srv.url);
  await page.waitForFunction(() => window.__app?.screen);
  res = await page.evaluate(async () => {
    // the module instances the app loaded
    const mod = (p) => import(performance.getEntriesByType('resource').map((r) => r.name).find((n) => new URL(n).pathname === p) ?? p);
    const A = await mod('/src/render/atlas.ts');
    const N = await mod('/src/render/names.ts');
    await A.artReady();
    const fam = {};
    for (const name of N.allSpriteNames()) {
      const f = name.split(':').slice(0, 2).join(':');
      const e = (fam[f] ??= { total: 0, imported: 0, code: 0, missing: [], wrong: [] });
      e.total++;
      if (!A.hasSprite(name) && !A.hasImage(name)) { e.missing.push(name); continue; }
      const s = A.sprite(name), spec = N.spriteSpec(name);
      if (s.w !== spec.w || s.h !== spec.h || s.ox !== spec.ox || s.oy !== spec.oy) e.wrong.push(`${name} ${s.w}x${s.h}@${s.ox},${s.oy} (want ${spec.w}x${spec.h}@${spec.ox},${spec.oy})`);
      if (A.hasImage(name)) e.imported++;
      else e.code++;
    }
    return fam;
  });
} finally {
  await browser.close();
  await srv.close();
}
fs.writeFileSync(`${OUT}/coverage.json`, JSON.stringify(res, null, 2));
let missing = 0, wrong = 0, total = 0, imported = 0;
for (const [f, e] of Object.entries(res)) {
  total += e.total;
  imported += e.imported;
  missing += e.missing.length;
  wrong += e.wrong.length;
  console.log(`${f.padEnd(16)} ${String(e.total).padStart(4)}  imported ${String(e.imported).padStart(4)}  code-drawn ${String(e.code).padStart(4)}${e.missing.length ? `  MISSING ${e.missing.length}` : ''}${e.wrong.length ? `  WRONG SIZE ${e.wrong.length}` : ''}`);
  if (listFam === f || e.missing.length || e.wrong.length) for (const n of [...e.missing, ...e.wrong]) console.log('   ' + n);
}
console.log(`\n${total} names: ${imported} imported, ${total - imported - missing} code-drawn, ${missing} missing, ${wrong} wrong size.`);
process.exit(missing || wrong ? 1 : 0);
