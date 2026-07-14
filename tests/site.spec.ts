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

test("uses a full-width dark footer", async ({ page }) => {
  await page.goto("/");

  const treatment = await page.locator(".site-footer").evaluate((footer) => {
    return {
      background: getComputedStyle(footer).backgroundColor,
      width: footer.getBoundingClientRect().width,
      viewportWidth: window.innerWidth
    };
  });

  expect(treatment.background).toBe("rgb(23, 19, 38)");
  expect(treatment.width).toBe(treatment.viewportWidth);
});

test("selects and extrudes every event without changing its layout footprint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  for (const date of ["2026-08-01", "2026-08-22", "2026-09-12", "2026-09-30"]) {
    const card = page.locator(`[data-event-card][data-date="${date}"]`);
    const before = await card.evaluate((element) => ({
      offsetHeight: (element as HTMLElement).offsetHeight,
      offsetLeft: (element as HTMLElement).offsetLeft,
      offsetWidth: (element as HTMLElement).offsetWidth
    }));

    await card.locator("h3").click();

    await expect(card).toHaveAttribute("aria-current", "date");
    await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveCount(1);
    await expect.poll(() => card.evaluate((element) => getComputedStyle(element).boxShadow)).toContain("rgb(255, 129, 0)");
    await expect.poll(() => card.evaluate((element) => getComputedStyle(element).translate)).toMatch(/^-/);
    const after = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        boxShadow: style.boxShadow,
        offsetHeight: (element as HTMLElement).offsetHeight,
        offsetLeft: (element as HTMLElement).offsetLeft,
        offsetWidth: (element as HTMLElement).offsetWidth,
        translate: style.translate
      };
    });

    expect(after.boxShadow.match(/rgb\(255, 129, 0\)/g)).toHaveLength(4);
    expect(after.translate).toMatch(/^-/);
    expect(after.offsetHeight).toBe(before.offsetHeight);
    expect(after.offsetLeft).toBe(before.offsetLeft);
    expect(after.offsetWidth).toBe(before.offsetWidth);
  }

  await expect(page.locator("[data-event-counter]")).toHaveText("4 / 4");
});

test("keeps mouse selection stable while smoothly centering", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Mouse transition is covered once at desktop size");
  await page.goto("/");

  const track = page.locator("[data-event-track]");
  await page.locator("#events").scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>("[data-event-track]")!;
    const cards = [...document.querySelectorAll<HTMLElement>("[data-event-card]")];
    const selections: string[] = [];
    const scrollPositions: number[] = [];
    const save = () => {
      document.documentElement.dataset.selectionTrace = JSON.stringify(selections);
      document.documentElement.dataset.scrollTrace = JSON.stringify(scrollPositions);
    };
    new MutationObserver(() => {
      selections.push(cards.find((card) => card.hasAttribute("data-selected"))?.dataset.date ?? "");
      save();
    }).observe(rail, { attributes: true, attributeFilter: ["data-selected"], subtree: true });
    rail.addEventListener("scroll", () => {
      scrollPositions.push(Math.round(rail.scrollLeft));
      save();
    }, { passive: true });
    save();
  });

  const card = page.locator('[data-event-card][data-date="2026-09-12"]');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + 8, box!.y + 80);

  await expect(card).toHaveAttribute("aria-current", "date");
  await expect.poll(() => card.evaluate((element) => {
    const rail = element.parentElement;
    const left = (element as HTMLElement).offsetLeft - (rail!.clientWidth - (element as HTMLElement).offsetWidth) / 2;
    return Math.abs(rail!.scrollLeft - left);
  })).toBeLessThan(2);
  const trace = await page.evaluate(() => ({
    scroll: JSON.parse(document.documentElement.dataset.scrollTrace ?? "[]"),
    selections: JSON.parse(document.documentElement.dataset.selectionTrace ?? "[]")
  }));

  expect(trace.selections).toEqual(["2026-09-12"]);
  expect(new Set(trace.scroll).size).toBeGreaterThan(3);
});

test("outlines neighboring events and extrudes backdrop cards only on hover", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Hover treatment only applies to hover-capable pointers");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Show next event" }).click();
  await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveAttribute("data-date", "2026-09-12");

  const neighbor = page.locator('[data-event-card][data-date="2026-09-30"]');
  await expect(neighbor).not.toHaveAttribute("data-selected", "");
  const neighborBox = await neighbor.boundingBox();
  expect(neighborBox).not.toBeNull();
  await page.mouse.move(neighborBox!.x + 8, neighborBox!.y + 80);
  await expect(neighbor).not.toHaveAttribute("data-selected", "");
  await expect.poll(() => neighbor.evaluate((element) => getComputedStyle(element).borderColor)).toBe("rgb(255, 129, 0)");
  const neighborHover = await neighbor.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      translate: style.translate
    };
  });

  expect(neighborHover.borderColor).toBe("rgb(255, 129, 0)");
  expect(neighborHover.boxShadow).toBe("none");
  expect(neighborHover.translate).toBe("0px");

  for (const backdrop of [
    page.getByRole("link", { name: "Explore the dates" }),
    page.locator(".hero__art")
  ]) {
    await page.mouse.move(0, 0);
    const before = await backdrop.evaluate((element) => ({
      boxShadow: getComputedStyle(element).boxShadow,
      offsetHeight: (element as HTMLElement).offsetHeight,
      offsetWidth: (element as HTMLElement).offsetWidth
    }));

    expect(before.boxShadow).toBe("none");
    await backdrop.hover();
    await expect.poll(() => backdrop.evaluate((element) => getComputedStyle(element).boxShadow)).toContain("rgb(23, 19, 38)");
    await expect.poll(() => backdrop.evaluate((element) => getComputedStyle(element).translate)).toMatch(/^-/);
    const after = await backdrop.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        boxShadow: style.boxShadow,
        offsetHeight: (element as HTMLElement).offsetHeight,
        offsetWidth: (element as HTMLElement).offsetWidth,
        translate: style.translate
      };
    });

    expect(after.boxShadow.match(/rgb\(23, 19, 38\)/g)).toHaveLength(4);
    expect(after.translate).toMatch(/^-/);
    expect(after.offsetHeight).toBe(before.offsetHeight);
    expect(after.offsetWidth).toBe(before.offsetWidth);
  }
});
