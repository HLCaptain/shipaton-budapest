export const siteUrl = process.env.SITE_URL ?? "https://shipaton-budapest.pages.dev";
export const currentEdition = "2026";

/** @satisfies {import("astro").AstroUserConfig["redirects"]} */
export const redirects = {
  "/": { destination: `/${currentEdition}/`, status: 302 },
  "/events/": { destination: "/2026/events/", status: 301 },
  "/events/project-kickoff/": { destination: "/2026/events/project-kickoff/", status: 301 }
};
