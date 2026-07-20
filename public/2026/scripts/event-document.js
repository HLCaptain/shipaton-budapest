const initVenueGallery = (eventDocument) => {
  const gallery = eventDocument.querySelector("[data-venue-gallery]");
  const dialog = eventDocument.querySelector("[data-venue-dialog]");
  if (!gallery || !dialog) return;

  const photos = gallery.querySelectorAll("[data-venue-photo]");
  const image = dialog.querySelector("[data-venue-preview-image]");
  const picture = dialog.querySelector("[data-venue-picture]");
  const viewport = dialog.querySelector("[data-venue-viewport]");
  const description = dialog.querySelector("[data-venue-description]");
  const hover = matchMedia("(hover: hover)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const root = document.documentElement;

  if (!photos.length || !image || !picture || !viewport || !description) return;
  photos.forEach((photo) => {
    photo.style.backgroundImage = `url("${photo.dataset.src}")`;
  });

  let currentIndex = 0;
  let opener;
  let pointer;
  let gesture;
  let previewRule;
  let slide;
  let suppressClick = false;
  let transition;
  let closeQueued = false;
  let zoomTimer;

  const setDescription = (text) => {
    if (description.textContent !== text) description.textContent = text;
  };

  const setPreviewRatio = (width, height) => {
    if (!previewRule) {
      for (const sheet of document.styleSheets) {
        try {
          previewRule = Array.from(sheet.cssRules).find(
            (rule) => rule instanceof CSSStyleRule && rule.selectorText === ".venue-preview"
          );
        } catch {}
        if (previewRule) break;
      }
    }
    previewRule?.style.setProperty("--venue-preview-ratio", String(width / height));
  };

  const resetGesture = () => {
    const pointerId = gesture?.id;
    gesture = null;
    suppressClick = false;
    if (pointerId !== undefined && viewport.hasPointerCapture(pointerId)) viewport.releasePointerCapture(pointerId);
    delete picture.dataset.dragging;
    picture.style.removeProperty("transform");
  };

  const clearSlide = () => {
    if (!slide) return;
    const active = slide;
    slide = null;
    active.animations.forEach((animation) => animation.cancel());
    active.incoming.remove();
    const photo = photos[currentIndex];
    setDescription(photo.dataset.description);
    setPreviewRatio(Number(photo.dataset.width), Number(photo.dataset.height));
  };

  const setZoom = (zoomed, point) => {
    if (zoomed) {
      window.clearTimeout(zoomTimer);
      const bounds = image.getBoundingClientRect();
      const x = point ? Math.min(Math.max(point.x - bounds.left, 0), bounds.width) : bounds.width / 2;
      const y = point ? Math.min(Math.max(point.y - bounds.top, 0), bounds.height) : bounds.height / 2;
      image.style.setProperty("--venue-zoom-x", `${x}px`);
      image.style.setProperty("--venue-zoom-y", `${y}px`);
      zoomTimer = window.setTimeout(() => {
        zoomTimer = null;
        if (!dialog.hasAttribute("data-zoomed")) return;
        image.style.setProperty("--venue-zoom-x", "0px");
        image.style.setProperty("--venue-zoom-y", "0px");
        requestAnimationFrame(() => {
          if (dialog.hasAttribute("data-zoomed")) viewport.scrollTo({ left: x, top: y });
        });
      }, reducedMotion.matches ? 0 : 280);
    } else if (dialog.hasAttribute("data-zoomed")) {
      window.clearTimeout(zoomTimer);
      image.style.setProperty("--venue-zoom-x", `${viewport.scrollLeft}px`);
      image.style.setProperty("--venue-zoom-y", `${viewport.scrollTop}px`);
      zoomTimer = window.setTimeout(() => {
        zoomTimer = null;
        if (dialog.hasAttribute("data-zoomed")) return;
        image.style.removeProperty("--venue-zoom-x");
        image.style.removeProperty("--venue-zoom-y");
      }, reducedMotion.matches ? 0 : 280);
    }

    dialog.toggleAttribute("data-zoomed", zoomed);
    picture.setAttribute("aria-pressed", String(zoomed));
    picture.setAttribute("aria-label", zoomed ? "Zoom out of venue photo" : "Zoom in on venue photo");
    if (!zoomed) viewport.scrollTo(0, 0);
  };

  const renderPhoto = (index) => {
    const photo = photos[index];
    const width = Number(photo.dataset.width);
    const height = Number(photo.dataset.height);
    currentIndex = index;
    image.src = photo.dataset.src;
    image.alt = photo.dataset.alt;
    image.width = width;
    image.height = height;
    setDescription(photo.dataset.description);
    setPreviewRatio(width, height);
    setZoom(false);
  };

  const selectPhoto = (index, direction, startOffset = 0) => {
    if (index === currentIndex || slide) return;
    setZoom(false);
    if (reducedMotion.matches) return renderPhoto(index);

    const photo = photos[index];
    const before = dialog.getBoundingClientRect();
    setPreviewRatio(Number(photo.dataset.width), Number(photo.dataset.height));
    const after = dialog.getBoundingClientRect();
    const distance = Math.max(before.width, after.width);
    const offset = Math.max(-distance, Math.min(distance, startOffset));
    const incoming = image.cloneNode();
    incoming.removeAttribute("data-venue-preview-image");
    incoming.removeAttribute("data-venue-transition");
    incoming.classList.add("venue-preview__slide");
    incoming.src = photo.dataset.src;
    incoming.alt = "";
    incoming.width = Number(photo.dataset.width);
    incoming.height = Number(photo.dataset.height);
    incoming.setAttribute("aria-hidden", "true");
    viewport.append(incoming);

    const timing = { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" };
    const animations = [
      picture.animate([
        { transform: `translateX(${offset}px)` },
        { transform: `translateX(${-direction * distance}px)` }
      ], timing),
      incoming.animate([
        { transform: `translateX(${offset + direction * distance}px)` },
        { transform: "translateX(0)" }
      ], timing),
      dialog.animate([
        { width: `${before.width}px`, height: `${before.height}px` },
        { width: `${after.width}px`, height: `${after.height}px` }
      ], timing)
    ];
    const active = { animations, incoming };
    slide = active;
    const fadeOut = description.animate([
      { opacity: 1 },
      { opacity: 0 }
    ], { ...timing, duration: timing.duration / 2 });
    active.animations.push(fadeOut);
    const captionFinished = fadeOut.finished.then(() => {
      if (slide !== active) return;
      setDescription(photo.dataset.description);
      fadeOut.cancel();
      const fadeIn = description.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], { ...timing, duration: timing.duration / 2 });
      active.animations.push(fadeIn);
      return fadeIn.finished;
    });
    Promise.all([...animations.map((animation) => animation.finished), captionFinished]).then(() => {
      if (slide !== active) return;
      renderPhoto(index);
      clearSlide();
    }, () => {
      if (slide === active) clearSlide();
    });
  };

  const move = (direction, startOffset = 0) => selectPhoto(
    (currentIndex + direction + photos.length) % photos.length,
    direction,
    startOffset
  );

  const runSharedTransition = (from, to, update, direction) => {
    root.dataset.venueTransitioning = direction;
    from.dataset.venueTransition = "";
    const fromBox = from.getBoundingClientRect();
    let toBox;
    const active = document.startViewTransition(() => {
      delete from.dataset.venueTransition;
      update();
      to.dataset.venueTransition = "";
      toBox = to.getBoundingClientRect();
    });
    if (direction === "close") active.ready.then(() => {
      const animation = document.getAnimations().find((candidate) =>
        candidate.effect?.pseudoElement === "::view-transition-group(venue-photo)"
      );
      const keyframes = animation?.effect?.getKeyframes().map(({ computedOffset, ...keyframe }) => keyframe);
      const first = keyframes?.[0];
      const last = keyframes?.at(-1);
      if (!keyframes?.length || !first?.transform || !last?.transform || !toBox) return;
      const firstMatrix = new DOMMatrix(first.transform);
      const lastMatrix = new DOMMatrix(last.transform);
      keyframes[0] = {
        ...first,
        transform: `matrix(${firstMatrix.a}, ${firstMatrix.b}, ${firstMatrix.c}, ${firstMatrix.d}, ${fromBox.x}, ${fromBox.y})`
      };
      keyframes[keyframes.length - 1] = {
        ...last,
        transform: `matrix(${lastMatrix.a}, ${lastMatrix.b}, ${lastMatrix.c}, ${lastMatrix.d}, ${toBox.x}, ${toBox.y})`
      };
      animation.effect.setKeyframes(keyframes);
    }).catch(() => {});
    transition = active;
    const cleanup = () => {
      if (transition !== active) return;
      delete from.dataset.venueTransition;
      delete to.dataset.venueTransition;
      delete root.dataset.venueTransitioning;
      transition = null;
      requestAnimationFrame(() => to.closest("[data-venue-hover-target]")?.removeAttribute("data-venue-hover-target"));
    };
    active.finished.then(cleanup, cleanup);
  };

  const closePreview = () => {
    if (!dialog.open) return;
    if (transition) {
      if (closeQueued) return;
      closeQueued = true;
      const retry = () => {
        closeQueued = false;
        closePreview();
      };
      transition.skipTransition();
      transition.finished.then(retry, retry);
      return;
    }
    clearSlide();
    const photo = photos[currentIndex];
    const thumbnail = photo.querySelector("img");
    opener = photo;
    if (reducedMotion.matches || !document.startViewTransition || !thumbnail) {
      dialog.close();
      return;
    }

    if (dialog.hasAttribute("data-zoomed")) {
      image.style.setProperty("transition", "none");
      setZoom(false);
      image.getBoundingClientRect();
      image.style.removeProperty("transition");
    }

    photo.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    const bounds = photo.getBoundingClientRect();
    photo.toggleAttribute("data-venue-hover-target", Boolean(
      hover.matches && pointer &&
      pointer.x >= bounds.left && pointer.x < bounds.right &&
      pointer.y >= bounds.top && pointer.y < bounds.bottom
    ));
    runSharedTransition(image, thumbnail, () => dialog.close(), "close");
  };

  photos.forEach((photo, index) => photo.addEventListener("click", (event) => {
    if (transition) return;
    if (hover.matches && event.detail > 0) pointer = { x: event.clientX, y: event.clientY };
    resetGesture();
    opener = photo;
    renderPhoto(index);
    const thumbnail = photo.querySelector("img");
    if (reducedMotion.matches || !document.startViewTransition || !thumbnail) {
      dialog.showModal();
      return;
    }

    runSharedTransition(thumbnail, image, () => dialog.showModal(), "open");
  }));

  dialog.querySelector("[data-venue-close]").addEventListener("click", closePreview);
  dialog.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") pointer = { x: event.clientX, y: event.clientY };
  });
  dialog.querySelector("[data-venue-previous]").addEventListener("click", () => move(-1));
  dialog.querySelector("[data-venue-next]").addEventListener("click", () => move(1));
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePreview();
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closePreview();
  });

  viewport.addEventListener("click", (event) => {
    if (suppressClick || slide) {
      suppressClick = false;
      event.preventDefault();
      return;
    }

    const point = event.detail === 0 ? null : { x: event.clientX, y: event.clientY };
    setZoom(!dialog.hasAttribute("data-zoomed"), point);
  });

  viewport.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || slide) return;
    picture.getAnimations().forEach((animation) => animation.cancel());
    suppressClick = false;
    const zoomed = dialog.hasAttribute("data-zoomed");
    gesture = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
      offset: 0,
      axis: null,
      dragged: false,
      zoomed
    };
    if (zoomed) viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    gesture.dragged ||= Math.hypot(deltaX, deltaY) > 8;

    if (gesture.zoomed) {
      if (!gesture.dragged) return;
      event.preventDefault();
      picture.dataset.dragging = "true";
      viewport.scrollLeft = gesture.startScrollLeft - deltaX;
      viewport.scrollTop = gesture.startScrollTop - deltaY;
      return;
    }

    if (!gesture.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
      gesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      if (gesture.axis === "x") viewport.setPointerCapture(event.pointerId);
    }
    if (gesture.axis !== "x") return;

    event.preventDefault();
    gesture.offset = deltaX;
    picture.dataset.dragging = "true";
    picture.style.transform = `translateX(${gesture.offset}px)`;
  });

  const finishGesture = (event, cancelled = false) => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const { axis, dragged, offset, zoomed } = gesture;
    resetGesture();
    suppressClick = dragged;

    if (zoomed || !dragged || axis !== "x") return;
    const threshold = Math.min(72, Math.max(48, viewport.clientWidth * 0.12));
    if (!cancelled && Math.abs(offset) >= threshold) {
      move(offset < 0 ? 1 : -1, offset);
    } else if (!reducedMotion.matches) {
      picture.animate([
        { transform: `translateX(${offset}px)` },
        { transform: "translateX(0)" }
      ], { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
    }
  };

  viewport.addEventListener("pointerup", (event) => finishGesture(event));
  viewport.addEventListener("pointercancel", (event) => finishGesture(event, true));

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    move(event.key === "ArrowLeft" ? -1 : 1);
  });

  dialog.addEventListener("close", () => {
    clearSlide();
    picture.getAnimations().forEach((animation) => animation.cancel());
    delete image.dataset.venueTransition;
    resetGesture();
    setZoom(false);
    opener?.focus({ preventScroll: true });
  });
};

const initEventDocument = () => {
  const eventDocument = document.querySelector(".event-document");
  if (!eventDocument || eventDocument.dataset.eventDocumentBound) return;
  eventDocument.dataset.eventDocumentBound = "true";

  const backLink = eventDocument.querySelector("[data-history-back]");
  if (backLink) {
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

  initVenueGallery(eventDocument);

  const article = eventDocument.querySelector(".event-document__body");
  const copyStatus = eventDocument.querySelector("[data-heading-copy-status]");

  if (!article || !copyStatus) return;

  for (const heading of article.querySelectorAll(":is(h2, h3, h4)[id]")) {
    const label = heading.textContent?.trim() || "section";
    const row = document.createElement("div");
    const button = document.createElement("button");

    row.className = "event-document__heading-row";
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

    heading.replaceWith(row);
    row.append(button, heading);
  }
};

if (!window.__shipatonEventDocumentBound) {
  window.__shipatonEventDocumentBound = true;
  document.addEventListener("astro:page-load", initEventDocument);
}

initEventDocument();
