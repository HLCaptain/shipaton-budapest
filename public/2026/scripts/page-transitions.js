(() => {
  if (window.__shipatonPageTransitionsBound) return;
  window.__shipatonPageTransitionsBound = true;

  const pathDepth = (url) => new URL(url, window.location.href).pathname.split("/").filter(Boolean).length;

  document.addEventListener("astro:before-preparation", (event) => {
    const from = new URL(event.from?.href ?? window.location.href);
    const to = new URL(event.to?.href ?? window.location.href);
    const fromDepth = pathDepth(from);
    const toDepth = pathDepth(to);
    const direction = to.pathname === from.pathname
      ? "same"
      : toDepth < fromDepth || (toDepth === fromDepth && event.direction === "back")
        ? "up"
        : "down";
    const targetScrollY = event.navigationType === "traverse" && Number.isFinite(history.state?.scrollY)
      ? history.state.scrollY
      : 0;

    document.documentElement.dataset.pageDirection = direction;
    document.documentElement.style.setProperty(
      "--page-old-scroll-offset-y",
      `${Math.round(targetScrollY - window.scrollY)}px`
    );
  });

  document.addEventListener("astro:before-swap", (event) => {
    const currentRoot = document.documentElement;
    const nextRoot = event.newDocument?.documentElement;
    if (!nextRoot) return;

    nextRoot.dataset.pageDirection = currentRoot.dataset.pageDirection ?? "down";
    nextRoot.style.setProperty(
      "--page-old-scroll-offset-y",
      currentRoot.style.getPropertyValue("--page-old-scroll-offset-y") || "0px"
    );
  });
})();
