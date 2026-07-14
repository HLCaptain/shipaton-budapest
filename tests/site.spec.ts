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
  await expect(page.locator(".event-schedule__index")).toHaveCount(0);
  await expect(page.locator(".event-schedule__time")).toHaveText(["Check-in", "Clinics", "Test pass", "Wrap-up"]);
  await expect(page.locator(".event-schedule > ol")).toHaveCSS("border-top-width", "2px");
  await expect(page.locator(".event-schedule > ol > li").first()).toHaveCSS("border-radius", "0px");
  await expect(page.locator(".event-schedule > ol > li").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const backLink = page.getByRole("link", { name: "All events", exact: true }).first();
  await expect(backLink).toHaveClass(/button--quiet/);
  await expect(backLink).toHaveClass(/button--compact/);
  await expect(backLink.locator(".button__icon")).toHaveCount(1);
  expect(await backLink.evaluate((link) => link.getBoundingClientRect().width < link.parentElement!.getBoundingClientRect().width)).toBe(true);
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Goals" })).toHaveAttribute("href", "#goals");
  await expect(page.locator(".event-document__body")).toContainText("Welcome to a practical problem-solving room");

  await page.getByRole("link", { name: "Back to all events" }).click();
  await expect(page).toHaveURL(/\/events\/$/);
});

test("keeps page motion directional and stable from a scrolled route", async ({ page }) => {
  await page.goto("/");

  const motion = await page.evaluate(() => {
    const root = document.documentElement;
    const pageContent = document.querySelector(".page-transition")!;
    const outgoing = getComputedStyle(root, "::view-transition-old(page-content)");
    const incoming = getComputedStyle(root, "::view-transition-new(page-content)");
    root.setAttribute("data-astro-transition-fallback", "old");
    const fallbackOutgoing = getComputedStyle(pageContent);
    const fallbackOutgoingMotion = [fallbackOutgoing.animationName, fallbackOutgoing.animationDuration];
    root.setAttribute("data-astro-transition-fallback", "new");
    const fallbackIncoming = getComputedStyle(pageContent);
    const fallbackIncomingMotion = [fallbackIncoming.animationName, fallbackIncoming.animationDuration];
    root.removeAttribute("data-astro-transition-fallback");
    return {
      easing: incoming.animationTimingFunction,
      fallbackIncomingMotion,
      fallbackOutgoingMotion,
      incomingDuration: incoming.animationDuration,
      outgoingDuration: outgoing.animationDuration,
      rootAnimation: getComputedStyle(root, "::view-transition-old(root)").animationName
    };
  });

  expect(motion).toEqual({
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    fallbackIncomingMotion: ["page-in", "0.42s"],
    fallbackOutgoingMotion: ["page-fallback-out", "0.18s"],
    incomingDuration: "0.42s",
    outgoingDuration: "0.18s",
    rootAnimation: "none"
  });

  await page.locator("#events").evaluate((element) => {
    element.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  });
  const sourceScrollY = await page.evaluate(() => window.scrollY);
  expect(sourceScrollY).toBeGreaterThan(0);
  await page.evaluate(() => {
    document.addEventListener(
      "astro:before-preparation",
      () => {
        (window as Window & { __shipatonMotionSource?: { offset: string; scrollY: number } }).__shipatonMotionSource = {
          offset: document.documentElement.style.getPropertyValue("--page-old-scroll-offset-y"),
          scrollY: window.scrollY
        };
      },
      { once: true }
    );
  });
  await page
    .locator('[data-event-card][data-date="2026-08-22"]')
    .getByRole("link", { name: "View event details" })
    .evaluate((link) => (link as HTMLAnchorElement).click());

  await expect(page).toHaveURL(/\/events\/build-sprint-one\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-page-direction", "down");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const motionSource = await page.evaluate(
    () => (window as Window & { __shipatonMotionSource?: { offset: string; scrollY: number } }).__shipatonMotionSource
  );
  expect(motionSource?.offset).toBe(`${-motionSource!.scrollY}px`);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-page-direction", "up");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(motionSource!.scrollY);

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition-new(page-content)").animationName)
  ).toBe("none");
});

test("reinitializes page features across repeated client-side visits", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => ((window as Window & { __shipatonDocumentMarker?: string }).__shipatonDocumentMarker = "alive"));

  await page.getByRole("link", { name: "Events", exact: true }).click();
  await page.getByRole("link", { name: /Ship clinic/ }).click();
  await expect(page.getByRole("button", { name: "Copy link to Goals" })).toHaveCount(1);

  await page.getByRole("link", { name: "Back to all events", exact: true }).click();
  await page.getByRole("link", { name: /Build sprint 01/ }).click();
  await expect(page.locator(".event-document__copy-link")).not.toHaveCount(0);

  await page.getByRole("link", { name: "Shipaton Budapest home" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(
    await page.evaluate(() => (window as Window & { __shipatonDocumentMarker?: string }).__shipatonDocumentMarker)
  ).toBe("alive");
  await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveAttribute("data-date", "2026-08-22");
  await expect(page.locator("[data-event-counter]")).toHaveText("2 / 4");
  await page.getByRole("button", { name: "Show next event" }).click();
  await expect(page.locator("[data-event-counter]")).toHaveText("3 / 4");
});

test("keeps the event detail body compact and aligned", async ({ page }) => {
  await page.goto("/events/build-sprint-one/");

  const aboutHeading = page.getByRole("heading", { name: "About this event", exact: true });
  const body = page.locator(".event-document__body");
  const intro = body.locator("> p").first();
  const headingBox = await aboutHeading.boundingBox();
  const bodyBox = await body.boundingBox();
  const backMargin = await page.locator(".event-document__back").evaluate((element) => getComputedStyle(element).marginBottom);
  const aboutMargin = await page.locator(".event-about").evaluate((element) => getComputedStyle(element).marginTop);

  expect(headingBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(Math.abs(headingBox!.x - bodyBox!.x)).toBeLessThan(1);
  expect(Number.parseFloat(backMargin)).toBeLessThanOrEqual(56);
  expect(Number.parseFloat(aboutMargin)).toBeLessThanOrEqual(80);
  await expect(intro).toHaveCSS("color", "rgb(81, 70, 99)");
  await expect(intro).toHaveCSS("font-weight", "500");
  await expect(page.getByRole("link", { name: "Back to all events", exact: true }).locator(".button__icon")).toHaveCount(1);
});

test("keeps Budapest beside the brand and exposes contact links", async ({ page }) => {
  await page.goto("/");

  const brand = page.getByRole("link", { name: "Shipaton Budapest home" });
  const footer = page.locator(".site-footer");
  await expect(brand.locator("span")).toHaveText("Budapest");
  await expect(page.getByRole("link", { name: /Media kit/ })).toHaveAttribute("href", "https://www.shipaton.com/media-kit");
  await expect(footer.getByRole("heading", { name: "Contact" })).toBeVisible();
  const githubLink = footer.getByRole("link", { name: "GitHub", exact: true });
  await expect(githubLink).toHaveAttribute("href", "https://github.com/HLCaptain");
  await expect(footer.getByRole("link", { name: "X", exact: true })).toHaveAttribute("href", "https://x.com/hlcaptain");
  await expect(footer.locator(".social-link svg")).toHaveCount(2);
  await expect(footer).not.toContainText(/\bfour\b|@hlcaptain|Official media-kit assets/i);
  if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
    await githubLink.hover();
    await expect(githubLink).toHaveCSS("background-color", "rgb(255, 129, 0)");
    await expect(githubLink).toHaveCSS("color", "rgb(23, 19, 38)");
  }
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
  await expect(page.locator(".site-footer__column")).toHaveCount(3);
  await expect(page.locator(".site-footer nav")).toHaveCount(2);
});

test("deep-links to Markdown headings and copies their references", async ({ page }, testInfo) => {
  if (testInfo.project.name === "tablet") {
    await page.setViewportSize({ width: 640, height: 900 });
  }
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
  const headingRow = page.locator(".event-document__heading-row").filter({ has: heading });
  const copy = headingRow.getByRole("button");
  await expect(copy).toHaveAccessibleName("Copy link to Goals");
  expect((await copy.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  if (await page.evaluate(() => matchMedia("(hover: hover)").matches)) {
    await page.mouse.move(0, 0);
    await expect(copy).toHaveCSS("opacity", "0");
    await headingRow.hover();
    await expect(copy).toHaveCSS("opacity", "1");
  } else {
    await expect(copy).toHaveCSS("opacity", "1");
  }
  await copy.focus();
  await expect(copy).toHaveCSS("opacity", "1");
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
