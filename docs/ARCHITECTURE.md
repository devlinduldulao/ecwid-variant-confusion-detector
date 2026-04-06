# Architecture

## Goal

This Ecwid app is a merchant-facing dashboard, not a storefront widget and not a hosted backend service. Its job is to help the store owner find products whose variant setup is likely to create decision friction.

## Why the Ecwid version is different from WooCommerce

The WooCommerce plugin can capture live frontend behavior because it runs inside WordPress and can keep short-lived event state in the host platform.

The Ecwid project is deliberately avoiding:

- a custom backend server
- a database
- Redis or other cache layers
- storefront visitor tracking

That constraint rules out a direct port of the WooCommerce event-ingestion model.

## Chosen model

The app now uses a static admin iframe architecture:

```
Ecwid admin iframe
    -> EcwidApp SDK payload
    -> store_id + access_token
    -> direct REST API requests to /profile and /products
    -> in-browser catalog analysis
    -> merchant dashboard + CSV export
```

## Runtime surfaces

### 1. Static admin page

Files:

- `public/index.html`
- `public/styles.css`
- `public/app.js`

This page is hosted on static HTTPS and loaded by Ecwid inside the merchant dashboard iframe.

### 2. Shared analyzer

File:

- `public/catalog-analyzer.js`

This contains the catalog scoring logic and is shared by the browser app and local smoke tests.

## Data flow

1. Ecwid loads the iframe URL.
2. `EcwidApp.init()` boots with your app ID.
3. `getPayload()` returns `store_id` and `access_token`.
4. The app requests `GET /profile` and paginated `GET /products` directly from Ecwid REST API.
5. The analyzer scores variant risk per product.
6. The merchant sees a ranked dashboard and can export the results as CSV.

## Persistence model

There is no server-side persistence in this project.

- Merchant catalog data stays in Ecwid.
- Dashboard preferences are stored only in browser `localStorage`.
- No copied store data is written to your own infrastructure.

## Scoring model

The analyzer focuses on catalog structure that commonly causes confusion:

- combination overload
- too many option layers
- oversized value lists
- generic option names
- duplicate normalized values
- ambiguous placeholder values
- high ratio of unavailable combinations
- thin image coverage on deep variant trees
- large price spread across variants

The output is a merchant prioritization tool, not a behavioral analytics feed.

## Deployment consequence

Because the app is static, production hosting only needs an HTTPS file host for the `public/` folder. There is no long-running app process to keep alive.
