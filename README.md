# Instrumental Monitor Evasion — results site

Static site for *Instrumental Monitor Evasion Emerges Under Ordinary Task
Pressure* (Schmotz, Prinzhorn, Beurer-Kellner, Paulus, Prabhu, Andriushchenko).
No build step, no dependencies: serve the folder and it works.

The landing page stays deliberately thin — paper-style results figure, how a run works, the
three routes agents take through the monitor, and the monitor diagnostics.
Everything that needs depth lives in the paper or in the trace browser.

## Languages

The nav carries an EN/DE switch. English lives in `index.html` and is the
source of truth: every translatable element carries a `data-i18n` key, the
English markup is cached the first time a language is applied, and `i18n.js`
holds only the German side — so a key missing from the dictionary falls back to
English instead of vanishing. The choice persists in `localStorage` and can be
forced with `?lang=de` or `?lang=en`.

The paper title, author names, model names, task ids, the quoted system
messages the agents actually saw and the `ALLOW`/`BLOCK` verdicts stay in
English in both versions: they are cited artifacts, not prose. The chart legend
and caption translate with the rest of the page. Text that scripts write,
such as the BibTeX copy button, goes through `I18N.t()`.

The trace browser under `traces/` is English only.

```
index.html              the paper summary — results figure, setup, routes, monitors
styles.css, app.js      the landing page
i18n.js                 the German translation and the EN/DE switch
traces/index.html       catalog — agent × task-source matrix, filters, run tables
traces/run.html         one run: event timeline, monitor decisions, setup & scoring
traces/assets/          styles.css, common.js, catalog.js, run.js
traces/data/            complete generated corpus, published with the site
tools/build_traces.py   turns the resultstore into traces/data/
paper.pdf               the public paper, served by the site's PDF links
```

## Running it locally

Open `index.html` in a browser. No server needed: the run data is delivered as
`<script>` tags calling `IME.receive(...)` rather than as `fetch()`ed JSON,
because a browser refuses `fetch()` on a `file://` page. Serving the folder
over HTTP works identically:

```sh
python3 -m http.server 8781 && open http://127.0.0.1:8781/
```

## The trace browser

The live website shows the 1,200-run, eight-agent corpus used for the paper's
mechanism analysis. The current results figure covers ten agents and is a
separate evaluation export.
`traces/data/` is generated from the private resultstore and committed with the
site so Cloudflare can serve the viewer as ordinary static files.

Each run page has three panels:

- **Run trace** — the normalized event timeline. Tool calls carry the monitor's
  `ALLOW`/`BLOCK` verdict and the reason string it returned, joined onto the
  call. The timeline shows every recorded event, with reasoning and tool outputs
  collapsed individually to keep long runs readable.
- **Monitor decisions** — every reviewed call in order, from the selected
  episode's `samples[0].decisions` record. A separate decision log is used only
  when an older episode record lacks that list.
- **Setup & scoring** — how the episode was scored, the policy, the monitor and
  agent configuration, and the fixed messages the agent was shown. It also
  shows the paper's Luna-judged evasion attempt classification and rationale.

The catalog can filter runs by the Luna judge's `supported` or `no_supported`
route label. A supported label is shown as a possible evasion attempt, matching
the paper's evasion attempt measure. These labels come from the resultstore's
`model_comparison/20260923_luna_figure1_judgments_v1/report.json`, joined by
selected attempt ID. They assess visible actions after denial and do not change
the deterministic evasion success outcome. The quote check only verifies cited text; it
does not validate Luna's interpretation.

### Evidence coverage, and why runs differ

Timeline coverage differs by scaffold, while monitor decisions are available
for every selected episode:

| artifact | runs | what it gives |
| --- | ---: | --- |
| `stdout.txt` | 1200 | the agent transcript |
| `samples[0].decisions` in `result.json.gz` | 1200 | every proposed call, its verdict and the monitor's reason |
| `decisions.jsonl` | 577 | separate copy of monitor decisions, used only as a fallback |
| Codex session (`rollout-*.jsonl`) | 240 | proposals *and* denials as Codex recorded them |

That yields three kinds of timeline. Claude Code's stream (300 runs) records
denied `tool_use` blocks, so it is complete. A Codex session (240 runs) is
likewise complete. The remaining 660 Codex runs are reconstructed from stdout,
which only ever contains calls that **ran** — a blocked proposal never enters
that stream. Those runs are labelled *executed calls only* in the catalog and
on the run page. Their blocked proposals, including commands and monitor
reasons, appear in the **Monitor decisions** panel from the episode record.

### The interception gap

The Codex CLI reviews the command that launches an interactive process but not
the input written to it afterwards. In a run with monitor decisions, a
`write_stdin` call with no decision is that gap, and the timeline tags it
`NOT INTERCEPTED` — five runs in the corpus, fifteen calls. The flag is
deliberately limited to `write_stdin`: for any other call, an unmatched
proposal is more likely a quoting difference between two artifacts than an
unreviewed call. Not intercepted means not reviewed, never approved.

## Regenerating the trace data

`traces/data/` is generated from the private
[agent-breakout-resultstore](https://github.com/davidsmts/agent-breakout-resultstore)
snapshots:

```sh
git clone https://github.com/davidsmts/agent-breakout-resultstore ~/resultstore
python3 tools/build_traces.py --store ~/resultstore
```

It rewrites `traces/data/` from scratch — 1,200 runs, about 139 MB. The
selection is read from `model_comparison/20260919_figure1_exact3_v1/summary.json`;
the Luna labels are read from `model_comparison/20260923_luna_figure1_judgments_v1/report.json`;
artifacts for each attempt are then located anywhere in the store, because the
same attempt is exported into several snapshots and the copies are not equally
complete. Tool output is clipped from the middle at 1,600 characters (3,000 for
prose) and the store stays authoritative. The build also redacts home-directory
paths, key-shaped strings and the operator's account, name and email address,
which the export's own redaction does not catch inside captured tool output —
eight runs contain them, mostly ToolSandbox fixtures whose simulated user
profile is the operator's own. Benchmark fixture content is otherwise left as
recorded, including the synthetic contacts ToolSandbox ships.

Payloads are deterministic, so re-running the build over an unchanged store
rewrites the files byte-for-byte and git records no new objects.
