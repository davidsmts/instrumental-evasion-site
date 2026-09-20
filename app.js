(function () {
  'use strict';

  document.body.classList.add('js');

  /* ---------- theme ---------- */

  var themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    });
  }

  /* ---------- leaderboard: render metric cells, sort, unit toggle ---------- */

  var board = document.getElementById('board');
  var unitToggle = document.getElementById('unitToggle');

  function renderBoard(mode) {
    if (!board) return;
    var rows = board.tBodies[0].rows;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      row.cells[0].textContent = i + 1;
      var cells = row.querySelectorAll('td.metric');
      for (var j = 0; j < cells.length; j++) {
        var cell = cells[j];
        var key = cell.getAttribute('data-col');
        var pct = parseFloat(row.getAttribute('data-' + key));
        var label = mode === 'count'
          ? row.getAttribute('data-' + key + 'c')
          : pct.toFixed(1) + '%';
        cell.innerHTML =
          '<span class="metric-inner">' +
            '<span class="metric-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="metric-val"></span>' +
          '</span>';
        cell.querySelector('.metric-val').textContent = label;
      }
    }
  }

  function sortBoard(key, dir) {
    var body = board.tBodies[0];
    var rows = Array.prototype.slice.call(body.rows);
    rows.sort(function (a, b) {
      var av = parseFloat(a.getAttribute('data-' + key));
      var bv = parseFloat(b.getAttribute('data-' + key));
      return dir === 'ascending' ? av - bv : bv - av;
    });
    rows.forEach(function (r) { body.appendChild(r); });
  }

  if (board) {
    renderBoard('pct');

    var headers = board.querySelectorAll('th.sortable');
    Array.prototype.forEach.call(headers, function (th) {
      th.setAttribute('tabindex', '0');
      th.setAttribute('role', 'button');

      function activate() {
        var key = th.getAttribute('data-key');
        var dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending';
        Array.prototype.forEach.call(headers, function (other) {
          other.removeAttribute('aria-sort');
        });
        th.setAttribute('aria-sort', dir);
        sortBoard(key, dir);
        renderBoard(unitToggle && unitToggle.dataset.mode === 'count' ? 'count' : 'pct');
      }

      th.addEventListener('click', activate);
      th.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
      });
    });
  }

  if (unitToggle) {
    unitToggle.addEventListener('click', function () {
      var next = unitToggle.dataset.mode === 'pct' ? 'count' : 'pct';
      unitToggle.dataset.mode = next;
      unitToggle.textContent = next === 'count' ? 'Show percentages' : 'Show counts';
      renderBoard(next);
    });
  }

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

  var copyBtn = document.getElementById('copyCite');
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener('click', function () {
      var text = document.getElementById('bibtex').textContent;
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = 'Copied';
        setTimeout(function () { copyBtn.textContent = 'Copy BibTeX'; }, 1600);
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
