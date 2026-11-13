// FINORA — PAGE MOTION
// Fallback fade-out untuk browser yang belum mendukung View Transitions.

let initialized = false;

function prefersReducedMotion() {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
  );
}

function supportsViewTransitions() {
  return Boolean(
    globalThis.CSS?.supports?.('view-transition-name: none') ||
      typeof document.startViewTransition === 'function'
  );
}

export function initPageTransitions() {
  if (initialized || prefersReducedMotion() || supportsViewTransitions()) {
    return;
  }

  initialized = true;
  let navigating = false;

  document.addEventListener('click', (event) => {
    if (
      navigating ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const link = event.target.closest?.('a[href]');

    if (
      !link ||
      link.hasAttribute('download') ||
      link.dataset.noTransition !== undefined ||
      (link.target && link.target !== '_self')
    ) {
      return;
    }

    const url = new URL(link.href, window.location.href);

    if (
      url.origin !== window.location.origin ||
      (url.pathname === window.location.pathname &&
        url.search === window.location.search)
    ) {
      return;
    }

    event.preventDefault();
    navigating = true;
    document.documentElement.classList.add('page-exiting');

    globalThis.setTimeout(() => {
      window.location.href = url.href;
    }, 140);
  });

  globalThis.addEventListener('pageshow', () => {
    navigating = false;
    document.documentElement.classList.remove('page-exiting');
  });
}
