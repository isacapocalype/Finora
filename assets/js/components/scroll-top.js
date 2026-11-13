// FINORA — KEMBALI KE ATAS
// Tombol ringan yang muncul setelah pengguna menggulir cukup jauh.

import { icon, refreshIcons } from '../icons.js';

let initialized = false;
let button = null;
let ticking = false;

function prefersReducedMotion() {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false
  );
}

function updateVisibility() {
  ticking = false;

  if (button) {
    button.classList.toggle('is-visible', globalThis.scrollY > 600);
  }
}

function handleScroll() {
  if (ticking) {
    return;
  }

  ticking = true;
  globalThis.requestAnimationFrame(updateVisibility);
}

export function initScrollTop() {
  if (initialized) {
    return;
  }

  initialized = true;
  button = document.createElement('button');
  button.type = 'button';
  button.className = 'scroll-top';
  button.setAttribute('aria-label', 'Kembali ke atas');
  button.innerHTML = icon('arrow-up');
  button.addEventListener('click', () => {
    globalThis.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth'
    });
  });

  document.body.appendChild(button);
  globalThis.addEventListener('scroll', handleScroll, { passive: true });
  updateVisibility();
  refreshIcons();
}
