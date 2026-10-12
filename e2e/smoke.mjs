// Smoke test: title -> Play -> drive with real key presses -> rip -> pause -> resume, with
// screenshots and zero console errors. Starts its own dev server unless BASE is set.
// Usage: node e2e/smoke.mjs
import { serve, launch, OUT } from './serve.mjs';

const srv = await serve();
const { browser, page, errors } = await launch();
const shot = (n) => page.screenshot({ path: `${OUT}/smoke-${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);
let failed = false;
const check = (ok, msg) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed = true;
};

try {
  await page.goto(srv.url);
  await page.waitForFunction(() => window.__app?.screen === 'title');
  await wait(400);
  await shot('01-title');

  // click Play (logical 260..380, 162..182): the Garage; then Start (260..380, 290..312) starts the run
  const geo = await page.evaluate(() => ({ zoom: window.__app.zoom, ox: window.__app.ox, oy: window.__app.oy, dpr: window.__app.dpr }));
  const at = (x, y) => [(geo.ox + x * geo.zoom) / geo.dpr, (geo.oy + y * geo.zoom) / geo.dpr];
  await page.mouse.click(...at(320, 172));
  await wait(300);
  check(await page.evaluate(() => window.__app.screen === 'garage'), 'Play opens the Garage');
  await shot('01b-garage');
  await page.mouse.click(...at(320, 301));
  await wait(300);
  check(await page.evaluate(() => window.__app.screen === 'play'), 'Start starts a run');

  // drive right for a second: should reach Slipstream
  await page.keyboard.down('KeyD');
  await wait(1100);
  const fast = await page.evaluate(() => window.__app.play.world.player.speed);
  check(fast >= 190, `holding D reaches Slipstream (speed ${fast.toFixed(0)})`);
  await shot('02-driving');
  await page.keyboard.press('Space');
  await wait(60);
  const ripped = await page.evaluate(() => window.__app.play.recent.some((e) => e.k === 'rip'));
  check(ripped, 'Space rips');
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyA');
  await wait(500);
  await page.keyboard.up('KeyA');
  await wait(2500);
  const rammers = await page.evaluate(() => window.__app.play.world.enemies.length);
  check(rammers >= 1, `wave 1 sends a Rammer in (${rammers})`);
  await shot('03-wave1');

  await page.keyboard.press('Escape');
  await wait(200);
  check(await page.evaluate(() => window.__app.play.paused), 'Esc pauses');
  await shot('04-pause');
  const t0 = await page.evaluate(() => window.__app.play.world.tick);
  await wait(300);
  check((await page.evaluate(() => window.__app.play.world.tick)) === t0, 'the sim stops while paused');
  await page.keyboard.press('Escape');
  await wait(200);
  check(!(await page.evaluate(() => window.__app.play.paused)), 'Esc resumes');

  // whole-number scaling only
  check(Number.isInteger(geo.zoom) && geo.zoom >= 1, `whole-number scale (x${geo.zoom})`);
  check(errors.length === 0, `no console errors${errors.length ? ':\n' + errors.join('\n') : ''}`);
} catch (e) {
  console.error(e);
  failed = true;
} finally {
  await browser.close();
  await srv.close();
}
process.exit(failed ? 1 : 0);
