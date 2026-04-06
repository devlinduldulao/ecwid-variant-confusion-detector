const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const Analyzer = require('../public/catalog-analyzer.js');

const APP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
const HTML_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const STORAGE_KEY = 'variant-confusion-detector-ecwid-preferences';

function createProduct(id, overrides) {
  return Object.assign({
    id: id,
    name: 'Product ' + id,
    sku: 'SKU-' + id,
    enabled: true,
    price: 20,
    options: [
      { name: 'Size', choices: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'] }
    ],
    combinations: [
      { quantity: 3, price: 20 },
      { quantity: 0, price: 28 }
    ]
  }, overrides || {});
}

function createEcwidLiveProduct(id, overrides) {
  return Object.assign({
    id: id,
    name: 'Live Product ' + id,
    sku: 'LIVE-' + id,
    enabled: true,
    price: 49,
    productOptions: [
      {
        title: 'Attribute',
        values: [{ text: 'Standard' }, { text: 'Premium' }, { text: 'Default' }]
      },
      {
        label: 'Material',
        values: [{ value: 'Cotton' }, { value: 'Canvas' }, { value: 'Leather' }]
      }
    ],
    variations: [
      { quantity: 0, price: 49 },
      { quantity: 2, price: 54 },
      { quantity: 4, price: 59 },
      { quantity: 0, price: 63 },
      { quantity: 5, price: 69 },
      { quantity: 3, price: 75 },
      { quantity: 1, price: 79 },
      { quantity: 0, price: 84 },
      { quantity: 2, price: 89 },
      { quantity: 1, price: 94 },
      { quantity: 3, price: 99 },
      { quantity: 2, price: 104 }
    ]
  }, overrides || {});
}

function createJsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    json: async function () {
      return payload;
    },
    text: async function () {
      return JSON.stringify(payload);
    }
  };
}

function createErrorResponse(status, body) {
  return {
    ok: false,
    status: status,
    json: async function () {
      return { error: body };
    },
    text: async function () {
      return body;
    }
  };
}

function createEcwidApp(options, tracker) {
  return {
    init: function (config) {
      tracker.initCalls.push(config);

      if (options && options.throwOnInit) {
        throw new Error(options.throwOnInit);
      }

      return {
        getPayload: function (callback) {
          callback(options && Object.prototype.hasOwnProperty.call(options, 'payload') ? options.payload : null);
        }
      };
    },
    setSize: function (payload) {
      tracker.sizeCalls.push(payload);
    }
  };
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise(function (resolve) {
    setTimeout(resolve, 0);
  });
  await Promise.resolve();
}

async function createHarness(options) {
  const config = options || {};
  const dom = new JSDOM(HTML_SOURCE, {
    url: 'https://example.com/index.html' + (config.query || ''),
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });

  const window = dom.window;
  const document = window.document;
  const tracker = {
    fetchCalls: [],
    initCalls: [],
    sizeCalls: [],
    createdBlobs: [],
    downloadClicks: []
  };

  document.querySelector('meta[name="ecwid-app-id"]').setAttribute('content', config.metaAppId || '');

  if (config.rawLocalStorageValue !== undefined) {
    window.localStorage.setItem(STORAGE_KEY, config.rawLocalStorageValue);
  } else if (config.localStorageValue !== undefined) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config.localStorageValue));
  }

  window.fetch = async function (url, init) {
    tracker.fetchCalls.push({ url: url, init: init || {} });

    if (config.fetchImpl) {
      return config.fetchImpl(url, init || {}, tracker.fetchCalls);
    }

    throw new Error('fetch was not expected in this test');
  };

  window.VariantConfusionCatalogAnalyzer = config.analyzer || Analyzer;
  window.URL.createObjectURL = function (blob) {
    tracker.createdBlobs.push(blob);
    return 'blob:variant-confusion-report';
  };
  window.URL.revokeObjectURL = function () {};

  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (tagName) {
    const element = originalCreateElement(tagName);

    if (String(tagName).toLowerCase() === 'a') {
      element.click = function () {
        tracker.downloadClicks.push({ href: element.href, download: element.download });
      };
    }

    return element;
  };

  if (config.ecwidOptions !== undefined) {
    window.EcwidApp = createEcwidApp(config.ecwidOptions, tracker);
  }

  window.eval(APP_SOURCE);
  await flushAsync();
  await flushAsync();

  return {
    window: window,
    document: document,
    tracker: tracker,
    close: function () {
      dom.window.close();
    }
  };
}

test('boots into preview mode when Ecwid is unavailable', async function () {
  const harness = await createHarness();

  try {
    assert.equal(harness.document.getElementById('connection-badge').textContent, 'Not connected');
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview off');
    assert.match(harness.document.getElementById('help-text').textContent, /Click "Preview sample dashboard" to simulate the dashboard with fake merchant data/);
    assert.equal(harness.document.getElementById('preview-button').disabled, false);
    assert.equal(harness.document.getElementById('preview-center-button').disabled, false);
    assert.equal(harness.document.getElementById('preview-button').textContent, 'Preview sample dashboard');
    assert.equal(harness.document.getElementById('preview-center-button').textContent, 'Preview sample dashboard');
    assert.equal(harness.document.getElementById('metric-products').textContent, '0');
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Preview is off');
  } finally {
    harness.close();
  }
});

test('toggles the sample dashboard on and off when preview is the only available mode', async function () {
  const harness = await createHarness();

  try {
    harness.document.getElementById('preview-center-button').click();
    await flushAsync();
    await flushAsync();

    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview mode');
    assert.equal(harness.document.getElementById('connection-badge').textContent, 'Sample data');
    assert.equal(harness.document.getElementById('preview-center-button').textContent, 'Hide sample dashboard');
    assert.match(harness.document.getElementById('status-text').textContent, /Preview catalog loaded/);
    assert.ok(Number(harness.document.getElementById('metric-products').textContent) > 0);

    harness.document.getElementById('preview-center-button').click();
    await flushAsync();

    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview off');
    assert.equal(harness.document.getElementById('connection-badge').textContent, 'Not connected');
    assert.equal(harness.document.getElementById('preview-center-button').textContent, 'Preview sample dashboard');
    assert.equal(harness.document.getElementById('metric-products').textContent, '0');
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Preview is off');
    assert.match(harness.document.getElementById('status-text').textContent, /Sample dashboard hidden/);
  } finally {
    harness.close();
  }
});

test('boots into preview mode when local preview preference is persisted', async function () {
  const harness = await createHarness({
    localStorageValue: {
      scanLimit: 200,
      minimumScore: 8,
      includeDisabled: false,
      previewMode: true
    }
  });

  try {
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview mode');
    assert.equal(harness.document.getElementById('connection-badge').textContent, 'Sample data');
    assert.equal(harness.document.getElementById('preview-center-button').textContent, 'Hide sample dashboard');
    assert.ok(Number(harness.document.getElementById('metric-products').textContent) > 0);
  } finally {
    harness.close();
  }
});

test('boots live mode and filters disabled products by default', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '12345', access_token: 'secret-token' }
    },
    fetchImpl: async function (url, init) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ storeName: 'Alpha Store' });
      }

      if (url.includes('/products?limit=100&offset=0')) {
        return createJsonResponse({
          items: [
            createProduct(1),
            createProduct(2, { enabled: false })
          ]
        });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.equal(harness.tracker.initCalls[0].appId, 'app-live');
    assert.equal(harness.tracker.fetchCalls.length, 2);
    assert.equal(harness.document.getElementById('connection-badge').textContent, 'Connected');
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Alpha Store');
    assert.equal(harness.document.getElementById('metric-products').textContent, '1');
    assert.equal(harness.document.getElementById('preview-button').disabled, false);
    assert.equal(harness.tracker.fetchCalls[0].init.headers.Authorization, 'Bearer secret-token');
  } finally {
    harness.close();
  }
});

test('paginates product fetches, respects scan limits, and includes disabled products when configured', async function () {
  const pageOne = Array.from({ length: 100 }, function (_, index) {
    return createProduct(index + 1, { enabled: index % 10 !== 0 });
  });
  const pageTwo = Array.from({ length: 80 }, function (_, index) {
    return createProduct(index + 101);
  });

  const harness = await createHarness({
    metaAppId: 'app-live',
    localStorageValue: {
      scanLimit: 150,
      minimumScore: 8,
      includeDisabled: true,
      previewMode: false
    },
    ecwidOptions: {
      payload: { store_id: '98765', access_token: 'page-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ company: { companyName: 'Paged Store' } });
      }

      if (url.includes('offset=0')) {
        return createJsonResponse({ items: pageOne });
      }

      if (url.includes('offset=100')) {
        return createJsonResponse({ items: pageTwo });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.equal(harness.tracker.fetchCalls.length, 3);
    assert.equal(harness.document.getElementById('metric-products').textContent, '150');
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Paged Store');
  } finally {
    harness.close();
  }
});

test('renders live Ecwid productOptions and variations data from the API', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '77777', access_token: 'live-shape-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ company: { companyName: 'Shape Store' } });
      }

      if (url.includes('/products?limit=100&offset=0')) {
        return createJsonResponse({ items: [createEcwidLiveProduct(77)] });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Live Ecwid store');
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Shape Store');
    assert.equal(harness.document.getElementById('metric-products').textContent, '1');
    assert.match(harness.document.getElementById('risk-table-body').textContent, /Live Product 77/);
    assert.match(harness.document.getElementById('risk-table-body').textContent, /2 options \/ 12 combos/);
    assert.equal(harness.document.getElementById('export-button').disabled, false);
  } finally {
    harness.close();
  }
});

test('re-runs the live scan when include disabled is toggled', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '80808', access_token: 'include-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ storeName: 'Include Store' });
      }

      if (url.includes('/products?limit=100&offset=0')) {
        return createJsonResponse({
          items: [
            createProduct(1),
            createProduct(2, { enabled: false })
          ]
        });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.equal(harness.document.getElementById('metric-products').textContent, '1');

    harness.document.getElementById('include-disabled').checked = true;
    harness.document.getElementById('include-disabled').dispatchEvent(new harness.window.Event('change', { bubbles: true }));
    await flushAsync();
    await flushAsync();

    assert.equal(harness.document.getElementById('metric-products').textContent, '2');
    assert.equal(harness.tracker.fetchCalls.length, 4);
  } finally {
    harness.close();
  }
});

test('uses persisted preview mode and toggles back to live data on demand', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    localStorageValue: {
      scanLimit: 200,
      minimumScore: 8,
      includeDisabled: false,
      previewMode: true
    },
    ecwidOptions: {
      payload: { store_id: '555', access_token: 'preview-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ storeName: 'Live Store' });
      }

      if (url.includes('/products?limit=100&offset=0')) {
        return createJsonResponse({ items: [createProduct(10)] });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.equal(harness.tracker.fetchCalls.length, 0);
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview mode');

    harness.document.getElementById('preview-button').click();
    await flushAsync();
    await flushAsync();

    assert.equal(harness.tracker.fetchCalls.length, 2);
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Live Ecwid store');
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Live Store');

    const stored = JSON.parse(harness.window.localStorage.getItem(STORAGE_KEY));
    assert.equal(stored.previewMode, false);
  } finally {
    harness.close();
  }
});

test('shows an error and still renders a fallback report when the live Ecwid scan fails', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '222', access_token: 'bad-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createErrorResponse(500, 'profile failed');
      }

      if (url.includes('/products?limit=100&offset=0')) {
        return createJsonResponse({ items: [createProduct(30)] });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.match(harness.document.getElementById('status-text').textContent, /Ecwid API 500: profile failed/);
    assert.ok(Number(harness.document.getElementById('metric-products').textContent) > 0);
    assert.equal(harness.document.getElementById('store-meta').textContent, 'Store #222');
  } finally {
    harness.close();
  }
});

test('shows a live catalog error when products fail after profile succeeds', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '333', access_token: 'catalog-fail-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ storeName: 'Catalog Error Store' });
      }

      if (url.includes('/products?limit=100&offset=0')) {
        return createErrorResponse(403, 'catalog forbidden');
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.match(harness.document.getElementById('status-text').textContent, /Ecwid API 403: catalog forbidden/);
    assert.ok(Number(harness.document.getElementById('metric-products').textContent) > 0);
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Live Ecwid store');
  } finally {
    harness.close();
  }
});

test('keeps preview off when the Ecwid payload is missing store credentials', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '444' }
    }
  });

  try {
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview off');
    assert.equal(harness.document.getElementById('connection-badge').textContent, 'Not connected');
    assert.equal(harness.document.getElementById('metric-products').textContent, '0');
    assert.match(harness.document.getElementById('help-text').textContent, /simulate the dashboard with fake merchant data/);
  } finally {
    harness.close();
  }
});

test('refresh button re-runs the active live scan', async function () {
  let refreshCycle = 0;
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      payload: { store_id: '90909', access_token: 'refresh-token' }
    },
    fetchImpl: async function (url) {
      if (url.endsWith('/profile')) {
        return createJsonResponse({ storeName: 'Refresh Store' });
      }

      if (url.includes('/products?limit=100&offset=0')) {
        refreshCycle += 1;
        return createJsonResponse({ items: [createProduct(refreshCycle)] });
      }

      throw new Error('Unexpected URL: ' + url);
    }
  });

  try {
    assert.match(harness.document.getElementById('risk-table-body').textContent, /Product 1/);

    harness.document.getElementById('refresh-button').click();
    await flushAsync();
    await flushAsync();

    assert.match(harness.document.getElementById('risk-table-body').textContent, /Product 2/);
    assert.equal(harness.tracker.fetchCalls.length, 4);
  } finally {
    harness.close();
  }
});

test('falls back to default preferences when localStorage is invalid JSON', async function () {
  const harness = await createHarness({
    rawLocalStorageValue: '{not valid json}'
  });

  try {
    assert.equal(harness.document.getElementById('scan-limit').value, '200');
    assert.equal(harness.document.getElementById('score-filter').value, '8');
    assert.equal(harness.document.getElementById('include-disabled').checked, false);
  } finally {
    harness.close();
  }
});

test('exports the filtered report as CSV', async function () {
  const harness = await createHarness();

  try {
    harness.document.getElementById('preview-center-button').click();
    await flushAsync();
    await flushAsync();

    harness.document.getElementById('score-filter').value = '20';
    harness.document.getElementById('score-filter').dispatchEvent(new harness.window.Event('change', { bubbles: true }));
    await flushAsync();

    harness.document.getElementById('export-button').click();
    await flushAsync();

    assert.equal(harness.tracker.createdBlobs.length, 1);
    assert.equal(harness.tracker.downloadClicks[0].download, 'variant-confusion-report.csv');

    const csv = await harness.tracker.createdBlobs[0].text();
    assert.match(csv, /Product ID,Name,SKU,Severity,Score,Options,Combinations,Signals,Next action/);
    assert.match(csv, /Performance Runner/);
  } finally {
    harness.close();
  }
});

test('falls back to preview mode when EcwidApp initialization throws', async function () {
  const harness = await createHarness({
    metaAppId: 'app-live',
    ecwidOptions: {
      throwOnInit: 'SDK init failed'
    }
  });

  try {
    assert.equal(harness.document.getElementById('mode-badge').textContent, 'Preview mode');
    assert.match(harness.document.getElementById('status-text').textContent, /Preview catalog loaded/);
  } finally {
    harness.close();
  }
});