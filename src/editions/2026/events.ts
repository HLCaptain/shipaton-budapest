const eventDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Budapest"
});

export const formatEventDate = (date: string) => eventDateFormatter.format(new Date(`${date}T12:00:00Z`));
export const eventPath = (id: string) => `/2026/events/${id}/`;
