import { expect, test } from "@playwright/test";
import { resolveEvent } from "../src/editions/2026/resolve";
import { eventSchema } from "../src/editions/2026/schema";

const event = {
  sequence: "01",
  date: "2026-10-13",
  title: "Reference check",
  format: "Meetup",
  description: "An event with reusable facts",
  time: "17:30–20:30",
  venue: "genesys-hungary",
  themes: ["Community"],
  tags: ["meetup"],
  schedule: [{ time: "17:30", title: "Welcome", description: "Arrive" }]
};

test("resolves shared identities, presentation credits, and event-specific roles", () => {
  const data = resolveEvent("example", eventSchema.parse({
    ...event,
    hosts: [{ ref: "balazs-puspok-kiss", role: "Host for this event" }],
    organizers: [{ ref: "balazs-puspok-kiss" }],
    presentations: [{
      title: "Talk", speaker: { ref: "marton-braun" },
      url: "/2026/documents/example.pdf", format: "PDF"
    }]
  }));

  expect(data.hosts[0]).toMatchObject({
    name: "Balázs Püspök-Kiss",
    url: "https://www.linkedin.com/in/balazs-puspok-kiss",
    role: "Host for this event"
  });
  expect(data.organizers[0].role).toBeUndefined();
  expect(data.presentations[0].speaker.name).toBe("Márton Braun");
  expect(data.speakers).toEqual([]);
  expect(data.venue).toMatchObject({ name: "Genesys Hungary", label: "Genesys Hungary", heroLabel: "Genesys Hungary" });
  expect(data.venue.images.map(({ width, height }) => [width, height])).toEqual([[1000, 667], [1000, 625], [1000, 667]]);
});

test("keeps one-off inline records and empty optional groups usable", () => {
  const data = resolveEvent("inline", eventSchema.parse({
    ...event,
    venue: { name: "One-off venue", label: "Short label" },
    speakers: [{ name: "Guest", role: "Visiting speaker" }]
  }));
  expect(data.venue).toEqual({ name: "One-off venue", label: "Short label", heroLabel: "Short label", images: [] });
  expect(data.speakers).toEqual([{ name: "Guest", role: "Visiting speaker" }]);
  expect(data.hosts).toEqual([]);
  expect(data.organizers).toEqual([]);
  expect(data.presentations).toEqual([]);
  expect(data.links).toEqual({});
});

test("rejects missing references with the event and field in the error", () => {
  expect(eventSchema.safeParse({ ...event, hosts: [{ ref: "missing", name: "Inline fallback" }] }).success).toBe(false);
  expect(() => resolveEvent("broken", eventSchema.parse({ ...event, venue: "missing" })))
    .toThrow('broken.venue: unknown venue reference "missing"');
  expect(() => resolveEvent("broken", eventSchema.parse({ ...event, hosts: [{ ref: "missing" }] })))
    .toThrow('broken.hosts[0]: unknown profile reference "missing"');
  expect(() => resolveEvent("broken", eventSchema.parse({
    ...event,
    presentations: [{ title: "Talk", speaker: { ref: "missing" }, url: "https://example.com/slides", format: "Slides" }]
  }))).toThrow('broken.presentations[0].speaker: unknown profile reference "missing"');
});
