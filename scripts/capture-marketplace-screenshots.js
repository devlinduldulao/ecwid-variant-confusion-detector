const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const rootDir = path.join(__dirname, '..');
const outputDir = path.join(rootDir, 'assets', 'marketplace');
const baseUrl = process.env.MARKETPLACE_CAPTURE_URL || process.argv[2] || 'http://127.0.0.1:3011';

const screenshotPaths = {
  previewOff: path.join(outputDir, 'screenshot-preview-off.png'),
  previewOn: path.join(outputDir, 'screenshot-preview-on.png'),
  controls: path.join(outputDir, 'screenshot-controls-and-export.png')
};

async function ensureDirectory() {
  fs.mkdirSync(outputDir, { recursive: true });
}

function clearOldScreenshots() {
  Object.keys(screenshotPaths).forEach(function (key) {
    const filePath = screenshotPaths[key];
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

async function waitForPreviewOn(page) {
  await page.waitForFunction(function () {
    var badge = document.getElementById('mode-badge');
    var metric = document.getElementById('metric-products');
    return badge && badge.textContent === 'Preview mode' && metric && Number(metric.textContent) > 0;
  });
}

async function main() {
  await ensureDirectory();
  clearOldScreenshots();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1512, height: 2200 }, colorScheme: 'light' });

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.locator('#preview-center-button').waitFor();

    await page.screenshot({ path: screenshotPaths.previewOff, fullPage: true });

    await page.click('#preview-center-button');
    await waitForPreviewOn(page);
    await page.screenshot({ path: screenshotPaths.previewOn, fullPage: true });

    const controls = page.locator('.controls-grid');
    await controls.scrollIntoViewIfNeeded();
    await controls.screenshot({ path: screenshotPaths.controls });
  } finally {
    await browser.close();
  }

  console.log('Captured marketplace screenshots in ' + outputDir + ' from ' + baseUrl);
}

main().catch(function (error) {
  console.error(error.message || error);
  process.exit(1);
});