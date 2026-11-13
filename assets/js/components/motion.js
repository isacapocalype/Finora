// FINORA — PAGE MOTION
// Fallback fade-out untuk browser yang belum mendukung View Transitions,
// plus overlay loading GIF di tengah layar untuk setiap perpindahan halaman.

const LOADER_GIF = new URL('../../images/loading.gif', import.meta.url).href;
const LOADER_STATIC = new URL(
  '../../images/loading-static.png',
  import.meta.url
).href;
const LOADER_TIMEOUT = 12000;

let initialized = false;
let loaderInitialized = false;
let loaderElement = null;
let loaderHideTimer = null;
let loaderSafetyTimer = null;

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

function ensureLoaderElement() {
  if (loaderElement?.isConnected) {
    return loaderElement;
  }

  loaderElement = document.getElementById('route-loader');

  if (!loaderElement) {
    loaderElement = document.createElement('div');
    loaderElement.id = 'route-loader';
    loaderElement.className = 'route-loader';
    loaderElement.setAttribute('aria-hidden', 'true');
    loaderElement.innerHTML = `
      <div class="route-loader-panel" role="status" aria-live="polite">
        <picture>
          <source media="(prefers-reduced-motion: reduce)" srcset="${LOADER_STATIC}">
          <img class="route-loader-media" src="${LOADER_GIF}" alt="" width="120" height="120" decoding="async">
        </picture>
        <p>Memuat halaman...</p>
      </div>
    `;
    document.body.appendChild(loaderElement);
  }

  return loaderElement;
}

function setLoaderActive(active) {
  const element = ensureLoaderElement();

  element.classList.toggle('is-active', active);
  element.setAttribute('aria-hidden', active ? 'false' : 'true');
  document.documentElement.classList.toggle('is-route-loading', active);
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
  if (loaderInitialized) {
    return;
  }

  loaderInitialized = true;
  ensureLoaderElement();
  document.addEventListener('click', handleNavigationProgress);

  globalThis.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      finishRouteProgress({ immediate: true });
    }
  });
}

export function startRouteProgress() {
  const element = ensureLoaderElement();

  globalThis.clearTimeout(loaderHideTimer);
  globalThis.clearTimeout(loaderSafetyTimer);

  element.classList.remove('is-leaving');
  setLoaderActive(true);

  // Jaring pengaman agar overlay tidak tertinggal bila inisialisasi macet.
  loaderSafetyTimer = globalThis.setTimeout(() => {
    if (element.classList.contains('is-active')) {
      finishRouteProgress({ immediate: true });
    }
  }, LOADER_TIMEOUT);
}

export function finishRouteProgress({ immediate = false } = {}) {
  if (!loaderElement || !loaderElement.classList.contains('is-active')) {
    return;
  }

  globalThis.clearTimeout(loaderSafetyTimer);
  globalThis.clearTimeout(loaderHideTimer);

  if (immediate || prefersReducedMotion()) {
    loaderElement.classList.remove('is-leaving');
    setLoaderActive(false);
    return;
  }

  loaderElement.classList.add('is-leaving');
  loaderHideTimer = globalThis.setTimeout(() => {
    loaderElement.classList.remove('is-leaving');
    setLoaderActive(false);
  }, 180);
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
