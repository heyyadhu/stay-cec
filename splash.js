/**
 * splash.js — Shows the StayCEC splash overlay ONLY on a hard refresh or
 * direct navigation to login / registration. When clicking through from
 * another page in the app the splash is skipped.
 *
 * How it works:
 *   - Pages that navigate AWAY set sessionStorage flag "staycec_nav_internal".
 *   - splash.js checks for that flag on load. If present → skip splash,
 *     clear flag. If absent → show splash (user refreshed or opened directly).
 */
(function () {
  const INTERNAL_FLAG = 'staycec_nav_internal';

  // If we arrived here via an in-app link, skip the splash
  if (sessionStorage.getItem(INTERNAL_FLAG)) {
    sessionStorage.removeItem(INTERNAL_FLAG);
    return; // no splash
  }

  // Inject CSS
  if (!document.getElementById('staycec-splash-css')) {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap';
    document.head.appendChild(font);

    const link = document.createElement('link');
    link.id = 'staycec-splash-css';
    link.rel = 'stylesheet';
    link.href = 'splash.css';
    document.head.appendChild(link);
  }

  // Build overlay
  const overlay = document.createElement('div');
  overlay.className = 'staycec-splash-overlay';
  overlay.innerHTML = `
    <div class="splash-logo"></div>
    <div class="splash-bar-track">
      <div class="splash-bar-fill"></div>
    </div>
    <span class="splash-text">loading staycec....</span>
  `;

  overlay.addEventListener('animationend', (e) => {
    if (e.animationName === 'splashFadeOut') overlay.remove();
  });

  if (document.body) {
    document.body.prepend(overlay);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.prepend(overlay);
    });
  }
})();

/**
 * Call this helper before navigating in-app so the destination page
 * knows it was an internal navigation and skips the splash.
 *   navigateTo('dashboard.html')
 */
function navigateTo(url) {
  sessionStorage.setItem('staycec_nav_internal', '1');
  window.location.href = url;
}
