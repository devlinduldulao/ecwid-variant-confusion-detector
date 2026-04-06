# Variant Confusion Detector for Ecwid — AI Agent Notes

## Project overview

| Key | Value |
|-----|-------|
| Product | Variant Confusion Detector for Ecwid |
| Audience | Ecwid merchants in the admin dashboard |
| Runtime | Static admin iframe app |
| Store API | Ecwid REST API v3 |
| SDK | EcwidApp JS SDK |
| Backend | None in production |
| Persistence | Browser localStorage only |

## Non-negotiable constraints

- Do not add a custom production server unless explicitly requested.
- Do not add a database, Redis, or server-side cache unless explicitly requested.
- Do not turn this into a storefront visitor tracker.
- Do not port WooCommerce assumptions directly into Ecwid.

## Intended product behavior

This app helps merchants audit their catalog. It should answer questions such as:

- Which products have too many combinations?
- Which option labels are too vague?
- Which products have fragmented stock coverage across variants?
- Which products need cleanup first?

It should not depend on shopper event ingestion.

## Important files

- `public/index.html`: merchant dashboard page inside Ecwid admin
- `public/app.js`: Ecwid boot flow, API reads, rendering, CSV export
- `public/catalog-analyzer.js`: reusable scoring logic
- `public/styles.css`: dashboard styling
- `scripts/lint.js`: local validation
- `scripts/smoke-test.js`: analyzer and asset smoke tests

## Editing guidelines

- Keep the app static-host friendly.
- Prefer deterministic heuristics over heavy analysis.
- Preserve the fallback preview mode for local work outside Ecwid.
- When adding risk signals, make them explainable to merchants.
- **Number one priority:** Build an Ecwid native look and feel. Adhere strictly to the [Lightspeed Design System](https://brand.lightspeedhq.com/document/170#/brand-system/logo-1) (which includes the iconic "Flame" logo, Charcoal gray/white monochrome logos, Fire red accents, clearspace rules, and WCAG AA contrast guidelines) to ensure the app looks like a native Lightspeed/Ecwid module.

## Validation

Run both commands after meaningful changes:

```bash
npm run lint
npm test
```