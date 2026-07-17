const initVenueGallery = () => {
  const gallery = document.querySelector("[data-venue-gallery]");
  const dialog = document.querySelector("[data-venue-dialog]");
  if (!gallery || !dialog || gallery.dataset.venueGalleryBound) return;

  const photos = [...gallery.querySelectorAll("[data-venue-photo]")];
  const image = dialog.querySelector("[data-venue-preview-image]");
  const picture = dialog.querySelector("[data-venue-picture]");
  const viewport = dialog.querySelector("[data-venue-viewport]");
  const description = dialog.querySelector("[data-venue-description]");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  if (!photos.length || !image || !picture || !viewport || !description) return;
  gallery.dataset.venueGalleryBound = "true";

  let currentIndex = 0;
  let opener;
  let gesture;
  let suppressClick = false;
  let zoomTimer;

  const resetGesture = () => {
    const pointerId = gesture?.id;
    gesture = null;
    suppressClick = false;
    if (pointerId !== undefined && picture.hasPointerCapture(pointerId)) picture.releasePointerCapture(pointerId);
    delete picture.dataset.dragging;
    picture.style.removeProperty("transform");
  };

  const setZoom = (zoomed, point) => {
    window.clearTimeout(zoomTimer);
    if (zoomed) {
      const bounds = image.getBoundingClientRect();
      const x = point ? Math.min(Math.max(point.x - bounds.left, 0), bounds.width) : bounds.width / 2;
      const y = point ? Math.min(Math.max(point.y - bounds.top, 0), bounds.height) : bounds.height / 2;
      image.style.setProperty("--venue-zoom-x", `${x}px`);
      image.style.setProperty("--venue-zoom-y", `${y}px`);
      zoomTimer = window.setTimeout(() => {
        if (!dialog.hasAttribute("data-zoomed")) return;
        image.style.setProperty("--venue-zoom-x", "0px");
        image.style.setProperty("--venue-zoom-y", "0px");
        viewport.scrollBy({ left: x, top: y });
      }, reducedMotion.matches ? 0 : 280);
    }

    dialog.toggleAttribute("data-zoomed", zoomed);
    picture.setAttribute("aria-pressed", String(zoomed));
    picture.setAttribute("aria-label", zoomed ? "Zoom out of venue photo" : "Zoom in on venue photo");
    if (!zoomed) viewport.scrollTo(0, 0);
  };

  const renderPhoto = (index) => {
    const photo = photos[index];
    currentIndex = index;
    image.src = photo.dataset.src;
    image.alt = photo.dataset.alt;
    image.width = Number(photo.dataset.width);
    image.height = Number(photo.dataset.height);
    description.textContent = photo.dataset.description;
    setZoom(false);
  };

  const selectPhoto = (index, direction, startOffset = 0) => {
    if (index === currentIndex) return;
    const apply = () => renderPhoto(index);
    if (reducedMotion.matches) return apply();

    picture.getAnimations().forEach((animation) => animation.cancel());
    const outgoing = picture.animate([
      { opacity: 1, transform: `translateX(${startOffset}px)` },
      { opacity: 0, transform: `translateX(${startOffset - direction * 14}px)` }
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

  const move = (direction, startOffset = 0) => selectPhoto(
    (currentIndex + direction + photos.length) % photos.length,
    direction,
    startOffset
  );

  photos.forEach((photo, index) => photo.addEventListener("click", () => {
    resetGesture();
    opener = photo;
    renderPhoto(index);
    dialog.showModal();
  }));

  dialog.querySelector("[data-venue-close]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-venue-previous]").addEventListener("click", () => move(-1));
  dialog.querySelector("[data-venue-next]").addEventListener("click", () => move(1));

  picture.addEventListener("click", (event) => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }

    const point = event.detail === 0 ? null : { x: event.clientX, y: event.clientY };
    setZoom(!dialog.hasAttribute("data-zoomed"), point);
  });

  picture.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    picture.getAnimations().forEach((animation) => animation.cancel());
    suppressClick = false;
    gesture = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offset: 0,
      axis: null,
      dragged: false,
      zoomed: dialog.hasAttribute("data-zoomed")
    };
  });

  picture.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    gesture.dragged ||= Math.hypot(deltaX, deltaY) > 8;

    if (gesture.zoomed) {
      return;
    }

    if (!gesture.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (gesture.axis === "x") picture.setPointerCapture(event.pointerId);
    }
    if (gesture.axis !== "x") return;

    event.preventDefault();
    gesture.offset = deltaX * 0.72;
    picture.dataset.dragging = "true";
    picture.style.transform = `translateX(${gesture.offset}px)`;
  });

  const finishGesture = (event, cancelled = false) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { axis, dragged, offset, zoomed } = gesture;
    gesture = null;
    delete picture.dataset.dragging;
    picture.style.removeProperty("transform");
    suppressClick = !cancelled && dragged;

    if (cancelled || zoomed || !dragged || axis !== "x") return;
    const threshold = Math.min(72, Math.max(48, viewport.clientWidth * 0.12));
    if (Math.abs(offset / 0.72) >= threshold) {
      move(offset < 0 ? 1 : -1, offset);
    } else if (!reducedMotion.matches) {
      picture.animate([
        { transform: `translateX(${offset}px)` },
        { transform: "translateX(0)" }
      ], { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    }
  };

  picture.addEventListener("pointerup", (event) => finishGesture(event));
  picture.addEventListener("pointercancel", (event) => finishGesture(event, true));
  picture.addEventListener("lostpointercapture", (event) => finishGesture(event, true));

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });

  dialog.addEventListener("close", () => {
    picture.getAnimations().forEach((animation) => animation.cancel());
    resetGesture();
    setZoom(false);
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
