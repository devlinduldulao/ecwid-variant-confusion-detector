# Publishing Guide

This document prepares the Ecwid app repo for marketplace publication. It is intentionally practical: what is already ready in this repository, what still needs operator input, and what must be verified in the Ecwid partner portal before you submit.

## Repository readiness

Current state of this repo:

- Static production build exists through `npm run build`
- Automated PNG publishing asset export exists through `npm run build:publishing-assets`
- Automated marketplace screenshot capture exists through `npm run capture:marketplace`
- CI validation exists in `.github/workflows/ci.yml`
- GitHub Pages deployment exists in `.github/workflows/deploy-pages.yml`
- Tag-based release packaging exists in `.github/workflows/release-package.yml`
- Unit tests and smoke tests cover the analyzer and dashboard happy and unhappy paths
- Local app icon source exists at `public/icon.svg`
- Listing banner source exists at `assets/marketplace/banner.svg`
- Marketplace screenshots and raster exports are stored in `assets/marketplace/`

## App configuration for publication

Before submission, set these values for the real app:

1. Replace the placeholder app ID in `public/index.html` or supply it through environment-specific hosting URLs.
2. Deploy the built `dist/` directory to a stable HTTPS URL.
3. Register that hosted URL as the Ecwid admin iframe URL.
4. Request only the scopes the app actually uses.

Recommended minimum scopes for this app model:

- `read_store_profile`
- `read_catalog`

This app does not need write scopes, webhook scopes, or storefront customization scopes in its current form.

## Listing copy draft

Suggested app name:

- Variant Confusion Detector

Suggested short description:

- Merchant dashboard for spotting confusing Ecwid product variant structures before they hurt conversion.

Suggested value points:

- Flags overloaded variant combinations and vague option naming
- Ranks the products that need cleanup first
- Works inside Ecwid admin without a custom database or tracking server
- Includes preview mode for demos and onboarding

## Required operator-provided items

These cannot be finalized from code alone:

- Real app ID
- Production iframe URL
- Support email or support URL
- Privacy policy URL
- Terms of service URL if the partner portal requires one
- Final confirmation that the generated icon and banner sizes match the current portal form

## Asset checklist

Available source assets in this repo:

- `public/icon.svg`
- `assets/marketplace/banner.svg`

Generated marketplace assets:

- `assets/marketplace/icon.svg`
- `assets/marketplace/icon-128x128.png`
- `assets/marketplace/icon-256x256.png`
- `assets/marketplace/icon-512x512.png`
- `assets/marketplace/banner-1200x675.png`
- `assets/marketplace/banner-1600x900.png`
- `assets/marketplace/screenshot-preview-off.png`
- `assets/marketplace/screenshot-preview-on.png`
- `assets/marketplace/screenshot-controls-and-export.png`

Still needed before submission:

1. Confirm whether the current Ecwid listing form wants one of the generated sizes or a different size.
2. If desired, recapture screenshots from the latest deployed UI before the final store submission.

## Product checks before submission

Run these commands before every publish candidate:

```bash
npm run lint
npm test
npm run build
npm run build:publishing-assets
npm run capture:marketplace
```

Then verify manually:

1. The app loads outside Ecwid in preview mode.
2. The app loads inside Ecwid admin with a real payload.
3. The live scan reads `/profile` and paginated `/products` successfully.
4. CSV export downloads and contains the filtered product list.
5. No secrets are embedded in the shipped static files.

## Submission notes for this app

This product is an admin-side catalog diagnostic tool, not a shopper-tracking app. Keep the listing language aligned with that boundary.

Do not describe it as:

- live shopper session recording
- storefront analytics tracking
- per-customer behavioral monitoring

Describe it as:

- catalog quality auditing
- variant decision-friction detection
- merchant-side prioritization and cleanup

## Test boundary

This app does not ingest online visitor or shopper-session telemetry. The supported production surface is Ecwid admin payload data plus Ecwid REST API reads for store profile and catalog records. Testing should therefore focus on:

- successful store profile and catalog reads
- realistic Ecwid product payload shapes such as `productOptions` and `variations`
- pagination, disabled-product filtering, preview/live toggling, and CSV export
- unhappy paths such as SDK initialization errors, missing payload credentials, and API failures

## Release workflow

1. Merge validated changes into the default branch.
2. Let GitHub Actions build and deploy the static app.
3. Create a release tag if you want the CI package zip and generated publishing assets attached automatically.
4. Test the deployed URL inside Ecwid admin.
5. Recapture listing screenshots from that deployment if the UI changed since the last asset run.
6. Submit the listing through the current Ecwid partner portal flow.