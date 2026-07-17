const initVenueGallery = () => {
  const gallery = document.querySelector("[data-venue-gallery]");
  const dialog = document.querySelector("[data-venue-dialog]");
  if (!gallery || !dialog || gallery.dataset.venueGalleryBound) return;

  const photos = [...gallery.querySelectorAll("[data-venue-photo]")];
  const image = dialog.querySelector("[data-venue-preview-image]");
  const picture = dialog.querySelector("[data-venue-picture]");
  const viewport = dialog.querySelector("[data-venue-viewport]");
  const caption = dialog.querySelector("[data-venue-caption]");
  const counter = dialog.querySelector("[data-venue-counter]");
  const description = dialog.querySelector("[data-venue-description]");
  const zoom = dialog.querySelector("[data-venue-zoom]");
  const details = dialog.querySelector("[data-venue-details]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  if (!photos.length || !image || !picture || !viewport || !caption || !counter || !description || !zoom || !details) return;
  gallery.dataset.venueGalleryBound = "true";

  let currentIndex = 0;
  let opener;

  const setZoom = (zoomed) => {
    dialog.toggleAttribute("data-zoomed", zoomed);
    zoom.setAttribute("aria-pressed", String(zoomed));
    zoom.textContent = zoomed ? "Zoom out" : "Zoom in";
    if (!zoomed) viewport.scrollTo(0, 0);
  };

  const setDetails = (visible) => {
    caption.hidden = !visible;
    details.setAttribute("aria-expanded", String(visible));
    details.textContent = visible ? "Hide details" : "Show details";
  };

  const renderPhoto = (index) => {
    const photo = photos[index];
    currentIndex = index;
    image.src = photo.dataset.src;
    image.alt = photo.dataset.alt;
    image.width = Number(photo.dataset.width);
    image.height = Number(photo.dataset.height);
    description.textContent = photo.dataset.description;
    counter.textContent = `${index + 1} / ${photos.length}`;
    setZoom(false);
  };

  const selectPhoto = (index, direction) => {
    if (index === currentIndex) return;
    const apply = () => renderPhoto(index);
    if (reducedMotion.matches) return apply();

    picture.getAnimations().forEach((animation) => animation.cancel());
    const outgoing = picture.animate([
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: `translateX(${direction * -14}px)` }
    ], { duration: 140, easing: "ease-in", fill: "forwards" });

    outgoing.onfinish = () => {
      outgoing.cancel();
      apply();
      picture.animate([
        { opacity: 0, transform: `translateX(${direction * 14}px)` },
        { opacity: 1, transform: "translateX(0)" }
      ], { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    };
  };

  const move = (direction) => selectPhoto((currentIndex + direction + photos.length) % photos.length, direction);

  photos.forEach((photo, index) => photo.addEventListener("click", () => {
    opener = photo;
    renderPhoto(index);
    setDetails(true);
    dialog.showModal();
  }));

  dialog.querySelector("[data-venue-close]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-venue-previous]").addEventListener("click", () => move(-1));
  dialog.querySelector("[data-venue-next]").addEventListener("click", () => move(1));
  zoom.addEventListener("click", () => setZoom(!dialog.hasAttribute("data-zoomed")));
  image.addEventListener("click", () => setZoom(!dialog.hasAttribute("data-zoomed")));
  details.addEventListener("click", () => setDetails(caption.hidden));

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });

  dialog.addEventListener("close", () => {
    picture.getAnimations().forEach((animation) => animation.cancel());
    setZoom(false);
    setDetails(true);
    opener?.focus();
  });
};

const initEventDocument = () => {
  const backLink = document.querySelector("[data-history-back]");
  if (backLink && !backLink.dataset.historyBackBound) {
    backLink.dataset.historyBackBound = "true";
    backLink.addEventListener("click", (event) => {
      const current = new URL(window.location.href);
      const target = window.__shipatonBackTarget;
      const targetUrl = target?.href ? new URL(target.href, current) : null;

      if (!targetUrl || targetUrl.origin !== current.origin || targetUrl.pathname === current.pathname) return;

      event.preventDefault();
      const currentIndex = history.state?.index;
      if (Number.isInteger(target.index) && Number.isInteger(currentIndex) && target.index < currentIndex) {
        history.go(target.index - currentIndex);
      } else {
        window.location.assign(targetUrl.href);
      }
    });
  }

  initVenueGallery();

  const article = document.querySelector(".event-document__body");
  const copyStatus = document.querySelector("[data-heading-copy-status]");

  if (!article || !copyStatus || article.dataset.headingLinksBound) return;
  article.dataset.headingLinksBound = "true";

  for (const heading of article.querySelectorAll(":is(h2, h3, h4)[id]")) {
    const label = heading.textContent?.trim() || "section";
    const row = document.createElement("div");
    const button = document.createElement("button");

    row.className = "event-document__heading-row";
    heading.before(row);
    row.append(heading);

    button.className = "event-document__copy-link";
    button.type = "button";
    button.title = `Copy link to ${label}`;
    button.setAttribute("aria-label", `Copy link to ${label}`);
    button.innerHTML = `
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M7.775 3.275a.75.75 0 0 0 1.06 1.06l1.25-1.25a2 2 0 1 1 2.83 2.83l-2.5 2.5a2 2 0 0 1-2.83 0 .75.75 0 0 0-1.06 1.06 3.5 3.5 0 0 0 4.95 0l2.5-2.5a3.5 3.5 0 0 0-4.95-4.95l-1.25 1.25Zm-4.69 9.64a2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .75.75 0 0 0 1.06-1.06 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 4.95 4.95l1.25-1.25a.75.75 0 0 0-1.06-1.06l-1.25 1.25a2 2 0 0 1-2.83 0Z" />
      </svg>
    `;

    button.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.hash = heading.id;

      try {
        await navigator.clipboard.writeText(url.href);
        button.dataset.state = "copied";
        button.setAttribute("aria-label", `Copied link to ${label}`);
        copyStatus.textContent = `Copied link to ${label}.`;

        window.setTimeout(() => {
          delete button.dataset.state;
          button.setAttribute("aria-label", `Copy link to ${label}`);
        }, 1800);
      } catch {
        button.dataset.state = "error";
        copyStatus.textContent = `Could not copy the link to ${label}.`;
      }
    });

    row.prepend(button);
  }
};

if (!window.__shipatonEventDocumentBound) {
  window.__shipatonEventDocumentBound = true;
  document.addEventListener("astro:page-load", initEventDocument);
}

initEventDocument();
