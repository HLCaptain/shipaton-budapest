import { z } from "astro/zod";

export const profileSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional(),
  url: z.url().optional(),
  urlLabel: z.string().min(1).optional(),
  social: z.object({
    github: z.url().optional(),
    x: z.url().optional()
  }).optional()
});

const person = z.union([
  z.object({ ref: z.string().min(1), role: z.string().optional() }).strict(),
  profileSchema.strict()
]);

const image = z.object({
  src: z.string(),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});

export const venueSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1).optional(),
  heroLabel: z.string().min(1).optional(),
  mapsUrl: z.url().optional(),
  building: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  directions: z.string().min(1).optional(),
  images: z.array(image.extend({ description: z.string().min(1) })).default([])
});

const eventNotice = z.object({
  label: z.string().min(1),
  message: z.string().min(1).max(96),
  detailMessage: z.string().min(1).max(180).optional(),
  sitewide: z.boolean().default(false)
});

const presentationUrl = z.union([
  z.url().regex(/^https:\/\//i, "Remote presentation URLs must use HTTPS"),
  z.string().regex(
    /^\/2026\/documents\/[a-z0-9]+(?:-[a-z0-9]+)*\.pdf$/,
    "Local presentation URLs must use a kebab-case PDF under /2026/documents/"
  )
]);

export const eventSchema = z.object({
  sequence: z.string(),
  date: z.string().regex(/^2026-\d{2}-\d{2}$/),
  title: z.string(),
  status: z.enum(["scheduled", "postponed"]).default("scheduled"),
  notice: eventNotice.optional(),
  format: z.string(),
  description: z.string(),
  time: z.string(),
  venue: z.union([z.string().min(1), venueSchema]),
  thumbnail: image.refine(
    ({ width, height }) => width === height,
    "Event thumbnails must use a 1:1 aspect ratio"
  ).optional(),
  themes: z.array(z.string()).min(1),
  tags: z.array(z.string()).min(1),
  schedule: z.array(z.object({
    time: z.string(),
    emoji: z.string().optional(),
    title: z.string(),
    description: z.string()
  })).min(1),
  links: z.object({
    rsvp: z.url().optional(),
    meetup: z.url().optional()
  }).default({}),
  hosts: z.array(person).default([]),
  organizers: z.array(person).default([]),
  speakers: z.array(person).default([]),
  presentations: z.array(z.object({
    title: z.string().min(1),
    speaker: person,
    url: presentationUrl,
    format: z.string().min(1)
  })).default([]),
  attachment: z.string().optional()
});

export type Profile = z.infer<typeof profileSchema>;
export type Venue = z.infer<typeof venueSchema>;
export type EventData = z.infer<typeof eventSchema>;
