const article = document.querySelector(".event-document__body");
const copyStatus = document.querySelector("[data-heading-copy-status]");

if (article && copyStatus) {
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
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M9.5 14.5 14.5 9M7.1 17.9l-1 1a3.54 3.54 0 0 1-5-5l4-4a3.54 3.54 0 0 1 5 0M16.9 6.1l1-1a3.54 3.54 0 1 1 5 5l-4 4a3.54 3.54 0 0 1-5 0" />
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

    row.append(button);
  }
}
