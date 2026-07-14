# Shipaton Budapest

A small static site for the Budapest Shipaton 2026 event series. Astro renders the page; the browser only runs the date-aware event rail.

Production: [shipaton-budapest.pages.dev](https://shipaton-budapest.pages.dev)

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

Add or edit an entry in `src/content/events/`; the site sorts entries by date and selects the first event on or after the current Budapest date. Copy `_template.mdx` for the complete field list.

Every entry appears on `/events/` and publishes `/events/<filename>/`. Frontmatter drives the shared facts, tags, schedule, optional RSVP, location, hosts, organizers, speakers, presentation, and attachments; the MDX body holds the welcoming description and goals. People can include an optional role and external `url`. Put uploaded files under `public/documents/`.

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
