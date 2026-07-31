(() => {
  if (window.__shipatonPageTransitionsBound) return;
  window.__shipatonPageTransitionsBound = true;

  document.addEventListener("load", ({ target }) => {
    if (
      matchMedia("(prefers-reduced-motion: reduce)").matches
      || !(target instanceof HTMLImageElement)
      || !new URL(target.currentSrc || target.src).pathname.endsWith(".svg")
    ) return;

    target.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 400,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      fill: "both"
    });
  }, true);

  const pathDepth = ({ pathname }) => pathname.split("/").filter(Boolean).length;
  const rememberBackTarget = (from, to, index = null) => {
    if (from.origin === to.origin && from.pathname !== to.pathname) {
      window.__shipatonBackTarget = { href: from.href, index: Number.isInteger(index) ? index : null };
    }
  };
  let transitionRootRule;

  if (document.referrer) {
    rememberBackTarget(new URL(document.referrer), new URL(window.location.href));
  }

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
    rememberBackTarget(from, to, history.state?.index);
    const fromDepth = pathDepth(from);
    const toDepth = pathDepth(to);
    let direction = "down";
    if (to.pathname === from.pathname) direction = "same";
    else if (toDepth < fromDepth || (toDepth === fromDepth && event.direction === "back")) direction = "up";
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
