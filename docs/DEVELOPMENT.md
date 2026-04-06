# Development Guide

## Local preview

```bash
npm install
npm run dev
```

This serves the static `public/` folder on `http://localhost:3000`.

If the page is not inside the Ecwid admin iframe, it automatically falls back to sample catalog data so you can work on the dashboard UI and analyzer logic locally.

## Live Ecwid testing

For real catalog scans, the app must run inside an Ecwid admin iframe with a valid app ID.

Set the app ID in `public/index.html`:

```html
<meta name="ecwid-app-id" content="your-ecwid-app-id">
```

Or append it during testing:

```text
https://your-static-host/index.html?appId=your-ecwid-app-id
```

## Files you will edit most often

- `public/index.html`: dashboard structure
- `public/styles.css`: dashboard visuals
- `public/app.js`: Ecwid integration and rendering
- `public/catalog-analyzer.js`: risk scoring logic

## Validation

Run both checks before treating work as done:

```bash
npm run build
npm run lint
npm test
```

`npm run build` creates a deployable `dist/` directory from the static app assets.

`npm run lint` validates JavaScript syntax and confirms the expected local assets are wired into `public/index.html`.

`npm test` runs smoke tests against the analyzer and dashboard file structure.

## Analyzer development notes

The analyzer intentionally scores catalog structure rather than shopper behavior. Keep changes aligned with that design boundary.

Good signal examples:

- too many combinations
- too many option groups
- too many values within one option
- unclear option naming
- duplicate normalized values
- high unavailable-combination ratio

Signals to avoid in this project unless architecture changes:

- per-session visitor tracking
- event ingestion from storefront scripts
- persistent behavioral history on your own infrastructure

## Ecwid API use in this project

The browser app requests only the endpoints it needs for a merchant scan:

- `GET /profile`
- paginated `GET /products`

Requests are authorized with the `access_token` returned by `EcwidApp.getPayload()`.

## Performance guidance

- Keep the default scan limit reasonable for browser execution
- Prefer a small number of deterministic heuristics over heavy analysis
- Do not fetch product-by-product detail unless the list endpoint becomes insufficient

## Debugging tips

- Use browser DevTools on the static preview page for local UI work.
- Use DevTools inside the Ecwid admin iframe to inspect live payload and REST responses.
- If live scans fail, verify the app ID and confirm the page is actually running inside Ecwid admin.
- When changing heuristics, add or update smoke-test coverage in `scripts/smoke-test.js`.

## Project conventions

| Element | Convention | Example |
|---------|-----------|---------|
| File names | kebab-case | `catalog-analyzer.js` |
| Variables | camelCase | `storeId`, `scanLimit` |
| Constants | SCREAMING_SNAKE_CASE | `STORAGE_KEY` |
| CSS classes | semantic and lightweight | `.metric-card`, `.signal-item` |
| Commits | Conventional style | `feat: refine duplicate label scoring` |
