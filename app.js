(function () {
  'use strict';

  document.body.classList.add('js');

  var copyBtn = document.getElementById('copyCite');

  I18N.onChange(function () {
    if (copyBtn) copyBtn.textContent = I18N.t('cite.copy');
  });

  /* ---------- tabs ---------- */

  var tabs = document.querySelectorAll('.tab');
  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      var panelId = tab.getAttribute('aria-controls');
      Array.prototype.forEach.call(tabs, function (t) {
        var active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      var panels = document.querySelectorAll('.panel');
      Array.prototype.forEach.call(panels, function (p) {
        p.classList.toggle('is-active', p.id === panelId);
      });
    });
  });

  /* ---------- copy BibTeX ---------- */

  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener('click', function () {
      var text = document.getElementById('bibtex').textContent;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = I18N.t('cite.copied');
        setTimeout(function () { copyBtn.textContent = I18N.t('cite.copy'); }, 1600);
      });
    });
  }

  /* ---------- nav scroll-spy ---------- */

  var navLinks = document.querySelectorAll('.nav-links a');
  var targets = [];
  Array.prototype.forEach.call(navLinks, function (link) {
    // The nav also holds a link off the page (the trace browser); only the
    // in-page anchors have a section to observe.
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return;
    var el = document.querySelector(href);
    if (el) targets.push({ link: link, el: el });
  });

  if (targets.length && 'IntersectionObserver' in window) {
    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
      });
      var current = null;
      targets.forEach(function (t) {
        if (visible[t.el.id] && !current) current = t;
      });
      Array.prototype.forEach.call(navLinks, function (l) { l.classList.remove('current'); });
      if (current) current.link.classList.add('current');
    }, { rootMargin: '-56px 0px -70% 0px' });

    targets.forEach(function (t) { observer.observe(t.el); });
  }
})();
