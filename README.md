# Variant Confusion Detector for Ecwid

Static Ecwid merchant dashboard that scans a store's product catalog and scores which products are most likely to confuse buyers because of variant structure.

This implementation is intentionally cheap to run:

- No custom Node.js backend in production
- No database
- No Redis or other cache service
- No storefront visitor tracking

The dashboard runs inside the Ecwid admin iframe, reads the merchant's own catalog through the Ecwid REST API with the iframe payload token, and computes risk scores locally in the browser.

## What it does

- Ranks products by variant confusion risk
- Flags overloaded combination counts, unclear option naming, duplicate values, and stock fragmentation
- Exports the current priority list as CSV
- Persists dashboard preferences in browser local storage only
- Falls back to a sample catalog when opened outside Ecwid for local preview

## What it does not do

- It does not watch storefront visitors
- It does not store merchant data on your own server
- It does not require OAuth callback endpoints, webhooks, or any hosted API

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for local preview.

To run it inside Ecwid admin, set your actual Ecwid app ID in `public/index.html`:

```html
<meta name="ecwid-app-id" content="your-ecwid-app-id">
```

You can also pass the app ID temporarily with `?appId=your-ecwid-app-id`.

## Project structure

```
variant-confusion-detector/
├── public/
│   ├── index.html            # Ecwid admin iframe page
│   ├── app.js                # Dashboard bootstrapping and Ecwid API reads
│   ├── catalog-analyzer.js   # Shared risk scoring logic
│   └── styles.css            # Merchant dashboard styling
├── scripts/
│   ├── lint.js               # Syntax and asset validation
│   ├── setup.sh              # Local setup helper
│   └── smoke-test.js         # Static smoke tests for analyzer/dashboard assets
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── DEVELOPMENT.md
├── AGENTS.md
├── package.json
└── README.md
```

## Available scripts

- `npm run build`: copies the static app into `dist/` for deployment
- `npm run build:publishing-assets`: exports marketplace banner and icon PNGs into `assets/marketplace/`
- `npm run capture:marketplace`: captures fresh screenshots from the running local app into `assets/marketplace/`
- `npm run dev`: serves the static dashboard locally on port `3000`
- `npm start`: same as `npm run dev`
- `npm run lint`: validates the JavaScript bundles and HTML asset references
- `npm test`: runs unit tests plus smoke tests against the analyzer and dashboard assets
- `npm run test:unit`: runs the deeper analyzer and dashboard unit suite only

## Merchant-facing model

The WooCommerce plugin detects live shopper confusion because it owns frontend event capture and short-lived storage inside WordPress. Ecwid does not give the same in-platform backend surface without introducing your own hosted infrastructure.

This Ecwid version therefore focuses on a merchant dashboard problem that fits a free deployment model: catalog risk analysis from the admin side.

The dashboard treats confusion as a catalog quality issue and scores products using:

- variant combination depth
- number of option layers
- oversized option value lists
- generic option names such as `Option` or `Type`
- duplicate or placeholder value labels
- unavailable combination ratios
- weak image coverage for high-choice products
- wide price spread across variants

## Deployment

Host the `public/` folder on any static HTTPS host and register that URL as the app iframe URL in Ecwid. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

For GitHub Pages on the repository default branch:

1. Push this repository to GitHub.
2. In the repository settings, open Pages and choose `GitHub Actions` as the source.
3. Keep `.github/workflows/deploy-pages.yml` enabled.
4. Push to `main` or run the workflow manually from the Actions tab.

The site will publish from the built `dist/` folder to a URL like:

```text
https://<owner>.github.io/<repository>/
```

For this repository, that becomes:

```text
https://devlinduldulao.github.io/ecwid-variant-confusion-detector/
```

## More detail

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- [docs/API.md](docs/API.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/PUBLISHING.md](docs/PUBLISHING.md)

---

## License

MIT
