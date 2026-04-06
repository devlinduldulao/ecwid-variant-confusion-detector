# API Reference

This project does not expose a custom HTTP API anymore.

## Runtime API usage

The dashboard calls Ecwid directly from the browser after `EcwidApp.getPayload()` returns the store credentials.

### Ecwid endpoints used

#### `GET /api/v3/{storeId}/profile`

Used to display the connected store name in the dashboard.

#### `GET /api/v3/{storeId}/products?limit=100&offset={offset}`

Used to fetch paginated catalog data for local variant-risk analysis.

## Authorization model

Requests are sent with:

```http
Authorization: Bearer <payload.access_token>
```

The token is supplied by the Ecwid admin iframe payload and is never persisted by this project outside the running browser session.

## Internal analyzer surface

`public/catalog-analyzer.js` exposes the following functions for the browser and local tests:

- `analyzeCatalog(products, options)`
- `analyzeProduct(product)`
- `buildSampleCatalog()`

## Analyzer output shape

`analyzeCatalog()` returns:

```json
{
  "generatedAt": "2026-03-20T12:00:00.000Z",
  "products": [
    {
      "id": "101",
      "name": "Performance Runner",
      "sku": "RUN-101",
      "score": 31,
      "severity": "urgent",
      "optionCount": 3,
      "combinationCount": 28,
      "signals": [
        {
          "key": "combination_overload",
          "label": "Too many variant combinations",
          "score": 14,
          "detail": "28 combinations are available."
        }
      ],
      "nextAction": "Split the product into clearer families or reduce option combinations."
    }
  ],
  "summary": {
    "productsAnalyzed": 4,
    "productsAtRisk": 3,
    "urgentProducts": 1,
    "averageRiskScore": 15,
    "totalCombinations": 54,
    "signalCounts": {
      "combination_overload": 2,
      "duplicate_values": 1
    }
  },
  "recommendations": [
    {
      "key": "combination_overload",
      "count": 2,
      "label": "Too many variant combinations",
      "action": "Split the product into clearer families or reduce option combinations."
    }
  ]
}
```

## No custom endpoints

There are intentionally no equivalents for:

- `/health`
- `/api/settings`
- `/auth/*`
- `/webhooks/*`

Adding any of those would mean reintroducing hosted infrastructure.
