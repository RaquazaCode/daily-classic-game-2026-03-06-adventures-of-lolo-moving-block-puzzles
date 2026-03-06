import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = process.cwd();
const outDir = path.join(root, 'artifacts', 'playwright');
mkdirSync(outDir, { recursive: true });

const server = spawn('pnpm', ['dev', '--host', '127.0.0.1', '--port', '4173'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let ready = false;
const logs = [];
function collect(chunk) {
  const line = chunk.toString();
  logs.push(line);
  if (line.includes('http://127.0.0.1:4173')) ready = true;
}
server.stdout.on('data', collect);
server.stderr.on('data', collect);

async function waitReady(timeoutMs = 30000) {
  const start = Date.now();
  while (!ready) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('dev server did not become ready in time');
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

(async () => {
  try {
    await waitReady();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);

    await page.screenshot({ path: path.join(outDir, 'clip-01-opening.png'), fullPage: true });

    const start = await page.evaluate(() => JSON.parse(window.render_game_to_text()));

    await page.evaluate(() => {
      window.__lolo.debugCollectAllHearts();
      window.advanceTime(1000);
    });

    const afterHearts = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.screenshot({ path: path.join(outDir, 'clip-02-heart-collection.png'), fullPage: true });

    await page.evaluate(() => {
      const chest = window.__lolo.getState().chest;
      window.__lolo.debugSetPlayer(chest.x, chest.y);
      window.__lolo.move('left');
      window.__lolo.move('right');
      window.advanceTime(500);
    });

    const afterClear = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.screenshot({ path: path.join(outDir, 'clip-03-level-clear.png'), fullPage: true });

    const actionPayload = {
      buttons: ['left_mouse_button'],
      mouse_x: 220,
      mouse_y: 180,
      frames: 12,
    };

    writeFileSync(path.join(outDir, 'actions-opening.json'), JSON.stringify(actionPayload, null, 2));
    writeFileSync(path.join(outDir, 'render-start.json'), JSON.stringify(start, null, 2));
    writeFileSync(path.join(outDir, 'render-after-heart-collection.json'), JSON.stringify(afterHearts, null, 2));
    writeFileSync(path.join(outDir, 'render-after-level-clear.json'), JSON.stringify(afterClear, null, 2));
    writeFileSync(path.join(outDir, 'dev-server.log'), logs.join(''));

    await browser.close();
    server.kill('SIGTERM');
    console.log('playwright capture complete');
  } catch (error) {
    server.kill('SIGTERM');
    writeFileSync(path.join(outDir, 'dev-server.log'), logs.join(''));
    console.error(error);
    process.exit(1);
  }
})();
