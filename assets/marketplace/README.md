# Marketplace Assets

This folder holds marketplace-ready artwork and screenshots for the Ecwid listing.

Files generated or maintained here:

- `banner.svg`: editable banner source aligned to the current app UI
- `icon.svg`: copied from `public/icon.svg` by `npm run build:publishing-assets`
- `icon-128x128.png`, `icon-256x256.png`, `icon-512x512.png`: exported listing icons
- `banner-1200x675.png`, `banner-1600x900.png`: exported banner PNGs
- `screenshot-preview-off.png`: centered preview launcher before fake data is shown
- `screenshot-preview-on.png`: current app UI with sample data visible
- `screenshot-controls-and-export.png`: controls area with export action visible

Commands:

```bash
npm run build:publishing-assets
npm run capture:marketplace
```

`npm run capture:marketplace` expects the app to already be running locally. Override the URL with `MARKETPLACE_CAPTURE_URL` if needed.