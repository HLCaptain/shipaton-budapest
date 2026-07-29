import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const person = z.object({
  name: z.string(),
  role: z.string().optional(),
  url: z.url().optional()
});

const image = z.object({
  src: z.string(),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

const eventNotice = z.object({
  label: z.string().min(1),
  message: z.string().min(1).max(240),
  sitewide: z.boolean().default(false)
});

const events2026 = defineCollection({
  loader: glob({ base: "./src/content/events/2026", pattern: "[^_]*.{md,mdx}" }),
  schema: z.object({
    sequence: z.string(),
    date: z.string().regex(/^2026-\d{2}-\d{2}$/),
    title: z.string(),
    status: z.enum(["scheduled", "postponed"]).default("scheduled"),
    notice: eventNotice.optional(),
    format: z.string(),
    description: z.string(),
    time: z.string(),
    venue: z.string(),
    heroVenue: z.string().optional(),
    thumbnail: image.refine(
      ({ width, height }) => width === height,
      "Event thumbnails must use a 1:1 aspect ratio"
    ).optional(),
    venueImages: z.array(image.extend({
      description: z.string().min(1)
    })).min(1).optional(),
    themes: z.array(z.string()).min(1),
    tags: z.array(z.string()).min(1),
    schedule: z.array(z.object({
      time: z.string(),
      emoji: z.string().optional(),
      title: z.string(),
      description: z.string()
    })).min(1),
    rsvp: z.url().optional(),
    locationUrl: z.url().optional(),
    hosts: z.array(person).min(1).optional(),
    organizers: z.array(person).min(1).optional(),
    speakers: z.array(person).min(1).optional(),
    presentation: z.string().optional(),
    attachment: z.string().optional()
  })
});

export const collections = { events2026 };
