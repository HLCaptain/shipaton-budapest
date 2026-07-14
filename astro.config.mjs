import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

const site = process.env.SITE_URL ?? "https://shipaton-budapest.pages.dev";

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  integrations: [mdx()],
  build: {
    inlineStylesheets: "never"
  }
});
