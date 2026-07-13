import { defineConfig } from "astro/config";

const site = process.env.SITE_URL ?? "https://shipaton-budapest.pages.dev";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: {
    inlineStylesheets: "never"
  }
});
