import { chromium } from '@playwright/test';
import { rename, mkdir } from 'node:fs/promises';
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
        padding: '16px 24px', font: '600 18px/1.4 system-ui, sans-serif', color: '#eef2fb',
        background: 'linear-gradient(to top, rgba(4,8,18,0.96), rgba(4,8,18,0))', textAlign: 'center', pointerEvents: 'none',
      });
      document.body.appendChild(bar);
    }
    bar.textContent = message;
  }, text);
}

async function query(page, text, note) {
  await page.fill('#q', '');
  for (const char of text) { await page.type('#q', char, { delay: 35 }); }
  await caption(page, note);
  await page.click('button[type=submit]');
  await page.waitForFunction(() => document.querySelectorAll('.card').length > 0, null, { timeout: 8000 });
  await wait(page, 4000);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: OUT, size: SIZE }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${BASE}/changelog`);
  await page.waitForSelector('#q');

  await caption(page, 'MongoDB release notes, embedded as vectors in the database.');
  await wait(page, 3500);
  await query(page, 'queryable encryption', 'Ask in plain English. One $vectorSearch over the changelog.');
  await query(page, 'slot based query execution', 'No keywords matched. It found the section by meaning.');
  await query(page, 'time series improvements', 'Real release-note sections, ranked by similarity, in milliseconds.');
  await caption(page, 'This is the changelog as queryable vectors. The same query runs in Atlas.');
  await wait(page, 4000);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  const finalName = join(OUT, 'changelog-vectors.webm');
  await rename(videoPath, finalName).catch(() => {});
  console.log('Recording saved:', finalName);
}

main().catch((error) => { console.error(error); process.exit(1); });
