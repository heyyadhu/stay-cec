/**
 * splash.js — Shows the StayCEC splash overlay ONLY on a hard refresh or
 * direct navigation. When clicking through from another page in the app,
 * the splash is skipped.
 */
import './splash.css';

(function () {
  const SPLASH_SHOWN = 'staycec_splash_shown';
  
  // If we already saw the splash this session, skip it
  if (sessionStorage.getItem(SPLASH_SHOWN)) {
    return; // no splash
  }
  sessionStorage.setItem(SPLASH_SHOWN, '1');

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

  // Fallback cleanup: force remove after 4.5s no matter what
  const safeRemove = () => {
    if (overlay.parentNode) {
      overlay.remove();
    }
  };
  setTimeout(safeRemove, 4500);

  overlay.addEventListener('animationend', (e) => {
    if (e.animationName === 'splashFadeOut') {
      safeRemove();
    }
  });

  const startSplash = () => {
    document.body.prepend(overlay);
    // Start the fade out animation after enough time for the loading bar to fill
    overlay.style.animation = 'splashFadeOut 0.5s ease forwards 2.6s';
  };

  if (document.body) {
    startSplash();
  } else {
    document.addEventListener('DOMContentLoaded', startSplash);
  }
})();

/**
 * Helper to navigate in-app.
 */
window.navigateTo = function (url) {
  window.location.href = url;
};
