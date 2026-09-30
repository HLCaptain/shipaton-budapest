import { edition } from "./config";

const eventDateFormatter = new Intl.DateTimeFormat(edition.dateLocale, {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: edition.timeZone
});
const eventDateKeyFormatter = new Intl.DateTimeFormat(edition.dateKeyLocale, { timeZone: edition.timeZone });

export const getToday = (date = new Date()) => eventDateKeyFormatter.format(date);
export const selectFeaturedEvent = <T extends { id: string; date: string; status: "scheduled" | "postponed" }>(
  events: readonly T[],
  today = getToday()
) => events.find((event) => event.status === "scheduled" && event.date >= today)
  ?? events.find((event) => event.status === "postponed")
  ?? events.at(-1);

export const formatEventDate = (date: string) => eventDateFormatter.format(new Date(`${date}T12:00:00Z`));
export const formatEventDateLabel = (date: string, status: "scheduled" | "postponed") => (
  status === "postponed" ? "New date to be announced" : formatEventDate(date)
);
export const formatEventStatus = (status: "scheduled" | "postponed") => (
  status === "postponed" ? "Postponed" : "Scheduled"
);
export const eventPath = (id: string) => `${edition.eventsPath}${id}/`;
