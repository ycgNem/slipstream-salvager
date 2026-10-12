// Contact sheets for the code-drawn placeholder art (STYLE.md "Code-drawn placeholder rules").
//
//   node e2e/artsheet.mjs            -> e2e/out/artsheet.png (every sprite name at 3x, labelled,
//                                       with its anchor marked) and e2e/out/artsheet-dirs.png (the
//                                       Scrapper, the Rammer and the booster in all 8 directions at
//                                       4x, with the booster drawn at its rear mount on both bodies)
//   ONLY=pl:scrapper,part: SCALE=8 node e2e/artsheet.mjs
//                                    -> also e2e/out/artsheet-only.png: just names with those
//                                       prefixes, at SCALE (default 6)
//   ARENA=1 node e2e/artsheet.mjs    -> also e2e/out/artsheet-arena.png: a slice of the Ring at 3x
//   IMPORTED=1 node e2e/artsheet.mjs -> the same sheets with the imported art (src/art/) on top of
//                                       the code-drawn art, as the game draws it
//
// Fails (exit 1) if any name in allSpriteNames() came back as the missing-sprite placeholder, or
// if a sprite's size or anchor differs from spriteSpec().
import fs from 'node:fs';
import { serve, launch, OUT } from './serve.mjs';

const srv = await serve();
const { browser, page, errors } = await launch({ width: 1600, height: 1000 });
let failed = false;
try {
  // a blank page on the dev server's origin, so the modules import without starting the game
  await page.route('**/__artsheet__', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>artsheet</title><body></body>' }));
  await page.goto(srv.url + '__artsheet__');
  const res = await page.evaluate(async ([only, scaleOnly, arena, imported]) => {
    const art = await import('/src/render/art/code/index.ts');
    const atlas = await import('/src/render/atlas.ts');
    const namesMod = await import('/src/render/names.ts');
    const mounts = await import('/src/data/mounts.ts');
    const dirsMod = await import('/src/data/dirs.ts');
    const { sprite, drawSprite, codeDrawn } = atlas;
    art.registerCodeArt();
    if (imported) {
      (await import('/src/render/art/imported.ts')).registerImportedArt();
      await atlas.artReady();
    }

    const names = namesMod.allSpriteNames();
    const t0 = performance.now();
    const bad = [];
    const missing = sprite('__artsheet_missing__');
    const famMs = {};
    for (const n of names) {
      const t1 = performance.now();
      const s = sprite(n);
      const fam = n.split(':').slice(0, 2).join(':');
      famMs[fam] = (famMs[fam] ?? 0) + performance.now() - t1;
      const spec = namesMod.spriteSpec(n);
      if (s === missing || s.img === missing.img || (!imported && !codeDrawn.has(n))) bad.push(`${n}: missing (placeholder)`);
      else if (s.w !== spec.w || s.h !== spec.h || s.ox !== spec.ox || s.oy !== spec.oy)
        bad.push(`${n}: got ${s.w}x${s.h} @(${s.ox},${s.oy}), spec ${spec.w}x${spec.h} @(${spec.ox},${spec.oy})`);
    }
    const genMs = Math.round(performance.now() - t0);

    // ---- sheet 1: every name, grouped one family per row ----
    const group = (n) => {
      const parts = n.split(':').filter((p) => !/^\d+$/.test(p) && !dirsMod.DIRS.includes(p));
      // small single-frame things share a row per family (all walls, all gates, all shadows...)
      const short = ['t', 'ob', 'ui', 'pickup', 'icon'].includes(parts[0]) || ['fx:shadow', 'fx:plume'].includes(parts.slice(0, 2).join(':'));
      return (short ? parts.slice(0, 2) : parts).join(':');
    };
    function sheet(list0, S, maxW) {
      // stable sort by family, keeping each family's names in their listed order
      const order = new Map();
      for (const n of list0) if (!order.has(group(n))) order.set(group(n), order.size);
      const list = [...list0].sort((a, b) => order.get(group(a)) - order.get(group(b)));
      const pad = 6, labelH = 12, rows = [];
      let row = null, x = pad;
      for (const n of list) {
        const s = sprite(n);
        const cw = Math.max(s.w * S, n.length * 6) + pad;
        const g = group(n);
        if (!row || row.g !== g || x + cw > maxW) { row = { g, cells: [], h: 0 }; rows.push(row); x = pad; }
        row.cells.push({ n, s, x });
        row.h = Math.max(row.h, s.h * S + labelH + pad);
        x += cw;
      }
      const H = rows.reduce((a, r) => a + r.h, pad) + pad;
      const W = maxW;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#1d1620'; g.fillRect(0, 0, W, H);
      let y = pad;
      for (const r of rows) {
        for (const { n, s, x } of r.cells) {
          g.fillStyle = '#3e3546';
          g.fillRect(x, y, s.w * S, s.h * S);
          g.strokeStyle = '#5a4f66'; g.lineWidth = 1;
          g.strokeRect(x - 0.5, y - 0.5, s.w * S + 1, s.h * S + 1);
          g.drawImage(s.img, s.x, s.y, s.w, s.h, x, y, s.w * S, s.h * S);
          // anchor: a 1-px cross at the anchor point
          const ax = x + s.ox * S, ay = y + s.oy * S;
          g.fillStyle = '#00ffff';
          g.fillRect(ax - 3, ay, 7, 1);
          g.fillRect(ax, ay - 3, 1, 7);
          g.fillStyle = '#c7dcd0';
          g.font = '10px monospace';
          g.textBaseline = 'top';
          g.fillText(n, x, y + s.h * S + 2);
        }
        y += r.h;
      }
      return c.toDataURL('image/png');
    }
    const all = sheet(names, 3, 1900);
    const focus = only ? sheet(names.filter((n) => only.split(',').some((o) => n.startsWith(o))), scaleOnly, 1900) : null;

    // ---- sheet 2: bodies and the booster in all 8 directions, 4x, booster at the rear mount ----
    const S = 4, CW = 48, D = dirsMod.DIRS;
    const rowsDef = [
      { label: 'scrapper + booster', body: (d) => `pl:scrapper:drive:${d}:0`, dist: mounts.MOUNT_DIST.scrapper, part: true, shadow: 'fx:shadow:m' },
      { label: 'scrapper + booster + plume', body: (d) => `pl:scrapper:drive:${d}:1`, dist: mounts.MOUNT_DIST.scrapper, part: true, plume: true, shadow: 'fx:shadow:m' },
      { label: 'scrapper rip + slash (slip)', body: (d) => `pl:scrapper:rip:${d}:1`, slash: true, shadow: 'fx:shadow:m' },
      { label: 'scrapper bare', body: (d) => `pl:scrapper:drive:${d}:0`, shadow: 'fx:shadow:m' },
      { label: 'rammer + booster', body: (d) => `en:rammer:stalk:${d}:0`, dist: mounts.MOUNT_DIST.rammer, part: true, shadow: 'fx:shadow:l' },
      { label: 'rammer charge + booster + plume', body: (d) => `en:rammer:charge:${d}:0`, dist: mounts.MOUNT_DIST.rammer, part: true, plume: true, shadow: 'fx:shadow:l' },
      { label: 'rammer bare (stripped)', body: (d) => `en:rammer:stalk:${d}:0`, shadow: 'fx:shadow:l' },
      { label: 'booster alone', body: null, part: true, dist: 0 },
    ];
    const W = D.length * CW * S + 16, RH = CW * S;
    const H2 = rowsDef.length * (RH + 14) + 16;
    const c2 = document.createElement('canvas');
    c2.width = W; c2.height = H2;
    const g2 = c2.getContext('2d');
    g2.imageSmoothingEnabled = false;
    // floor tiles under everything (also shows how the floor tiles)
    const fl = document.createElement('canvas');
    fl.width = Math.ceil(W / S / 16) * 16; fl.height = Math.ceil(H2 / S / 16) * 16;
    const fg = fl.getContext('2d');
    for (let ty = 0; ty < fl.height / 16; ty++) for (let tx = 0; tx < fl.width / 16; tx++) {
      const v = ((tx * 7 + ty * 13 + ((tx * ty) % 5)) * 2654435761 >>> 0) % 4;
      const s = sprite(`t:floor:${v}`);
      fg.drawImage(s.img, s.x, s.y, 16, 16, tx * 16, ty * 16, 16, 16);
    }
    g2.drawImage(fl, 0, 0, fl.width * S, fl.height * S);
    rowsDef.forEach((r, ri) => {
      const y0 = 8 + ri * (RH + 14);
      g2.fillStyle = '#ffffff'; g2.font = '12px monospace'; g2.textBaseline = 'top';
      g2.fillText(r.label, 8, y0);
      D.forEach((dn, d) => {
        const cx = 8 + d * CW * S + (CW * S) / 2, cy = y0 + 14 + RH * 0.62;
        g2.fillStyle = '#ffffff'; g2.fillText(dn, cx - 6, y0 + 14);
        if (r.shadow) drawSprite(g2, sprite(r.shadow), cx, cy, S);
        const m = r.body ? mounts.rearMount(d, r.dist) : { dx: 0, dy: 0, behind: false };
        const mx = cx + m.dx * S, my = cy + m.dy * S;
        const partFirst = r.part && m.behind;
        const drawPart = () => {
          if (r.plume) drawSprite(g2, sprite(`fx:plume:${dn}:0`), mx, my, S);
          drawSprite(g2, sprite(`part:booster:${dn}`), mx, my, S);
        };
        if (partFirst) drawPart();
        if (r.body) drawSprite(g2, sprite(r.body(dn)), cx, cy, S);
        if (r.part && !partFirst) drawPart();
        if (r.slash) drawSprite(g2, sprite(`fx:slash:slip:${dn}:1`), cx, cy, S);
        if (r.body && r.body(dn).startsWith('pl:') && !r.slash) {
          // claw tip marker (where the renderer puts the tier glow)
          const tip = mounts.clawTip(dirsMod.dirAngle(d));
          g2.fillStyle = '#00ffff';
          g2.fillRect(cx + tip.dx * S + 1, cy + tip.dy * S + 1, 2, 2);
        }
      });
    });
    // ---- optional (ARENA=1): a small slice of the Ring, to judge the floor, walls and pillar together ----
    let arenaUrl = null;
    if (arena) {
      const TW = 22, TH = 13, AS = 3;
      const c3 = document.createElement('canvas');
      c3.width = TW * 16; c3.height = TH * 16;
      const g3 = c3.getContext('2d');
      const isWall = (x, y) => x < 0 || y < 0 || x >= TW || y >= TH || x === 0 || y === 0 || x === TW - 1 || y === TH - 1;
      for (let ty = 0; ty < TH; ty++) for (let tx = 0; tx < TW; tx++) {
        const v = ((tx * 7 + ty * 13 + ((tx * ty) % 5)) * 2654435761 >>> 0) % 4;
        let name = `t:floor:${v}`;
        if (isWall(tx, ty)) {
          const m = (isWall(tx, ty - 1) ? 1 : 0) | (isWall(tx + 1, ty) ? 2 : 0) | (isWall(tx, ty + 1) ? 4 : 0) | (isWall(tx - 1, ty) ? 8 : 0);
          name = `t:wall:${m}`;
        }
        drawSprite(g3, sprite(name), tx * 16, ty * 16);
      }
      // gates: top wall (h) and left wall (v), drawn over the wall tiles
      drawSprite(g3, sprite('ob:gate:h:closed'), 4 * 16, 0);
      drawSprite(g3, sprite('ob:gate:h:open'), 9 * 16, 0);
      drawSprite(g3, sprite('ob:gate:h:warn'), 14 * 16, 0);
      drawSprite(g3, sprite('ob:gate:v:closed'), 0, 3 * 16);
      drawSprite(g3, sprite('ob:gate:v:warn'), 0, 7 * 16);
      drawSprite(g3, sprite('ob:gate:v:open'), (TW - 1) * 16, 5 * 16);
      // a pillar and some actors
      drawSprite(g3, sprite('ob:pillar'), 10 * 16, 6 * 16);
      const actor = (body, shadow, x, y, d, dist) => {
        drawSprite(g3, sprite(shadow), x, y);
        const m = dist ? mounts.rearMount(d, dist) : null;
        const dn = dirsMod.DIRS[d];
        if (m && m.behind) drawSprite(g3, sprite(`part:booster:${dn}`), x + m.dx, y + m.dy);
        drawSprite(g3, sprite(body), x, y);
        if (m && !m.behind) drawSprite(g3, sprite(`part:booster:${dn}`), x + m.dx, y + m.dy);
      };
      actor('en:rammer:stalk:sw:0', 'fx:shadow:l', 80, 90, 3, 10);
      actor('en:rammer:windup:ne:0', 'fx:shadow:l', 270, 150, 7, 10);
      actor('pl:scrapper:drive:e:0', 'fx:shadow:m', 130, 160, 0, 7);
      actor('pl:scrapper:drive:nw:1', 'fx:shadow:m', 250, 70, 5, 0);
      drawSprite(g3, sprite('pickup:booster'), 210, 110);
      drawSprite(g3, sprite('fx:shadow:s'), 210, 112);
      drawSprite(g3, sprite('pickup:booster'), 210, 110);
      const big = document.createElement('canvas');
      big.width = c3.width * AS; big.height = c3.height * AS;
      const gb = big.getContext('2d');
      gb.imageSmoothingEnabled = false;
      gb.drawImage(c3, 0, 0, big.width, big.height);
      arenaUrl = big.toDataURL('image/png');
    }
    return { bad, genMs, famMs, count: names.length, all, focus, arena: arenaUrl, dirs: c2.toDataURL('image/png') };
  }, [process.env.ONLY ?? '', Number(process.env.SCALE ?? 6), !!process.env.ARENA, !!process.env.IMPORTED]);

  const save = (file, url) => fs.writeFileSync(`${OUT}/${file}`, Buffer.from(url.split(',')[1], 'base64'));
  save('artsheet.png', res.all);
  save('artsheet-dirs.png', res.dirs);
  if (res.focus) save('artsheet-only.png', res.focus);
  if (res.arena) save('artsheet-arena.png', res.arena);
  console.log(`${res.count} sprite names, generated in ${res.genMs} ms`);
  console.log('  by family (ms): ' + Object.entries(res.famMs).map(([k, v]) => `${k} ${Math.round(v)}`).join(', '));
  console.log(`wrote ${OUT}/artsheet.png and ${OUT}/artsheet-dirs.png${res.focus ? ` and ${OUT}/artsheet-only.png` : ''}`);
  if (res.bad.length) {
    failed = true;
    console.log(`\n${res.bad.length} bad sprite(s):`);
    for (const b of res.bad) console.log('  ' + b);
  }
  const errs = errors.filter((e) => !e.includes('missing sprite __artsheet_missing__'));
  if (errs.length) {
    console.log('\npage errors/warnings:');
    for (const e of errs) console.log('  ' + e);
  }
} catch (e) {
  failed = true;
  console.error(e);
  for (const er of errors) console.error('  ' + er);
} finally {
  await browser.close();
  await srv.close();
}
process.exit(failed ? 1 : 0);
