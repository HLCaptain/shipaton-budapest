import type { CollectionEntry } from "astro:content";

export const year = "2026";
export const eventSlug = ({ id }: CollectionEntry<"events2026">) => id;
export const eventPath = (event: CollectionEntry<"events2026">) => `/${year}/events/${eventSlug(event)}/`;
