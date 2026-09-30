import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";
import { writeFile } from "node:fs/promises";
import { redirects, siteUrl } from "./src/site.config.mjs";

export default defineConfig({
  site: siteUrl,
  trailingSlash: "always",
  redirects,
  integrations: [mdx(), {
    name: "cloudflare-redirects",
    hooks: {
      "astro:build:done": ({ dir }) => writeFile(
        new URL("_redirects", dir),
        Object.entries(redirects)
          .map(([source, { destination, status }]) => `${source} ${destination} ${status}\n`)
          .join("")
      )
    }
  }],
  build: {
    inlineStylesheets: "never"
  }
});
