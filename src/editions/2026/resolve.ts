import type { z } from "astro/zod";
import { profiles, venues } from "./references";
import { eventSchema, profileSchema, venueSchema, type EventData, type Profile } from "./schema";

const profileRecords: Readonly<Record<string, z.input<typeof profileSchema>>> = profiles;
const venueRecords: Readonly<Record<string, z.input<typeof venueSchema>>> = venues;

export function resolveProfile(value: EventData["hosts"][number], context: string): Profile {
  if (!("ref" in value)) return profileSchema.parse(value);
  if (!Object.hasOwn(profileRecords, value.ref)) {
    throw new Error(`${context}: unknown profile reference "${value.ref}"`);
  }
  return profileSchema.parse({
    ...profileRecords[value.ref],
    ...(value.role === undefined ? {} : { role: value.role })
  });
}

export function resolveEvent(id: string, input: z.input<typeof eventSchema>) {
  const data = eventSchema.parse(input);
  if (typeof data.venue === "string" && !Object.hasOwn(venueRecords, data.venue)) {
    throw new Error(`${id}.venue: unknown venue reference "${data.venue}"`);
  }
  const venue = venueSchema.parse(typeof data.venue === "string" ? venueRecords[data.venue] : data.venue);
  return {
    ...data,
    venue: {
      ...venue,
      label: venue.label ?? venue.name,
      heroLabel: venue.heroLabel ?? venue.label ?? venue.name
    },
    hosts: data.hosts.map((person, index) => resolveProfile(person, `${id}.hosts[${index}]`)),
    organizers: data.organizers.map((person, index) => resolveProfile(person, `${id}.organizers[${index}]`)),
    speakers: data.speakers.map((person, index) => resolveProfile(person, `${id}.speakers[${index}]`)),
    presentations: data.presentations.map((presentation, index) => ({
      ...presentation,
      speaker: resolveProfile(presentation.speaker, `${id}.presentations[${index}].speaker`)
    }))
  };
}

export type ResolvedEventData = ReturnType<typeof resolveEvent>;
