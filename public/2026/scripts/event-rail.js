const initEventRail = () => {
  const browser = document.querySelector("[data-event-browser]");
  if (!browser || browser.dataset.eventRailBound) return;

  const track = browser.querySelector("[data-event-track]");
  const teaser = browser.querySelector("[data-event-teaser]");
  const teaserDeadline = Date.parse(teaser?.dataset.visibleBefore ?? "");
  if (teaser) {
    if (Number.isFinite(teaserDeadline) && Date.now() < teaserDeadline) teaser.hidden = false;
    else teaser.remove();
  }

  const cards = [...browser.querySelectorAll("[data-event-rail-card]")];
  const controls = browser.querySelector("[data-event-controls]");
  const counter = browser.querySelector("[data-event-counter]");
  const buttons = browser.querySelectorAll("[data-event-direction]");

  if (!track || !cards.length) return;
  browser.dataset.eventRailBound = "true";
  if (controls) controls.hidden = cards.length <= 1;
  if (cards.length > 1) cards.forEach((card) => card.setAttribute("tabindex", "0"));

  const controller = new AbortController();
  const { signal } = controller;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = -1;
  let centerTarget = null;
  let initialFrame = 0;
  let scrollFrame = 0;

  const cleanup = () => {
    cancelAnimationFrame(initialFrame);
    cancelAnimationFrame(scrollFrame);
    controller.abort();
  };

  document.addEventListener("astro:before-swap", cleanup, { once: true, signal });

  const restoreSnapping = () => track.style.removeProperty("scroll-snap-type");

  cards.forEach((card) => {
    const date = card.dataset.date;
    if (!date) return;
    const state = date < today ? "Past" : date === today ? "Today" : "Upcoming";
    card.dataset.state = state.toLowerCase();
    const stateLabel = card.querySelector("[data-event-state]");
    if (stateLabel) stateLabel.textContent = state;
  });

  const centerCard = (card, smooth) => {
    const scrollMargin = parseFloat(getComputedStyle(card).scrollMarginInlineStart) || 0;
    const left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2 - scrollMargin / 2;
    centerTarget = smooth && !reducedMotion
      ? Math.max(0, Math.min(left, track.scrollWidth - track.clientWidth))
      : null;
    track.scrollTo({ left, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  };

  const closestCardIndex = () => {
    const railCenter = track.getBoundingClientRect().left + track.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - railCenter);
      if (distance >= closestDistance) return;
      closestIndex = index;
      closestDistance = distance;
    });
    return closestIndex;
  };

  const selectCard = (index, scroll = false) => {
    const nextIndex = Math.max(0, Math.min(cards.length - 1, index));
    if (activeIndex === nextIndex) {
      if (scroll) centerCard(cards[nextIndex], true);
      return;
    }
    activeIndex = nextIndex;
    cards.forEach((card, cardIndex) => {
      const selected = cardIndex === activeIndex;
      card.toggleAttribute("data-selected", selected);
      if (selected) card.setAttribute("aria-current", card.dataset.date ? "date" : "true");
      else card.removeAttribute("aria-current");
    });
    if (counter) counter.value = `${activeIndex + 1} / ${cards.length}`;
    buttons.forEach((button) => {
      const direction = Number(button.dataset.eventDirection);
      button.disabled = direction < 0 ? activeIndex === 0 : activeIndex === cards.length - 1;
    });
    if (scroll) centerCard(cards[activeIndex], true);
  };

  const settleSelection = () => {
    selectCard(closestCardIndex(), true);
    if (centerTarget === null) restoreSnapping();
  };

  const firstUpcoming = cards.findIndex((card) => Boolean(card.dataset.date) && card.dataset.date >= today);
  const featuredIndex = firstUpcoming >= 0 ? firstUpcoming : cards.length - 1;
  const featuredCard = cards[featuredIndex];
  const featuredLink = document.querySelector("[data-featured-event]");
  selectCard(featuredIndex);

  if (featuredLink && featuredCard.dataset.eventUrl) {
    featuredLink.href = featuredCard.dataset.eventUrl;
    featuredLink.setAttribute("aria-label", `View ${featuredCard.dataset.title} event details`);
    const title = featuredLink.querySelector("[data-featured-title]");
    const location = featuredLink.querySelector("[data-featured-location]");
    if (title) title.textContent = featuredCard.dataset.title ?? "Upcoming event";
    if (location) location.textContent = featuredCard.dataset.venue ?? "Budapest";
  }

  initialFrame = requestAnimationFrame(() => centerCard(cards[activeIndex], false));

  buttons.forEach((button) => {
    button.addEventListener(
      "click",
      () => selectCard(activeIndex + Number(button.dataset.eventDirection), true),
      { signal }
    );
  });

  cards.forEach((card, index) => {
    card.addEventListener(
      "focusin",
      (event) => {
        if (event.target.matches(":focus-visible")) selectCard(index, true);
      },
      { signal }
    );
    card.addEventListener(
      "click",
      (event) => {
        if (event.target.closest("a")) restoreSnapping();
        else selectCard(index, true);
      },
      { signal }
    );
  });

  const pauseCentering = () => {
    track.style.scrollSnapType = "none";
    if (centerTarget === null) return;
    const left = track.scrollLeft;
    centerTarget = null;
    track.scrollTo({ left, behavior: "auto" });
  };
  const cancelCentering = () => { centerTarget = null; };
  track.addEventListener("pointerdown", pauseCentering, { capture: true, passive: true, signal });
  window.addEventListener("pointerup", settleSelection, { passive: true, signal });
  window.addEventListener("pointercancel", restoreSnapping, { passive: true, signal });
  track.addEventListener("wheel", cancelCentering, { passive: true, signal });
  track.addEventListener("keydown", cancelCentering, { signal });

  track.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        if (centerTarget !== null) {
          if (Math.abs(track.scrollLeft - centerTarget) < 1) {
            centerTarget = null;
            restoreSnapping();
          }
          return;
        }
        selectCard(closestCardIndex());
      });
    },
    { passive: true, signal }
  );
};

if (!window.__shipatonEventRailBound) {
  window.__shipatonEventRailBound = true;
  document.addEventListener("astro:page-load", initEventRail);
}

initEventRail();
