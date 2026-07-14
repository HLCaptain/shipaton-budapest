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
    themes: z.array(z.string()).min(1),
    tags: z.array(z.string()).min(1),
    schedule: z.array(z.object({
      time: z.string(),
      title: z.string(),
      description: z.string()
    })).min(1),
    rsvp: z.url().optional(),
    locationUrl: z.url().optional(),
    speakers: z.array(z.object({
      name: z.string(),
      role: z.string(),
      url: z.url().optional()
    })).optional(),
    presentation: z.string().optional(),
    attachment: z.string().optional()
  })
});

export const collections = { events };
