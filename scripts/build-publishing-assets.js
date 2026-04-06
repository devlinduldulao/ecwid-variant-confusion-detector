const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = path.join(__dirname, '..');
const iconSource = path.join(rootDir, 'public', 'icon.svg');
const marketplaceDir = path.join(rootDir, 'assets', 'marketplace');
const bannerSource = path.join(marketplaceDir, 'banner.svg');
const iconMirror = path.join(marketplaceDir, 'icon.svg');
const outputDir = marketplaceDir;

const iconExports = [128, 256, 512];
const bannerExports = [
  { width: 1200, height: 675 },
  { width: 1600, height: 900 }
];

function cleanGeneratedTargets() {
  const generatedFiles = iconExports
    .map(function (size) {
      return 'icon-' + size + 'x' + size + '.png';
    })
    .concat(bannerExports.map(function (exportSize) {
      return 'banner-' + exportSize.width + 'x' + exportSize.height + '.png';
    }));

  generatedFiles.forEach(function (fileName) {
    const filePath = path.join(outputDir, fileName);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  });
}

async function ensureSource(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Missing source asset: ' + filePath);
  }
}

async function syncIconSource() {
  fs.copyFileSync(iconSource, iconMirror);
}

async function buildIconExports() {
  for (const size of iconExports) {
    const filePath = path.join(outputDir, 'icon-' + size + 'x' + size + '.png');
    await sharp(iconSource)
      .resize(size, size)
      .png()
      .toFile(filePath);
  }
}

async function buildBannerExports() {
  for (const exportSize of bannerExports) {
    const filePath = path.join(outputDir, 'banner-' + exportSize.width + 'x' + exportSize.height + '.png');
    await sharp(bannerSource)
      .resize(exportSize.width, exportSize.height)
      .png()
      .toFile(filePath);
  }
}

async function main() {
  await ensureSource(iconSource);
  await ensureSource(bannerSource);

  fs.mkdirSync(outputDir, { recursive: true });
  cleanGeneratedTargets();
  await syncIconSource();

  await buildIconExports();
  await buildBannerExports();

  console.log('Generated publishing assets in ' + outputDir);
}

main().catch(function (error) {
  console.error(error.message);
  process.exit(1);
});