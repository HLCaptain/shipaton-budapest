import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

const site = process.env.SITE_URL ?? "https://shipaton-budapest.pages.dev";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  redirects: {
    "/": "/2026/",
    "/events": "/2026/events/",
    "/events/budapest-kickoff": "/2026/events/budapest-kickoff/",
    "/events/build-sprint-one": "/2026/events/build-sprint-one/",
    "/events/ship-clinic": "/2026/events/ship-clinic/",
    "/events/demo-and-submit": "/2026/events/demo-and-submit/"
  },
  integrations: [mdx()],
  build: {
    inlineStylesheets: "never"
  }
});
