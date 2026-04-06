const test = require('node:test');
const assert = require('node:assert/strict');

const Analyzer = require('../public/catalog-analyzer.js');

function createVariantProduct(overrides) {
  return Object.assign({
    id: 900,
    name: 'Signal Product',
    sku: 'SIG-900',
    price: 30,
    options: [
      { name: 'Size', choices: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'] },
      { name: 'Type', choices: ['Option 1', 'Option 2'] },
      { name: 'Color', choices: ['Black', 'Black ', 'Default'] }
    ],
    combinations: Array.from({ length: 14 }, function (_, index) {
      return {
        quantity: index < 6 ? 0 : 4,
        price: 30 + index,
        available: index >= 6
      };
    })
  }, overrides || {});
}

test('analyzeCatalog handles non-array input safely', function () {
  const report = Analyzer.analyzeCatalog(null);

  assert.deepEqual(report.products, []);
  assert.equal(report.summary.productsAnalyzed, 0);
  assert.deepEqual(report.recommendations, []);
});

test('analyzeProduct derives the main catalog risk signals', function () {
  const product = createVariantProduct();
  const analyzed = Analyzer.analyzeProduct(product);
  const keys = analyzed.signals.map(function (signal) {
    return signal.key;
  });

  assert.equal(analyzed.severity, 'urgent');
  assert.ok(keys.includes('combination_overload'));
  assert.ok(keys.includes('option_sprawl'));
  assert.ok(keys.includes('value_sprawl'));
  assert.ok(keys.includes('generic_option_name'));
  assert.ok(keys.includes('duplicate_values'));
  assert.ok(keys.includes('ambiguous_value_labels'));
  assert.ok(keys.includes('stock_fragmentation'));
  assert.ok(keys.includes('thin_visual_context'));
  assert.ok(keys.includes('price_spread'));
});

test('analyzeProduct supports Ecwid-style productOptions and variations fields', function () {
  const analyzed = Analyzer.analyzeProduct({
    id: 901,
    name: 'Variation Product',
    sku: 'VAR-901',
    productOptions: [
      { title: 'Attribute', values: [{ text: 'Standard' }, { text: 'Standard' }, { text: '2' }] },
      { label: 'Material', values: [{ value: 'Cotton' }, { value: 'Canvas' }, { value: 'Leather' }] }
    ],
    variations: [
      { quantity: 0, price: 20 },
      { quantity: 0, price: 28 },
      { quantity: 5, price: 34 },
      { quantity: 5, price: 40 },
      { quantity: 5, price: 44 },
      { quantity: 5, price: 48 },
      { quantity: 5, price: 52 },
      { quantity: 5, price: 56 },
      { quantity: 5, price: 60 },
      { quantity: 5, price: 64 },
      { quantity: 5, price: 68 },
      { quantity: 5, price: 72 }
    ]
  });

  assert.equal(analyzed.optionCount, 2);
  assert.equal(analyzed.combinationCount, 12);
  assert.ok(analyzed.signals.some(function (signal) {
    return signal.key === 'generic_option_name';
  }));
});

test('analyzeProduct flags unclear structures when options exist without combinations', function () {
  const analyzed = Analyzer.analyzeProduct({
    id: 902,
    name: 'Option Tree Only',
    sku: 'OPT-902',
    options: [
      { name: 'Size', choices: ['XS', 'S', 'M', 'L', 'XL', '2XL'] },
      { name: 'Fit', choices: ['Slim', 'Classic', 'Relaxed'] },
      { name: 'Finish', choices: ['Matte', 'Gloss', 'Satin', 'Textured'] }
    ]
  });

  assert.ok(analyzed.signals.some(function (signal) {
    return signal.key === 'unclear_variant_structure';
  }));
});

test('analyzeCatalog summary respects minimum score thresholds', function () {
  const high = createVariantProduct({ id: 903, name: 'High Risk', sku: 'HIGH-903' });
  const medium = createVariantProduct({
    id: 904,
    name: 'Medium Risk',
    sku: 'MED-904',
    options: [{ name: 'Color', choices: ['Blue', 'Green', 'Red', 'Yellow', 'Black', 'White', 'Default'] }],
    combinations: [{ quantity: 2 }, { quantity: 2 }, { quantity: 2 }],
    price: 18
  });

  const report = Analyzer.analyzeCatalog([high, medium], { minimumScore: 20 });

  assert.equal(report.summary.productsAnalyzed, 2);
  assert.equal(report.summary.productsAtRisk, 1);
  assert.ok(report.summary.averageRiskScore > 0);
});

test('buildSampleCatalog returns reusable products for preview mode', function () {
  const samples = Analyzer.buildSampleCatalog();

  assert.ok(samples.length >= 4);
  assert.ok(samples.every(function (product) {
    return product.name && product.sku;
  }));
});

test('recommendations are ordered by dominant signal counts', function () {
  const report = Analyzer.analyzeCatalog([
    {
      id: 905,
      name: 'Overload One',
      sku: 'O-905',
      options: [{ name: 'Size', choices: ['S', 'M', 'L'] }],
      combinations: Array.from({ length: 28 }, function () {
        return { quantity: 3, price: 20 };
      })
    },
    {
      id: 906,
      name: 'Overload Two',
      sku: 'O-906',
      options: [{ name: 'Finish', choices: ['Matte', 'Gloss', 'Satin'] }],
      combinations: Array.from({ length: 24 }, function () {
        return { quantity: 2, price: 18 };
      })
    },
    {
      id: 907,
      name: 'Duplicate Labels',
      sku: 'D-907',
      options: [{ name: 'Color', choices: ['Blue', 'Blue ', 'Navy'] }],
      combinations: [{ quantity: 4 }, { quantity: 4 }]
    }
  ]);

  assert.ok(report.recommendations.length > 0);
  assert.equal(report.recommendations[0].key, 'combination_overload');
});