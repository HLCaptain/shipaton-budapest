const initEventDocument = () => {
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
