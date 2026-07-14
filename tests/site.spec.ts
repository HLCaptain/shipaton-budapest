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
  await freezeDate(page, "2026-07-15T10:00:00+02:00");
});

test("redirects the root to the current edition", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/2026\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-edition", "2026");
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe("/2026/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("local runway");
});

test("opens on the confirmed event without redundant navigation", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/2026/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("local runway");
  const event = page.locator('[data-event-card][data-date="2026-08-04"]');
  await expect(page.locator("[data-event-card]")).toHaveCount(1);
  await expect(event).toHaveAttribute("aria-current", "date");
  await expect(event.locator("[data-event-state]")).toHaveText("Upcoming");
  await expect(event.locator('[data-event-people="hosts"]')).toContainText("Balázs Püspök-Kiss");
  await expect(event.locator('[data-event-people="speakers"] li')).toHaveText([
    "Márton Braun",
    "Gábor Bóka",
    "Mirzamehdi Karimov"
  ]);
  if (page.viewportSize()!.width > 620) await expect(event.locator('[data-event-people="speakers"]')).toBeVisible();
  else await expect(event.locator('[data-event-people="speakers"]')).toBeHidden();
  await expect(event).not.toHaveAttribute("tabindex");
  await expect(event).toHaveCSS("cursor", "default");
  await expect(page.locator(".event-controls")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test("keeps content inside the viewport and exposes the important links", async ({ page }) => {
  await page.goto("/2026/");

  await expect(page.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", "/2026/events/");
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
  await page.goto("/2026/");

  const heroLink = page.getByRole("link", { name: "View Project Kickoff event details" });
  await expect(heroLink).toHaveAttribute("href", "/2026/events/project-kickoff/");
  await expect(heroLink.locator("[data-featured-title]")).toHaveText("Project Kickoff");
  await expect(heroLink.locator("[data-featured-location]")).toHaveText(
    "Genesys Cloud Services Hungary Kft. · Budapest, Teréz krt. 55-57, 1062 Hungary"
  );
  await expect(page.locator(".hero__lede")).not.toContainText(/\bfour\b/i);
});

test("uses browser history for the detail page's top back button", async ({ page }) => {
  await page.goto("/2026/?source=history");
  await page.getByRole("link", { name: "View Project Kickoff event details" }).click();

  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/$/);
  const backButton = page.getByRole("button", { name: "Back", exact: true });
  await expect(backButton).toHaveClass(/button--quiet/);
  await expect(backButton).toHaveClass(/button--compact/);
  await expect(backButton.locator(".button__icon")).toHaveCount(1);
  expect(await backButton.evaluate((button) => (
    button.getBoundingClientRect().width < button.parentElement!.getBoundingClientRect().width
  ))).toBe(true);

  await backButton.click();
  await expect(page).toHaveURL(/\/2026\/\?source=history$/);
});

test("publishes the isolated 2026 event routes", async ({ page }) => {
  await page.goto("/2026/events/");

  await expect(page).toHaveURL(/\/2026\/events\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-edition", "2026");
  expect(await page.locator(".event-grid-card time").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("datetime"))
  )).toEqual(["2026-08-04"]);
  expect(await page.locator(".event-grid-card__link").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href"))
  )).toEqual(["/2026/events/project-kickoff/"]);
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe("/2026/events/");
  await expect(page.locator('a[href^="/events/"]')).toHaveCount(0);

  await page.locator(".event-grid-card").getByRole("link", { name: "Project Kickoff", exact: true }).click();
  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/$/);
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe(
    "/2026/events/project-kickoff/"
  );
});

test("navigates from the event grid to MDX details and back", async ({ page }) => {
  await page.goto("/2026/");
  await page.getByRole("link", { name: "Events", exact: true }).click();

  await expect(page).toHaveURL(/\/2026\/events\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet. Make.");
  await expect(page.locator(".event-grid")).toHaveCSS("display", "grid");
  await expect(page.locator(".event-grid-card")).toHaveCount(1);
  await expect(page.locator(".event-grid-card__link")).toHaveCount(1);
  await expect(page.locator('.event-grid-card [data-event-people="hosts"]')).toContainText("Balázs Püspök-Kiss");
  const listedSpeakers = page.locator('.event-grid-card [data-event-people="speakers"]');
  await expect(listedSpeakers.locator("li")).toHaveText([
    "Márton Braun",
    "Gábor Bóka",
    "Mirzamehdi Karimov"
  ]);
  if (page.viewportSize()!.width > 620) await expect(listedSpeakers).toBeVisible();
  else await expect(listedSpeakers).toBeHidden();
  await expect(page.locator("a a")).toHaveCount(0);
  await page.locator(".event-grid-card").getByRole("link", { name: "Project Kickoff", exact: true }).click();

  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Project Kickoff");
  const facts = page.locator(".event-document__facts");
  await expect(facts).toContainText("Genesys Cloud Services Hungary Kft. · Budapest, Teréz krt. 55-57, 1062 Hungary");
  await expect(facts).toContainText("17:00–21:00");
  await expect(facts).toContainText("Mobile development · Team formation · AI-assisted coding");
  await expect(facts.getByRole("link", { name: /Genesys Cloud Services Hungary/ })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=47.509769399999996%2C19.058209299999998&query_place_id=ChIJo5TJXgDdQUcRZC48XlVw3VA"
  );
  await expect(page.getByRole("link", { name: /Reserve a place/ })).toHaveAttribute("href", "https://luma.com/9b5mxujb");
  await expect(page.getByRole("link", { name: /^RSVP/ })).toHaveAttribute("href", "https://luma.com/9b5mxujb");
  await expect(page.locator(".event-schedule > ol > li")).toHaveCount(14);
  await expect(page.locator(".event-schedule__index")).toHaveCount(0);
  await expect(page.locator(".event-schedule__time")).toHaveText([
    "17:00–17:20",
    "17:20–17:30",
    "17:30–17:45",
    "17:45–17:50",
    "17:50–18:05",
    "18:05–18:10",
    "18:10–18:25",
    "18:25–18:40",
    "18:40–18:50",
    "18:50–19:05",
    "19:05–19:15",
    "19:15–20:35",
    "20:35–20:50",
    "20:50–21:00"
  ]);
  await expect(page.locator(".event-schedule > ol")).toHaveCSS("border-top-width", "2px");
  await expect(page.locator(".event-schedule > ol > li").first()).toHaveCSS("border-radius", "0px");
  await expect(page.locator(".event-schedule > ol > li").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "What you can expect" })).toHaveAttribute("href", "#what-you-can-expect");
  await expect(page.locator(".event-document__body")).toContainText("Primary language: English");

  const team = page.locator(".event-people__groups");
  await expect(team.locator("dt")).toHaveText(["Host", "Organizer", "Speakers"]);
  await expect(team.locator('[data-event-people="hosts"] a')).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/balazs-puspok-kiss"
  );
  await expect(team.locator('[data-event-people="hosts"] a')).toHaveAttribute("target", "_blank");
  await expect(team.locator('[data-event-people="organizers"] a')).toHaveAttribute(
    "href",
    "https://luma.com/calendar/cal-VeKA6RiND89uvHk"
  );
  await expect(team.locator('[data-event-people="organizers"] a')).toHaveAttribute("target", "_blank");
  await expect(team.locator('[data-event-people="speakers"] li')).toHaveText([
    "Márton Braun",
    "Gábor Bóka",
    "Mirzamehdi Karimov"
  ]);
  await expect(team.locator('[data-event-people="speakers"] a')).toHaveCount(0);

  await page.getByRole("link", { name: "Back to 2026 events" }).click();
  await expect(page).toHaveURL(/\/2026\/events\/$/);
});

test("keeps page motion directional and stable from a scrolled route", async ({ page }) => {
  await page.goto("/2026/");

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
      rootAnimation: getComputedStyle(root, "::view-transition-old(root)").animationName,
      transitionName: getComputedStyle(pageContent).viewTransitionName,
      transitionScope: pageContent.hasAttribute("data-astro-transition-scope")
    };
  });

  expect(motion).toEqual({
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    fallbackIncomingMotion: ["page-in", "0.42s"],
    fallbackOutgoingMotion: ["page-fallback-out", "0.18s"],
    incomingDuration: "0.42s",
    outgoingDuration: "0.18s",
    rootAnimation: "none",
    transitionName: "page-content",
    transitionScope: false
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
          offset: getComputedStyle(document.documentElement).getPropertyValue("--page-old-scroll-offset-y").trim(),
          scrollY: window.scrollY
        };
      },
      { once: true }
    );
  });
  await page
    .locator('[data-event-card][data-date="2026-08-04"]')
    .getByRole("link", { name: "View event details" })
    .evaluate((link) => (link as HTMLAnchorElement).click());

  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-page-direction", "down");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const motionSource = await page.evaluate(
    () => (window as Window & { __shipatonMotionSource?: { offset: string; scrollY: number } }).__shipatonMotionSource
  );
  expect(motionSource?.offset).toBe(`${-motionSource!.scrollY}px`);

  await page.goBack();
  await expect(page).toHaveURL(/\/2026\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-page-direction", "up");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(motionSource!.scrollY);

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement, "::view-transition-new(page-content)").animationName)
  ).toBe("none");
});

test("animates through Astro's non-native fallback", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Fallback navigation is covered once at desktop size");
  await page.addInitScript(() => {
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
  });
  await page.goto("/2026/");
  await page.evaluate(() => {
    const state = window as Window & { __shipatonFallbackPhases?: string[][] };
    state.__shipatonFallbackPhases = [];
    const root = document.documentElement;
    new MutationObserver(() => {
      const phase = root.getAttribute("data-astro-transition-fallback");
      if (!phase || state.__shipatonFallbackPhases?.some(([recorded]) => recorded === phase)) return;
      const style = getComputedStyle(document.querySelector(".page-transition")!);
      state.__shipatonFallbackPhases?.push([phase, style.animationName, style.animationDuration]);
    }).observe(root, { attributes: true, attributeFilter: ["data-astro-transition-fallback"] });
  });

  await page.getByRole("link", { name: "Events", exact: true }).click({ noWaitAfter: true });
  await expect.poll(() => page.evaluate(
    () => (window as Window & { __shipatonFallbackPhases?: string[][] }).__shipatonFallbackPhases?.length
  )).toBe(2);
  expect(await page.evaluate(
    () => (window as Window & { __shipatonFallbackPhases?: string[][] }).__shipatonFallbackPhases
  )).toEqual([
    ["old", "page-fallback-out", "0.18s"],
    ["new", "page-in", "0.42s"]
  ]);
  await expect(page).toHaveURL(/\/2026\/events\/$/);
});

test("reinitializes page features across repeated client-side visits", async ({ page }) => {
  await page.goto("/2026/");
  await page.evaluate(() => ((window as Window & { __shipatonDocumentMarker?: string }).__shipatonDocumentMarker = "alive"));

  await page.getByRole("link", { name: "Events", exact: true }).click();
  await page.locator(".event-grid-card").getByRole("link", { name: "Project Kickoff", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy link to What you can expect" })).toHaveCount(1);

  await page.getByRole("link", { name: "Back to 2026 events", exact: true }).click();
  await page.locator(".event-grid-card").getByRole("link", { name: "Project Kickoff", exact: true }).click();
  await expect(page.locator(".event-document__copy-link")).not.toHaveCount(0);

  await page.getByRole("link", { name: "Shipaton Budapest home" }).click();
  await expect(page).toHaveURL(/\/2026\/$/);
  expect(
    await page.evaluate(() => (window as Window & { __shipatonDocumentMarker?: string }).__shipatonDocumentMarker)
  ).toBe("alive");
  await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveAttribute("data-date", "2026-08-04");
  await expect(page.locator(".event-controls")).toHaveCount(0);
});

test("keeps the event detail body aligned with a responsive table of contents", async ({ page }) => {
  await page.goto("/2026/events/project-kickoff/");

  const aboutHeading = page.getByRole("heading", { name: "About this event", exact: true });
  const title = page.getByRole("heading", { name: "Project Kickoff", exact: true });
  const scheduleHeading = page.getByRole("heading", { name: "Schedule", exact: true });
  const body = page.locator(".event-document__body");
  const toc = page.getByRole("navigation", { name: "On this page" });
  const intro = body.locator("> p").first();
  const titleBox = await title.boundingBox();
  const scheduleBox = await scheduleHeading.boundingBox();
  const headingBox = await aboutHeading.boundingBox();
  const bodyBox = await body.boundingBox();
  const tocBox = await toc.boundingBox();
  const backMargin = await page.locator(".event-document__back").evaluate((element) => getComputedStyle(element).marginBottom);
  const aboutMargin = await page.locator(".event-about").evaluate((element) => getComputedStyle(element).marginTop);
  const tocLinks = await toc.locator("li").evaluateAll((items) => items.map((item) => {
    const { x, y } = item.querySelector("a")!.getBoundingClientRect();
    return { depth: item.dataset.depth, x, y };
  }));

  expect(titleBox).not.toBeNull();
  expect(scheduleBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(tocBox).not.toBeNull();
  expect(Math.abs(titleBox!.x - scheduleBox!.x)).toBeLessThan(1);
  expect(Math.abs(titleBox!.x - headingBox!.x)).toBeLessThan(1);
  expect(Math.abs(headingBox!.x - bodyBox!.x)).toBeLessThan(1);
  expect(tocLinks.every((link, index) => index === 0 || link.y > tocLinks[index - 1].y)).toBe(true);
  const topLevelX = tocLinks.find(({ depth }) => depth === "2")!.x;
  expect(tocLinks.every(({ depth, x }) => (
    depth === "2" ? Math.abs(x - topLevelX) < 1 : x > topLevelX
  ))).toBe(true);
  expect(Number.parseFloat(backMargin)).toBeLessThanOrEqual(56);
  expect(Number.parseFloat(aboutMargin)).toBeLessThanOrEqual(80);
  await expect(intro).toHaveCSS("color", "rgb(81, 70, 99)");
  await expect(intro).toHaveCSS("font-weight", "500");
  await expect(page.getByRole("link", { name: "Back to 2026 events", exact: true }).locator(".button__icon")).toHaveCount(1);

  if (page.viewportSize()!.width > 940) {
    await expect(toc).toHaveCSS("position", "sticky");
    await expect(toc).toHaveCSS("overflow-y", "auto");
    expect(tocBox!.x).toBeGreaterThan(bodyBox!.x + bodyBox!.width - 1);

    await body.evaluate((article) => {
      const paragraph = article.querySelector("p")!;
      for (let index = 0; index < 20; index += 1) article.append(paragraph.cloneNode(true));
    });
    await toc.locator("ol").evaluate((list) => {
      const item = list.querySelector("li")!;
      for (let index = 0; index < 40; index += 1) list.append(item.cloneNode(true));
    });
    await page.locator(".event-about").evaluate((section) => {
      window.scrollTo({
        behavior: "instant" as ScrollBehavior,
        top: section.getBoundingClientRect().top + window.scrollY + 200
      });
    });
    await expect.poll(async () => Math.abs((await toc.boundingBox())!.y - 24)).toBeLessThan(2);
    const tocScroll = await toc.evaluate((element) => {
      const pageY = window.scrollY;
      element.scrollTop = 80;
      return {
        clientHeight: element.clientHeight,
        pageY,
        pageYAfter: window.scrollY,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop
      };
    });
    expect(tocScroll.scrollHeight).toBeGreaterThan(tocScroll.clientHeight);
    expect(tocScroll.scrollTop).toBeGreaterThan(0);
    expect(tocScroll.pageYAfter).toBe(tocScroll.pageY);
  } else {
    await expect(toc).toHaveCSS("position", "static");
    await expect(toc).toHaveCSS("overflow-y", "visible");
    expect(tocBox!.y).toBeLessThan(bodyBox!.y);
  }
});

test("keeps Budapest beside the brand and exposes contact links", async ({ page }) => {
  await page.goto("/2026/");

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
  await page.goto("/2026/");

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

  await page.goto("/2026/events/project-kickoff/#what-you-can-expect");

  const heading = page.getByRole("heading", { name: "What you can expect", exact: true });
  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/#what-you-can-expect$/);
  await expect(heading).toHaveAttribute("id", "what-you-can-expect");
  await expect(heading).toBeInViewport();
  const headingRow = page.locator(".event-document__heading-row").filter({ has: heading });
  const copy = headingRow.getByRole("button");
  await expect(copy).toHaveAccessibleName("Copy link to What you can expect");
  expect((await copy.boundingBox())!.x).toBeGreaterThanOrEqual(0);
  const canHover = await page.evaluate(() => matchMedia("(hover: hover)").matches);
  if (canHover && testInfo.project.name === "desktop") {
    await page.mouse.move(0, 0);
    await expect(copy).toHaveCSS("opacity", "0");
    await headingRow.hover();
    await expect(copy).toHaveCSS("opacity", "1");
  } else if (!canHover) {
    await expect(copy).toHaveCSS("opacity", "1");
  }
  await copy.focus();
  await expect(copy).toHaveCSS("opacity", "1");
  await copy.click();

  await expect(copy).toHaveAttribute("data-state", "copied");
  await expect(page.locator("[data-heading-copy-status]")).toHaveText("Copied link to What you can expect.");
  await expect.poll(() => page.locator("html").getAttribute("data-copied-heading-link")).toMatch(/\/2026\/events\/project-kickoff\/#what-you-can-expect$/);
});

test("selects and extrudes the event without changing its layout footprint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2026/");

  const card = page.locator('[data-event-card][data-date="2026-08-04"]');
  const before = await card.evaluate((element) => ({
    offsetHeight: (element as HTMLElement).offsetHeight,
    offsetLeft: (element as HTMLElement).offsetLeft,
    offsetWidth: (element as HTMLElement).offsetWidth
  }));

  await expect(card).toHaveAttribute("aria-current", "date");
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
});

test("gives clickable backdrops the right hover color", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Hover treatment only applies to hover-capable pointers");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/2026/");

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
