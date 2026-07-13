# Shipaton Budapest

A small static site for the Budapest Shipaton 2026 event series. Astro renders the page; the browser only runs the date-aware event rail.

## Local development

```sh
npm install
npx playwright install chromium
npm run dev
```

Quality checks:

```sh
npm run check
npm run build
npm test
```

The Playwright suite runs at mobile, tablet, and desktop sizes. It fixes the browser date during tests so past/upcoming selection remains deterministic.

## Update the schedule

Edit `src/data/events.ts`. Events must remain in chronological order. The page selects the first event on or after the current Budapest date; after the series ends, it selects the last event.

The checked-in entries are a draft because no public Budapest listing currently exists on the official Shipaton calendar.

## Cloudflare Pages

This uses the same direct-upload shape as SplitEasy: every pull request validates, deploys a branch preview, then runs Playwright against the returned URL. A push to `main` deploys production. If Cloudflare credentials are missing, CI still builds and runs Playwright against a local preview.

Create the Pages project once:

```sh
npx wrangler pages project create shipaton-budapest --production-branch main
```

In the repository's GitHub Actions secrets, add:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The API token needs Cloudflare Pages edit permission for the account. Repository secrets keep private repositories compatible with GitHub Free; do not store them as environment secrets. The project name defaults to `shipaton-budapest`; override it with the `CLOUDFLARE_PAGES_PROJECT` repository variable if needed.

Cloudflare Pages hosts both previews and production, so the repository can remain private without adding a second GitHub Pages deployment path.

## Brand assets

The logo and rocket illustration come from the official [Shipaton 2026 media kit](https://www.shipaton.com/media-kit), where they are offered as free-to-use Shipaton assets.
