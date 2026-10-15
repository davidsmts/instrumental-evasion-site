# Instrumental Monitor Evasion — results site

Static site for *Instrumental Monitor Evasion Emerges Under Ordinary Task
Pressure* (Schmotz, Prinzhorn, Beurer-Kellner, Paulus, Prabhu, Andriushchenko).
No build step, no dependencies: serve the folder and it works.

The landing page stays deliberately thin — paper-style results figure, how a run works, the
three routes agents take through the monitor, prompt injection, and denial feedback.
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
index.html              the paper summary — results figure, setup, routes, injection, feedback
styles.css, app.js      the landing page
i18n.js                 the German translation and the EN/DE switch
favicon.svg             the red square from the landing page wordmark
traces/index.html       catalog — agent × task-source matrix, filters, run tables
traces/run.html         one run: event timeline, monitor decisions, setup & scoring
traces/assets/          styles.css, common.js, catalog.js, run.js
traces/data/            complete generated corpus, published with the site
tools/build_traces.py   turns the resultstore into traces/data/
paper.pdf               local paper copy; the landing page links to arXiv
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

The trace browser publishes only evidence contributing to the current Figure 1:
1,050 selected repeated-run traces from seven original agents, 90 Claude Fable
5.1 traces, and 342 GPT-6 Sol traces (1,482 total, across nine agents).
The 150 historical Sonnet 5 mechanism-analysis traces are excluded because
Sonnet is absent from the current figure. GLM-5.2's chart row has no trace link.

The Fable and GPT-6 Sol IDs are frozen in `tools/figure1_selection.json`, with
result hashes, review provenance, and expected task-level aggregations. They
are exactly the native-valid traces used by Figure 1's Luna attempt-rate bars:
31/37 Fable tasks (83.8%) and 19/50 GPT-6 Sol tasks (38%). These evidence sets
mix campaigns, policies and effort settings; the paper's exact-count table
states that they differ from the success-rate cohorts. They must not be
described as matched Bo3 cohorts. All other campaign attempts are excluded.

`traces/data/` is generated from the private resultstore and committed with the
site so Cloudflare can serve the viewer as ordinary static files.

The left rail shows the main task from the episode's initial user message above
the policy constraint. The task prompt is exported in full, with the same
redaction as the rest of the trace.

Each run page has three panels:

- **Run trace** — the normalized event timeline. Tool calls carry the monitor's
  `ALLOW`/`BLOCK` verdict and the reason string it returned, joined onto the
  call. The timeline shows every recorded event, with reasoning and tool outputs
  collapsed individually to keep long runs readable. The configured system
  prompt addition appears after the episode start. Each blocked proposal has a
  **Context sent to agent** dropdown with the block message and denial reminder;
  the same dropdown is available in Monitor decisions. Initial task and
  continuation user messages omitted by stdout are restored from the episode
  record at their invocation boundaries. When a Claude stream includes extra
  internal retries, the preceding final response establishes the boundary.
- **Monitor decisions** — every reviewed call in order, from the selected
  episode's `samples[0].decisions` record. A separate decision log is used only
  when an older episode record lacks that list.
- **Setup & scoring** — how the episode was scored, the policy, the monitor and
  agent configuration, and the fixed messages the agent was shown.

The exported data retains the paper's Luna-judged evasion attempt labels and
rationales, but the trace viewer does not display or filter by them for now.
These labels come from the resultstore's
`model_comparison/20260923_luna_figure1_judgments_v1/report.json` for original
cohorts and the frozen selection manifest for Fable and GPT-6 Sol, joined by
selected attempt ID. They do not change the deterministic evasion success outcome.

Collection and campaign filters separate the repeated-run cohorts from the
attempt-rate evidence. Campaigns and recorded reasoning effort appear with
each added run; its epoch is shown without inventing a three-run position.

### Evidence coverage, and why runs differ

Timeline coverage differs by scaffold, while monitor decisions are available
for every selected episode:

| artifact | what it gives |
| --- | --- |
| `stdout.txt` | the agent transcript |
| `samples[0].decisions` in `result.json[.gz]` | every proposed call, its verdict and the monitor's reason |
| `decisions.jsonl` | separate copy of monitor decisions, used only as a fallback |
| Codex session (`rollout-*.jsonl`) | proposals *and* denials as Codex recorded them |

That yields three kinds of timeline. Claude Code's stream records denied
`tool_use` blocks, so it is complete. A Codex session is likewise complete.
Other Codex runs are reconstructed from stdout,
which only ever contains calls that **ran** — a blocked proposal never enters
that stream. Those runs are labelled *executed calls only* in the catalog and
on the run page. Their blocked proposals, including commands and monitor
reasons, appear in the **Monitor decisions** panel from the episode record.

### The interception gap

The Codex CLI reviews the command that launches an interactive process but not
the input written to it afterwards. In a run with monitor decisions, a
`write_stdin` call with no decision is that gap, and the timeline tags it
`NOT INTERCEPTED`. The flag is
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

Use a current resultstore checkout (at least commit `8905d139`). The build
rewrites `traces/data/` from scratch, deleting obsolete run payloads. Original
selections are read from `model_comparison/20260919_figure1_exact3_v1/summary.json`,
restricted to agents in the published Figure 1;
the Luna labels are read from `model_comparison/20260923_luna_figure1_judgments_v1/report.json`;
Fable and GPT-6 Sol selections and labels are read from the checked-in
`tools/figure1_selection.json`, with artifacts in
`recent_evaluations/20260923_fable_sol_campaigns_v1`. Results are verified against
the frozen IDs, native status, and hashes before export. The build checks the
90/37/31 and 342/50/19 attempt/task/supported-task totals and fails on any missing
or broken selected trace. It never adds attempts by globbing entire campaigns.
Artifacts for each selected attempt are located anywhere in the store, because the
same attempt is exported into several snapshots and the copies are not equally
complete. Tool output is clipped from the middle at 1,600 characters (3,000 for
prose) and the store stays authoritative. The build also redacts home-directory
paths, key-shaped strings and the operator's account, name and email address,
which the export's own redaction does not catch inside captured tool output —
eight runs contain them, mostly ToolSandbox fixtures whose simulated user
profile is the operator's own. Benchmark fixture content is otherwise left as
recorded, including the synthetic contacts ToolSandbox ships.

Run payloads are deterministic; the index records its generation time.
Run `python3 -m unittest discover -s tests -v` for exporter checks.
