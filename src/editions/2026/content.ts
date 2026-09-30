import { getCollection } from "astro:content";
import { resolveEvent } from "./resolve";

export async function getEvents2026() {
  // Resolve on every read: Astro can cache unchanged MDX across reference-only edits.
  return (await getCollection("events2026"))
    .map((entry) => ({ entry, data: resolveEvent(entry.id, entry.data) }))
    .sort((a, b) => a.data.date.localeCompare(b.data.date));
}

export type ResolvedEvent = Awaited<ReturnType<typeof getEvents2026>>[number];
