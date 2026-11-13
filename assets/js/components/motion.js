// FINORA — PAGE MOTION
// Fallback fade-out untuk browser yang belum mendukung View Transitions,
// plus indikator progress untuk setiap perpindahan halaman.

let initialized = false;
let progressInitialized = false;
let progressElement = null;
let progressBar = null;
let progressFinishTimer = null;
let progressResetTimer = null;

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

function ensureProgressElement() {
  if (progressElement?.isConnected) {
    return progressElement;
  }

  progressElement = document.getElementById('route-progress');

  if (!progressElement) {
    progressElement = document.createElement('div');
    progressElement.id = 'route-progress';
    progressElement.className = 'route-progress';
    progressElement.setAttribute('aria-hidden', 'true');
    progressElement.innerHTML = '<span class="route-progress-bar"></span>';
    document.body.appendChild(progressElement);
  }

  progressBar = progressElement.querySelector('.route-progress-bar');
  return progressElement;
}

function isInternalNavigation(link) {
  if (
    !link ||
    link.hasAttribute('download') ||
    link.dataset.noTransition !== undefined ||
    (link.target && link.target !== '_self')
  ) {
    return false;
  }

  const url = new URL(link.href, window.location.href);

  return (
    url.origin === window.location.origin &&
    !(
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    )
  );
}

function handleNavigationProgress(event) {
  if (
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

  if (isInternalNavigation(link)) {
    startRouteProgress();
  }
}

export function initRouteProgress() {
  if (progressInitialized) {
    return;
  }

  progressInitialized = true;
  ensureProgressElement();
  document.addEventListener('click', handleNavigationProgress);

  globalThis.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      finishRouteProgress({ immediate: true });
    }
  });
}

export function startRouteProgress() {
  if (prefersReducedMotion()) {
    return;
  }

  const element = ensureProgressElement();

  globalThis.clearTimeout(progressFinishTimer);
  globalThis.clearTimeout(progressResetTimer);

  element.classList.remove('is-active', 'is-complete', 'is-leaving');
  element.classList.add('is-resetting');
  void progressBar.offsetWidth;
  element.classList.remove('is-resetting');
  element.classList.add('is-active');
}

export function finishRouteProgress({ immediate = false } = {}) {
  if (
    !progressElement ||
    prefersReducedMotion() ||
    !progressElement.classList.contains('is-active')
  ) {
    return;
  }

  globalThis.clearTimeout(progressFinishTimer);
  globalThis.clearTimeout(progressResetTimer);

  if (immediate) {
    progressElement.classList.remove('is-active', 'is-complete', 'is-leaving');
    return;
  }

  progressElement.classList.add('is-complete');

  progressFinishTimer = globalThis.setTimeout(() => {
    progressElement.classList.add('is-leaving');
    progressResetTimer = globalThis.setTimeout(() => {
      progressElement.classList.remove('is-active', 'is-complete', 'is-leaving');
    }, 220);
  }, 160);
}

export function initPageTransitions() {
  initRouteProgress();

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
