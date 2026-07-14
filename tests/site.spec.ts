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

  await expect(page.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", "/events/");
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

test("links the hero art to the next Budapest event", async ({ page }) => {
  await page.goto("/");

  const heroLink = page.getByRole("link", { name: "View Build sprint 01 event details" });
  await expect(heroLink).toHaveAttribute("href", "/events/build-sprint-one/");
  await expect(heroLink.locator("[data-featured-title]")).toHaveText("Build sprint 01");
  await expect(heroLink.locator("[data-featured-location]")).toHaveText("Budapest · venue announced soon");
  await expect(page.locator(".hero__lede")).not.toContainText(/\bfour\b/i);
});

test("navigates from the event grid to MDX details and back", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Events", exact: true }).click();

  await expect(page).toHaveURL(/\/events\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet. Make.");
  await expect(page.locator(".event-grid")).toHaveCSS("display", "grid");
  await expect(page.locator(".event-grid-card")).toHaveCount(4);
  await page.getByRole("link", { name: /Ship clinic/ }).click();

  await expect(page).toHaveURL(/\/events\/ship-clinic\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ship clinic");
  await expect(page.locator(".event-document__facts")).toContainText("Budapest · venue announced soon");
  await expect(page.locator(".event-document__facts")).toContainText("Product feedback · App quality · Store readiness");
  await expect(page.locator(".event-document__facts")).toContainText("Local registration opens soon");
  await expect(page.getByRole("link", { name: /official listing/ })).toHaveAttribute("href", "https://www.shipaton.com/events");
  await expect(page.locator(".event-schedule > ol > li")).toHaveCount(4);
  await expect(page.locator(".event-schedule__index")).toHaveText(["01", "02", "03", "04"]);
  await expect(page.locator(".event-schedule__time")).toHaveText(["Check-in", "Clinics", "Test pass", "Wrap-up"]);
  await expect(page.locator(".event-schedule > ol")).not.toHaveCSS("gap", "normal");
  await expect(page.getByRole("link", { name: "All events", exact: true }).first()).not.toHaveClass(/button/);
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Goals" })).toHaveAttribute("href", "#goals");
  await expect(page.locator(".event-document__body")).toContainText("Welcome to a practical problem-solving room");

  await page.getByRole("link", { name: "Back to all events" }).click();
  await expect(page).toHaveURL(/\/events\/$/);
});

test("keeps Budapest beside the brand and exposes organizer credits", async ({ page }) => {
  await page.goto("/");

  const brand = page.getByRole("link", { name: "Shipaton Budapest home" });
  await expect(brand.locator("span")).toHaveText("Budapest");
  await expect(page.getByRole("link", { name: /Media kit/ })).toHaveAttribute("href", "https://www.shipaton.com/media-kit");
  await expect(page.getByRole("link", { name: /Organizer on GitHub/ })).toHaveAttribute("href", "https://github.com/HLCaptain");
  await expect(page.getByRole("link", { name: /@hlcaptain on X/ })).toHaveAttribute("href", "https://x.com/hlcaptain");
});

test("uses a responsive multi-column dark footer with readable type", async ({ page }) => {
  await page.goto("/");

  const treatment = await page.locator(".site-footer").evaluate((footer) => {
    const grid = footer.querySelector<HTMLElement>(".site-footer__grid")!;
    const link = footer.querySelector<HTMLElement>("nav a")!;
    return {
      background: getComputedStyle(footer).backgroundColor,
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      fontSize: Number.parseFloat(getComputedStyle(link).fontSize),
      scrollWidth: footer.scrollWidth,
      width: footer.getBoundingClientRect().width,
      viewportWidth: window.innerWidth
    };
  });

  expect(treatment.background).toBe("rgb(23, 19, 38)");
  expect(treatment.columns).toBe(treatment.viewportWidth <= 360 ? 1 : treatment.viewportWidth <= 940 ? 2 : 4);
  expect(treatment.fontSize).toBeGreaterThanOrEqual(14);
  expect(treatment.scrollWidth).toBeLessThanOrEqual(treatment.viewportWidth);
  expect(treatment.width).toBe(treatment.viewportWidth);
  await expect(page.locator(".site-footer nav")).toHaveCount(3);
});

test("deep-links to Markdown headings and copies their references", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          document.documentElement.dataset.copiedHeadingLink = value;
        }
      }
    });
  });

  await page.goto("/events/ship-clinic/#goals");

  const heading = page.getByRole("heading", { name: "Goals", exact: true });
  await expect(page).toHaveURL(/\/events\/ship-clinic\/#goals$/);
  await expect(heading).toHaveAttribute("id", "goals");
  await expect(heading).toBeInViewport();
  const copy = page.locator(".event-document__heading-row").filter({ has: heading }).getByRole("button");
  await expect(copy).toHaveAccessibleName("Copy link to Goals");
  await copy.click();

  await expect(copy).toHaveAttribute("data-state", "copied");
  await expect(page.locator("[data-heading-copy-status]")).toHaveText("Copied link to Goals.");
  await expect.poll(() => page.locator("html").getAttribute("data-copied-heading-link")).toMatch(/\/events\/ship-clinic\/#goals$/);
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
  const initialScroll = await track.evaluate((element) => element.scrollLeft);
  const initialPageScroll = await page.evaluate(() => window.scrollY);
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
  await page.mouse.move(box!.x + 8, box!.y + 80);
  await page.mouse.down();
  await page.waitForTimeout(120);
  expect(await track.evaluate((element) => element.scrollLeft)).toBe(initialScroll);
  await expect(card).not.toHaveAttribute("aria-current", "date");
  await page.mouse.up();

  await expect(card).toHaveAttribute("aria-current", "date");
  await expect.poll(() => card.evaluate((element) => {
    const rail = element.parentElement;
    const cardRect = element.getBoundingClientRect();
    const railRect = rail!.getBoundingClientRect();
    return Math.abs(cardRect.left + cardRect.width / 2 - railRect.left - rail!.clientWidth / 2);
  })).toBeLessThan(2);
  expect(await page.evaluate(() => window.scrollY)).toBe(initialPageScroll);
  const trace = await page.evaluate(() => ({
    scroll: JSON.parse(document.documentElement.dataset.scrollTrace ?? "[]"),
    selections: JSON.parse(document.documentElement.dataset.selectionTrace ?? "[]")
  }));

  expect(trace.selections).toEqual(["2026-09-12"]);
  expect(new Set(trace.scroll).size).toBeGreaterThan(3);
});

test("freezes an in-flight transition under the pointer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Mouse transition is covered once at desktop size");
  await page.goto("/");

  const track = page.locator("[data-event-track]");
  await page.locator("#events").scrollIntoViewIfNeeded();
  await expect.poll(() => track.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const rail = document.querySelector<HTMLElement>("[data-event-track]")!;
    const cards = [...document.querySelectorAll<HTMLElement>("[data-event-card]")];
    const selections: string[] = [];
    new MutationObserver(() => {
      selections.push(cards.find((card) => card.hasAttribute("data-selected"))?.dataset.date ?? "");
      document.documentElement.dataset.selectionTrace = JSON.stringify(selections);
    }).observe(rail, { attributes: true, attributeFilter: ["data-selected"], subtree: true });
  });

  const third = page.locator('[data-event-card][data-date="2026-09-12"]');
  const thirdBox = await third.boundingBox();
  expect(thirdBox).not.toBeNull();
  await page.mouse.click(thirdBox!.x + 8, thirdBox!.y + 80);
  await expect(third).toHaveAttribute("aria-current", "date");
  await expect.poll(
    () => track.evaluate((element) => element.scrollLeft),
    { intervals: [16], timeout: 2_000 }
  ).toBeGreaterThan(1_140);

  const fourth = page.locator('[data-event-card][data-date="2026-09-30"]');
  const fourthBox = await fourth.boundingBox();
  expect(fourthBox).not.toBeNull();
  await page.mouse.move(fourthBox!.x + 8, fourthBox!.y + 80);
  await page.mouse.down();
  const pressedScroll = await track.evaluate((element) => element.scrollLeft);
  await page.waitForTimeout(120);

  expect(await track.evaluate((element) => element.scrollLeft)).toBe(pressedScroll);
  await expect(third).toHaveAttribute("aria-current", "date");
  await page.mouse.up();

  expect(Math.abs(await track.evaluate((element) => element.scrollLeft) - pressedScroll)).toBeLessThan(50);
  await expect(fourth).toHaveAttribute("aria-current", "date");
  await expect.poll(() => fourth.evaluate((element) => {
    const rail = element.parentElement;
    const cardRect = element.getBoundingClientRect();
    const railRect = rail!.getBoundingClientRect();
    return Math.abs(cardRect.left + cardRect.width / 2 - railRect.left - rail!.clientWidth / 2);
  })).toBeLessThan(2);
  expect(JSON.parse(await page.locator("html").getAttribute("data-selection-trace") ?? "[]")).toEqual([
    "2026-09-12",
    "2026-09-30"
  ]);
});

test("outlines neighboring events and gives clickable backdrops the right hover color", async ({ page }, testInfo) => {
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

  const heroCaption = page.locator(".hero__art figcaption");
  await expect(heroCaption).toHaveCSS("background-color", "rgb(23, 19, 38)");

  for (const { backdrop, color } of [
    {
      backdrop: page.getByRole("link", { name: "Explore the dates" }).locator(".button--primary"),
      color: "rgb(23, 19, 38)"
    },
    {
      backdrop: page.locator(".hero__art"),
      color: "rgb(255, 129, 0)"
    }
  ]) {
    await page.mouse.move(0, 0);
    const before = await backdrop.evaluate((element) => ({
      boxShadow: getComputedStyle(element).boxShadow,
      offsetHeight: (element as HTMLElement).offsetHeight,
      offsetWidth: (element as HTMLElement).offsetWidth
    }));

    expect(before.boxShadow).toBe("none");
    await backdrop.hover();
    await expect.poll(() => backdrop.evaluate((element) => getComputedStyle(element).boxShadow)).toContain(color);
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

    expect(after.boxShadow.split(color)).toHaveLength(5);
    expect(after.translate).toMatch(/^-/);
    expect(after.offsetHeight).toBe(before.offsetHeight);
    expect(after.offsetWidth).toBe(before.offsetWidth);
  }

  await expect(page.locator(".hero__art")).toHaveCSS("border-color", "rgb(255, 129, 0)");
  await expect(heroCaption).toHaveCSS("background-color", "rgb(23, 19, 38)");
  await expect(heroCaption.locator("[data-featured-title]")).toHaveCSS("color", "rgb(255, 129, 0)");

  const primary = page.getByRole("link", { name: "Explore the dates" });
  await page.mouse.move(0, 0);
  const primaryBox = await primary.boundingBox();
  expect(primaryBox).not.toBeNull();
  const corner = { x: primaryBox!.x + primaryBox!.width - 3, y: primaryBox!.y + primaryBox!.height - 2 };
  for (let frame = 0; frame < 10; frame += 1) {
    await page.mouse.move(corner.x, corner.y);
    await page.waitForTimeout(20);
  }
  const cornerHover = await primary.evaluate((element) => {
    const face = element.querySelector<HTMLElement>(".button--primary")!;
    return {
      hovered: element.matches(":hover"),
      translate: getComputedStyle(face).translate
    };
  });

  expect(cornerHover).toEqual({ hovered: true, translate: "-8px -8px" });
  await page.mouse.click(corner.x, corner.y);
  await expect(page).toHaveURL(/#events$/);
});
