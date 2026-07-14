import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const events = defineCollection({
  loader: glob({ base: "./src/content/events", pattern: "**/[^_]*.{md,mdx}" }),
  schema: z.object({
    sequence: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string(),
    format: z.string(),
    description: z.string(),
    time: z.string(),
    venue: z.string(),
    presentation: z.string().optional(),
    attachment: z.string().optional()
  })
});

export const collections = { events };
