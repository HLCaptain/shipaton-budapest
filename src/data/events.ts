export type ShipatonEvent = {
  slug: string;
  sequence: string;
  date: string;
  title: string;
  format: string;
  description: string;
  time: string;
  venue: string;
};

// Draft schedule: replace dates, times, and venues as local events are confirmed.
export const events = [
  {
    slug: "budapest-kickoff",
    sequence: "01",
    date: "2026-08-01",
    title: "Budapest kickoff",
    format: "Meet · team up · choose a scope",
    description:
      "Meet the local builders, find a teammate if you want one, and choose the smallest app you can genuinely ship by September.",
    time: "Time announced soon",
    venue: "Budapest · venue announced soon"
  },
  {
    slug: "build-sprint-one",
    sequence: "02",
    date: "2026-08-22",
    title: "Build sprint 01",
    format: "Cowork · unblock · keep moving",
    description:
      "A focused room for turning the first rough build into something testable. Bring your laptop, your blockers, and a clear next milestone.",
    time: "Time announced soon",
    venue: "Budapest · venue announced soon"
  },
  {
    slug: "ship-clinic",
    sequence: "03",
    date: "2026-09-12",
    title: "Ship clinic",
    format: "Test · polish · prepare the store",
    description:
      "Bring the problem slowing you down. We will trade practical feedback on onboarding, purchases, store readiness, and the final cut list.",
    time: "Time announced soon",
    venue: "Budapest · venue announced soon"
  },
  {
    slug: "demo-and-submit",
    sequence: "04",
    date: "2026-09-30",
    title: "Demo & submit night",
    format: "Show · celebrate · press submit",
    description:
      "Show what made it across the line, tighten the last details together, and close the series with a room full of shipped apps.",
    time: "Time announced soon",
    venue: "Budapest · venue announced soon"
  }
] satisfies ShipatonEvent[];
