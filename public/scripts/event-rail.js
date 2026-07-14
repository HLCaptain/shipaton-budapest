const initEventRail = () => {
  const browser = document.querySelector("[data-event-browser]");
  const track = browser?.querySelector("[data-event-track]");
  const cards = Array.from(browser?.querySelectorAll("[data-event-card]") ?? []);
  const counter = browser?.querySelector("[data-event-counter]");
  const buttons = Array.from(browser?.querySelectorAll("[data-event-direction]") ?? []);

  if (!browser || !track || !cards.length || !counter || browser.dataset.eventRailBound) return;
  browser.dataset.eventRailBound = "true";

  const controller = new AbortController();
  const { signal } = controller;
  const todayParts = new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Budapest"
  }).formatToParts(new Date());
  const part = (type) => todayParts.find((item) => item.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let activeIndex = -1;
  let centerTarget = null;
  let initialFrame = 0;
  let scrollFrame = 0;
  let snapTimer = 0;

  const cleanup = () => {
    cancelAnimationFrame(initialFrame);
    cancelAnimationFrame(scrollFrame);
    window.clearTimeout(snapTimer);
    controller.abort();
  };

  document.addEventListener("astro:before-swap", cleanup, { once: true, signal });

  const restoreSnapping = () => track.style.removeProperty("scroll-snap-type");

  cards.forEach((card) => {
    const date = card.dataset.date ?? "";
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
      if (selected) card.setAttribute("aria-current", "date");
      else card.removeAttribute("aria-current");
    });
    counter.value = `${activeIndex + 1} / ${cards.length}`;
    buttons.forEach((button) => {
      const direction = Number(button.dataset.eventDirection);
      button.disabled = direction < 0 ? activeIndex === 0 : activeIndex === cards.length - 1;
    });
    if (scroll) centerCard(cards[activeIndex], true);
  };

  const firstUpcoming = cards.findIndex((card) => (card.dataset.date ?? "") >= today);
  const featuredIndex = firstUpcoming >= 0 ? firstUpcoming : cards.length - 1;
  const featuredCard = cards[featuredIndex];
  const featuredLink = document.querySelector("[data-featured-event]");
  selectCard(featuredIndex);

  if (featuredLink && featuredCard.dataset.eventId) {
    featuredLink.href = `/events/${featuredCard.dataset.eventId}/`;
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
  window.addEventListener(
    "pointerup",
    () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(restoreSnapping);
    },
    { passive: true, signal }
  );
  window.addEventListener("pointercancel", restoreSnapping, { passive: true, signal });
  track.addEventListener("wheel", cancelCentering, { passive: true, signal });
  track.addEventListener("keydown", cancelCentering, { signal });

  track.addEventListener(
    "scroll",
    () => {
      cancelAnimationFrame(scrollFrame);
      scrollFrame = requestAnimationFrame(() => {
        if (centerTarget !== null) {
          if (Math.abs(track.scrollLeft - centerTarget) < 1) centerTarget = null;
          return;
        }
        const railCenter = track.getBoundingClientRect().left + track.clientWidth / 2;
        const closestIndex = cards.reduce((closest, card, index) => {
          const rect = card.getBoundingClientRect();
          const distance = Math.abs(rect.left + rect.width / 2 - railCenter);
          const closestRect = cards[closest].getBoundingClientRect();
          const closestDistance = Math.abs(closestRect.left + closestRect.width / 2 - railCenter);
          return distance < closestDistance ? index : closest;
        }, 0);
        selectCard(closestIndex);
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
