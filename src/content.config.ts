import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { eventSchema } from "./editions/2026/schema";

const events2026 = defineCollection({
  loader: glob({ base: "./src/content/events/2026", pattern: "[^_]*.{md,mdx}" }),
  schema: eventSchema
});

export const collections = { events2026 };
