import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const TARGET_URL = process.env.TRAILER_URL || 'http://127.0.0.1:4173/?trailer=1';
const OUTPUT_DIR = path.resolve(process.cwd(), 'media-output');
const PLATFORM = (process.env.MEDIA_PLATFORM || 'all').toLowerCase(); // 'y8' | 'crazygames' | 'social' | 'all'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const VIDEO_SPECS = {
  y8_16x9: {
    platform: 'y8',
    width: 1280,
    height: 720,
    filename: 'y8-video-16x9-1280x720.webm',
    screenshots: [
      { name: 'y8-screenshot-widescreen-1-1280x720.png', atStep: 'normal' },
      { name: 'y8-screenshot-widescreen-2-1280x720.png', atStep: 'fever' },
    ],
  },
  y8_4x3: {
    platform: 'y8',
    width: 960,
    height: 720,
    filename: 'y8-video-4x3-960x720.webm',
    screenshots: [],
  },
  cg_landscape: {
    platform: 'crazygames',
    width: 1920,
    height: 1080,
    filename: 'crazygames-video-landscape-1920x1080-raw.webm',
    screenshots: [],
  },
  cg_portrait: {
    platform: 'crazygames',
    width: 800,
    height: 1200,
    filename: 'crazygames-video-portrait-800x1200-raw.webm',
    screenshots: [],
  },
  social_9x16: {
    platform: 'social',
    width: 720,
    height: 1280,
    filename: 'social-shorts-9x16-720x1280.webm',
    screenshots: [],
  },
};

function getTargets() {
  if (PLATFORM === 'all') return Object.keys(VIDEO_SPECS);
  return Object.keys(VIDEO_SPECS).filter((k) => VIDEO_SPECS[k].platform === PLATFORM);
}

async function createSeededContext(browser, width, height, videoDir) {
  const options = {
    viewport: { width, height },
    deviceScaleFactor: 1,
  };
  if (videoDir) {
    options.recordVideo = {
      dir: videoDir,
      size: { width, height },
    };
  }
  const context = await browser.newContext(options);
  const page = await context.newPage();

  await page.addInitScript(() => {
    const seedSave = {
      tokens: 180,
      lifetimeTokens: 2400,
      totalClicks: 42,
      upgrades: { auto_script: 4, gpu_rack: 2 },
      lastSavedAt: Date.now(),
    };
    localStorage.setItem('ai_startup_sim_save_v1', JSON.stringify(seedSave));
  });

  await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
  await sleep(300);
  return { context, page };
}

async function recordSpec(browser, specKey) {
  const spec = VIDEO_SPECS[specKey];
  const rawDir = path.join(OUTPUT_DIR, 'raw', specKey);
  const platformDir = path.join(OUTPUT_DIR, spec.platform);
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(platformDir, { recursive: true });

  const { context, page } = await createSeededContext(browser, spec.width, spec.height, rawDir);

  const isDesktop = spec.width >= 900;
  const coreX = Math.round(isDesktop ? spec.width * 0.36 : spec.width * 0.5);
  const coreY = Math.round(isDesktop ? spec.height * 0.52 : spec.height * 0.42);

  // Phase 1 (~7.5s): Active core clicking, particle bursts, buying upgrades
  for (let i = 0; i < 62; i++) {
    if (i % 2 === 0) {
      await page.mouse.click(coreX + (Math.random() - 0.5) * 20, coreY + (Math.random() - 0.5) * 20);
    } else {
      await page.keyboard.press('Space');
    }
    if (i === 18) {
      await page.keyboard.press('1');
    }
    if (i === 32) {
      await page.keyboard.press('2');
    }
    if (i === 48) {
      await page.keyboard.press('1');
      const normalShot = spec.screenshots.find((s) => s.atStep === 'normal');
      if (normalShot) {
        await page.screenshot({ path: path.join(platformDir, normalShot.name) });
      }
    }
    await sleep(115);
  }

  // Phase 2 (~10.5s): Activate 10x Golden Fever Mode and showcase exponential growth!
  await page.keyboard.press('f');
  await sleep(200);

  for (let i = 0; i < 84; i++) {
    if (i % 2 === 0) {
      await page.mouse.click(coreX + (Math.random() - 0.5) * 26, coreY + (Math.random() - 0.5) * 26);
    } else {
      await page.keyboard.press('Space');
    }
    if (i % 10 === 9) await page.keyboard.press('1');
    if (i % 16 === 15) await page.keyboard.press('2');
    if (i % 28 === 27) await page.keyboard.press('3');
    if (i === 36) {
      const feverShot = spec.screenshots.find((s) => s.atStep === 'fever');
      if (feverShot) {
        await page.screenshot({ path: path.join(platformDir, feverShot.name) });
      }
    }
    await sleep(115);
  }

  const video = page.video();
  await context.close();

  const recordedPath = await video.path();
  const finalRawPath = path.join(OUTPUT_DIR, 'raw', spec.filename);
  fs.copyFileSync(recordedPath, finalRawPath);
  fs.rmSync(rawDir, { recursive: true, force: true });
  console.log(`Recorded ${specKey} -> ${finalRawPath}`);
}

async function captureY8StandardScreenshot(browser) {
  const y8Dir = path.join(OUTPUT_DIR, 'y8');
  fs.mkdirSync(y8Dir, { recursive: true });
  const { context, page } = await createSeededContext(browser, 760, 570, null);
  const coreX = Math.round(760 * 0.5);
  const coreY = Math.round(570 * 0.42);
  for (let i = 0; i < 8; i++) {
    await page.mouse.click(coreX, coreY);
    await sleep(90);
  }
  await page.screenshot({ path: path.join(y8Dir, 'y8-screenshot-standard-760x570.png') });
  await context.close();
  console.log('Captured Y8 standard 760x570 screenshot');
}

async function main() {
  fs.mkdirSync(path.join(OUTPUT_DIR, 'raw'), { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const targets = getTargets();
    for (const key of targets) {
      await recordSpec(browser, key);
    }
    if (PLATFORM === 'all' || PLATFORM === 'y8') {
      await captureY8StandardScreenshot(browser);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Media generation failed:', err);
  process.exit(1);
});
