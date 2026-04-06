(function (window, document) {
  'use strict';

  var Analyzer = window.VariantConfusionCatalogAnalyzer;
  var STORAGE_KEY = 'variant-confusion-detector-ecwid-preferences';
  var APP_ID_PLACEHOLDER = 'replace-with-your-ecwid-app-id';
  var state = {
    app: null,
    ecwidPayload: null,
    isPreview: false,
    isLoading: false,
    lastError: '',
    profile: null,
    report: null,
    products: [],
    preferences: loadPreferences()
  };

  var refs = {
    connectionBadge: document.getElementById('connection-badge'),
    modeBadge: document.getElementById('mode-badge'),
    storeMeta: document.getElementById('store-meta'),
    statusText: document.getElementById('status-text'),
    lastScan: document.getElementById('last-scan'),
    helpText: document.getElementById('help-text'),
    scanLimit: document.getElementById('scan-limit'),
    scoreFilter: document.getElementById('score-filter'),
    includeDisabled: document.getElementById('include-disabled'),
    refreshButton: document.getElementById('refresh-button'),
    previewButton: document.getElementById('preview-button'),
    exportButton: document.getElementById('export-button'),
    metricProducts: document.getElementById('metric-products'),
    metricRisk: document.getElementById('metric-risk'),
    metricUrgent: document.getElementById('metric-urgent'),
    metricAverage: document.getElementById('metric-average'),
    riskTable: document.getElementById('risk-table-body'),
    riskEmpty: document.getElementById('risk-empty'),
    signalsList: document.getElementById('signals-list'),
    recommendationsList: document.getElementById('recommendations-list')
  };

  if (!Analyzer) {
    setStatus('Analyzer bundle is missing.', true);
    return;
  }

  bindEvents();
  syncPreferenceInputs();
  setStatus('Preparing the merchant dashboard.');
  updateChrome();
  boot();

  function bindEvents() {
    refs.refreshButton.addEventListener('click', function () {
      refreshAnalysis();
    });

    bindPreviewButtons();

    refs.exportButton.addEventListener('click', exportCsv);

    refs.scanLimit.addEventListener('change', function () {
      state.preferences.scanLimit = clampNumber(refs.scanLimit.value, 25, 500, 200);
      persistPreferences();
      syncPreferenceInputs();
      refreshAnalysis();
    });

    refs.scoreFilter.addEventListener('change', function () {
      state.preferences.minimumScore = clampNumber(refs.scoreFilter.value, 0, 50, 8);
      persistPreferences();
      syncPreferenceInputs();
      renderReport();
    });

    refs.includeDisabled.addEventListener('change', function () {
      state.preferences.includeDisabled = refs.includeDisabled.checked;
      persistPreferences();
      refreshAnalysis();
    });
  }

  function bindPreviewButtons() {
    eachPreviewButton(function (button) {
      button.addEventListener('click', function () {
        handlePreviewTrigger();
      });
    });
  }

  function handlePreviewTrigger() {
    if (!canUseLiveData()) {
      state.isPreview = !state.isPreview;
      state.preferences.previewMode = state.isPreview;
      persistPreferences();
      updateHelpText();

      if (state.isPreview) {
        setStatus('Loading sample merchant catalog.');
        refreshAnalysis();
        return;
      }

      clearDashboard('Sample dashboard hidden. Click "Preview sample dashboard" to show fake merchant data.');
      return;
    }

    state.isPreview = !state.isPreview;
    state.preferences.previewMode = state.isPreview;
    persistPreferences();
    refreshAnalysis();
  }

  function boot() {
    var appId = getConfiguredAppId();

    if (!window.EcwidApp || !appId) {
      state.isPreview = Boolean(state.preferences.previewMode);
      updateHelpText();
      if (state.isPreview) {
        refreshAnalysis();
      } else {
        clearDashboard('Preview is off. Click "Preview sample dashboard" to load fake merchant data.');
      }
      return;
    }

    try {
      state.app = window.EcwidApp.init({ appId: appId });
      state.app.getPayload(function (payload) {
        if (!payload || !payload.store_id || !payload.access_token) {
          state.isPreview = Boolean(state.preferences.previewMode);
          updateHelpText();
          if (state.isPreview) {
            refreshAnalysis();
          } else {
            clearDashboard('Preview is off. Click "Preview sample dashboard" to load fake merchant data.');
          }
          return;
        }

        state.ecwidPayload = payload;
        state.isPreview = Boolean(state.preferences.previewMode);
        updateHelpText();
        refreshAnalysis();
      });
    } catch (error) {
      state.isPreview = true;
      state.preferences.previewMode = true;
      persistPreferences();
      updateHelpText();
      setStatus(error.message || 'Unable to initialize Ecwid.', true);
      refreshAnalysis();
    }
  }

  function refreshAnalysis() {
    if (state.isLoading) {
      return;
    }

    state.isLoading = true;
    state.lastError = '';
    updateChrome();
    setStatus(state.isPreview ? 'Loading sample merchant catalog.' : 'Scanning the Ecwid catalog for variant confusion signals.');

    var runner = state.isPreview ? loadPreviewCatalog() : loadLiveCatalog();

    runner
      .then(function (catalogState) {
        state.products = catalogState.products;
        state.profile = catalogState.profile;
        state.report = Analyzer.analyzeCatalog(catalogState.products, {
          minimumScore: state.preferences.minimumScore
        });
        renderReport();
        state.lastError = '';
        setStatus(state.isPreview ? 'Preview catalog loaded.' : 'Catalog scan complete.');
      })
      .catch(function (error) {
        state.lastError = error && error.message ? error.message : 'Unable to scan the catalog.';
        setStatus(state.lastError, true);
        state.report = Analyzer.analyzeCatalog(Analyzer.buildSampleCatalog(), {
          minimumScore: state.preferences.minimumScore
        });
        renderReport();
      })
      .finally(function () {
        state.isLoading = false;
        refs.lastScan.textContent = new Date().toLocaleString();
        updateChrome();
        resizeIframe();
      });
  }

  function loadPreviewCatalog() {
    return Promise.resolve({
      profile: {
        storeName: 'Preview Store',
        company: { companyName: 'Preview Store' }
      },
      products: Analyzer.buildSampleCatalog()
    });
  }

  function loadLiveCatalog() {
    return Promise.all([fetchEcwid('/profile'), fetchAllProducts()]).then(function (results) {
      return {
        profile: results[0],
        products: results[1]
      };
    });
  }

  function fetchAllProducts() {
    var results = [];
    var limit = 100;
    var offset = 0;
    var maxProducts = state.preferences.scanLimit;

    function nextPage() {
      return fetchEcwid('/products?limit=' + limit + '&offset=' + offset).then(function (response) {
        var items = Array.isArray(response.items) ? response.items : [];
        var filtered = state.preferences.includeDisabled ? items : items.filter(function (product) {
          return product && product.enabled !== false;
        });

        results = results.concat(filtered);

        if (results.length >= maxProducts || items.length < limit) {
          return results.slice(0, maxProducts);
        }

        offset += limit;
        return nextPage();
      });
    }

    return nextPage();
  }

  function fetchEcwid(path) {
    var payload = state.ecwidPayload;
    var base = 'https://app.ecwid.com/api/v3/' + encodeURIComponent(payload.store_id);

    return window.fetch(base + path, {
      headers: {
        Authorization: 'Bearer ' + payload.access_token,
        'Content-Type': 'application/json'
      }
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (body) {
          throw new Error('Ecwid API ' + response.status + ': ' + body);
        });
      }

      return response.json();
    });
  }

  function renderReport() {
    var report = state.report;

    if (!report) {
      return;
    }

    var filteredProducts = report.products.filter(function (product) {
      return product.score >= state.preferences.minimumScore;
    });

    refs.metricProducts.textContent = String(report.summary.productsAnalyzed);
    refs.metricRisk.textContent = String(filteredProducts.length);
    refs.metricUrgent.textContent = String(report.products.filter(function (product) {
      return product.severity === 'urgent';
    }).length);
    refs.metricAverage.textContent = String(report.summary.averageRiskScore);

    renderRiskTable(filteredProducts);
    renderSignals(report.summary.signalCounts);
    renderRecommendations(report.recommendations);
    updateChrome();
    resizeIframe();
  }

  function renderRiskTable(products) {
    refs.riskTable.innerHTML = '';

    if (!products.length) {
      refs.riskEmpty.hidden = false;
      refs.exportButton.disabled = true;
      return;
    }

    refs.riskEmpty.hidden = true;
    refs.exportButton.disabled = false;

    products.slice(0, 25).forEach(function (product) {
      var row = document.createElement('tr');
      row.innerHTML = [
        '<td>',
        '<div class="product-cell">',
        '<strong>' + escapeHtml(product.name) + '</strong>',
        '<span>' + escapeHtml(product.sku) + '</span>',
        '</div>',
        '</td>',
        '<td><span class="severity severity-' + product.severity + '">' + escapeHtml(product.severity) + '</span></td>',
        '<td>' + product.score + '</td>',
        '<td>' + product.optionCount + ' options / ' + product.combinationCount + ' combos</td>',
        '<td>' + escapeHtml(product.signals.slice(0, 2).map(function (signal) { return signal.label; }).join(', ')) + '</td>',
        '<td>' + escapeHtml(product.nextAction) + '</td>'
      ].join('');
      refs.riskTable.appendChild(row);
    });
  }

  function renderSignals(signalCounts) {
    refs.signalsList.innerHTML = '';

    var keys = Object.keys(signalCounts || {}).sort(function (left, right) {
      return signalCounts[right] - signalCounts[left];
    });

    if (!keys.length) {
      refs.signalsList.innerHTML = '<li class="empty-line">No catalog-level confusion signals were detected in this scan.</li>';
      return;
    }

    keys.slice(0, 6).forEach(function (key) {
      var item = document.createElement('li');
      item.className = 'signal-item';
      item.innerHTML = '<span>' + escapeHtml(Analyzer.signalLabels[key] || key) + '</span><strong>' + signalCounts[key] + '</strong>';
      refs.signalsList.appendChild(item);
    });
  }

  function renderRecommendations(recommendations) {
    refs.recommendationsList.innerHTML = '';

    if (!recommendations.length) {
      refs.recommendationsList.innerHTML = '<li class="empty-line">No immediate catalog cleanup is suggested.</li>';
      return;
    }

    recommendations.forEach(function (recommendation) {
      var item = document.createElement('li');
      item.className = 'recommendation-item';
      item.innerHTML = '<strong>' + escapeHtml(recommendation.label) + '</strong><p>' + escapeHtml(recommendation.action) + ' Seen on ' + recommendation.count + ' product' + (recommendation.count === 1 ? '' : 's') + '.</p>';
      refs.recommendationsList.appendChild(item);
    });
  }

  function clearDashboard(message) {
    state.report = null;
    state.products = [];
    state.profile = null;

    refs.metricProducts.textContent = '0';
    refs.metricRisk.textContent = '0';
    refs.metricUrgent.textContent = '0';
    refs.metricAverage.textContent = '0';
    refs.riskTable.innerHTML = '';
    refs.riskEmpty.hidden = false;
    refs.riskEmpty.textContent = 'Preview data is hidden. Click "Preview sample dashboard" to show the simulated catalog.';
    refs.signalsList.innerHTML = '<li class="empty-line">Preview data is hidden.</li>';
    refs.recommendationsList.innerHTML = '<li class="empty-line">Preview data is hidden.</li>';
    refs.exportButton.disabled = true;
    refs.lastScan.textContent = 'Preview hidden';
    setStatus(message || 'Preview data is hidden.');
    updateChrome();
    resizeIframe();
  }

  function updateChrome() {
    var profileName = getProfileName();
    var liveDataAvailable = canUseLiveData();
    var modeLabel = liveDataAvailable
      ? (state.isPreview ? 'Preview mode' : 'Live Ecwid store')
      : (state.isPreview ? 'Preview mode' : 'Preview off');
    var connectionLabel = state.isPreview
      ? 'Sample data'
      : (liveDataAvailable ? 'Connected' : 'Not connected');

    refs.connectionBadge.textContent = connectionLabel;
    refs.modeBadge.textContent = modeLabel;
    refs.connectionBadge.className = 'badge ' + (state.isPreview ? 'badge-muted' : state.ecwidPayload ? 'badge-good' : 'badge-waiting');
    refs.modeBadge.className = 'badge badge-outline';
    refs.storeMeta.textContent = profileName;
    refs.refreshButton.disabled = state.isLoading || (!liveDataAvailable && !state.isPreview);
    eachPreviewButton(function (button) {
      button.disabled = state.isLoading;
      button.textContent = !liveDataAvailable
        ? (state.isPreview ? 'Hide sample dashboard' : 'Preview sample dashboard')
        : (state.isPreview ? 'Return to live dashboard' : 'Preview sample dashboard');
    });
  }

  function eachPreviewButton(callback) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-preview-trigger]'), function (button) {
      callback(button);
    });
  }

  function updateHelpText() {
    if (!window.EcwidApp || !getConfiguredAppId()) {
      refs.helpText.textContent = state.isPreview
        ? 'Preview mode is showing fake merchant data so the store owner can demo the dashboard without touching the live catalog.'
        : 'Live Ecwid data is not connected. Click "Preview sample dashboard" to simulate the dashboard with fake merchant data.';
      return;
    }

    if (!state.ecwidPayload) {
      refs.helpText.textContent = state.isPreview
        ? 'Preview mode is showing fake merchant data so the store owner can demo the dashboard without touching the live catalog.'
        : 'Ecwid payload is not available yet. Click "Preview sample dashboard" to simulate the dashboard with fake merchant data.';
      return;
    }

    refs.helpText.textContent = state.isPreview
      ? 'Preview mode is showing fake merchant data so the store owner can demo the dashboard without touching the live catalog.'
      : 'Live mode scores the connected Ecwid catalog. Use preview mode anytime to simulate the dashboard with fake data.';
  }

  function canUseLiveData() {
    return Boolean(state.ecwidPayload && state.ecwidPayload.store_id && state.ecwidPayload.access_token);
  }

  function getProfileName() {
    if (state.isPreview) {
      return 'Preview Store';
    }

    if (!canUseLiveData()) {
      return 'Preview is off';
    }

    if (state.profile && state.profile.storeName) {
      return state.profile.storeName;
    }

    if (state.profile && state.profile.company && state.profile.company.companyName) {
      return state.profile.company.companyName;
    }

    if (state.ecwidPayload && state.ecwidPayload.store_id) {
      return 'Store #' + state.ecwidPayload.store_id;
    }

    return 'Waiting for Ecwid connection';
  }

  function exportCsv() {
    if (!state.report) {
      return;
    }

    var lines = [
      ['Product ID', 'Name', 'SKU', 'Severity', 'Score', 'Options', 'Combinations', 'Signals', 'Next action'].join(',')
    ];

    state.report.products
      .filter(function (product) {
        return product.score >= state.preferences.minimumScore;
      })
      .forEach(function (product) {
        lines.push([
          csvEscape(product.id),
          csvEscape(product.name),
          csvEscape(product.sku),
          csvEscape(product.severity),
          csvEscape(product.score),
          csvEscape(product.optionCount),
          csvEscape(product.combinationCount),
          csvEscape(product.signals.map(function (signal) { return signal.label; }).join(' | ')),
          csvEscape(product.nextAction)
        ].join(','));
      });

    var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'variant-confusion-report.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function csvEscape(value) {
    return '"' + String(value).replace(/"/g, '""') + '"';
  }

  function setStatus(message, isError) {
    refs.statusText.textContent = message;
    refs.statusText.className = isError ? 'status status-error' : 'status';
  }

  function syncPreferenceInputs() {
    refs.scanLimit.value = state.preferences.scanLimit;
    refs.scoreFilter.value = state.preferences.minimumScore;
    refs.includeDisabled.checked = state.preferences.includeDisabled;
  }

  function loadPreferences() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return {
        scanLimit: clampNumber(parsed.scanLimit, 25, 500, 200),
        minimumScore: clampNumber(parsed.minimumScore, 0, 50, 8),
        includeDisabled: Boolean(parsed.includeDisabled),
        previewMode: Boolean(parsed.previewMode)
      };
    } catch (error) {
      return {
        scanLimit: 200,
        minimumScore: 8,
        includeDisabled: false,
        previewMode: false
      };
    }
  }

  function persistPreferences() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.preferences));
  }

  function clampNumber(value, min, max, fallback) {
    var parsed = Number(value);

    if (isNaN(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
  }

  function getConfiguredAppId() {
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get('appId');
    var meta = document.querySelector('meta[name="ecwid-app-id"]');
    var fromMeta = meta ? meta.getAttribute('content') : '';
    var appId = fromQuery || fromMeta || '';

    if (!appId || appId === APP_ID_PLACEHOLDER) {
      return '';
    }

    return appId;
  }

  function resizeIframe() {
    if (!window.EcwidApp || typeof window.EcwidApp.setSize !== 'function') {
      return;
    }

    window.setTimeout(function () {
      window.EcwidApp.setSize({ height: document.body.scrollHeight + 24 });
    }, 50);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})(window, document);