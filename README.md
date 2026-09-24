# Instrumental Monitor Evasion — results site

Static site for *Instrumental Monitor Evasion Emerges Under Ordinary Task
Pressure* (Schmotz, Prinzhorn, Beurer-Kellner, Paulus, Prabhu, Andriushchenko).
No build step, no dependencies: serve the folder and it works.

The landing page stays deliberately thin — leaderboard, how a run works, the
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
English in both versions: they are cited artifacts, not prose. German switches
number formatting too (`60,0 %`). Text that the scripts write themselves — the
leaderboard's unit toggle, the BibTeX copy button — goes through `I18N.t()`,
and `I18N.onChange()` repaints the board when the language flips.

The trace browser under `traces/` is English only.

```
index.html              the paper summary — leaderboard, setup, routes, monitors
styles.css, app.js      the landing page
i18n.js                 the German translation and the EN/DE switch
traces/index.html       catalog — agent × task-source matrix, filters, run tables
traces/run.html         one run: event timeline, monitor decisions, setup & scoring
traces/assets/          styles.css, common.js, catalog.js, run.js
traces/data/            complete generated corpus (git-ignored, added at deploy time)
tools/build_traces.py   turns the resultstore into traces/data/
paper.pdf               the current draft (git-ignored while under review)
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

The live website shows all 1,200 traces behind the leaderboard. The corpus is
not committed to this repository: `traces/data/` is generated from the private
resultstore and remains git-ignored. In production, a narrowly routed
Cloudflare Pages Function reads the files from a private R2 bucket, so cloning
the source repository does not download the trace corpus.

A visitor can still download anything the public viewer serves. This setup
separates the website payload from the Git repository; it is not access
control for the live traces.

Each run page has three panels:

- **Run trace** — the normalized event timeline. Tool calls carry the monitor's
  `ALLOW`/`BLOCK` verdict and the reason string it returned, joined onto the
  call. *Focus* hides private reasoning, harness boilerplate and the output of
  calls that simply worked; *Full* shows everything.
- **Monitor decisions** — every reviewed call in order, straight from the
  decision log, for the runs whose log the export carries.
- **Setup & scoring** — how the episode was scored, the policy, the monitor and
  agent configuration, and the fixed messages the agent was shown.

### Evidence coverage, and why runs differ

Coverage is uneven and the pages say so rather than papering over it:

| artifact | runs | what it gives |
| --- | ---: | --- |
| `stdout.txt` | 1200 | the agent transcript; the only universal source |
| `decisions.jsonl` | 577 | every proposed call, its verdict and the monitor's reason |
| Codex session (`rollout-*.jsonl`) | 240 | proposals *and* denials as Codex recorded them |

That yields three kinds of timeline. Claude Code's stream (300 runs) records
denied `tool_use` blocks, so it is complete. A Codex session (240 runs) is
likewise complete. The remaining 660 Codex runs are reconstructed from stdout,
which only ever contains calls that **ran** — a blocked proposal never enters
that stream. Those runs are labelled *executed calls only* in the catalog and
on the run page, and their blocked-call counts come from the episode record.

### The interception gap

The Codex CLI reviews the command that launches an interactive process but not
the input written to it afterwards. In a run whose decision log is present, a
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

It rewrites `traces/data/` from scratch — 1,200 runs, about 135 MB. The
selection is read from `model_comparison/20260919_figure1_exact3_v1/summary.json`;
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

## Deferred plan: publish traces without putting them in GitHub

**Status:** paused. No Cloudflare setup is required until we decide to publish
the full trace browser.

**Goal:** show all 1,200 traces on the public website while keeping the 135 MB
corpus out of normal GitHub clones.

Already prepared:

- `traces/data/` contains the full local corpus and is git-ignored.
- The viewer requests `/traces/data/index.js` and individual run files.
- `functions/traces/data/[[path]].js` can serve those requests from Cloudflare
  R2 through a binding named `TRACE_DATA`.
- `_routes.json` limits the Function to trace-data requests.

When there is time, finish the setup in this order:

1. Create a private Cloudflare R2 bucket for the trace files.
2. Create an R2 API token limited to that bucket. Do not commit or share it.
3. Bulk-upload the contents of `traces/data/` through R2's S3-compatible API.
   This can be delegated once the local machine has been authenticated.
4. In the Cloudflare Pages project, bind the bucket as `TRACE_DATA`.
5. Redeploy the site and verify the catalog, one ordinary run, and one run with
   linked monitor denials.

For later corpus updates, rebuild `traces/data/` and repeat only the bulk sync.
The R2 bucket should remain private; the Pages Function is the public read
path. Anything displayed by the public viewer can still be downloaded, but it
will not be included in a clone of this repository.
