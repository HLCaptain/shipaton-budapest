import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime("2026-07-15T10:00:00+02:00");
});

test("redirects the root to the current edition", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/2026\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-edition", "2026");
  expect(new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!).pathname).toBe("/2026/");
  const socialImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(new URL(socialImage!).pathname).toBe("/2026/brand/shipaton-budapest-social-card.png");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", socialImage!);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Move your app forward");
});

test("fades in external SVG artwork after it loads", async ({ page }) => {
  await page.goto("/2026/");

  const fades = await page.locator('img[src$=".svg"]').evaluateAll((images) => images.map((image) => {
    const animation = image.getAnimations()[0];
    const frames = (animation.effect as KeyframeEffect).getKeyframes();
    return {
      duration: animation.effect?.getTiming().duration,
      opacity: frames.map((frame) => Number(frame.opacity))
    };
  }));

  expect(fades).toEqual([
    { duration: 400, opacity: [0, 1] },
    { duration: 400, opacity: [0, 1] }
  ]);
});

test("opens on the confirmed event without redundant navigation", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/2026/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Move your app forward");
  const event = page.locator('[data-event-card][data-date="2026-08-04"]');
  const teaser = page.locator("[data-event-teaser]");
  await expect(page.locator("[data-event-rail-card]")).toHaveCount(2);
  await expect(page.locator("[data-event-card]")).toHaveCount(1);
  await expect(teaser).toBeVisible();
  await expect(event).toHaveAttribute("aria-current", "date");
  await expect(event.locator("[data-event-state]")).toHaveText("Upcoming");
  await expect(event.locator('[data-event-people="hosts"]')).toContainText("Balázs Püspök-Kiss");
  await expect(event.locator('[data-event-people="speakers"] li')).toContainText([
    "Márton Braun",
    "Gábor Bóka",
    "Mirzamehdi Karimov"
  ]);
  if (page.viewportSize()!.width > 620) await expect(event.locator('[data-event-people="speakers"]')).toBeVisible();
  else await expect(event.locator('[data-event-people="speakers"]')).toBeHidden();
  await expect(event).toHaveAttribute("tabindex", "0");
  await expect(event).toHaveCSS("cursor", "pointer");
  await expect(page.locator(".event-controls")).toBeVisible();
  await expect(page.locator("[data-event-counter]")).toHaveText("1 / 2");
  const ctaLayout = await event.getByRole("link", { name: "View event details" }).evaluate((link) => {
    const card = link.closest<HTMLElement>("[data-event-card]")!;
    const cardBox = card.getBoundingClientRect();
    const linkBox = link.getBoundingClientRect();
    const cardStyle = getComputedStyle(card);
    return {
      bottomInset: cardBox.bottom - linkBox.bottom,
      bottomPadding: Number.parseFloat(cardStyle.paddingBottom),
      childElementCount: link.childElementCount,
      rightInset: cardBox.right - linkBox.right,
      rightPadding: Number.parseFloat(cardStyle.paddingRight),
      text: link.textContent,
      whiteSpace: getComputedStyle(link).whiteSpace
    };
  });
  expect(Math.abs(ctaLayout.rightInset - ctaLayout.rightPadding)).toBeLessThan(3);
  expect(Math.abs(ctaLayout.bottomInset - ctaLayout.bottomPadding)).toBeLessThan(3);
  expect(ctaLayout.childElementCount).toBe(0);
  expect(ctaLayout.text).toBe("View event details →");
  expect(ctaLayout.whiteSpace).toBe("nowrap");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(consoleErrors).toEqual([]);
});

test("uses smooth centering after an interrupted event-card drag", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Mouse drag regression is covered at desktop size");
  await page.goto("/2026/");

  const track = page.locator("[data-event-track]");
  const trackBox = await track.boundingBox();
  expect(trackBox).not.toBeNull();
  await page.mouse.move(trackBox!.x + trackBox!.width / 2, trackBox!.y + trackBox!.height / 2);
  await page.mouse.down();

  await track.evaluate((element) => {
    const cards = [...element.querySelectorAll<HTMLElement>("[data-event-rail-card]")];
    const card = cards.at(-1)!;
    const margin = Number.parseFloat(getComputedStyle(card).scrollMarginInlineStart) || 0;
    const left = card.offsetLeft - (element.clientWidth - card.offsetWidth) / 2 - margin / 2;
    const target = Math.max(0, Math.min(left, element.scrollWidth - element.clientWidth));
    element.scrollLeft = target - 200;
  });
  await expect(page.locator("[data-event-counter]")).toHaveText("2 / 2");

  await track.evaluate((element) => {
    const state = window as Window & { __eventRailScroll?: { behavior?: ScrollBehavior } };
    const scrollTo = element.scrollTo.bind(element);
    element.scrollTo = ((options: ScrollToOptions) => {
      state.__eventRailScroll = { behavior: options.behavior };
      scrollTo(options);
    }) as typeof element.scrollTo;
  });
  await track.dispatchEvent("pointerup");
  await page.mouse.up();

  await expect.poll(() => page.evaluate(
    () => (window as Window & { __eventRailScroll?: { behavior?: ScrollBehavior } }).__eventRailScroll
  )).toEqual({ behavior: "smooth" });
  await expect.poll(() => track.evaluate((element) => element.style.scrollSnapType)).toBe("");
});

test("invites ideas for a potential event before the competition deadline", async ({ page }) => {
  await page.goto("/2026/");

  const teaser = page.locator("[data-event-teaser]");
  await expect(teaser).toBeVisible();
  await expect(teaser).not.toHaveAttribute("data-event-card");
  await expect(teaser.getByRole("heading", { name: "What should happen next?" })).toBeVisible();
  await expect(teaser).toContainText("Not organized yet");
  await expect(teaser).toContainText("Share your Shipaton Budapest experience");
  await expect(teaser).toContainText("Contact the organizer");
  await expect(teaser).not.toContainText("Balázs");
  await expect(teaser.getByRole("link", { name: /^X / })).toHaveAttribute("href", "https://x.com/hlcaptain");
  await expect(teaser.getByRole("link", { name: /^LinkedIn / })).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/balazs-puspok-kiss"
  );
  for (const link of await teaser.getByRole("link").all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /\bnoopener\b/);
    await expect(link).toHaveAttribute("rel", /\bnoreferrer\b/);
  }
  await expect(teaser.getByRole("link", { name: /View event details/i })).toHaveCount(0);
});

test("removes the potential event at the competition deadline", async ({ page }) => {
  await page.clock.setFixedTime("2026-10-01T06:45:00Z");
  await page.goto("/2026/");

  const event = page.locator('[data-event-card][data-date="2026-08-04"]');
  await expect(page.locator("[data-event-teaser]")).toHaveCount(0);
  await expect(page.locator("[data-event-rail-card]")).toHaveCount(1);
  await expect(page.locator(".event-controls")).toBeHidden();
  await expect(page.locator("[data-event-counter]")).toHaveText("1 / 1");
  await expect(event).not.toHaveAttribute("tabindex");
  await expect(event).toHaveCSS("cursor", "default");
});

test("keeps content inside the viewport and exposes the important links", async ({ page }) => {
  await page.goto("/2026/");

  await expect(page.getByRole("link", { name: "Events", exact: true })).toHaveAttribute("href", "/2026/events/");
  await expect(page.getByRole("link", { name: "See the next event" })).toHaveAttribute("href", "#events");
  await expect(page.getByRole("link", { name: /Join Shipaton/ })).toHaveAttribute(
    "href",
    "https://revenuecat-shipaton-2026.devpost.com/"
  );
  await expect(page.locator("[data-event-track]")).toBeVisible();

  const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasPageOverflow).toBe(false);
  expect(await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage)).toBe("none");

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
    "Genesys Hungary office · Eiffel Irodaház"
  );
  await expect(page.locator(".hero__lede")).not.toContainText(/\bfour\b/i);
});

test("skips same-page anchors when using the detail page's top back link", async ({ page }) => {
  await page.goto("/2026/?source=history");
  await page.getByRole("link", { name: "View Project Kickoff event details" }).click();

  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/$/);
  const backLink = page.getByRole("link", { name: "Back", exact: true });
  await expect(backLink).toHaveAttribute("href", "/2026/");
  await expect(backLink).toHaveClass(/button--quiet/);
  await expect(backLink).toHaveClass(/button--compact/);
  await expect(backLink.locator(".button__icon")).toHaveCount(1);
  expect(await backLink.evaluate((link) => (
    link.getBoundingClientRect().width < link.parentElement!.getBoundingClientRect().width
  ))).toBe(true);

  await page.getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "Lightning talks" })
    .click();
  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/#lightning-talks$/);

  await backLink.click();
  await expect(page).toHaveURL(/\/2026\/\?source=history$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Move your app forward in good company.");
});

test("falls back to the edition home when no earlier internal path is available", async ({ page }) => {
  await page.goto("/2026/events/project-kickoff/");
  await page.getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "Lightning talks" })
    .click();

  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/2026\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Move your app forward in good company.");
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
  await expect(listedSpeakers.locator("li")).toContainText([
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
  await expect(facts).toContainText(
    "Genesys Hungary office · Teréz körút 55-57, Building B, Eiffel Irodaház · Entrance next to Cafe Frei"
  );
  await expect(facts).toContainText("17:00–21:00");
  await expect(facts).toContainText("Mobile development · Idea development · Mentoring");
  await expect(facts.getByRole("link", { name: /Genesys Hungary office/ })).toHaveAttribute(
    "href",
    "https://maps.app.goo.gl/4Qk2mNq2eZ7592NPA"
  );
  await expect(page.getByRole("link", { name: /Reserve a place/ })).toHaveAttribute("href", "https://luma.com/9b5mxujb");
  await expect(page.getByRole("link", { name: /^RSVP/ })).toHaveAttribute("href", "https://luma.com/9b5mxujb");
  await expect(page.locator(".event-schedule > ol > li")).toHaveCount(7);
  await expect(page.locator(".event-schedule__index")).toHaveCount(0);
  await expect(page.locator(".event-schedule__time")).toHaveText([
    "17:00",
    "17:20",
    "17:30",
    "18:25",
    "18:40",
    "19:10",
    "20:45"
  ]);
  const scheduleEmojis = page.locator('.event-schedule h3 > span[aria-hidden="true"]');
  await expect(scheduleEmojis).toHaveText(["👋", "🚀", "🎤", "☕", "🎲", "🛠️", "🤝"]);
  await expect(page.getByRole("heading", { name: "Arrival and registration", exact: true })).toBeVisible();
  const scheduleLayout = await page.locator(".event-schedule > ol").evaluate((list) => {
    const items = [...list.children] as HTMLElement[];
    const number = (value: string) => Number.parseFloat(value);
    const markerSize = (style: CSSStyleDeclaration, dimension: "height" | "width") => {
      const border = dimension === "width"
        ? number(style.borderLeftWidth) + number(style.borderRightWidth)
        : number(style.borderTopWidth) + number(style.borderBottomWidth);
      return number(style[dimension]) + (style.boxSizing === "border-box" ? 0 : border);
    };
    const geometry = items.slice(0, -1).map((item, index) => {
      const marker = getComputedStyle(item, "::before");
      const connector = getComputedStyle(item, "::after");
      const nextMarker = getComputedStyle(items[index + 1], "::before");
      return {
        centerDelta: Math.abs(
          number(marker.left) + markerSize(marker, "width") / 2
          - number(connector.left) - number(connector.width) / 2
        ),
        endDelta: Math.abs(-number(connector.bottom) - number(nextMarker.top)),
        startDelta: Math.abs(number(connector.top) - number(marker.top) - markerSize(marker, "height"))
      };
    });
    const markerTextDeltas = items.map((item) => {
      const marker = getComputedStyle(item, "::before");
      const itemBox = item.getBoundingClientRect();
      const timeBox = item.querySelector<HTMLElement>(".event-schedule__time")!.getBoundingClientRect();
      const markerCenter = itemBox.top + number(marker.top) + markerSize(marker, "height") / 2;
      return Math.abs(markerCenter - (timeBox.top + timeBox.height / 2));
    });
    const time = items[0].querySelector<HTMLElement>(".event-schedule__time")!;
    const heading = items[0].querySelector<HTMLElement>("h3")!;
    return {
      connectorWidth: getComputedStyle(items[0], "::after").width,
      headingTop: heading.getBoundingClientRect().top,
      markerWidth: getComputedStyle(items[0], "::before").borderTopWidth,
      maxCenterDelta: Math.max(...geometry.map(({ centerDelta }) => centerDelta)),
      maxEndDelta: Math.max(...geometry.map(({ endDelta }) => endDelta)),
      maxMarkerTextDelta: Math.max(...markerTextDeltas),
      maxStartDelta: Math.max(...geometry.map(({ startDelta }) => startDelta)),
      timeBottom: time.getBoundingClientRect().bottom,
      timeFontSize: Number.parseFloat(getComputedStyle(time).fontSize)
    };
  });
  expect(scheduleLayout.connectorWidth).toBe("2px");
  expect(scheduleLayout.markerWidth).toBe("2px");
  expect(scheduleLayout.maxCenterDelta).toBeLessThan(0.5);
  expect(scheduleLayout.maxEndDelta).toBeLessThan(0.5);
  expect(scheduleLayout.maxMarkerTextDelta).toBeLessThan(0.5);
  expect(scheduleLayout.maxStartDelta).toBeLessThan(0.5);
  expect(scheduleLayout.timeFontSize).toBeGreaterThan(20);
  expect(scheduleLayout.headingTop).toBeGreaterThan(scheduleLayout.timeBottom);
  await expect(page.locator(".event-schedule > ol > li").first()).toHaveCSS("border-radius", "0px");
  await expect(page.locator(".event-schedule > ol > li").first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Lightning talks" })).toHaveAttribute("href", "#lightning-talks");
  await expect(page.locator(".event-document__body")).toContainText("Primary languages: English and Hungarian");
  await expect(page.locator(".event-document__body")).toContainText("Food and drinks will be provided.");
  const thumbnail = page.locator(".event-document__header").getByRole("img", { name: /Ship-a-ton Budapest Kickoff 2026 poster/ });
  await expect(thumbnail).toHaveAttribute("src", "/2026/events/project-kickoff-thumbnail.webp");
  await expect(thumbnail).toHaveAttribute("width", "1254");
  await expect(thumbnail).toHaveAttribute("height", "1254");
  await expect(page.locator(".event-document__body .event-document__thumbnail")).toHaveCount(0);

  const heroCopy = page.locator(".event-document__hero-copy");
  const resources = page.locator(".event-document__resources");
  const [thumbnailBox, heroCopyBox, factsBox, resourcesBox] = await Promise.all([
    thumbnail.boundingBox(),
    heroCopy.boundingBox(),
    facts.boundingBox(),
    resources.boundingBox()
  ]);
  expect(thumbnailBox).not.toBeNull();
  expect(heroCopyBox).not.toBeNull();
  expect(factsBox).not.toBeNull();
  expect(resourcesBox).not.toBeNull();
  expect(Math.abs(thumbnailBox!.width - thumbnailBox!.height)).toBeLessThan(1);
  expect(thumbnailBox!.y).toBeLessThan(page.viewportSize()!.height);
  if (page.viewportSize()!.width > 940) {
    expect(thumbnailBox!.x).toBeGreaterThan(heroCopyBox!.x + heroCopyBox!.width);
    expect(Math.abs(thumbnailBox!.y - heroCopyBox!.y)).toBeLessThan(1);
  } else {
    expect(thumbnailBox!.y + thumbnailBox!.height).toBeLessThan(heroCopyBox!.y);
    expect(thumbnailBox!.y + thumbnailBox!.height).toBeLessThan(factsBox!.y);
    expect(thumbnailBox!.y + thumbnailBox!.height).toBeLessThan(resourcesBox!.y);
  }

  const team = page.locator(".event-people__groups");
  await expect(team.locator("dt")).toHaveText(["Host", "Speakers"]);
  await expect(team.locator('[data-event-people="hosts"] a')).toHaveAttribute(
    "href",
    "https://www.linkedin.com/in/balazs-puspok-kiss"
  );
  await expect(team.locator('[data-event-people="hosts"] a')).toHaveAttribute("target", "_blank");
  await expect(team.locator('[data-event-people="organizers"]')).toHaveCount(0);
  await expect(team.locator('[data-event-people="speakers"] li')).toContainText([
    "Márton Braun",
    "Gábor Bóka",
    "Mirzamehdi Karimov"
  ]);
  const speakerLinks = team.locator('[data-event-people="speakers"] a');
  await expect(speakerLinks).toHaveCount(3);
  expect(await speakerLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")))).toEqual([
    "https://www.linkedin.com/in/zsmb13/",
    "https://www.linkedin.com/in/gabor-boka/",
    "https://www.linkedin.com/in/mirzemehdi/"
  ]);

  await page.getByRole("link", { name: "Back to 2026 events" }).click();
  await expect(page).toHaveURL(/\/2026\/events\/$/);
});

test("previews venue photos accessibly", async ({ context, page }, testInfo) => {
  await page.goto("/2026/events/project-kickoff/");

  const alts = [
    "Sixth-floor terrace with long tables, chairs and views over the city rooftops",
    "Open lounge around the staircase with a café counter, built-in seating and hanging lights",
    "Bright sixth-floor open space with tables, chairs, plants and floor-to-ceiling windows"
  ];
  const descriptions = [
    "The terrace runs alongside the sixth-floor event space, with outdoor tables beneath retractable awnings and views across Budapest.",
    "This quieter area behind the staircase can be arranged with tables as a hands-on workspace for teams.",
    "The main space can be rearranged with rows of chairs for attendees. A large presentation display sits just beyond the left edge of the photo; the venue has previously hosted groups of around 30–40 people."
  ];
  const sources = [
    "/2026/events/project-kickoff-venue-terrace.webp",
    "/2026/events/project-kickoff-venue-workspace.webp",
    "/2026/events/project-kickoff-venue-main-room.webp"
  ];
  const rail = page.getByRole("list", { name: "Venue photos" });
  const thumbnails = rail.getByRole("button");
  await expect(thumbnails).toHaveCount(3);
  for (let index = 0; index < alts.length; index += 1) {
    const thumbnail = thumbnails.nth(index).getByRole("img", { name: alts[index] });
    await expect(thumbnail).toHaveAttribute("src", sources[index]);
    await expect(thumbnail).toHaveCSS("object-fit", "cover");
    expect(await thumbnails.nth(index).evaluate((button) => getComputedStyle(button).backgroundImage))
      .toContain(sources[index]);
  }
  await expect(page.getByText(descriptions[0], { exact: true })).not.toBeVisible();

  const railLayout = await rail.evaluate((list) => {
    const boxes = [...list.querySelectorAll("button")].map((button) => button.getBoundingClientRect());
    const documentBox = list.closest(".event-document")!.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    const headingBox = list.closest(".event-venue")!.querySelector("h2")!.getBoundingClientRect();
    const style = getComputedStyle(list);
    return {
      display: style.display,
      documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
      edgeAligned: Math.abs(boxes[0].left - headingBox.left) < 1,
      edgeToEdge: Math.abs(listBox.left - documentBox.left) < 1
        && Math.abs(listBox.right - documentBox.right) < 1,
      itemStartsAtRailEdge: Math.abs(boxes[0].left - listBox.left) < 1,
      overflowX: style.overflowX,
      sameRow: boxes.every(({ y }) => Math.abs(y - boxes[0].y) < 1),
      sideFade: style.maskImage !== "none",
      viewportEdgeToEdge: Math.abs(listBox.left) < 1
        && Math.abs(listBox.right - window.innerWidth) < 1,
      scrollable: list.scrollWidth > list.clientWidth
    };
  });
  expect(railLayout).toMatchObject({
    display: "flex",
    documentOverflow: false,
    overflowX: "auto",
    sameRow: true
  });
  const isWidthConstrained = page.viewportSize()!.width > 1280;
  expect(railLayout.edgeAligned).toBe(true);
  expect(railLayout.edgeToEdge).toBe(true);
  expect(railLayout.itemStartsAtRailEdge).toBe(false);
  expect(railLayout.sideFade).toBe(isWidthConstrained);
  expect(railLayout.viewportEdgeToEdge).toBe(!isWidthConstrained);
  if (!isWidthConstrained) expect(railLayout.scrollable).toBe(true);

  const opener = thumbnails.first();
  if (testInfo.project.name === "desktop") {
    await opener.hover();
    await expect.poll(() => opener.evaluate((button) => (
      Math.abs(Number.parseFloat(getComputedStyle(button).translate))
    ))).toBeGreaterThan(1);
    await expect(opener).toHaveCSS("background-color", "rgb(255, 129, 0)");
    await expect(opener).toHaveCSS("border-color", "rgb(255, 129, 0)");
    const hoverStyle = await opener.evaluate((button) => {
      const railStyle = getComputedStyle(button.closest("[aria-label='Venue photos']")!);
      const railBox = button.closest("[aria-label='Venue photos']")!.getBoundingClientRect();
      const style = getComputedStyle(button);
      const buttonBox = button.getBoundingClientRect();
      const extrusion = Math.abs(Number.parseFloat(style.translate));
      const hasSideFade = railStyle.maskImage !== "none";
      return {
        background: style.backgroundColor,
        border: style.borderColor,
        boxShadow: style.boxShadow,
        effectInsideRail: (hasSideFade || (buttonBox.left - 4 >= railBox.left
          && buttonBox.right + extrusion <= railBox.right))
          && buttonBox.top - 4 >= railBox.top
          && buttonBox.bottom + extrusion <= railBox.bottom,
        hasEdgeClearance: Number.parseFloat(railStyle.paddingTop) >= extrusion + 6
          && (hasSideFade || Number.parseFloat(railStyle.paddingLeft) >= extrusion + 6),
        translate: style.translate
      };
    });
    expect(hoverStyle.background).toBe("rgb(255, 129, 0)");
    expect(hoverStyle.border).toBe("rgb(255, 129, 0)");
    expect(hoverStyle.boxShadow).not.toBe("none");
    expect(hoverStyle.effectInsideRail).toBe(true);
    expect(hoverStyle.hasEdgeClearance).toBe(true);
    expect(hoverStyle.translate).not.toBe("none");

    await page.mouse.move(0, 0);
    await opener.focus();
    await expect(opener).toHaveCSS("outline-color", "rgb(255, 129, 0)");
  }

  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Venue photo preview" });
  const preview = dialog.getByRole("img", { name: alts[0] });
  const caption = dialog.locator("[data-venue-caption]");
  const description = dialog.locator("[data-venue-description]");
  const picture = dialog.getByRole("button", { name: "Zoom in on venue photo" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transitioning");
  await expect(dialog).toHaveCSS("opacity", "1");
  const close = dialog.getByRole("button", { name: "Close venue photo preview" });
  await expect(close).toHaveCount(1);
  await expect(preview).toHaveAttribute("src", sources[0]);
  await expect(dialog.locator("[data-venue-counter], [data-venue-zoom], [data-venue-details]")).toHaveCount(0);
  const controls = dialog.getByRole("group", { name: "Venue photo controls" });
  await expect(controls.getByRole("button")).toHaveCount(2);
  await expect(controls.getByRole("button", { name: /zoom|details/i })).toHaveCount(0);
  await expect(dialog.getByText(/^\d+\s*\/\s*\d+$/)).toHaveCount(0);
  await expect(dialog.getByText(descriptions[0], { exact: true })).toBeVisible();
  await expect(caption).toHaveCSS("color", "rgb(255, 250, 243)");
  expect(await caption.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      borderWidths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
      maxWidth: style.maxWidth,
      outlineStyle: style.outlineStyle,
      textAlign: style.textAlign
    };
  })).toEqual({
    backgroundImage: expect.stringContaining("linear-gradient"),
    borderWidths: ["0px", "0px", "0px", "0px"],
    maxWidth: "none",
    outlineStyle: "none",
    textAlign: "center"
  });
  expect(await preview.evaluate((image) => {
    const source = image as HTMLImageElement;
    const box = image.getBoundingClientRect();
    return Math.abs(box.width / box.height - source.naturalWidth / source.naturalHeight);
  })).toBeLessThan(0.01);

  const previous = controls.getByRole("button", { name: "Previous venue photo" });
  const next = controls.getByRole("button", { name: "Next venue photo" });
  const [previewBoxBeforeZoom, captionBox, closeBox, previousBox, nextBox] = await Promise.all([
    preview.boundingBox(),
    caption.boundingBox(),
    close.boundingBox(),
    previous.boundingBox(),
    next.boundingBox()
  ]);
  const dialogTreatment = await dialog.evaluate((element) => {
    const image = element.querySelector<HTMLElement>("[data-venue-preview-image]")!;
    const imageBox = image.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const pictureStyle = getComputedStyle(element.querySelector("[data-venue-picture]")!);
    const style = getComputedStyle(element.querySelector(".venue-preview__shell")!);
    return {
      borderRadius: Number.parseFloat(style.borderTopLeftRadius),
      withinSizeCap: box.width <= 1281 && box.height <= window.innerHeight * 0.8 + 1,
      fillsViewport: Math.min(
        Math.abs(box.width - (window.innerWidth - 16)),
        Math.abs(box.height - (window.innerHeight - 16))
      ) < 2,
      imageInset: Math.max(
        Math.abs(imageBox.left - box.left),
        Math.abs(imageBox.top - box.top),
        Math.abs(imageBox.right - box.right),
        Math.abs(imageBox.bottom - box.bottom)
      ),
      picturePadding: [
        pictureStyle.paddingTop,
        pictureStyle.paddingRight,
        pictureStyle.paddingBottom,
        pictureStyle.paddingLeft
      ],
      ratioError: Math.abs(box.width / box.height - imageBox.width / imageBox.height)
    };
  });
  expect(dialogTreatment.borderRadius).toBeGreaterThan(0);
  expect(dialogTreatment.withinSizeCap).toBe(true);
  expect(dialogTreatment.fillsViewport).toBe(testInfo.project.name !== "desktop");
  expect(dialogTreatment.imageInset).toBeLessThan(1);
  expect(dialogTreatment.picturePadding).toEqual(["0px", "0px", "0px", "0px"]);
  expect(dialogTreatment.ratioError).toBeLessThan(0.01);

  const imageCenterY = previewBoxBeforeZoom!.y + previewBoxBeforeZoom!.height / 2;
  expect(Math.abs(previousBox!.y + previousBox!.height / 2 - imageCenterY)).toBeLessThan(2);
  expect(Math.abs(nextBox!.y + nextBox!.height / 2 - imageCenterY)).toBeLessThan(2);
  expect(previousBox!.x - previewBoxBeforeZoom!.x).toBeGreaterThanOrEqual(0);
  expect(previousBox!.x - previewBoxBeforeZoom!.x).toBeLessThan(16);
  expect(previewBoxBeforeZoom!.x + previewBoxBeforeZoom!.width - nextBox!.x - nextBox!.width).toBeLessThan(16);
  expect(Math.abs(captionBox!.x - previewBoxBeforeZoom!.x)).toBeLessThan(1);
  expect(Math.abs(captionBox!.width - previewBoxBeforeZoom!.width)).toBeLessThan(1);
  expect(Math.abs(captionBox!.y + captionBox!.height - previewBoxBeforeZoom!.y - previewBoxBeforeZoom!.height)).toBeLessThan(2);
  expect(closeBox!.y).toBeLessThanOrEqual(16);
  expect(Math.abs(closeBox!.x + closeBox!.width - page.viewportSize()!.width)).toBeLessThanOrEqual(16);
  await expect(close).toHaveCSS("position", "fixed");
  await expect(close).toHaveCSS("opacity", "1");
  expect(await close.evaluate((button) => {
    const box = button.getBoundingClientRect();
    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("[data-venue-close]") === button;
  })).toBe(true);
  await expect(close).toHaveCSS("background-color", "rgba(13, 10, 22, 0.68)");
  await expect(previous).toHaveCSS("background-color", "rgba(13, 10, 22, 0.68)");
  await expect(controls).toHaveCSS("position", "absolute");
  await expect(caption).toHaveCSS("position", "absolute");

  const canHover = await page.evaluate(() => matchMedia("(hover: hover)").matches);
  if (canHover) {
    await page.mouse.move(0, 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(caption).toHaveCSS("opacity", "0");
    await expect(close).toHaveCSS("opacity", "1");
    await expect(controls).toHaveCSS("opacity", "0");
    await picture.hover({
      position: {
        x: Math.round(previewBoxBeforeZoom!.width / 2),
        y: Math.round(previewBoxBeforeZoom!.height / 2)
      }
    });
    await expect(caption).toHaveCSS("opacity", "1");
    await expect(close).toHaveCSS("opacity", "1");
    await expect(controls).toHaveCSS("opacity", "1");

    for (const arrow of [previous, next]) {
      const buttonBefore = await arrow.boundingBox();
      const iconBefore = await arrow.locator(".button__icon").boundingBox();
      await arrow.hover();
      await page.waitForTimeout(180);
      const buttonAfter = await arrow.boundingBox();
      const iconAfter = await arrow.locator(".button__icon").boundingBox();
      expect(buttonAfter).toEqual(buttonBefore);
      expect(iconAfter).toEqual(iconBefore);
    }
  } else {
    await expect(caption).toHaveCSS("opacity", "1");
    await expect(close).toHaveCSS("opacity", "1");
    await expect(controls).toHaveCSS("opacity", "1");
  }

  const previewBox = await preview.boundingBox();
  const viewport = dialog.locator("[data-venue-viewport]");
  await expect(picture).toHaveCSS("cursor", "zoom-in");
  const zoomPoint = {
    x: previewBox!.x + previewBox!.width * 0.72,
    y: previewBox!.y + previewBox!.height * 0.28
  };
  await page.mouse.click(zoomPoint.x, zoomPoint.y);
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  await expect(dialog.getByRole("button", { name: "Zoom out of venue photo" })).toHaveAttribute("aria-pressed", "true");
  await expect(viewport).toHaveCSS("cursor", "zoom-out");
  expect(await preview.evaluate((image) => getComputedStyle(image).transform)).not.toBe("none");
  const zoomOrigin = await preview.evaluate((image) => {
    const [x, y] = getComputedStyle(image).transformOrigin.split(" ").map(Number.parseFloat);
    return { x: x / image.clientWidth, y: y / image.clientHeight };
  });
  expect(zoomOrigin.x).toBeCloseTo(0.72, 1);
  expect(zoomOrigin.y).toBeCloseTo(0.28, 1);
  await expect.poll(() => viewport.evaluate((element) => (
    element.scrollWidth > element.clientWidth
  ))).toBe(true);
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(() => viewport.evaluate((element) => {
    const image = element.querySelector<HTMLImageElement>("[data-venue-preview-image]")!;
    return Math.abs(element.scrollLeft - image.clientWidth * 0.72) / image.clientWidth;
  })).toBeLessThan(0.01);
  const normalizedZoom = await viewport.evaluate((element) => {
    const image = element.querySelector("[data-venue-preview-image]") as HTMLImageElement;
    const expectedScrollTop = Math.min(image.clientHeight * 0.28, element.scrollHeight - element.clientHeight);
    return {
      anchorErrorRatio: Math.abs(element.scrollLeft - image.clientWidth * 0.72) / image.clientWidth,
      verticalAnchorErrorRatio: Math.abs(element.scrollTop - expectedScrollTop) / image.clientHeight,
      origin: getComputedStyle(image).transformOrigin
    };
  });
  expect(normalizedZoom.anchorErrorRatio).toBeLessThan(0.01);
  expect(normalizedZoom.verticalAnchorErrorRatio).toBeLessThan(0.01);
  expect(normalizedZoom.origin).toBe("0px 0px");

  const viewportBox = await viewport.boundingBox();
  const panStart = await viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  await page.mouse.move(viewportBox!.x + viewportBox!.width / 2, viewportBox!.y + viewportBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    viewportBox!.x + viewportBox!.width / 2 + 60,
    viewportBox!.y + viewportBox!.height / 2 + 40,
    { steps: 4 }
  );
  await page.mouse.up();
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  const panEnd = await viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop }));
  expect(panEnd.left).toBeLessThan(panStart.left - 40);
  expect(panEnd.top).toBeLessThan(panStart.top - 20);

  const zoomOutStart = await viewport.evaluate((element) => {
    const image = element.querySelector("[data-venue-preview-image]")!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return { height: image.height, left: image.left - box.left, top: image.top - box.top, width: image.width };
  });

  await page.mouse.click(
    viewportBox!.x + viewportBox!.width * 0.9,
    viewportBox!.y + viewportBox!.height * 0.25
  );
  await expect(dialog).not.toHaveAttribute("data-zoomed");
  await expect(picture).toHaveAttribute("aria-pressed", "false");
  const zoomOutFirstFrame = await preview.evaluate((image) => {
    const animation = image.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const box = image.closest("[data-venue-viewport]")!.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const frame = {
      height: imageBox.height,
      left: imageBox.left - box.left,
      top: imageBox.top - box.top,
      width: imageBox.width
    };
    animation.play();
    return frame;
  });
  for (const edge of ["height", "left", "top", "width"] as const) {
    expect(zoomOutFirstFrame[edge]).toBeCloseTo(zoomOutStart[edge], 0);
  }
  await expect.poll(() => viewport.evaluate((element) => [element.scrollLeft, element.scrollTop])).toEqual([0, 0]);

  const readSlide = () => dialog.evaluate((element) => {
    const viewport = element.querySelector("[data-venue-viewport]")!;
    const picture = element.querySelector("[data-venue-picture]")!;
    const incoming = element.querySelector<HTMLImageElement>(".venue-preview__slide")!;
    const x = (value: string | null | undefined) => new DOMMatrix(value && value !== "none" ? value : undefined).e;
    const outgoingFrames = (picture.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
    const incomingFrames = (incoming.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
    const sizeFrames = (element.getAnimations().find((animation) => (
      (animation.effect as KeyframeEffect).getKeyframes()[0].width
    ))!.effect as KeyframeEffect).getKeyframes();
    return {
      endSize: {
        height: Number.parseFloat(String(sizeFrames.at(-1)?.height)),
        width: Number.parseFloat(String(sizeFrames.at(-1)?.width))
      },
      incomingEnd: x(incomingFrames.at(-1)?.transform as string),
      incomingSrc: incoming.getAttribute("src"),
      incomingStart: x(incomingFrames[0].transform as string),
      outgoingEnd: x(outgoingFrames.at(-1)?.transform as string),
      outgoingStart: x(outgoingFrames[0].transform as string),
      startSize: {
        height: Number.parseFloat(String(sizeFrames[0].height)),
        width: Number.parseFloat(String(sizeFrames[0].width))
      },
      width: viewport.getBoundingClientRect().width
    };
  });

  await description.evaluate((element) => {
    new MutationObserver((_, observer) => {
      const frames = (element.getAnimations()[0].effect as KeyframeEffect).getKeyframes();
      element.setAttribute("data-test-swap-opacity", getComputedStyle(element).opacity);
      element.setAttribute("data-test-fade-in", JSON.stringify(frames.map(({ opacity }) => Number(opacity))));
      observer.disconnect();
    }).observe(element, { childList: true });
  });
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator(".venue-preview__slide")).toHaveCount(1);
  const nextSlide = await readSlide();
  expect(nextSlide.incomingSrc).toBe(sources[1]);
  expect(nextSlide.outgoingStart).toBeCloseTo(0, 0);
  expect(nextSlide.outgoingEnd).toBeLessThanOrEqual(-nextSlide.width);
  expect(nextSlide.incomingStart).toBeCloseTo(-nextSlide.outgoingEnd, 0);
  expect(nextSlide.incomingEnd).toBeCloseTo(0, 0);
  expect(Math.max(
    Math.abs(nextSlide.endSize.height - nextSlide.startSize.height),
    Math.abs(nextSlide.endSize.width - nextSlide.startSize.width)
  )).toBeGreaterThan(1);
  await page.mouse.click(
    viewportBox!.x + viewportBox!.width / 2,
    viewportBox!.y + viewportBox!.height * 0.25
  );
  await expect(dialog).not.toHaveAttribute("data-zoomed");
  await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute("src", sources[1]);
  const nextDialogBox = await dialog.boundingBox();
  expect(nextDialogBox!.width).toBeCloseTo(nextSlide.endSize.width, 0);
  expect(nextDialogBox!.height).toBeCloseTo(nextSlide.endSize.height, 0);
  await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute("alt", alts[1]);
  await expect(dialog.getByText(descriptions[1], { exact: true })).toBeVisible();
  expect(Number(await description.getAttribute("data-test-swap-opacity"))).toBeLessThan(0.1);
  expect(JSON.parse((await description.getAttribute("data-test-fade-in"))!)).toEqual([0, 1]);
  await expect(dialog).not.toHaveAttribute("data-zoomed");
  await expect(picture).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator(".venue-preview__slide")).toHaveCount(1);
  const previousSlide = await readSlide();
  expect(previousSlide.incomingSrc).toBe(sources[0]);
  expect(previousSlide.outgoingEnd).toBeGreaterThanOrEqual(previousSlide.width);
  expect(previousSlide.incomingStart).toBeCloseTo(-previousSlide.outgoingEnd, 0);
  await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute("src", sources[0]);
  const previousDialogBox = await dialog.boundingBox();
  expect(previousDialogBox!.width).toBeCloseTo(previousSlide.endSize.width, 0);
  expect(previousDialogBox!.height).toBeCloseTo(previousSlide.endSize.height, 0);

  if (testInfo.project.name === "mobile") {
    const swipeBox = await preview.boundingBox();
    const y = swipeBox!.y + swipeBox!.height * 0.3;
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: swipeBox!.x + swipeBox!.width * 0.78, y }]
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: swipeBox!.x + swipeBox!.width * 0.22, y }]
    });
    await expect(picture).toHaveAttribute("data-dragging", "true");
    await expect.poll(() => picture.evaluate((element) => (
      new DOMMatrix(getComputedStyle(element).transform).e
    ))).toBeLessThan(-10);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute("src", sources[1]);
    await expect(dialog.getByText(descriptions[1], { exact: true })).toBeVisible();
    await expect.poll(() => picture.evaluate((element) => element.getAnimations().length)).toBe(0);

    const reverseBox = await dialog.locator("[data-venue-preview-image]").boundingBox();
    const reverseY = reverseBox!.y + reverseBox!.height * 0.3;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: reverseBox!.x + reverseBox!.width * 0.22, y: reverseY }]
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: reverseBox!.x + reverseBox!.width * 0.78, y: reverseY }]
    });
    await expect(picture).toHaveAttribute("data-dragging", "true");
    await expect.poll(() => picture.evaluate((element) => (
      new DOMMatrix(getComputedStyle(element).transform).e
    ))).toBeGreaterThan(10);
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute("src", sources[0]);

    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: reverseBox!.x + reverseBox!.width * 0.78, y: reverseY }]
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: reverseBox!.x + reverseBox!.width * 0.22, y: reverseY }]
    });
    await expect(picture).toHaveAttribute("data-dragging", "true");
    await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await expect(dialog.locator(".venue-preview__slide")).toHaveCount(0);
    await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute("src", sources[0]);
    await client.detach();
  }

  await expect(close).toBeVisible();
  await expect(close).toHaveCSS("opacity", "1");
  const closeAfterInteractions = await close.boundingBox();
  expect(closeAfterInteractions!.y).toBeLessThanOrEqual(16);
  expect(Math.abs(closeAfterInteractions!.x + closeAfterInteractions!.width - page.viewportSize()!.width)).toBeLessThanOrEqual(16);

  await close.click();
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(preview).not.toHaveAttribute("data-venue-transition");
  await page.mouse.click(1, 1);
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(preview).not.toHaveAttribute("data-venue-transition");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("animates the venue preview and respects reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Motion treatment is covered once at desktop size");
  await page.goto("/2026/events/project-kickoff/");

  const dialog = page.locator("[data-venue-dialog]");
  const picture = dialog.locator("[data-venue-picture]");
  const transitionMs = await dialog.evaluate((element) => {
    const duration = (value: string) => Math.max(...value.split(",").map((item) => {
      const time = item.trim();
      return Number.parseFloat(time) * (time.endsWith("ms") ? 1 : 1000);
    }));
    return {
      backdrop: duration(getComputedStyle(element, "::backdrop").transitionDuration),
      dialog: duration(getComputedStyle(element).transitionDuration),
      shared: duration(getComputedStyle(document.documentElement, "::view-transition-group(venue-photo)").animationDuration),
      zoom: duration(getComputedStyle(element.querySelector("[data-venue-preview-image]")!).transitionDuration)
    };
  });
  expect(transitionMs.dialog).toBeGreaterThanOrEqual(200);
  expect(transitionMs.backdrop).toBeGreaterThanOrEqual(200);
  expect(transitionMs.shared).toBeGreaterThanOrEqual(300);
  expect(transitionMs.zoom).toBeGreaterThanOrEqual(250);

  const isolatedTransition = await page.evaluate(() => {
    const root = document.documentElement;
    root.dataset.venueTransitioning = "open";
    const treatment: Record<string, string> = {
      backdropAnimation: getComputedStyle(root, "::view-transition").animationName,
      backdropColor: getComputedStyle(root, "::view-transition").backgroundColor,
      openCloseNewAnimation: getComputedStyle(root, "::view-transition-new(venue-close)").animationName,
      openCloseNewDirection: getComputedStyle(root, "::view-transition-new(venue-close)").animationDirection,
      openCloseNewTiming: getComputedStyle(root, "::view-transition-new(venue-close)").animationTimingFunction,
      closeGroupZIndex: getComputedStyle(root, "::view-transition-group(venue-close)").zIndex,
      dialogScale: getComputedStyle(document.querySelector("[data-venue-dialog]")!).scale,
      dialogTranslate: getComputedStyle(document.querySelector("[data-venue-dialog]")!).translate,
      groupBorderRadius: getComputedStyle(root, "::view-transition-group(venue-photo)").borderRadius,
      groupOverflow: getComputedStyle(root, "::view-transition-group(venue-photo)").overflow,
      groupZIndex: getComputedStyle(root, "::view-transition-group(venue-photo)").zIndex,
      openPhotoNewAnimation: getComputedStyle(root, "::view-transition-new(venue-photo)").animationName,
      openPhotoNewObjectFit: getComputedStyle(root, "::view-transition-new(venue-photo)").objectFit,
      openPhotoNewOpacity: getComputedStyle(root, "::view-transition-new(venue-photo)").opacity,
      openPhotoOldAnimation: getComputedStyle(root, "::view-transition-old(venue-photo)").animationName,
      openPhotoOldObjectFit: getComputedStyle(root, "::view-transition-old(venue-photo)").objectFit,
      openPhotoOldOpacity: getComputedStyle(root, "::view-transition-old(venue-photo)").opacity,
      rootNewOpacity: getComputedStyle(root, "::view-transition-new(root)").opacity,
      venuePageTransitionName: getComputedStyle(document.querySelector(".page-transition")!).viewTransitionName,
    };
    root.dataset.venueTransitioning = "close";
    treatment.closeCloseOldAnimation = getComputedStyle(root, "::view-transition-old(venue-close)").animationName;
    treatment.closeCloseOldDirection = getComputedStyle(root, "::view-transition-old(venue-close)").animationDirection;
    treatment.closeCloseOldTiming = getComputedStyle(root, "::view-transition-old(venue-close)").animationTimingFunction;
    treatment.closeThumbnailTransitionDuration = getComputedStyle(document.querySelector("[data-venue-photo]")!).transitionDuration;
    treatment.closePhotoNewAnimation = getComputedStyle(root, "::view-transition-new(venue-photo)").animationName;
    treatment.closePhotoNewObjectFit = getComputedStyle(root, "::view-transition-new(venue-photo)").objectFit;
    treatment.closePhotoNewOpacity = getComputedStyle(root, "::view-transition-new(venue-photo)").opacity;
    treatment.closePhotoOldAnimation = getComputedStyle(root, "::view-transition-old(venue-photo)").animationName;
    treatment.closePhotoOldObjectFit = getComputedStyle(root, "::view-transition-old(venue-photo)").objectFit;
    treatment.closePhotoOldOpacity = getComputedStyle(root, "::view-transition-old(venue-photo)").opacity;
    treatment.closeRootOldOpacity = getComputedStyle(root, "::view-transition-old(root)").opacity;
    delete root.dataset.venueTransitioning;
    return treatment;
  });
  expect(isolatedTransition).toEqual({
    backdropAnimation: "none",
    backdropColor: "rgb(10, 7, 17)",
    closeCloseOldAnimation: "venue-close-fade",
    closeCloseOldDirection: "reverse",
    closeCloseOldTiming: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    closeGroupZIndex: "3",
    closePhotoNewAnimation: "none",
    closePhotoNewObjectFit: "cover",
    closePhotoNewOpacity: "0",
    closePhotoOldAnimation: "none",
    closePhotoOldObjectFit: "cover",
    closePhotoOldOpacity: "1",
    closeRootOldOpacity: "0",
    closeThumbnailTransitionDuration: "0s",
    dialogScale: "none",
    dialogTranslate: "none",
    groupBorderRadius: "10px",
    groupOverflow: "clip",
    groupZIndex: "2",
    openPhotoNewAnimation: "none",
    openPhotoNewObjectFit: "cover",
    openPhotoNewOpacity: "1",
    openPhotoOldAnimation: "none",
    openPhotoOldObjectFit: "cover",
    openPhotoOldOpacity: "0",
    openCloseNewAnimation: "venue-close-fade",
    openCloseNewDirection: "normal",
    openCloseNewTiming: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    rootNewOpacity: "0",
    venuePageTransitionName: "none"
  });

  const supportsSharedTransition = await page.evaluate(() => {
    const start = document.startViewTransition?.bind(document);
    if (!start) return false;
    document.startViewTransition = (options) => {
      const update = typeof options === "function" ? options : options?.update;
      const root = document.documentElement;
      const phase = () => document.querySelector("[data-venue-preview-image][data-venue-transition]")
        ? "preview"
        : document.querySelector("[data-venue-photo] img[data-venue-transition]") ? "thumbnail" : "none";
      root.dataset.venueTransitionOld = phase();
      const source = document.querySelector<HTMLElement>("[data-venue-transition]");
      if (source) {
        const { x, y, width, height } = source.getBoundingClientRect();
        root.dataset.venueTransitionSourceBox = JSON.stringify({ x, y, width, height });
      }
      return start(async () => {
        await update?.();
        root.dataset.venueTransitionNew = phase();
        const target = document.querySelector<HTMLElement>("[data-venue-transition]");
        if (target) {
          const { x, y, width, height } = target.getBoundingClientRect();
          root.dataset.venueTransitionTargetBox = JSON.stringify({ x, y, width, height });
        }
      });
    };
    return true;
  });
  await page.getByRole("list", { name: "Venue photos" }).getByRole("button").first().click();
  if (supportsSharedTransition) {
    await expect(page.locator("html")).toHaveAttribute("data-venue-transitioning", "open");
    await expect(page.locator("html")).toHaveAttribute("data-venue-transition-old", "thumbnail");
    await expect(page.locator("html")).toHaveAttribute("data-venue-transition-new", "preview");
    expect(await page.evaluate(() => (
      getComputedStyle(document.documentElement, "::view-transition-new(venue-close)").animationName
    ))).toBe("venue-close-fade");
  }
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transitioning");
  if (supportsSharedTransition) {
    const targetBox = await page.locator("html").getAttribute("data-venue-transition-target-box");
    const finalBox = await dialog.locator("[data-venue-preview-image]").boundingBox();
    expect(finalBox).toEqual(JSON.parse(targetBox!));
  }
  await dialog.getByRole("button", { name: "Next venue photo" }).click();
  expect(await dialog.evaluate((element) => [
    element.querySelector("[data-venue-picture]")!.getAnimations()[0],
    element.querySelector(".venue-preview__slide")!.getAnimations()[0]
  ].every((animation) => Number(animation.effect?.getTiming().duration) >= 300))).toBe(true);
  await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute(
    "src",
    "/2026/events/project-kickoff-venue-workspace.webp"
  );
  await dialog.getByRole("button", { name: "Close venue photo preview" }).click();
  if (supportsSharedTransition) {
    await expect(page.locator("html")).toHaveAttribute("data-venue-transitioning", "close");
    await expect(page.locator("html")).toHaveAttribute("data-venue-transition-old", "preview");
    await expect(page.locator("html")).toHaveAttribute("data-venue-transition-new", "thumbnail");
    expect(await page.evaluate(() => ({
      newOpacity: getComputedStyle(document.documentElement, "::view-transition-new(venue-photo)").opacity,
      oldOpacity: getComputedStyle(document.documentElement, "::view-transition-old(venue-photo)").opacity
    }))).toEqual({ newOpacity: "0", oldOpacity: "1" });
  }
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transitioning");
  if (supportsSharedTransition) {
    const targetBox = await page.locator("html").getAttribute("data-venue-transition-target-box");
    const finalBox = await page.getByRole("list", { name: "Venue photos" }).getByRole("img").nth(1).boundingBox();
    expect(finalBox).toEqual(JSON.parse(targetBox!));
  }

  const hoverTarget = page.getByRole("list", { name: "Venue photos" }).getByRole("button").first();
  await hoverTarget.click();
  if (supportsSharedTransition) await expect(page.locator("html")).toHaveAttribute("data-venue-transitioning", "open");
  await hoverTarget.evaluate((button) => {
    button.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
  });
  const hoverTargetBox = await hoverTarget.boundingBox();
  await page.mouse.move(hoverTargetBox!.x + hoverTargetBox!.width / 2, hoverTargetBox!.y + hoverTargetBox!.height / 2);
  await dialog.getByRole("button", { name: "Close venue photo preview" }).evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  if (supportsSharedTransition) {
    await expect(page.locator("html")).toHaveAttribute("data-venue-transitioning", "close");
    await page.waitForFunction(() => document.getAnimations().some((animation) =>
      (animation.effect as KeyframeEffect & { pseudoElement?: string })?.pseudoElement === "::view-transition-group(venue-photo)"
    ));
    const landing = await page.evaluate(() => {
      const animation = document.getAnimations().find((candidate) =>
        (candidate.effect as KeyframeEffect & { pseudoElement?: string })?.pseudoElement === "::view-transition-group(venue-photo)"
      )!;
      const matrix = new DOMMatrix((animation.effect as KeyframeEffect).getKeyframes().at(-1)!.transform as string);
      const target = document.querySelector("[data-venue-photo] img[data-venue-transition]")!;
      const box = target.getBoundingClientRect();
      return {
        x: matrix.e,
        y: matrix.f,
        targetX: box.x,
        targetY: box.y,
        translate: getComputedStyle(target.closest("[data-venue-photo]")!).translate
      };
    });
    expect(landing.translate).toBe("-8px -8px");
    expect(Math.abs(landing.x - landing.targetX)).toBeLessThan(0.01);
    expect(Math.abs(landing.y - landing.targetY)).toBeLessThan(0.01);
  }
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transitioning");
  await expect(hoverTarget).not.toHaveAttribute("data-venue-hover-target");
  await expect.poll(() => hoverTarget.evaluate((button) => button.matches(":hover"))).toBe(true);
  if (supportsSharedTransition) {
    const targetBox = JSON.parse((await page.locator("html").getAttribute("data-venue-transition-target-box"))!);
    expect(await hoverTarget.locator("img").boundingBox()).toEqual(targetBox);
  }

  await page.getByRole("list", { name: "Venue photos" }).getByRole("button").first().click();
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transitioning");
  const normalPreviewBox = await dialog.locator("[data-venue-preview-image]").boundingBox();
  await picture.click();
  await expect(dialog).toHaveAttribute("data-zoomed", "");
  await expect.poll(async () => (await dialog.locator("[data-venue-preview-image]").boundingBox())!.width)
    .toBeGreaterThan(normalPreviewBox!.width * 1.9);
  await dialog.getByRole("button", { name: "Close venue photo preview" }).click();
  if (supportsSharedTransition) {
    await expect(page.locator("html")).toHaveAttribute("data-venue-transitioning", "close");
    const sourceBox = JSON.parse((await page.locator("html").getAttribute("data-venue-transition-source-box"))!);
    expect(sourceBox.width).toBeCloseTo(normalPreviewBox!.width, 0);
    expect(sourceBox.height).toBeCloseTo(normalPreviewBox!.height, 0);
  }
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transitioning");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("html").evaluate((element) => {
    delete element.dataset.venueTransitionOld;
    delete element.dataset.venueTransitionNew;
    delete element.dataset.venueTransitionSourceBox;
    delete element.dataset.venueTransitionTargetBox;
  });
  const reducedTransitionMs = await dialog.evaluate((element) => {
    const duration = (target: Element) => {
      const time = getComputedStyle(target).transitionDuration;
      return Number.parseFloat(time) * (time.endsWith("ms") ? 1 : 1000);
    };
    return {
      dialog: duration(element),
      image: duration(element.querySelector("[data-venue-preview-image]")!)
    };
  });
  expect(reducedTransitionMs.dialog).toBeLessThanOrEqual(0.01);
  expect(reducedTransitionMs.image).toBeLessThanOrEqual(0.01);
  await page.getByRole("list", { name: "Venue photos" }).getByRole("button").first().click();
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transition-old");
  await expect(page.locator("html")).not.toHaveAttribute("data-venue-transition-new");
  await dialog.getByRole("button", { name: "Next venue photo" }).click();
  await expect(dialog.locator("[data-venue-preview-image]")).toHaveAttribute(
    "src",
    "/2026/events/project-kickoff-venue-workspace.webp"
  );
  expect(await picture.evaluate((element) => element.getAnimations())).toHaveLength(0);
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
  await expect(page.getByRole("button", { name: "Copy link to Lightning talks" })).toHaveCount(1);

  await page.getByRole("link", { name: "Back to 2026 events", exact: true }).click();
  await page.locator(".event-grid-card").getByRole("link", { name: "Project Kickoff", exact: true }).click();
  await expect(page.locator(".event-document__copy-link")).not.toHaveCount(0);
  await page.getByRole("list", { name: "Venue photos" }).getByRole("button").first().click();
  await expect(page.getByRole("dialog", { name: "Venue photo preview" })).toBeVisible();
  await page.getByRole("button", { name: "Close venue photo preview" }).click();

  await page.getByRole("link", { name: "Shipaton Budapest home" }).click();
  await expect(page).toHaveURL(/\/2026\/$/);
  expect(
    await page.evaluate(() => (window as Window & { __shipatonDocumentMarker?: string }).__shipatonDocumentMarker)
  ).toBe("alive");
  await expect(page.locator('[data-event-card][aria-current="date"]')).toHaveAttribute("data-date", "2026-08-04");
  await expect(page.locator(".event-controls")).toBeVisible();
  await expect(page.locator("[data-event-counter]")).toHaveText("1 / 2");
});

test("keeps the event detail body aligned with a responsive table of contents", async ({ page }) => {
  await page.goto("/2026/events/project-kickoff/");

  const aboutHeading = page.getByRole("heading", { name: "About this event", exact: true });
  const title = page.getByRole("heading", { name: "Project Kickoff", exact: true });
  const scheduleHeading = page.getByRole("heading", { name: "Schedule", exact: true });
  const body = page.locator(".event-document__body");
  const toc = page.getByRole("navigation", { name: "On this page" });
  const intro = body.locator("> p").first();
  const documentBox = await page.locator(".event-document").boundingBox();
  const headerBox = await page.locator(".site-header").boundingBox();
  const brandBox = await page.locator(".site-header .brand").boundingBox();
  const footerBox = await page.locator(".site-footer__grid").boundingBox();
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

  expect(documentBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(brandBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(titleBox).not.toBeNull();
  expect(scheduleBox).not.toBeNull();
  expect(headingBox).not.toBeNull();
  expect(bodyBox).not.toBeNull();
  expect(tocBox).not.toBeNull();
  expect(Math.abs(documentBox!.x - headerBox!.x)).toBeLessThan(1);
  expect(Math.abs(documentBox!.width - headerBox!.width)).toBeLessThan(1);
  expect(Math.abs(titleBox!.x - brandBox!.x)).toBeLessThan(1);
  expect(Math.abs(titleBox!.x - footerBox!.x)).toBeLessThan(1);
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
  const repositoryLink = footer.getByRole("navigation", { name: "Explore" }).getByRole("link", {
    name: /GitHub repository/
  });
  await expect(repositoryLink).toHaveAttribute("href", "https://github.com/HLCaptain/shipaton-budapest");
  await expect(repositoryLink).toHaveAttribute("target", "_blank");
  await expect(repositoryLink).toHaveAttribute("rel", /\bnoopener\b/);
  await expect(repositoryLink).toHaveAttribute("rel", /\bnoreferrer\b/);
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
  await page.emulateMedia({ reducedMotion: "reduce" });
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

  await page.goto("/2026/events/project-kickoff/#lightning-talks");

  const heading = page.locator(".event-document__body").getByRole("heading", { name: "Lightning talks", exact: true });
  await expect(page).toHaveURL(/\/2026\/events\/project-kickoff\/#lightning-talks$/);
  await expect(heading).toHaveAttribute("id", "lightning-talks");
  const headingRow = heading.locator("..");
  const copy = headingRow.getByRole("button");
  await expect(copy).toHaveAccessibleName("Copy link to Lightning talks");
  await expect(heading).toBeInViewport();
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
  await expect(page.locator("[data-heading-copy-status]")).toHaveText("Copied link to Lightning talks.");
  await expect.poll(() => page.locator("html").getAttribute("data-copied-heading-link")).toMatch(/\/2026\/events\/project-kickoff\/#lightning-talks$/);
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
      backdrop: page.getByRole("link", { name: "See the next event" }).locator(".button--primary"),
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

  const primary = page.getByRole("link", { name: "See the next event" });
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
