const browser = document.querySelector("[data-event-browser]");
const track = browser?.querySelector("[data-event-track]");
const cards = Array.from(browser?.querySelectorAll("[data-event-card]") ?? []);
const counter = browser?.querySelector("[data-event-counter]");
const buttons = Array.from(browser?.querySelectorAll("[data-event-direction]") ?? []);

if (browser && track && cards.length && counter) {
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
  let scrollFrame = 0;

  cards.forEach((card) => {
    const date = card.dataset.date ?? "";
    const state = date < today ? "Past" : date === today ? "Today" : "Upcoming";
    card.dataset.state = state.toLowerCase();
    const stateLabel = card.querySelector("[data-event-state]");
    if (stateLabel) stateLabel.textContent = state;
  });

  const centerCard = (card, smooth) => {
    const left = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
    centerTarget = smooth && !reducedMotion
      ? Math.max(0, Math.min(left, track.scrollWidth - track.clientWidth))
      : null;
    track.scrollTo({ left, behavior: smooth && !reducedMotion ? "smooth" : "auto" });
  };

  const selectCard = (index, scroll = false) => {
    const nextIndex = Math.max(0, Math.min(cards.length - 1, index));
    if (activeIndex === nextIndex) return;
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
  selectCard(firstUpcoming >= 0 ? firstUpcoming : cards.length - 1);
  requestAnimationFrame(() => centerCard(cards[activeIndex], false));

  buttons.forEach((button) => {
    button.addEventListener("click", () => selectCard(activeIndex + Number(button.dataset.eventDirection), true));
  });

  cards.forEach((card, index) => {
    card.addEventListener("focusin", () => selectCard(index, true));
    card.addEventListener("click", (event) => {
      if (!event.target.closest("a")) selectCard(index, true);
    });
  });

  const cancelCentering = () => { centerTarget = null; };
  track.addEventListener("pointerdown", cancelCentering, { passive: true });
  track.addEventListener("wheel", cancelCentering, { passive: true });
  track.addEventListener("keydown", cancelCentering);

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
    { passive: true }
  );
}
