const year = "2026";
const city = "Budapest";
const homePath = `/${year}/`;

export const edition = {
  year,
  city,
  name: `Shipaton ${city}`,
  competitionName: `Shipaton ${year}`,
  homePath,
  eventsPath: `${homePath}events/`,
  timeZone: "Europe/Budapest",
  dateLocale: "en-GB",
  dateKeyLocale: "en-CA",
  competitionDeadline: "2026-10-01T06:45:00Z",
  contactProfile: "balazs-puspok-kiss",
  footerEventIds: ["project-kickoff"],
  links: {
    official: "https://www.shipaton.com/",
    events: "https://www.shipaton.com/events",
    mediaKit: "https://www.shipaton.com/media-kit",
    competition: "https://revenuecat-shipaton-2026.devpost.com/",
    repository: "https://github.com/HLCaptain/shipaton-budapest"
  },
  assets: {
    wordmark: `${homePath}brand/shipaton-wordmark.svg`,
    rocket: `${homePath}brand/rocket-launch-wide.svg`,
    icon: `${homePath}brand/shippy-pixel-head.png`,
    socialImage: `${homePath}brand/shipaton-budapest-social-card.png`
  }
} as const;
