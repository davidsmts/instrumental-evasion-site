# Instrumental Monitor Evasion — results site

Static site for *Instrumental Monitor Evasion Emerges Under Ordinary Task
Pressure*. No build step, no dependencies: serve the folder and it works.

```
index.html              the paper summary — findings, leaderboard, setup, ablations
styles.css, app.js      the landing page
traces/index.html       catalog — agent × task-source matrix, filters, run tables
traces/run.html         one run: event timeline, monitor decisions, setup & scoring
traces/assets/          styles.css, common.js, catalog.js, run.js
traces/data/            index.js + one <attempt_id>.js per run (generated, git-ignored)
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

**The run data is not in this repository.** `traces/data/` is generated from a
private resultstore (see below) and git-ignored; without it the catalog shows
its "could not load the run index" state. Generate it before serving the site.

`traces/` covers the **Figure-1 exact-three selection**: eight agents × 50
task–policy pairs × exactly three audit-valid runs — the same 1,200 attempts
the leaderboard is computed from, so every leaderboard row links into the runs
behind its number.

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

## Before publishing the corpus

The trace corpus is derived from a **private** resultstore and this repository
is public, so `traces/data/` is git-ignored by default: committing it publishes
1,200 transcripts, about 135 MB, and that is a deliberate decision rather than a
side effect of running the build. The paper is under double-blind review; the
build redacts author and host identity from the transcripts and `paper.pdf`
stays git-ignored, but nothing here decides for you whether the transcripts
themselves should be public.

To publish them, drop the `traces/data/` line from `.gitignore` and commit the
directory.
