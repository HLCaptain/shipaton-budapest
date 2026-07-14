(() => {
  if (window.__shipatonPageTransitionsBound) return;
  window.__shipatonPageTransitionsBound = true;

  const pathDepth = (url) => new URL(url, window.location.href).pathname.split("/").filter(Boolean).length;
  let transitionRootRule;

  const setScrollOffset = (value) => {
    // CSP blocks element.style, so update the allowed same-origin stylesheet instead.
    if (!transitionRootRule) {
      for (const sheet of document.styleSheets) {
        try {
          transitionRootRule = Array.from(sheet.cssRules).find(
            (rule) => rule instanceof CSSStyleRule
              && rule.selectorText === ":root"
              && rule.style.getPropertyValue("--page-old-scroll-offset-y")
          );
        } catch {}
        if (transitionRootRule) break;
      }
    }
    transitionRootRule?.style.setProperty("--page-old-scroll-offset-y", value);
  };

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
    setScrollOffset(`${Math.round(targetScrollY - window.scrollY)}px`);
  });

  document.addEventListener("astro:before-swap", (event) => {
    const currentRoot = document.documentElement;
    const nextRoot = event.newDocument?.documentElement;
    if (!nextRoot) return;

    nextRoot.dataset.pageDirection = currentRoot.dataset.pageDirection ?? "down";
  });
})();
