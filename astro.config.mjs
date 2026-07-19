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
    "/events/project-kickoff": "/2026/events/project-kickoff/"
  },
  integrations: [mdx()],
  build: {
    inlineStylesheets: "never"
  }
});
