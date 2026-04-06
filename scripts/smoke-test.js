const path = require('path');
const fs = require('fs');

const Analyzer = require('../public/catalog-analyzer.js');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name} — ${e.message}`);
    failed++;
  }
}

async function run() {
  console.log('\nSmoke test — static dashboard\n');

  await test('public/index.html exists and references the merchant dashboard assets', async () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    if (!html.includes('Variant Confusion Detector for Ecwid')) {
      throw new Error('dashboard title missing');
    }
    if (!html.includes('./catalog-analyzer.js') || !html.includes('./app.js')) {
      throw new Error('dashboard assets missing');
    }
    if (!html.includes('./icon.svg')) {
      throw new Error('dashboard icon missing');
    }
    if (!html.includes('preview-button')) {
      throw new Error('preview toggle missing');
    }
  });

  await test('public/icon.svg exists for favicon and listing reuse', async () => {
    const iconPath = path.join(__dirname, '..', 'public', 'icon.svg');
    const icon = fs.readFileSync(iconPath, 'utf8');
    if (!icon.includes('<svg')) {
      throw new Error('icon is not svg content');
    }
  });

  await test('analyzer exposes sample catalog builder', async () => {
    const samples = Analyzer.buildSampleCatalog();
    if (!Array.isArray(samples) || samples.length < 3) {
      throw new Error('sample catalog missing');
    }
  });

  await test('analyzer flags high-risk products', async () => {
    const report = Analyzer.analyzeCatalog(Analyzer.buildSampleCatalog(), { minimumScore: 8 });
    if (!report.products.length) {
      throw new Error('no analyzed products');
    }
    if (report.products[0].score < 8) {
      throw new Error('top product was not scored as risky');
    }
  });

  await test('analyzer ignores simple non-variant products', async () => {
    const report = Analyzer.analyzeCatalog([
      { id: 1, name: 'Simple mug', sku: 'MUG-1', price: 12 },
      { id: 2, name: 'Complex shoe', sku: 'SHOE-2', price: 50, options: [{ name: 'Size', choices: ['6', '7', '8', '9', '10', '11', '12'] }], combinations: [{ quantity: 4 }, { quantity: 0 }] }
    ]);

    if (report.products.length !== 1) {
      throw new Error('simple products should be skipped');
    }
  });

  await test('recommendations are generated from dominant signals', async () => {
    const report = Analyzer.analyzeCatalog(Analyzer.buildSampleCatalog(), { minimumScore: 8 });
    if (!report.recommendations.length) {
      throw new Error('recommendations missing');
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
