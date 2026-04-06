(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }

  root.VariantConfusionCatalogAnalyzer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SIGNAL_FILTER = 8;
  var SIGNAL_LABELS = {
    combination_overload: 'Too many variant combinations',
    option_sprawl: 'Too many decision layers',
    value_sprawl: 'Options with too many values',
    generic_option_name: 'Generic option naming',
    duplicate_values: 'Duplicate value labels',
    ambiguous_value_labels: 'Ambiguous value labels',
    stock_fragmentation: 'Many variants unavailable',
    thin_visual_context: 'Too few images for variant depth',
    price_spread: 'Large variant price spread',
    unclear_variant_structure: 'Variant setup lacks clear structure'
  };

  var SIGNAL_ACTIONS = {
    combination_overload: 'Split the product into clearer families or reduce option combinations.',
    option_sprawl: 'Remove one option layer or convert low-value choices into separate products.',
    value_sprawl: 'Trim the longest option list or group values by buyer intent.',
    generic_option_name: 'Rename options to buyer-facing labels such as Size, Fit, or Material.',
    duplicate_values: 'Merge duplicate option values and standardize naming.',
    ambiguous_value_labels: 'Replace placeholders or numeric labels with descriptive shopper language.',
    stock_fragmentation: 'Hide or consolidate unavailable combinations before they create dead ends.',
    thin_visual_context: 'Add more product imagery or swatches for high-choice products.',
    price_spread: 'Explain the price jumps so variants feel intentional rather than random.',
    unclear_variant_structure: 'Confirm the option tree reflects how merchants explain the product offline.'
  };

  function analyzeCatalog(products, options) {
    var config = options || {};
    var analyzed = (Array.isArray(products) ? products : [])
      .map(analyzeProduct)
      .filter(Boolean)
      .sort(function (left, right) {
        return right.score - left.score;
      });

    return {
      generatedAt: new Date().toISOString(),
      products: analyzed,
      summary: buildSummary(analyzed, config.minimumScore || DEFAULT_SIGNAL_FILTER),
      recommendations: buildRecommendations(analyzed)
    };
  }

  function analyzeProduct(product) {
    var options = getProductOptions(product);
    var combinations = getProductCombinations(product);

    if (!options.length && !combinations.length) {
      return null;
    }

    var signals = [];
    var optionChoiceCount = 0;
    var ambiguousLabelCount = 0;

    if (combinations.length >= 24) {
      pushSignal(signals, 'combination_overload', 14, combinations.length + ' combinations are available.');
    } else if (combinations.length >= 12) {
      pushSignal(signals, 'combination_overload', 9, combinations.length + ' combinations are available.');
    }

    if (options.length >= 3) {
      pushSignal(signals, 'option_sprawl', 4 + (options.length - 3) * 2, options.length + ' option groups need buyer decisions.');
    }

    options.forEach(function (option) {
      var choices = getOptionChoices(option);
      var duplicates = countDuplicates(choices);
      var ambiguous = countAmbiguousLabels(choices);

      optionChoiceCount += choices.length;
      ambiguousLabelCount += ambiguous;

      if (choices.length >= 7) {
        pushSignal(signals, 'value_sprawl', 4 + Math.min(choices.length - 7, 4), option.name + ' has ' + choices.length + ' values.');
      }

      if (isGenericOptionName(option.name)) {
        pushSignal(signals, 'generic_option_name', 5, option.name + ' should be renamed to a buyer-facing label.');
      }

      if (duplicates > 0) {
        pushSignal(signals, 'duplicate_values', 5 + duplicates, option.name + ' contains duplicate or equivalent values.');
      }

      if (ambiguous > 0) {
        pushSignal(signals, 'ambiguous_value_labels', 4 + ambiguous, option.name + ' includes placeholder or unclear values.');
      }
    });

    if (optionChoiceCount >= 12 && !combinations.length) {
      pushSignal(signals, 'unclear_variant_structure', 7, 'The option tree is deep, but concrete combinations are missing.');
    }

    var stockGapCount = countUnavailableCombinations(combinations);
    if (combinations.length && stockGapCount / combinations.length >= 0.35) {
      pushSignal(signals, 'stock_fragmentation', 6 + Math.min(stockGapCount, 5), stockGapCount + ' of ' + combinations.length + ' combinations appear unavailable.');
    }

    var imageCount = getImageCount(product);
    if (combinations.length >= 10 && imageCount <= 1) {
      pushSignal(signals, 'thin_visual_context', 5, 'Only ' + imageCount + ' image is attached to a high-choice product.');
    }

    var priceSpread = getCombinationPriceSpread(product, combinations);
    if (priceSpread.ratio >= 0.35) {
      pushSignal(signals, 'price_spread', 4, 'Variant prices span ' + formatCurrencyDelta(priceSpread.delta) + '.');
    }

    var score = signals.reduce(function (total, signal) {
      return total + signal.score;
    }, 0);

    var highestSignal = signals[0] || null;

    return {
      id: getProductId(product),
      name: getProductName(product),
      sku: product && product.sku ? String(product.sku) : 'No SKU',
      enabled: product && product.enabled !== false,
      score: score,
      severity: getSeverity(score),
      optionCount: options.length,
      optionChoiceCount: optionChoiceCount,
      combinationCount: combinations.length,
      ambiguousLabelCount: ambiguousLabelCount,
      stockGapCount: stockGapCount,
      imageCount: imageCount,
      signals: signals.sort(function (left, right) {
        return right.score - left.score;
      }),
      nextAction: highestSignal ? SIGNAL_ACTIONS[highestSignal.key] : 'Monitor after the next catalog update.',
      primarySignalLabel: highestSignal ? highestSignal.label : 'Low risk'
    };
  }

  function buildSummary(products, minimumScore) {
    var totals = {
      productsAnalyzed: products.length,
      productsAtRisk: 0,
      urgentProducts: 0,
      averageRiskScore: 0,
      totalCombinations: 0,
      signalCounts: {}
    };

    var totalScore = 0;

    products.forEach(function (product) {
      totalScore += product.score;
      totals.totalCombinations += product.combinationCount;

      if (product.score >= minimumScore) {
        totals.productsAtRisk += 1;
      }

      if (product.severity === 'urgent') {
        totals.urgentProducts += 1;
      }

      product.signals.forEach(function (signal) {
        totals.signalCounts[signal.key] = (totals.signalCounts[signal.key] || 0) + 1;
      });
    });

    totals.averageRiskScore = products.length ? Math.round(totalScore / products.length) : 0;

    return totals;
  }

  function buildRecommendations(products) {
    var counts = {};

    products.forEach(function (product) {
      product.signals.forEach(function (signal) {
        counts[signal.key] = (counts[signal.key] || 0) + 1;
      });
    });

    return Object.keys(counts)
      .sort(function (left, right) {
        return counts[right] - counts[left];
      })
      .slice(0, 4)
      .map(function (key) {
        return {
          key: key,
          count: counts[key],
          label: SIGNAL_LABELS[key],
          action: SIGNAL_ACTIONS[key]
        };
      });
  }

  function getProductOptions(product) {
    if (!product || typeof product !== 'object') {
      return [];
    }

    var rawOptions = [];

    if (Array.isArray(product.options)) {
      rawOptions = product.options;
    } else if (Array.isArray(product.productOptions)) {
      rawOptions = product.productOptions;
    }

    return rawOptions.map(function (option, index) {
      return {
        name: getOptionName(option, index),
        choices: getOptionChoices(option)
      };
    });
  }

  function getProductCombinations(product) {
    if (!product || typeof product !== 'object') {
      return [];
    }

    if (Array.isArray(product.combinations)) {
      return product.combinations;
    }

    if (Array.isArray(product.variations)) {
      return product.variations;
    }

    return [];
  }

  function getOptionName(option, index) {
    if (option && typeof option === 'object') {
      return String(option.name || option.title || option.label || option.type || 'Option ' + (index + 1));
    }

    return 'Option ' + (index + 1);
  }

  function getOptionChoices(option) {
    var rawChoices = [];

    if (option && Array.isArray(option.choices)) {
      rawChoices = option.choices;
    } else if (option && Array.isArray(option.values)) {
      rawChoices = option.values;
    }

    return rawChoices
      .map(readChoiceLabel)
      .filter(function (label) {
        return label.length > 0;
      });
  }

  function readChoiceLabel(choice) {
    if (typeof choice === 'string' || typeof choice === 'number') {
      return String(choice).trim();
    }

    if (choice && typeof choice === 'object') {
      return String(choice.text || choice.value || choice.name || choice.label || '').trim();
    }

    return '';
  }

  function pushSignal(target, key, score, detail) {
    target.push({
      key: key,
      label: SIGNAL_LABELS[key],
      score: score,
      detail: detail
    });
  }

  function countDuplicates(choices) {
    var seen = {};
    var duplicates = 0;

    choices.forEach(function (choice) {
      var normalized = normalizeComparableLabel(choice);
      if (!normalized) {
        return;
      }

      if (seen[normalized]) {
        duplicates += 1;
        return;
      }

      seen[normalized] = true;
    });

    return duplicates;
  }

  function countAmbiguousLabels(choices) {
    return choices.reduce(function (count, choice) {
      return count + (isAmbiguousLabel(choice) ? 1 : 0);
    }, 0);
  }

  function countUnavailableCombinations(combinations) {
    return combinations.reduce(function (count, combination) {
      return count + (isUnavailableCombination(combination) ? 1 : 0);
    }, 0);
  }

  function isUnavailableCombination(combination) {
    if (!combination || typeof combination !== 'object') {
      return false;
    }

    if (combination.available === false || combination.inStock === false || combination.enabled === false) {
      return true;
    }

    if (typeof combination.quantity === 'number' && combination.quantity <= 0) {
      return true;
    }

    return false;
  }

  function getImageCount(product) {
    var count = 0;

    if (product && product.originalImage) {
      count += 1;
    }

    if (product && Array.isArray(product.galleryImages)) {
      count += product.galleryImages.length;
    }

    if (product && product.media && Array.isArray(product.media.images)) {
      count += product.media.images.length;
    }

    return count;
  }

  function getCombinationPriceSpread(product, combinations) {
    var fallback = readNumber(product && product.price);
    var prices = combinations
      .map(function (combination) {
        return readNumber(combination && (combination.price || combination.defaultDisplayedPrice));
      })
      .filter(function (value) {
        return value !== null;
      });

    if (!prices.length || prices.length < 2) {
      return { delta: 0, ratio: 0 };
    }

    var low = Math.min.apply(null, prices);
    var high = Math.max.apply(null, prices);
    var base = fallback || low || 1;

    return {
      delta: high - low,
      ratio: base > 0 ? (high - low) / base : 0
    };
  }

  function readNumber(value) {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      var parsed = Number(value);
      return isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  function formatCurrencyDelta(value) {
    return '$' + Number(value || 0).toFixed(2);
  }

  function isGenericOptionName(label) {
    return /^(option|select|choose|type|attribute|variation)\b/i.test(String(label || '').trim());
  }

  function isAmbiguousLabel(label) {
    return /^(default|standard|regular|option\s*\d+|choice\s*\d+|value\s*\d+|\d+)$/i.test(String(label || '').trim());
  }

  function normalizeComparableLabel(label) {
    return String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  function getSeverity(score) {
    if (score >= 20) {
      return 'urgent';
    }

    if (score >= 14) {
      return 'high';
    }

    if (score >= 8) {
      return 'watch';
    }

    return 'low';
  }

  function getProductId(product) {
    return product && (product.id || product.productId) ? String(product.id || product.productId) : 'unknown';
  }

  function getProductName(product) {
    return product && product.name ? String(product.name) : 'Unnamed product';
  }

  function buildSampleCatalog() {
    return [
      {
        id: 101,
        name: 'Performance Runner',
        sku: 'RUN-101',
        enabled: true,
        price: 89,
        originalImage: { url: 'https://example.com/image.jpg' },
        options: [
          { name: 'Size', choices: ['6', '7', '8', '9', '10', '11', '12'] },
          { name: 'Color', choices: ['Black', 'Black ', 'Charcoal', 'Grey'] },
          { name: 'Type', choices: ['Option 1', 'Option 2'] }
        ],
        combinations: createSampleCombinations(28, 89, 129, 11)
      },
      {
        id: 205,
        name: 'Studio Tote',
        sku: 'TOT-205',
        enabled: true,
        price: 64,
        galleryImages: [],
        options: [
          { name: 'Material', choices: ['Canvas', 'Waxed Canvas', 'Leather'] },
          { name: 'Monogram', choices: ['No', 'Yes'] }
        ],
        combinations: createSampleCombinations(6, 64, 78, 1)
      },
      {
        id: 318,
        name: 'Modular Desk Lamp',
        sku: 'LMP-318',
        enabled: true,
        price: 120,
        options: [
          { name: 'Option', choices: ['1', '2', '3', '4'] },
          { name: 'Finish', choices: ['Brass', 'Matte Black', 'Ivory'] }
        ],
        combinations: createSampleCombinations(12, 120, 140, 5)
      },
      {
        id: 444,
        name: 'Classic Tee',
        sku: 'TEE-444',
        enabled: true,
        price: 28,
        options: [
          { name: 'Size', choices: ['S', 'M', 'L', 'XL'] },
          { name: 'Color', choices: ['White', 'Navy'] }
        ],
        combinations: createSampleCombinations(8, 28, 32, 0)
      }
    ];
  }

  function createSampleCombinations(total, lowPrice, highPrice, unavailableCount) {
    var combinations = [];
    var index = 0;

    while (index < total) {
      combinations.push({
        id: index + 1,
        price: lowPrice + ((highPrice - lowPrice) / Math.max(total - 1, 1)) * index,
        quantity: index < unavailableCount ? 0 : 6,
        available: index >= unavailableCount
      });
      index += 1;
    }

    return combinations;
  }

  return {
    analyzeCatalog: analyzeCatalog,
    analyzeProduct: analyzeProduct,
    buildSampleCatalog: buildSampleCatalog,
    signalLabels: SIGNAL_LABELS
  };
});