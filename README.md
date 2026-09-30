# Shipaton Budapest

A static archive for Budapest Shipaton editions. The root redirects to the current edition at `/2026/`; Astro renders each edition while the browser only runs its small interaction scripts.

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

Add or edit a flat, lowercase kebab-case entry in `src/content/events/2026/`; the edition sorts entries by date and selects the first event on or after the current Budapest date. Copy `_template.mdx` there for the complete field list.

Every entry appears on `/2026/events/` and publishes at `/2026/events/<filename>/`. Frontmatter drives the shared facts, tags, schedule, optional registration links, venue, people, presentations, and attachments; the MDX body holds the welcoming description and goals. Put uploaded files under `public/2026/documents/`.

Reusable facts have these owners:

| Facts | Edit here |
| --- | --- |
| Edition name, links, timezone, deadline, brand assets, contact profile, footer event selection | `src/editions/2026/config.ts` |
| People/community names and profiles; venue labels, Maps URLs, directions and photos | `src/editions/2026/references.ts` |
| Event-specific facts and `links.rsvp` / `links.meetup` | The event's MDX frontmatter |
| Accepted fields and validation | `src/editions/2026/schema.ts` and `_template.mdx` together |
| Site origin, current edition, legacy redirects | `src/site.config.mjs` (`SITE_URL` overrides the origin) |

Use `venue: "genesys-hungary"` or an inline venue object. People and presentation speakers accept `{ ref: "marton-braun" }` or inline `{ name, url?, role? }` records; a reference may include an event-specific `role`. The template demonstrates both forms. A contact profile can also supply `urlLabel` (otherwise “Profile”) and optional `social.github` / `social.x` links; only available links are shown. Keep sequence numbers, time ranges, themes, tags, and speaker lists explicit: changing dates or publishing slides should not change those facts automatically.

MDX receives resolved data as `props.event` and edition settings as `props.edition`. For example, use `<a href={props.event.links.rsvp}>RSVP</a>` or `{props.event.venue.name}` instead of copying the URL or name into prose. Named profiles and venues can also be imported from the edition reference module. Leave unique narrative and headings authored normally.

The server-only event loader resolves references on every read, so a reference-only edit is reflected even when Astro reuses cached MDX. Missing references fail the build with the event and field. Browser date/selection helpers stay separate from content loading. `llms.txt` and Cloudflare's `_redirects` are generated during the build; edit their source records instead of `dist/`.

The 2026 design and reference records are frozen under `src/editions/2026/`, with authored assets and standalone scripts under `public/2026/`. The event rail script lives in edition source so Astro can bundle its shared date/selection imports. A future edition should get its own page, content, edition, and public directories so rebuilding it cannot change earlier designs. Deployment-wide headers and robots rules remain at the root of `public/`; legacy redirects stay pinned to their original edition.

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

## License

The source code is available under the [MIT License](LICENSE). Content and image assets are not included unless expressly stated otherwise.

## Brand assets

These official Shipaton assets are excluded from the MIT License:

- `public/2026/brand/rocket-launch-wide.svg`
- `public/2026/brand/shipaton-wordmark.svg`
- `public/2026/brand/shippy-pixel-head.png`
- `public/2026/brand/shipaton-budapest-social-card.png`

The wordmark and rocket illustration come from the official [Shipaton 2026 media kit](https://www.shipaton.com/media-kit), where they are offered as free-to-use Shipaton assets for event and promotional materials. The social card combines those two assets, and the pixel head is official Shipaton artwork. All four remain subject to the asset owner's permissions; this repository grants no rights to Shipaton names, marks, or artwork.
