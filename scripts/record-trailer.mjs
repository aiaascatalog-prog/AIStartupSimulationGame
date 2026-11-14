import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TARGET_URL = process.env.TRAILER_URL || 'http://127.0.0.1:4173/?trailer=1';
const OUTPUT_DIR = path.resolve(process.cwd(), 'trailer-output');
const ORIENTATION = process.env.TRAILER_ORIENTATION || 'both'; // 'landscape' | 'portrait' | 'both'

const PRESETS = {
  landscape: { width: 1280, height: 720, filename: 'ai-startup-trailer-16x9.webm' },
  portrait: { width: 720, height: 1280, filename: 'ai-startup-trailer-9x16.webm' },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function recordClip(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) throw new Error(`Unknown preset: ${presetKey}`);

  const tempVideoDir = path.join(OUTPUT_DIR, `raw-${presetKey}`);
  fs.mkdirSync(tempVideoDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: preset.width, height: preset.height },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tempVideoDir,
      size: { width: preset.width, height: preset.height },
    },
  });

  const page = await context.newPage();

  // Seed a small starter save so upgrades & GPU racks appear quickly in a 10-second showcase
  await page.addInitScript(() => {
    const seedSave = {
      tokens: 45,
      lifetimeTokens: 600,
      totalClicks: 24,
      upgrades: { auto_script: 2, gpu_rack: 1 },
      lastSavedAt: Date.now(),
    };
    localStorage.setItem('ai_startup_sim_save_v1', JSON.stringify(seedSave));
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

  // 0.0s - 0.9s: Showcase Title Screen
  await sleep(900);

  // 0.9s: Launch game
  await page.keyboard.press('Enter');
  await sleep(250);

  const isDesktop = preset.width >= 900;
  const coreX = Math.round(isDesktop ? preset.width * 0.36 : preset.width * 0.5);
  const coreY = Math.round(isDesktop ? preset.height * 0.52 : preset.height * 0.42);

  // 1.15s - 4.65s: Rapid Core Clicking + Upgrades (3.5s)
  for (let i = 0; i < 28; i++) {
    await page.mouse.click(coreX + (Math.random() - 0.5) * 18, coreY + (Math.random() - 0.5) * 18);
    if (i % 6 === 5) await page.keyboard.press('1');
    if (i % 13 === 12) await page.keyboard.press('2');
    await sleep(115);
  }

  // 4.65s: Trigger 10x Golden Fever Mode!
  await page.keyboard.press('f');
  await sleep(250);

  // 4.90s - 10.2s: High-Intensity 10x Golden Fever Climax (~5.3s)
  for (let i = 0; i < 44; i++) {
    if (i % 2 === 0) {
      await page.mouse.click(coreX + (Math.random() - 0.5) * 24, coreY + (Math.random() - 0.5) * 24);
    } else {
      await page.keyboard.press('Space');
    }
    if (i % 5 === 4) await page.keyboard.press('1');
    if (i % 8 === 7) await page.keyboard.press('2');
    if (i % 18 === 17) await page.keyboard.press('3');
    await sleep(115);
  }

  const video = page.video();
  await context.close();
  await browser.close();

  const recordedPath = await video.path();
  const finalWebmPath = path.join(OUTPUT_DIR, preset.filename);
  fs.copyFileSync(recordedPath, finalWebmPath);
  fs.rmSync(tempVideoDir, { recursive: true, force: true });

  console.log(`Recorded ${presetKey} video -> ${finalWebmPath}`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const targets = ORIENTATION === 'both' ? ['landscape', 'portrait'] : [ORIENTATION];
  for (const target of targets) {
    await recordClip(target);
  }
}

main().catch((err) => {
  console.error('Trailer recording failed:', err);
  process.exit(1);
});
