# Contributing

## Getting Started

1. Clone the repo
2. Run `npm install`
3. Run `npm run dev`
4. Open the dashboard locally at `http://localhost:3000`

## Development Workflow

1. Create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes
3. Run `npm run lint` to check for issues
4. Run `npm test`
4. Commit with conventional commit messages:
   - `feat: add a new catalog signal`
   - `fix: handle Ecwid payload fallback`
   - `docs: update API reference`
5. Push and open a PR

## Code Style

- Match the style already present in the file you are editing
- Keep functions small and focused
- Keep merchant-facing copy concrete and operational
- Follow the naming conventions in AGENTS.md

## Adding New Features

- **New merchant dashboard feature:** Edit `public/index.html`, `public/styles.css`, and `public/app.js`
- **New scoring rule:** Add it in `public/catalog-analyzer.js` and cover it in `scripts/smoke-test.js`
- **New static validation rule:** Update `scripts/lint.js`

## Important Rules

- Never add a production backend, database, or Redis layer unless explicitly requested
- Keep the app merchant-facing inside Ecwid admin, not shopper-facing on the storefront
- Handle Ecwid product pagination cleanly when changing catalog fetch behavior
- Preserve the sample preview mode for local development
