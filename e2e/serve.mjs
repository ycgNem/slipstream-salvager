// Shared by the e2e scripts: start the Vite dev server on a free port (or use BASE if it's set)
// and launch headless Chrome.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';

export const OUT = 'e2e/out';
fs.mkdirSync(OUT, { recursive: true });

export async function serve() {
  if (process.env.BASE) return { url: process.env.BASE, close: async () => {} };
  const server = await createServer({ server: { port: 0, host: '127.0.0.1', hmr: false }, logLevel: 'error', clearScreen: false });
  await server.listen();
  const { port } = server.httpServer.address();
  return { url: `http://127.0.0.1:${port}/`, close: () => server.close() };
}

export async function launch(viewport = { width: 1280, height: 720 }) {
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack}`));
  return { browser, page, errors };
}
