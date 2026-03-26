/**
 * splash.js — Shows the StayCEC splash overlay ONLY on a hard refresh or
 * direct navigation. When clicking through from another page in the app,
 * the splash is skipped.
 */
import './splash.css';

(function () {
  const INTERNAL_FLAG = 'staycec_nav_internal';
  
  // If we arrived here via an in-app link, skip the splash
  if (sessionStorage.getItem(INTERNAL_FLAG)) {
    sessionStorage.removeItem(INTERNAL_FLAG);
    return; // no splash
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
 * Call this helper before navigating in-app so the destination page
 * knows it was an internal navigation and skips the splash.
 */
window.navigateTo = function (url) {
  sessionStorage.setItem('staycec_nav_internal', '1');
  window.location.href = url;
};
