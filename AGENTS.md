# Shipaton Budapest agent guide

## Project

- This is a static Astro 7 and MDX archive for Budapest Shipaton editions.
- `/` redirects to the current edition at `/2026/`; event pages live at `/2026/events/<id>/`.
- Event data and copy live in `src/content/events/2026/`. Keep `src/content.config.ts` and `_template.mdx` aligned when fields change.
- Edition-specific pages, components, and styles belong under `src/editions/<year>/`; authored public assets belong under `public/<year>/`.
- Keep past editions isolated so a future redesign cannot alter an earlier edition.
- Cloudflare Pages builds `dist/`. Pull requests trigger validation and a branch preview; pushes to `main` deploy production.

## Development

```sh
npm install
npm run dev
npm run check
npm run build
npm run test:ui
```

Playwright covers mobile, tablet, and desktop. Add the smallest relevant assertion when changing responsive behavior or a shared interaction.

## Handoff

For every user request managed as a goal or as an end-to-end feature request, **always finish the handoff by committing and pushing all in-scope changes to a draft pull request** so Cloudflare can deploy a preview branch.

1. Run the relevant checks; for UI work, use `npm run check`, `npm run build`, and `npm run test:ui`.
2. Stage only files that belong to the request and commit them with a terse summary.
3. Push the working branch. When starting from `main`, use an `agent/<description>` branch.
4. Open a draft PR targeting `main`, or update the existing PR for the branch and convert it back to draft when necessary.
5. Confirm the Cloudflare Preview & CI result and include the preview URL in the handoff. If deployment is unavailable, report the exact blocker instead of presenting local validation as a deployed preview.

Do not hand off goal or end-to-end feature work with uncommitted changes, an unpushed branch, or a ready-for-review PR.
