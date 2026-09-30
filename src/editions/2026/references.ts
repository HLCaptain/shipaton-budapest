import { edition } from "./config";
import type { Profile, Venue } from "./schema";

export const profiles = {
  "balazs-puspok-kiss": {
    name: "Balázs Püspök-Kiss",
    url: "https://www.linkedin.com/in/balazs-puspok-kiss",
    urlLabel: "LinkedIn",
    social: {
      github: "https://github.com/HLCaptain",
      x: "https://x.com/hlcaptain"
    }
  },
  "marton-braun": {
    name: "Márton Braun",
    url: "https://www.linkedin.com/in/zsmb13/"
  },
  "gabor-boka": {
    name: "Gábor Bóka",
    url: "https://www.linkedin.com/in/gabor-boka/"
  },
  "mirzamehdi-karimov": {
    name: "Mirzamehdi Karimov",
    url: "https://www.linkedin.com/in/mirzemehdi/"
  },
  "petra-szasz-perjesi": {
    name: "Petra Szász-Perjési",
    url: "https://www.linkedin.com/in/szpetra/"
  },
  "tamas-fabian": {
    name: "Tamás Fábián",
    url: "https://www.linkedin.com/in/tamas--fabian/"
  },
  "shipaton-budapest": { name: edition.name },
  "kotlin-budapest": {
    name: "Kotlin Budapest",
    url: "https://www.meetup.com/kotlin-budapest/"
  }
} satisfies Record<string, Profile>;

const puzlName = "Puzl CowOrKing";

export const venues = {
  "puzl-coworking": {
    name: puzlName,
    label: `${puzlName}, ${edition.city}`,
    heroLabel: `${puzlName} · ${edition.city}`,
    mapsUrl: "https://maps.app.goo.gl/ZqMrZSwVsqHFw7AeA",
    images: [
      {
        src: "/2026/events/project-kickoff-venue-puzl-talk-space.webp",
        alt: "Open event space at Puzl CowOrKing with a seated conference audience viewed from above",
        description: "This open event area can be arranged with audience seating for the lightning talks, with space to stand around the perimeter.",
        width: 1000,
        height: 667
      },
      {
        src: "/2026/events/project-kickoff-venue-puzl-workspace.webp",
        alt: "Open coworking area at Puzl CowOrKing with shared desks, glass meeting rooms, plants and a yellow sofa",
        description: "Shared tables and adjacent meeting rooms provide flexible space for small-group workshops and mentoring.",
        width: 1000,
        height: 667
      },
      {
        src: "/2026/events/project-kickoff-venue-puzl-lounge.webp",
        alt: "Multi-level lounge at Puzl CowOrKing with stepped wooden seating, sofas, a green wall and glass offices",
        description: "The central lounge offers informal seating for group matching, breaks and conversations between workshop sessions.",
        width: 1000,
        height: 667
      }
    ]
  },
  "genesys-hungary": {
    name: "Genesys Hungary",
    mapsUrl: "https://maps.app.goo.gl/txyWYX2hDED4bRi27",
    building: "Eiffel Office Building",
    address: "Teréz körút 55–57, 1062 Budapest",
    directions: "Building B, 6th floor. Entrance next to Café Frei.",
    images: [
      {
        src: "/2026/events/project-kickoff-venue-main-room.webp",
        alt: "Bright Genesys event space with tables, chairs, orange planters and floor-to-ceiling windows",
        description: "The main indoor space at Genesys Hungary, with shared tables and windows overlooking the terrace.",
        width: 1000,
        height: 667
      },
      {
        src: "/2026/events/project-kickoff-venue-workspace.webp",
        alt: "Genesys lounge with a café counter, blue built-in seating and hanging globe lights around a staircase",
        description: "The lounge beside the staircase has café-style seating and small tables for informal conversations.",
        width: 1000,
        height: 625
      },
      {
        src: "/2026/events/project-kickoff-venue-terrace.webp",
        alt: "Outdoor terrace with long tables, chairs and an awning overlooking Budapest rooftops",
        description: "The terrace runs alongside the sixth-floor event space, with outdoor seating and views across Budapest.",
        width: 1000,
        height: 667
      }
    ]
  }
} satisfies Record<string, Venue>;
