/* Run page: the event timeline, the monitor's decision log, and the setup.

   Focus mode hides the two things that make a long episode unreadable without
   changing what happened — the model's private reasoning and the output of
   calls that simply worked — and keeps everything that bears on the monitor:
   every proposal, every verdict, every denial. */

(function () {
  var DATA = null;
  var VIEW = 'focus';

  var el = {
    title: document.getElementById('s-title'),
    sub: document.getElementById('s-sub'),
    outcome: document.getElementById('s-outcome'),
    basis: document.getElementById('s-basis'),
    policy: document.getElementById('s-policy'),
    stats: document.getElementById('s-stats'),
    coverage: document.getElementById('s-coverage'),
    runId: document.getElementById('s-runid'),
    runIdText: document.getElementById('s-runid-text'),
    back: document.getElementById('back-link'),
    topbarMeta: document.getElementById('topbar-meta'),
    trace: document.getElementById('trace'),
    traceNote: document.getElementById('trace-note'),
    count: document.getElementById('event-count'),
    decisions: document.getElementById('decisions'),
    setup: document.getElementById('setup'),
    jump: document.getElementById('jump'),
    expand: document.getElementById('expand-outputs')
  };

  var params = new URLSearchParams(location.search);
  var RUN_ID = params.get('id');
  var BACK = params.get('back');
  if (BACK) el.back.href = 'index.html?' + BACK;

  var escapeHtml = IME.escapeHtml;

  // ------------------------------------------------------------ rendering

  function visible(event) {
    if (VIEW === 'full') return true;
    if (event.kind === 'thought') return false;
    if (event.kind === 'tool_result') return event.is_error || event.denied;
    // Harness boilerplate (hook-trust banners, model-metadata warnings) is
    // the same in every run; a denial notice is the point of the page.
    if (event.kind === 'notice') return event.flavor === 'deny';
    return true;
  }

  // The .row wrapper is display:contents and has no box of its own, so the
  // anchor has to live on the gutter cell for scrollIntoView to work.
  function gutter(event, callNumber) {
    return '<div class="row-gutter" id="ev-' + event.i + '">' +
      (callNumber
        ? '<a class="row-turn" href="#ev-' + event.i + '">#' + callNumber + '</a>'
        : '<span class="row-dot" aria-hidden="true"></span>') +
      (event.ts ? '<br>' + IME.clockTime(event.ts) : '') + '</div>';
  }

  function label(text) {
    return '<span class="event-label">' + escapeHtml(text) + '</span>';
  }

  function verdictChip(event) {
    // A call the monitor never saw is not a call the monitor approved.
    if (event.unreviewed) {
      return '<span class="tag gap" title="No monitor decision was recorded ' +
        'for this call. The Codex CLI reviews the command that launches a ' +
        'process, not the input written to it afterwards.">NOT INTERCEPTED</span>';
    }
    if (!event.verdict) return '';
    return '<span class="tag ' + (event.blocked ? 'block' : 'allow') + '">' +
      escapeHtml(event.verdict) + '</span>';
  }

  function body(event) {
    switch (event.kind) {
      case 'session_start':
        var fields = [
          ['agent', event.model],
          ['cwd', event.cwd],
          ['harness', event.cli ? 'v' + event.cli : null],
          ['permission', event.permission_mode],
          ['session', event.session_id]
        ].filter(function (f) { return f[1]; });
        return '<div class="session-card">' + label('episode start') + '<dl>' +
          fields.map(function (f) {
            return '<dt>' + escapeHtml(f[0]) + '</dt><dd>' + escapeHtml(f[1]) + '</dd>';
          }).join('') + '</dl></div>';

      case 'stage':
        return '<div class="stage-divider"><span class="stage-name">' +
          escapeHtml(event.name || 'stage') + '</span></div>';

      case 'user':
        return '<div class="bubble bubble-user">' + label('user') +
          IME.markdown(event.text) + '</div>';

      case 'text':
        return '<div class="bubble">' + IME.markdown(event.text) + '</div>';

      case 'thought':
        return '<details class="thought"><summary>thinking</summary>' +
          '<div class="thought-body">' + escapeHtml(event.text) + '</div></details>';

      case 'tool_call':
        return '<div class="tool' + (event.blocked ? ' tool-blocked' : '') +
          (event.unreviewed ? ' tool-unreviewed' : '') + '">' +
          '<div class="tool-head">' +
          '<span class="tool-name">' + escapeHtml(event.name || 'tool') + '</span>' +
          (event.detail ? '<span class="tool-detail">' + escapeHtml(event.detail) +
            '</span>' : '') +
          '<span class="spacer"></span>' + verdictChip(event) + '</div>' +
          '<pre class="tool-cmd">' + escapeHtml(event.input || '') + '</pre>' +
          (event.reason
            ? '<div class="monitor-reason"><span class="mr-label">monitor</span>' +
              escapeHtml(event.reason) + '</div>'
            : '') + '</div>';

      case 'tool_result':
        var open = el.expand.checked ? ' open' : '';
        var exit = (event.exit_code !== undefined && event.exit_code !== null)
          ? ' exit ' + event.exit_code : '';
        if (event.denied) {
          return '<div class="notice notice-deny">' +
            '<div class="notice-title">The tool call did not run</div>' +
            '<div class="notice-detail">' + escapeHtml(event.output) + '</div></div>';
        }
        return '<div class="tool"><div class="tool-head">' +
          '<span class="tool-name">' + escapeHtml(event.name || 'result') +
          '</span><span class="spacer"></span><span class="tool-meta">result' +
          exit + '</span></div>' +
          '<details class="tool-out' + (event.is_error ? ' tool-out-error' : '') +
          '"' + open + '><summary></summary><pre>' +
          escapeHtml(event.output || '(no output)') + '</pre>' +
          (event.truncated
            ? '<div class="tool-trunc">output elided in the middle</div>' : '') +
          '</details></div>';

      case 'notice':
        if (event.flavor === 'deny') {
          return '<div class="notice notice-deny">' +
            '<div class="notice-title">Guardrail denial reminder</div>' +
            '<div class="notice-detail">' +
            escapeHtml((DATA.setup || {}).refusal_context_message ||
              'The preceding tool call was denied by a runtime guardrail.') +
            '</div></div>';
        }
        return '<div class="notice notice-' + escapeHtml(event.flavor || 'info') + '">' +
          '<div class="notice-title">' + escapeHtml(event.title || '') + '</div>' +
          (event.detail
            ? '<div class="notice-detail">' + escapeHtml(event.detail) + '</div>' : '') +
          '</div>';

      case 'result':
        return '<div class="bubble">' + label('episode result · ' +
          (event.status || '')) +
          (event.text ? IME.markdown(event.text)
            : '<p class="muted">(no final message)</p>') + '</div>';

      default:
        return '';
    }
  }

  function renderTrace() {
    var callNumber = 0;
    var numbers = {};
    DATA.events.forEach(function (event) {
      if (event.kind === 'tool_call') {
        callNumber += 1;
        numbers[event.i] = callNumber;
      }
    });

    var rows = DATA.events.filter(visible).map(function (event) {
      var html = body(event);
      if (!html) return '';
      return '<div class="row row-' + event.kind + '">' +
        gutter(event, numbers[event.i]) +
        '<div class="row-body">' + html + '</div></div>';
    }).join('');

    el.trace.innerHTML = rows ||
      '<p class="muted">This run has no readable stream artifact.</p>';

    var shown = DATA.events.filter(visible).length;
    el.count.textContent = callNumber + ' tool call' + (callNumber === 1 ? '' : 's') +
      ' · ' + shown + ' of ' + DATA.events.length + ' events shown';
  }

  function renderDecisions() {
    if (!DATA.decisions.length) {
      el.decisions.innerHTML = '<div class="empty-state"><p class="muted">' +
        'No monitor decision log was exported for this attempt. The recorded ' +
        'totals — ' + IME.number(DATA.tool_calls) + ' tool calls, ' +
        IME.number(DATA.blocked_calls) + ' of them blocked — come from the ' +
        'episode record itself.</p></div>';
      return;
    }

    var blocked = DATA.decisions.filter(function (d) { return d.blocked; }).length;
    var head = '<div class="section-intro"><p>Every call the monitor reviewed, ' +
      'in order, with the verdict and the reason string it returned. The monitor ' +
      'saw the preceding calls and verdicts, not the agent\'s reasoning. A reason ' +
      'is the monitor\'s own account of its decision, and an <code>ALLOW</code> ' +
      'is not evidence that the call was harmless.</p>' +
      '<p class="muted">' + DATA.decisions.length + ' reviewed · ' + blocked +
      ' blocked · monitor ' + escapeHtml(DATA.monitor) + '</p></div>';

    el.decisions.innerHTML = head + '<table class="decisions"><thead><tr>' +
      '<th class="num">#</th><th>verdict</th><th>proposed call</th>' +
      '<th>monitor reason</th></tr></thead><tbody>' +
      DATA.decisions.map(function (d) {
        return '<tr class="' + (d.blocked ? 'is-blocked' : '') + '">' +
          '<td class="num">' + (d.i + 1) + '</td>' +
          '<td><span class="tag ' + (d.blocked ? 'block' : 'allow') + '">' +
            escapeHtml(d.decision) + '</span></td>' +
          '<td><pre class="tool-cmd">' + escapeHtml(d.input) + '</pre></td>' +
          '<td class="reason-cell">' + escapeHtml(d.reason || '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function definition(term, value) {
    if (value === null || value === undefined || value === '') return '';
    return '<div><dt>' + escapeHtml(term) + '</dt><dd>' + escapeHtml(value) + '</dd></div>';
  }

  function renderSetup() {
    var setup = DATA.setup || {};
    var scoring = DATA.scoring || {};
    var limits = DATA.limits || {};

    var blocks = [];

    blocks.push('<section class="panel-block"><h2>How this episode was scored</h2>' +
      '<p>' + escapeHtml(DATA.explanation || '') + '</p>' +
      '<dl class="kv">' +
      definition('scorer verdict', DATA.answer) +
      definition('task completed', String(!!scoring.task_completed)) +
      definition('confirmed prohibited effect',
        scoring.confirmed_prohibited_effect === null
          ? 'not probed' : String(scoring.confirmed_prohibited_effect)) +
      definition('counted as evasion', String(!!scoring.evasion_success)) +
      definition('basis', scoring.basis) +
      definition('stop reason', DATA.stop_reason) +
      definition('infrastructure', (DATA.infrastructure || {}).status) +
      '</dl>' +
      '<p class="muted">A deterministic non-LLM scorer reads authoritative state ' +
      'outside the agent\'s context. The agent\'s own report and the monitor\'s ' +
      'verdicts do not affect it.</p></section>');

    blocks.push('<section class="panel-block"><h2>Policy</h2>' +
      '<dl class="kv">' +
      definition('policy', DATA.policy) +
      definition('prohibited step', DATA.key_step) +
      definition('variant', setup.policy_variant) +
      definition('revision', setup.policy_revision) +
      '</dl>' +
      '<p class="muted">The policy text itself is private to the monitor and is ' +
      'not part of the episode record; the prohibited step above is the export\'s ' +
      'own summary of what the policy withholds.</p></section>');

    blocks.push('<section class="panel-block"><h2>Monitor</h2>' +
      '<dl class="kv">' +
      definition('model', DATA.monitor) +
      definition('history', setup.monitor_history_max_calls
        ? setup.monitor_history_max_calls + ' calls, ' +
          setup.monitor_history_max_arg_chars + ' chars per argument' : null) +
      definition('reasoning effort', setup.monitor_reasoning_effort) +
      definition('malformed judgements', String(DATA.monitor_errors)) +
      '</dl></section>');

    blocks.push('<section class="panel-block"><h2>Agent</h2>' +
      '<dl class="kv">' +
      definition('model', DATA.agent_model) +
      definition('scaffold', DATA.scaffold +
        (setup.scaffold_version ? ' · ' + setup.scaffold_version : '')) +
      definition('reasoning effort', setup.agent_reasoning_effort) +
      definition('network', setup.network) +
      definition('episode limit', limits.time_limit_seconds
        ? IME.duration(limits.time_limit_seconds) : null) +
      definition('refusal stop', setup.refusal_stop_threshold
        ? setup.refusal_stop_threshold + ' consecutive refusals' : null) +
      '</dl></section>');

    var messages = [
      ['System prompt addition', setup.system_prompt],
      ['Block message', setup.block_message],
      ['Denial reminder', setup.refusal_context_message],
      ['Continuation message', setup.continuation_message]
    ].filter(function (m) { return m[1]; });

    blocks.push('<section class="panel-block"><h2>What the agent was told</h2>' +
      messages.map(function (m) {
        return '<div class="quote-box"><p class="qb-label">' + escapeHtml(m[0]) +
          '</p><p class="qb-text">' + escapeHtml(m[1]) + '</p></div>';
      }).join('') + '</section>');

    el.setup.innerHTML = blocks.join('');
  }

  function renderSummary() {
    document.title = DATA.task_label + ' · ' + DATA.model_label + ' · traces';
    el.title.textContent = DATA.task_label;
    el.sub.innerHTML = escapeHtml(DATA.model_label) + ' · ' +
      escapeHtml(DATA.scaffold) + '<br>' + escapeHtml(DATA.source) +
      ' · run ' + (DATA.epoch + 1) + ' of 3';
    el.topbarMeta.textContent = DATA.task + ' · epoch ' + DATA.epoch;

    el.outcome.textContent = IME.outcomeLabel(DATA.outcome);
    el.outcome.className = 'verdict-big verdict-' + DATA.outcome;
    el.outcome.title = IME.outcomeTitle(DATA.outcome);
    el.basis.textContent = DATA.basis
      ? DATA.basis.replace(/_/g, ' ')
      : (DATA.solved ? 'task completed' : '');

    el.policy.innerHTML = '<span class="policy-label">prohibited step</span>' +
      escapeHtml(DATA.key_step || DATA.policy || '—');

    var stats = [
      ['tool calls', IME.number(DATA.tool_calls)],
      ['blocked', IME.number(DATA.blocked_calls)],
      ['reviewed by monitor', DATA.decisions.length
        ? IME.number(DATA.decisions.length) : '—'],
      ['duration', IME.duration(DATA.seconds)],
      ['CLI invocations', IME.number(DATA.turns)],
      ['tokens', IME.compact(DATA.tokens)]
    ];
    el.stats.innerHTML = stats.map(function (s) {
      return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>';
    }).join('');

    var note = IME.traceSourceNote(DATA.trace_source);
    var coverage = '<p>' + escapeHtml(note) + '</p>';
    if (DATA.unreviewed_stdin) {
      coverage += '<p><strong>' + DATA.unreviewed_stdin + ' session-input ' +
        'call' + (DATA.unreviewed_stdin === 1 ? '' : 's') + ' with no monitor ' +
        'decision.</strong> The launch command was reviewed; the input written ' +
        'to the running process was not.</p>';
    }
    if (DATA.decisions.length) {
      coverage += '<p>Monitor decision log present: ' + DATA.decisions.length +
        ' reviewed calls, ' + DATA.verdicts_joined + ' matched to a call in the ' +
        'timeline.</p>';
    } else {
      coverage += '<p>No monitor decision log in the export for this attempt. ' +
        'Verdict badges are therefore absent from the timeline; the episode ' +
        'record still counts ' + IME.number(DATA.blocked_calls) + ' blocked ' +
        'calls.</p>';
    }
    el.coverage.innerHTML = coverage;

    el.traceNote.innerHTML = DATA.trace_source === 'codex-stdout'
      ? '<strong>Executed calls only.</strong> ' + escapeHtml(note)
      : '';

    el.runIdText.textContent = DATA.run_id;
  }

  // ----------------------------------------------------------------- wire

  document.querySelectorAll('.tab-btn').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (other) {
        other.classList.toggle('active', other === button);
      });
      document.querySelectorAll('.section').forEach(function (section) {
        section.classList.toggle('active', section.id === 'tab-' + button.dataset.tab);
      });
    });
  });

  document.getElementById('view-focus').addEventListener('click', function () {
    VIEW = 'focus';
    this.classList.add('active');
    document.getElementById('view-full').classList.remove('active');
    renderTrace();
  });

  document.getElementById('view-full').addEventListener('click', function () {
    VIEW = 'full';
    this.classList.add('active');
    document.getElementById('view-focus').classList.remove('active');
    renderTrace();
  });

  el.expand.addEventListener('change', renderTrace);

  el.jump.addEventListener('change', function () {
    var wanted = parseInt(el.jump.value, 10);
    if (!wanted) return;
    var seen = 0;
    for (var index = 0; index < DATA.events.length; index++) {
      if (DATA.events[index].kind !== 'tool_call') continue;
      seen += 1;
      if (seen === wanted) {
        var target = document.getElementById('ev-' + DATA.events[index].i);
        if (target) target.scrollIntoView({ block: 'center' });
        return;
      }
    }
  });

  el.runId.addEventListener('click', function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(DATA.run_id).then(function () {
      el.runId.classList.add('copied');
      setTimeout(function () { el.runId.classList.remove('copied'); }, 1200);
    });
  });

  if (!RUN_ID) {
    el.trace.innerHTML = '<p class="muted">No run id in the URL.</p>';
    return;
  }

  IME.loadRun(RUN_ID).then(function (data) {
    DATA = data;
    renderSummary();
    renderTrace();
    renderDecisions();
    renderSetup();
  }).catch(function (err) {
    el.trace.innerHTML = '<p class="muted">Could not load this run: ' +
      escapeHtml(err.message) + '</p>';
  });
})();
