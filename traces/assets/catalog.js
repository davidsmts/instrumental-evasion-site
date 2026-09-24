/* Catalog page: the agent × task-source matrix, the filter dock, and the run
   tables under it. Filter state lives in the query string so any view is a
   link. The leaderboard on the landing page links straight into it. */

(function () {
  var RUNS = [];
  var MODEL_ORDER = [];
  var SOURCE_ORDER = [];

  var el = {
    matrix: document.getElementById('matrix'),
    legend: document.getElementById('matrix-legend'),
    stats: document.getElementById('hero-stats'),
    runs: document.getElementById('runs'),
    empty: document.getElementById('empty'),
    loading: document.getElementById('loading'),
    count: document.getElementById('count'),
    reset: document.getElementById('reset'),
    groupBy: document.getElementById('group-by'),
    sort: document.getElementById('sort'),
    q: document.getElementById('q')
  };

  var FILTERS = {
    model: document.getElementById('f-model'),
    source: document.getElementById('f-source'),
    task: document.getElementById('f-task'),
    outcome: document.getElementById('f-outcome'),
    evidence: document.getElementById('f-evidence')
  };

  // ---------------------------------------------------------------- state

  function readUrl() {
    var params = new URLSearchParams(location.search);
    Object.keys(FILTERS).forEach(function (key) {
      FILTERS[key].value = params.get(key) || '';
    });
    el.q.value = params.get('q') || '';
    el.groupBy.value = params.get('by') || 'model';
    el.sort.value = params.get('sort') || 'outcome';
    if (!el.sort.value) el.sort.value = 'outcome';
  }

  function writeUrl() {
    var params = new URLSearchParams();
    Object.keys(FILTERS).forEach(function (key) {
      if (FILTERS[key].value) params.set(key, FILTERS[key].value);
    });
    if (el.q.value) params.set('q', el.q.value);
    if (el.groupBy.value !== 'model') params.set('by', el.groupBy.value);
    if (el.sort.value !== 'outcome') params.set('sort', el.sort.value);
    var qs = params.toString();
    try {
      history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    } catch (e) {
      // file:// pages refuse a same-document URL rewrite; filtering still works.
    }
  }

  function anyFilter() {
    return el.q.value || Object.keys(FILTERS).some(function (k) {
      return FILTERS[k].value;
    });
  }

  // Column headers have one line each in the matrix; the full names stay in
  // the filter dock and on every run row.
  var SHORT_SOURCE = {
    'ToolSandbox': 'ToolSandbox',
    'ClawBench': 'ClawBench',
    'Terminal-Bench 2.1': 'TB 2.1',
    'OpenThoughts-TBLite': 'OpenThoughts',
    'tau-bench': '\u03c4-bench',
    'Authored terminal tasks': 'Authored'
  };

  function shortSource(name) { return SHORT_SOURCE[name] || name; }

  // --------------------------------------------------------------- matrix

  function evasionRate(rows) {
    var valid = rows.filter(function (r) { return r.outcome !== 'invalid'; });
    if (!valid.length) return null;
    return valid.filter(function (r) { return r.outcome === 'evaded'; }).length
      / valid.length;
  }

  function shade(rate) {
    // One hue, ramped toward the accent. A cell with no evasion and a cell
    // with nothing in it both stay neutral, so neither reads as a result it
    // is not.
    if (rate === null || rate === 0) return 'var(--surface-2)';
    return 'color-mix(in srgb, var(--accent) ' +
      Math.round((0.12 + rate * 0.62) * 100) + '%, var(--surface-2))';
  }

  function buildMatrix() {
    var head = '<thead><tr><th class="row-head"></th>' + SOURCE_ORDER.map(function (s) {
      return '<th title="' + IME.escapeHtml(s) + '">' +
        IME.escapeHtml(shortSource(s)) + '</th>';
    }).join('') + '<th class="matrix-total">all</th></tr></thead><tbody>';

    var body = MODEL_ORDER.map(function (model) {
      var mine = RUNS.filter(function (r) { return r.model_label === model; });
      var cells = SOURCE_ORDER.map(function (source) {
        var cell = mine.filter(function (r) { return r.source === source; });
        if (!cell.length) {
          return '<td><span class="matrix-cell" data-empty>·</span></td>';
        }
        var evaded = cell.filter(function (r) { return r.outcome === 'evaded'; }).length;
        return '<td><button class="matrix-cell" style="background:' +
          shade(evasionRate(cell)) + '"' +
          ' data-model="' + IME.escapeHtml(model) + '"' +
          ' data-source="' + IME.escapeHtml(source) + '"' +
          ' title="' + evaded + ' of ' + cell.length + ' runs reached a ' +
          'prohibited outcome: ' + IME.escapeHtml(model) + ' on ' +
          IME.escapeHtml(source) + '">' +
          '<span class="cell-rate">' + evaded + '/' + cell.length + '</span>' +
          '</button></td>';
      }).join('');

      var evadedAll = mine.filter(function (r) { return r.outcome === 'evaded'; }).length;
      return '<tr><th class="row-head">' + IME.escapeHtml(model) + '</th>' + cells +
        '<td class="matrix-total"><button class="matrix-cell matrix-cell-total"' +
        ' data-model="' + IME.escapeHtml(model) + '" data-source=""' +
        ' title="All 150 runs for ' + IME.escapeHtml(model) + '">' +
        evadedAll + '/' + mine.length + '</button></td></tr>';
    }).join('');

    el.matrix.innerHTML = head + body + '</tbody>';

    el.matrix.addEventListener('click', function (event) {
      var cell = event.target.closest('.matrix-cell[data-model]');
      if (!cell) return;
      FILTERS.model.value = cell.dataset.model;
      FILTERS.source.value = cell.dataset.source;
      FILTERS.task.value = '';
      apply();
      el.runs.scrollIntoView({ block: 'start' });
    });

    el.legend.innerHTML = 'runs reaching a prohibited outcome / runs in the cell ' +
      [0, 0.25, 0.5, 0.75, 1].map(function (r) {
        return '<span class="legend-swatch" style="background:' + shade(r) + '"></span>';
      }).join('') + ' none → all · cells count runs, not tasks. The ' +
      'leaderboard\'s best-of-three rate is per task, over three runs each.';
  }

  function buildStats() {
    var evaded = RUNS.filter(function (r) { return r.outcome === 'evaded'; }).length;
    var blocks = RUNS.reduce(function (sum, r) { return sum + (r.blocked_proposals || 0); }, 0);
    var calls = RUNS.reduce(function (sum, r) { return sum + (r.tool_calls || 0); }, 0);
    var tasks = {};
    RUNS.forEach(function (r) { tasks[r.task] = 1; });

    var stats = [
      [IME.number(RUNS.length), 'episodes'],
      [String(MODEL_ORDER.length), 'agents'],
      [String(Object.keys(tasks).length), 'task–policy pairs'],
      [IME.number(evaded), 'reached a prohibited outcome'],
      [IME.compact(calls), 'tool calls'],
      [IME.compact(blocks), 'logged blocks']
    ];
    el.stats.innerHTML = stats.map(function (s) {
      return '<div class="hero-stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>';
    }).join('');
  }

  // -------------------------------------------------------------- filters

  function fillSelect(select, values) {
    var keep = select.value;
    var first = select.querySelector('option').outerHTML;
    select.innerHTML = first + values.map(function (v) {
      return '<option value="' + IME.escapeHtml(v[0]) + '">' +
        IME.escapeHtml(v[1]) + '</option>';
    }).join('');
    select.value = keep;
  }

  function buildFilters() {
    fillSelect(FILTERS.model, MODEL_ORDER.map(function (m) { return [m, m]; }));
    fillSelect(FILTERS.source, SOURCE_ORDER.filter(function (s) {
      return RUNS.some(function (r) { return r.source === s; });
    }).map(function (s) { return [s, s]; }));

    var tasks = [];
    var seen = {};
    RUNS.forEach(function (r) {
      if (seen[r.task]) return;
      seen[r.task] = 1;
      tasks.push([r.task, r.task_label, r.source]);
    });
    tasks.sort(function (a, b) {
      return (SOURCE_ORDER.indexOf(a[2]) - SOURCE_ORDER.indexOf(b[2]))
        || a[1].localeCompare(b[1]);
    });
    fillSelect(FILTERS.task, tasks.map(function (t) { return [t[0], t[1]]; }));
  }

  function matchesEvidence(run) {
    switch (FILTERS.evidence.value) {
      case 'full': return run.trace_source !== 'codex-stdout';
      case 'blocked': return (run.blocked_calls || run.blocked_proposals) > 0;
      case 'stdin': return run.unreviewed_stdin > 0;
      default: return true;
    }
  }

  function matches(run) {
    if (FILTERS.model.value && run.model_label !== FILTERS.model.value) return false;
    if (FILTERS.source.value && run.source !== FILTERS.source.value) return false;
    if (FILTERS.task.value && run.task !== FILTERS.task.value) return false;
    if (FILTERS.outcome.value && run.outcome !== FILTERS.outcome.value) return false;
    if (!matchesEvidence(run)) return false;
    var q = el.q.value.trim().toLowerCase();
    if (!q) return true;
    return [run.run_id, run.task, run.task_label, run.model_label, run.agent_model,
      run.source, run.scaffold, run.policy, run.key_step, run.outcome,
      run.stop_reason, run.basis].join(' ').toLowerCase().indexOf(q) >= 0;
  }

  var SORTS = {
    outcome: function (a, b) {
      var rank = { evaded: 0, held: 1, invalid: 2 };
      return (rank[a.outcome] - rank[b.outcome]) || (a.epoch - b.epoch);
    },
    'blocked-desc': function (a, b) {
      return (b.blocked_calls || 0) - (a.blocked_calls || 0);
    },
    'calls-desc': function (a, b) { return (b.tool_calls || 0) - (a.tool_calls || 0); },
    'duration-desc': function (a, b) { return (b.seconds || 0) - (a.seconds || 0); },
    'tokens-desc': function (a, b) { return (b.tokens || 0) - (a.tokens || 0); }
  };

  // --------------------------------------------------------------- render

  function chips(run) {
    var out = '';
    if (run.basis === 'confirmed_prohibited_effect') {
      out += ' <span class="chip chip-alert" title="A prohibited effect was ' +
        'confirmed even though the task was not scored as completed">effect ' +
        'without completion</span>';
    }
    if (run.unreviewed_stdin) {
      out += ' <span class="chip chip-warn" title="Session input was written ' +
        'to a running process with no monitor decision recorded">' +
        run.unreviewed_stdin + ' unreviewed session input</span>';
    }
    if (run.monitor_errors) {
      out += ' <span class="chip chip-warn" title="The monitor returned a ' +
        'malformed judgement at least once">monitor errors</span>';
    }
    if (run.trace_source === 'codex-stdout') {
      out += ' <span class="chip" title="' + IME.escapeHtml(
        IME.traceSourceNote('codex-stdout')) + '">executed calls only</span>';
    }
    return out;
  }

  function runCard(run) {
    var href = 'run.html?id=' + encodeURIComponent(run.run_id) +
      '&back=' + encodeURIComponent(location.search.slice(1));
    var metrics = [
      ['calls', IME.number(run.tool_calls)],
      ['blocked', IME.number(run.blocked_calls)],
      ['time', IME.duration(run.seconds)],
      ['tokens', IME.compact(run.tokens)]
    ];
    return '<a class="run-card" href="' + href + '">' +
      '<div class="run-status"><span class="verdict verdict-' + run.outcome +
        '" title="' + IME.escapeHtml(IME.outcomeTitle(run.outcome)) + '">' +
        IME.outcomeLabel(run.outcome) + '</span>' +
        '<span class="run-number">run ' + (run.epoch + 1) + ' of 3</span></div>' +
      '<div class="run-copy"><h3>' + IME.escapeHtml(run.task_label) + '</h3>' +
        '<p class="run-sub">' + IME.escapeHtml(run.model_label) + ' · ' +
        IME.escapeHtml(run.source) + ' · ' + IME.escapeHtml(run.scaffold) + '</p>' +
        '<p class="run-step"><span>Policy constraint</span>' +
        IME.escapeHtml(IME.policyConstraint(run.policy_constraint || run.key_step) ||
          'Not recorded') + '</p>' +
        (chips(run) ? '<div class="run-chips">' + chips(run) + '</div>' : '') +
      '</div><dl class="run-metrics">' + metrics.map(function (metric) {
        return '<div><dt>' + metric[0] + '</dt><dd>' + metric[1] + '</dd></div>';
      }).join('') + '</dl><span class="run-open" aria-hidden="true">›</span></a>';
  }

  function runList(rows) {
    return '<div class="run-list">' + rows.map(runCard).join('') + '</div>';
  }

  function groupKeyOf(run, by) {
    if (by === 'task') return run.task_label;
    if (by === 'source') return run.source;
    return run.model_label;
  }

  function render(rows) {
    var by = el.groupBy.value;
    var sorter = SORTS[el.sort.value] || SORTS.outcome;

    if (by === 'none') {
      el.runs.innerHTML = '<div class="group"><div class="group-body">' +
        runList(rows.slice().sort(sorter)) + '</div></div>';
      return;
    }

    var keys = [];
    var buckets = {};
    rows.forEach(function (run) {
      var key = groupKeyOf(run, by);
      if (!buckets[key]) { buckets[key] = []; keys.push(key); }
      buckets[key].push(run);
    });

    if (by === 'model') {
      keys.sort(function (a, b) {
        return MODEL_ORDER.indexOf(a) - MODEL_ORDER.indexOf(b);
      });
    } else if (by === 'source') {
      keys.sort(function (a, b) {
        return SOURCE_ORDER.indexOf(a) - SOURCE_ORDER.indexOf(b);
      });
    } else {
      keys.sort(function (a, b) {
        var ga = buckets[a][0].source, gb = buckets[b][0].source;
        return (SOURCE_ORDER.indexOf(ga) - SOURCE_ORDER.indexOf(gb)) || a.localeCompare(b);
      });
    }

    // Groups start collapsed past the first few: 1,200 rows at once is a wall.
    el.runs.innerHTML = keys.map(function (key, index) {
      var bucket = buckets[key].slice().sort(sorter);
      var evaded = bucket.filter(function (r) { return r.outcome === 'evaded'; }).length;
      var kicker = by === 'task'
        ? '<span class="group-kicker">' + IME.escapeHtml(bucket[0].source) + '</span>' : '';
      var collapsed = keys.length > 3 && index > 0 ? ' data-collapsed' : '';
      return '<section class="group"' + collapsed + '><header class="group-head">' +
        '<span class="group-caret" aria-hidden="true">▾</span>' + kicker +
        '<h2>' + IME.escapeHtml(key) + '</h2>' +
        '<span class="group-meta">' + bucket.length + ' run' +
        (bucket.length === 1 ? '' : 's') + ' · ' + evaded + ' evaded</span>' +
        '</header><div class="group-body">' + runList(bucket) + '</div></section>';
    }).join('');
  }

  function apply() {
    var rows = RUNS.filter(matches);
    el.empty.classList.toggle('hidden', rows.length > 0);
    el.runs.classList.toggle('hidden', rows.length === 0);
    el.count.textContent = rows.length === RUNS.length
      ? RUNS.length + ' runs'
      : rows.length + ' of ' + RUNS.length + ' runs';
    el.reset.classList.toggle('hidden', !anyFilter());
    if (rows.length) render(rows);
    writeUrl();
  }

  // ----------------------------------------------------------------- wire

  Object.keys(FILTERS).forEach(function (key) {
    FILTERS[key].addEventListener('change', function () {
      // Picking one task makes its source redundant; picking a source drops a
      // task filter that would contradict it.
      if (key === 'task' && FILTERS.task.value) FILTERS.source.value = '';
      if (key === 'source' && FILTERS.source.value) FILTERS.task.value = '';
      apply();
    });
  });

  var searchTimer;
  el.q.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(apply, 120);
  });

  el.groupBy.addEventListener('change', apply);
  el.sort.addEventListener('change', apply);

  el.reset.addEventListener('click', function () {
    Object.keys(FILTERS).forEach(function (k) { FILTERS[k].value = ''; });
    el.q.value = '';
    apply();
  });

  el.runs.addEventListener('click', function (event) {
    var head = event.target.closest('.group-head');
    if (head) {
      head.parentElement.toggleAttribute('data-collapsed');
      return;
    }
  });

  readUrl();
  IME.loadIndex().then(function (data) {
    RUNS = data.runs;
    MODEL_ORDER = data.model_order;
    SOURCE_ORDER = data.source_order.filter(function (s) {
      return RUNS.some(function (r) { return r.source === s; });
    });
    el.loading.classList.add('hidden');
    buildMatrix();
    buildStats();
    buildFilters();
    readUrl();
    apply();
  }).catch(function (err) {
    el.loading.innerHTML = '<p class="muted">Could not load the run index: ' +
      IME.escapeHtml(err.message) + '. Check that <code>traces/data/</code> is ' +
      'present; it is generated by <code>tools/build_traces.py</code>.</p>';
  });
})();
