import { chromium } from '@playwright/test';
import { rename, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.DEMO_URL ?? 'http://127.0.0.1:8137';
const OUT = 'recordings';
const SIZE = { width: 1280, height: 800 };

// Dwell multiplier. Default paces the run to ~10 minutes; set PACE=1 for a quick capture.
const PACE = Number(process.env.PACE ?? 9);

const wait = (page, ms) => page.waitForTimeout(Math.round(ms * PACE));

async function caption(page, text) {
  await page.evaluate((message) => {
    let bar = document.getElementById('demo-caption');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-caption';
      Object.assign(bar.style, {
        position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '9999',
        padding: '16px 24px', font: '600 18px/1.4 system-ui, sans-serif',
        color: '#eef2fb', background: 'linear-gradient(to top, rgba(4,8,18,0.96), rgba(4,8,18,0))',
        textAlign: 'center', pointerEvents: 'none', transition: 'opacity 0.3s',
      });
      document.body.appendChild(bar);
    }
    bar.textContent = message;
    bar.style.opacity = '1';
  }, text);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: OUT, size: SIZE },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Part 1: the deck ---------------------------------------------------
  await page.goto(`${BASE}/deck`);
  await page.waitForSelector('.slide.active');
  const slideCount = await page.locator('.slide').count();
  await wait(page, 3500);
  for (let s = 1; s < slideCount; s += 1) {
    await page.keyboard.press('ArrowRight');
    await wait(page, 3200);
  }
  await wait(page, 800);

  // --- Part 2: switch to the live app ------------------------------------
  await page.goto(BASE);
  await page.waitForSelector('.question-card');

  const live = page.getByRole('button', { name: /Live MongoDB/ });
  if (await live.isEnabled()) {
    await live.click();
    await wait(page, 600);
  }

  await caption(page, 'From the deck to the live app \u2014 backed by Atlas.');
  await wait(page, 3000);

  await caption(page, 'Recall: similarity returns the deprecated mongo shell, with a high score.');
  await wait(page, 3500);
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await caption(page, 'Trace: follow the replacement edge to mongosh.');
  await wait(page, 3500);
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await caption(page, 'Resolve: the answer flips to mongosh, with the source cited.');
  await wait(page, 4000);

  await caption(page, 'Now ask in your own words \u2014 embedded locally, no LLM.');
  await page.fill('.ask input', 'what replaced the old mongo shell');
  await wait(page, 1200);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await caption(page, 'Same correction. Your typed question resolves to mongosh.');
  await wait(page, 4000);

  // Changelog corpus in Atlas
  await page.getByRole('button', { name: 'Changelog corpus' }).click();
  await page.waitForSelector('.changelogpanel');
  await page.locator('.changelogpanel').scrollIntoViewIfNeeded();
  await wait(page, 1200);
  await caption(page, 'The real MongoDB changelog, embedded as vectors in Atlas.');
  await wait(page, 3500);
  await page.fill('.changelogform input', 'MongoDB 9.0 new features');
  await wait(page, 800);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForSelector('.changelogpanel .evidence');
  await page.locator('.changelogpanel .evidence').scrollIntoViewIfNeeded();
  await caption(page, 'One $vectorSearch over the release notes \u2014 matched by meaning, milliseconds to Atlas.');
  await wait(page, 4500);
  await page.getByRole('button', { name: 'Hide changelog' }).click();
  await wait(page, 600);

  // Version drift check
  await page.getByRole('button', { name: 'Drift check' }).click();
  await page.waitForSelector('.driftpanel');
  await page.locator('.driftpanel').scrollIntoViewIfNeeded();
  await wait(page, 1000);
  await page.getByRole('button', { name: 'Check drift' }).click();
  await page.waitForSelector('.driftresult');
  await page.locator('.driftresult').scrollIntoViewIfNeeded();
  await caption(page, 'Drift check: server 9.0.0 is not GA \u2014 so the verdict is provisional, not invented.');
  await wait(page, 4500);
  await page.fill('.driftpanel input[placeholder="9.0.0"]', '7.0.5');
  await wait(page, 600);
  await page.getByRole('button', { name: 'Check drift' }).click();
  await page.waitForSelector('.driftresult');
  await caption(page, 'On a GA version it gives a real verdict, with the documented minimum and source.');
  await wait(page, 4500);
  await page.getByRole('button', { name: 'Hide drift' }).click();
  await wait(page, 600);

  await caption(page, 'Memory that keeps up: it knows what was true, and what is.');
  await wait(page, 3500);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  const finalName = join(OUT, 'run.webm');
  await rename(videoPath, finalName).catch(async () => {
    const files = await readdir(OUT);
    console.log('Recording saved under', OUT, files);
  });
  console.log('Recording saved:', finalName);
}

main().catch((error) => { console.error(error); process.exit(1); });
