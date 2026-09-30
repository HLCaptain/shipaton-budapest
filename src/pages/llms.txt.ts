import type { APIRoute } from "astro";
import { edition } from "../editions/2026/config";
import { getEvents2026 } from "../editions/2026/content";
import { eventPath } from "../editions/2026/events";

export const GET: APIRoute = async ({ site }) => {
  const events = await getEvents2026();
  const url = (path: string) => new URL(path, site).href;
  const pages = [
    `- [${edition.name} ${edition.year}](${url(edition.homePath)}): Current ${edition.city} edition overview.`,
    `- [${edition.year} events](${url(edition.eventsPath)}): Event archive for the ${edition.year} edition.`,
    ...events.map(({ entry, data }) => `- [${data.title}](${url(eventPath(entry.id))}): ${data.description}`)
  ];

  return new Response([
    `# ${edition.name}`,
    "",
    `> A static archive for ${edition.city} Shipaton editions, including local event details, schedules, speakers, and attendance information.`,
    "",
    "## Pages",
    "",
    ...pages,
    ""
  ].join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
