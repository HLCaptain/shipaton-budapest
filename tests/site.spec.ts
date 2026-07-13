import { expect, test, type Page } from "@playwright/test";

const freezeDate = async (page: Page, isoDate: string) => {
  const now = JSON.stringify(isoDate);
  await page.addInitScript({
    content: `{
      const RealDate = Date;
      const fixedTime = RealDate.parse(${now});
      class FixedDate extends RealDate {
        constructor(...args) { super(...(args.length ? args : [fixedTime])); }
        static now() { return fixedTime; }
      }
      globalThis.Date = FixedDate;
    }`
  });
};

test.beforeEach(async ({ page }) => {
  await freezeDate(page, "2026-08-10T10:00:00+02:00");
});

test("opens on the next event without moving the page vertically", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("local runway");
  await expect(page.locator("[data-event-card]")).toHaveCount(4);
  await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveAttribute("data-date", "2026-08-22");
  await expect(page.locator('[data-event-card][data-date="2026-08-01"] [data-event-state]')).toHaveText("Past");
  await expect(page.locator("[data-event-counter]")).toHaveText("2 / 4");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test("can select an earlier event by scrolling back", async ({ page }) => {
  await page.goto("/");

  const track = page.locator("[data-event-track]");
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const initialScroll = await track.evaluate((element) => element.scrollLeft);

  await page.getByRole("button", { name: "Show previous event" }).click();

  await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveAttribute("data-date", "2026-08-01");
  await expect(page.locator("[data-event-counter]")).toHaveText("1 / 4");
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeLessThan(initialScroll);
});

test("keeps content inside the viewport and exposes the important links", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Explore the dates" })).toHaveAttribute("href", "#events");
  await expect(page.getByRole("link", { name: /Join Shipaton/ })).toHaveAttribute(
    "href",
    "https://revenuecat-shipaton-2026.devpost.com/"
  );
  await expect(page.locator("[data-event-track]")).toBeVisible();

  const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasPageOverflow).toBe(false);

  const pageWeight = await page.evaluate(() => {
    const entries = [
      ...performance.getEntriesByType("navigation"),
      ...performance.getEntriesByType("resource")
    ] as PerformanceResourceTiming[];
    return {
      bytes: entries.reduce((total, entry) => total + entry.encodedBodySize, 0),
      requests: entries.length
    };
  });
  expect(pageWeight.requests).toBeLessThanOrEqual(8);
  expect(pageWeight.bytes).toBeLessThan(300 * 1024);
});

test("uses an attached event extension and a full-width dark footer", async ({ page }) => {
  await page.goto("/");

  const treatment = await page.locator('[data-event-card][aria-current="date"]').evaluate((card) => {
    const extension = getComputedStyle(card, "::after");
    const cardWidth = card.getBoundingClientRect().width;
    const footer = document.querySelector(".site-footer");

    return {
      cardWidth,
      extensionHeight: Number.parseFloat(extension.height),
      extensionWidth: Number.parseFloat(extension.width),
      footerBackground: footer ? getComputedStyle(footer).backgroundColor : "",
      footerWidth: footer?.getBoundingClientRect().width ?? 0,
      viewportWidth: window.innerWidth,
      boxShadow: getComputedStyle(card).boxShadow
    };
  });

  expect(treatment.boxShadow).toBe("none");
  expect(treatment.extensionHeight).toBeGreaterThan(0);
  expect(treatment.extensionWidth).toBeLessThan(treatment.cardWidth);
  expect(treatment.footerBackground).toBe("rgb(23, 19, 38)");
  expect(treatment.footerWidth).toBe(treatment.viewportWidth);
});
