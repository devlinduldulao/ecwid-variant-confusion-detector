# Deployment Guide

## Production model

This project is deployed as a static HTTPS site. There is no production Node.js process, database, or Redis layer.

You only need to host the static files produced by this repo.

## Recommended hosts

Any static host is enough, for example:

- GitHub Pages
- Cloudflare Pages
- Netlify
- Vercel static hosting
- Amazon S3 + CloudFront

## What to deploy

For manual hosting, you can deploy `public/` directly.

For CI/CD, run `npm run build` and deploy `dist/`, which is the production-ready copy used by the GitHub Pages workflow.

Example target:

```text
https://your-static-host.example.com/index.html
```

## GitHub Actions workflow

This repository includes two GitHub Actions workflows:

- `.github/workflows/ci.yml`: runs `npm ci`, `npm run lint`, `npm test`, and `npm run build` on pushes, pull requests, and manual runs
- `.github/workflows/deploy-pages.yml`: builds `dist/` and deploys it to GitHub Pages from the repository default branch or by manual dispatch

If you use GitHub Pages, enable it in the repository settings and select **GitHub Actions** as the source.

### GitHub Pages steps

1. Push the repository to GitHub.
2. Open **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Leave `.github/workflows/deploy-pages.yml` in place.
5. Push to the default branch, or trigger **Deploy GitHub Pages** manually from the Actions tab.

The deployment target for a project repository is:

```text
https://<owner>.github.io/<repository>/
```

For the current remote, the expected URL is:

```text
https://devlinduldulao.github.io/ecwid-variant-confusion-detector/
```

After the first successful deployment, use that URL as the Ecwid app iframe URL.

## Ecwid app settings

In Ecwid app settings, configure the iframe URL to point at the hosted page:

| Setting | Value |
|---------|-------|
| App iframe URL | `https://your-static-host.example.com/index.html` |

If you want the same hosted page to support multiple test apps, you can leave the meta app ID placeholder in the file and append `?appId=...` per environment.

## Security notes

- The app runs in Ecwid admin, not on the storefront.
- The app uses the Ecwid iframe payload access token for direct API reads.
- Do not paste secret tokens into public JavaScript outside the Ecwid admin model.
- Serve the page only over HTTPS.

## No-server consequence

The following features are intentionally not part of this deployment model:

- OAuth callback endpoints
- webhooks
- server-side settings storage
- server-side catalog caching

If you add those later, the deployment model changes and this document will need to expand accordingly.
