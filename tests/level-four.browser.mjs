import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { build, preview } from 'vite';

const outDir = await mkdtemp(join(tmpdir(), 'towing-level-four-'));
let server;
let browser;

try {
  await build({ base: '/', build: { outDir, emptyOutDir: true } });
  server = await preview({ base: '/', build: { outDir }, preview: { host: '127.0.0.1', port: 0 } });
  browser = await chromium.launch({
    executablePath: process.env.TOWING_CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 650 }, deviceScaleFactor: 0.45 });
  page.setDefaultTimeout(35000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.addInitScript(() => {
    // Accelerate the animation clock during held winch inputs. Physics still uses its
    // normal fixed-step loop and all controls go through the rendered UI.
    // Skip GPU draw calls during accelerated winching so software rendering
    // on a test runner doesn't dominate how quickly frames can advance.
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const prototype = WebGL2RenderingContext.prototype;
      const draw = prototype[name];
      prototype[name] = function (...args) {
        if (!window.testClockFactor) return draw.apply(this, args);
      };
    }
    const request = window.requestAnimationFrame.bind(window);
    let previous;
    let time;
    window.requestAnimationFrame = callback => request(now => {
      if (now !== previous) {
        time = time === undefined ? now : time + (now - previous) * (window.testClockFactor ?? 1);
        previous = now;
      }
      callback(time);
    });
  });

  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?level=4`);
  const panel = page.locator('.single-line-menu');
  const button = name => panel.getByRole('button', { name, exact: true });
  await page.getByText(/Right the overturned truck/).waitFor();
  assert.match(await page.locator('.mission').innerText(), /ENGINE 0\/3 · WINCH 0\/3/);

  if (!await page.locator('.game-minimap svg').count()) {
    await page.locator('.game-minimap button').click();
  }
  await page.keyboard.down('w');
  try {
    await page.waitForFunction(() => {
      const marker = document.querySelector('.game-minimap svg g:last-of-type');
      return Number(marker?.getAttribute('transform').match(/,([^)]*)/)?.[1]) < 52.5;
    });
    await page.keyboard.down('d');
    await page.waitForFunction(() => {
      const marker = document.querySelector('.game-minimap svg g:last-of-type');
      return Number(marker?.getAttribute('transform').match(/rotate\(([^)]*)/)?.[1]) < -76;
    });
  } finally {
    await page.keyboard.up('d');
    await page.keyboard.up('w');
  }

  await button('PARK BRAKE').click();
  await page.waitForFunction(() => Number(document.querySelector('.speed b').textContent) === 0);
  await button('RIGGERS DEPLOY').click();
  await button('RIGGERS RETRACT').waitFor();
  await page.getByLabel('Line A attachment point').selectOption({ label: 'UPPER FRAME' });
  await button('1:1 LINE').click();
  await button('CONNECT').click();
  await button('UNHOOK').waitFor();
  await button('LINE B').click();
  await page.getByLabel('Line B attachment point').selectOption({ label: 'RIGHT EYE' });
  await button('DIRECT LINE').click();
  await button('GROUND ANCHOR').click();
  await button('TREE ANCHOR').waitFor();
  await button('CONNECT').click();
  await button('UNHOOK').waitFor();
  await panel.getByRole('button', { name: /SPEED MEDIUM/ }).click();
  await page.evaluate(() => { window.testClockFactor = 5; });

  async function hold(control, waitForResult) {
    const bounds = await control.boundingBox();
    assert.ok(bounds, 'The winch control must be visible');
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    try {
      await waitForResult();
    } finally {
      await page.mouse.up();
    }
  }

  await hold(button('WINCH BOTH'), () => page.getByText(/Pull to recovery zone/).waitFor({ timeout: 75000 }));
  assert.ok(Number(await page.getByRole('meter', { name: 'Line A load' }).getAttribute('aria-valuemax')) < 42);
  console.log('Level 4 casualty upright. The HUD shows the extraction objective and current load limit.');

  await button('UNHOOK').click();
  await button('LINE A').click();
  await hold(button('WINCH IN'), () => page.waitForFunction(() => {
    const career = JSON.parse(localStorage.getItem('towing-career') ?? '{}');
    return career.job === 4 && career.completed === 1 && career.cash === 2600;
  }, null, { timeout: 180000 }));

  assert.deepEqual(errors, []);
  console.log('Level 4 completed and paid $2600 with zero engine or winch upgrades.');
} finally {
  await browser?.close();
  await new Promise(resolve => server ? server.httpServer.close(resolve) : resolve());
  await rm(outDir, { recursive: true, force: true });
}
