import { expect, test } from "@playwright/test";

test("preserves redirect destinations and HTTP statuses", async ({ request }) => {
  for (const [source, destination, status] of [
    ["/", "/2026/", 302],
    ["/events/", "/2026/events/", 301],
    ["/events/project-kickoff/", "/2026/events/project-kickoff/", 301]
  ] as const) {
    const response = await request.get(source, { maxRedirects: 0 });
    expect(response.status(), source).toBe(status);
    expect(new URL(response.headers().location, response.url()).pathname, source).toBe(destination);
  }
});

test("publishes edition and event links with the configured canonical origin", async ({ request }) => {
  const response = await request.get("/llms.txt");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const content = await response.text();
  const origin = process.env.SITE_URL ?? "https://shipaton-budapest.pages.dev";
  expect(content).toContain("# Shipaton Budapest");
  for (const [title, path] of [
    ["Shipaton Budapest 2026", "/2026/"],
    ["2026 events", "/2026/events/"],
    ["Project Kickoff", "/2026/events/project-kickoff/"],
    ["Kotlin Turns 15 × Shipaton Wrap-up", "/2026/events/wrap-up/"]
  ]) {
    expect(content).toContain(`[${title}](${new URL(path, origin).href})`);
  }
});
