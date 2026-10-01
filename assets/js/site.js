/* Mobile navigation. */
(function () {
  'use strict';

  var toggle = document.querySelector('.nav-toggle');
  var panel = document.querySelector('.nav-mobile');

  if (toggle && panel) {
    toggle.addEventListener('click', function () {
      var open = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    panel.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });

    // The panel is desktop-hidden by CSS; drop the open state so it can't
    // reappear mid-resize with a stale aria-expanded.
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 860 && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

})();
