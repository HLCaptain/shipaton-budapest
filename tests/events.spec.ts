import { expect, test } from "@playwright/test";
import { formatEventDate, getToday, selectFeaturedEvent } from "../src/editions/2026/events";

test("selects the first scheduled event, then a postponed event, then the latest past event", () => {
  const events = [
    { id: "earlier", date: "2026-07-01", status: "scheduled" },
    { id: "postponed", date: "2026-08-01", status: "postponed" },
    { id: "later", date: "2026-09-01", status: "scheduled" }
  ] as const;

  expect(selectFeaturedEvent(events, "2026-06-01")?.id).toBe("earlier");
  expect(selectFeaturedEvent(events, "2026-08-01")?.id).toBe("later");
  expect(selectFeaturedEvent(events, "2026-09-01")?.id).toBe("later");
  expect(selectFeaturedEvent(events, "2026-10-01")?.id).toBe("postponed");
  expect(selectFeaturedEvent(events.filter((event) => event.status === "scheduled"), "2026-10-01")?.id).toBe("later");
  expect(selectFeaturedEvent([], "2026-10-01")).toBeUndefined();
});

test("uses Budapest calendar dates before and after daylight-saving changes", () => {
  expect(getToday(new Date("2026-03-29T21:59:59Z"))).toBe("2026-03-29");
  expect(getToday(new Date("2026-03-29T22:00:00Z"))).toBe("2026-03-30");
  expect(getToday(new Date("2026-10-25T22:59:59Z"))).toBe("2026-10-25");
  expect(getToday(new Date("2026-10-25T23:00:00Z"))).toBe("2026-10-26");
  expect(formatEventDate("2026-08-13")).toBe("13 August 2026");
  expect(formatEventDate("2026-12-13")).toBe("13 December 2026");
});
