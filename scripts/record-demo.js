import { chromium } from '@playwright/test';
import { rename, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE = process.env.DEMO_URL ?? 'http://127.0.0.1:8137';
const OUT = 'recordings';
const SIZE = { width: 1280, height: 800 };

const wait = (page, ms) => page.waitForTimeout(ms);

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

  await page.goto(BASE);
  await page.waitForSelector('.question-card');

  // Prefer live MongoDB if available; fall back to rehearsal fixtures.
  const live = page.getByRole('button', { name: /Live MongoDB/ });
  if (await live.isEnabled()) {
    await live.click();
    await wait(page, 600);
  }

  await caption(page, 'Agent memory on MongoDB. When the docs change, the AI often remembers both.');
  await wait(page, 3500);

  await caption(page, 'Recall: similarity returns the deprecated mongo shell, with a high score.');
  await wait(page, 3500);

  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await caption(page, 'Trace: follow the replacement edge. mongosh surfaces, and mongo is struck through.');
  await wait(page, 4000);

  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await caption(page, 'Resolve: the answer flips to mongosh, with the source and deprecation quote cited.');
  await wait(page, 4500);

  await page.getByText('mongosh editor mode').click();
  await page.waitForSelector('[role="dialog"]');
  await caption(page, 'A newer, related doc. It does not supersede the answer, and it does not win.');
  await wait(page, 4000);
  await page.getByRole('button', { name: 'Close' }).click();
  await wait(page, 800);

  await page.getByRole('button', { name: 'Atlas CLI' }).click();
  await wait(page, 800);
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await caption(page, 'Same pattern: atlas deployments was deprecated in Atlas CLI 1.52.0. Use atlas local.');
  await wait(page, 4500);

  await page.getByRole('button', { name: 'Vector Search' }).click();
  await wait(page, 800);
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await caption(page, 'Two current sources disagree, with no edge between them. The system returns review required.');
  await wait(page, 4500);

  await caption(page, 'Now ask in your own words. The question is embedded locally \u2014 no cloud, no LLM.');
  await page.fill('.ask input', 'what replaced the old mongo shell');
  await wait(page, 1500);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForTimeout(1500);
  await caption(page, 'A paraphrase it never saw. Recall returns the deprecated mongo shell.');
  await wait(page, 3500);
  await page.getByRole('button', { name: /Next: Trace/ }).click();
  await page.getByRole('button', { name: /Next: Resolve/ }).click();
  await caption(page, 'Same correction. Your typed question resolves to mongosh, with the source cited.');
  await wait(page, 4500);

  await page.getByRole('button', { name: 'Show vectors' }).click();
  await page.waitForSelector('.vquery');
  await caption(page, 'Here is why. 384 dimensions projected to two. Each dot is a memory.');
  await wait(page, 4000);
  await caption(page, 'Your question and the deprecated mongo shell sit on top of each other \u2014 and mongosh is right beside them.');
  await wait(page, 5000);
  await caption(page, 'That adjacency is why similarity alone cannot tell them apart. The edge can.');
  await wait(page, 4500);
  await page.getByRole('button', { name: 'Hide vectors' }).click();
  await wait(page, 600);

  await page.fill('.ask input', 'how do I shard a collection');
  await wait(page, 1200);
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForTimeout(1500);
  await caption(page, 'Off topic? It does not guess. No confidently related source.');
  await wait(page, 4000);

  await page.getByRole('button', { name: 'Vector Search' }).click();
  await wait(page, 600);
  await page.getByRole('button', { name: 'View query' }).click();
  await page.waitForSelector('.query');
  await caption(page, 'One collection. One aggregation. $vectorSearch, then $graphLookup over the edges.');
  await wait(page, 4500);
  await page.getByRole('button', { name: 'Close' }).click();
  await wait(page, 600);

  await page.getByRole('button', { name: 'Reset' }).click();
  await caption(page, 'Memory that keeps up: it knows what was true, and what is.');
  await wait(page, 3500);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  const finalName = join(OUT, 'demo.webm');
  await rename(videoPath, finalName).catch(async () => {
    const files = await readdir(OUT);
    console.log('Recording saved under', OUT, files);
  });
  console.log('Recording saved:', finalName);
}

main().catch((error) => { console.error(error); process.exit(1); });
