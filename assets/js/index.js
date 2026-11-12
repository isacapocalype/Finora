// FINORA — ENTRY POINT
// Aplikasi tidak memakai login; langsung buka dashboard.

window.location.replace(
  new URL('pages/dashboard.html', window.location.href).href
);
