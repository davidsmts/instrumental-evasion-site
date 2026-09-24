#!/usr/bin/env python3
"""Redraw the two panels of paper Figure 4 for the landing page."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parent.parent
EFFORTS = ["low", "medium", "high", "xhigh", "max"]

# Outcome rates: figures/fig_reasoning_effort.tex in the paper repository.
# Token means: results/token_diagnostics_20260920_v1/reasoning_{model}.csv;
# GPT-6 Sol token means are embedded in the active paper figure source.
SERIES = [
    ("GPT-5.6 Luna", "#68B4C5", "^",
     [35.7143, 57.1429, 71.4286, 78.5714, 71.4286],
     [0.7031, 0.9059, 1.9416, 2.0837, 3.1937]),
    ("GPT-5.6 Sol", "#005365", "s",
     [41.3793, 51.7241, 58.6207, 51.7241, 62.0690],
     [1.4971, 1.6029, 1.6912, 2.4586, 2.7048]),
    ("GPT-5.6 Terra", "#00809B", "D",
     [61.5385, 57.6923, 61.5385, 57.6923, 69.2308],
     [4.2179, 3.5389, 4.2038, 5.3034, 5.6263]),
    ("GPT-6 Sol", "#287A62", "o",
     [0, 20, 20, 30, 26.6667],
     [3.5643, 3.6204, 5.6655, 5.3319, 6.2732]),
]

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10.5,
    "svg.fonttype": "none",
    "svg.hashsalt": "reasoning-effort-figure-4",
})

fig, axes = plt.subplots(1, 2, figsize=(11.2, 4.1), sharey=True)
fig.patch.set_facecolor("white")

for ax in axes:
    ax.set_facecolor("white")
    ax.set_ylim(-5, 90)
    ax.set_yticks([0, 20, 40, 60, 80])
    ax.grid(axis="y", color="#E3E0DA", linewidth=0.9)
    ax.set_axisbelow(True)
    ax.tick_params(colors="#5C5A63", length=0, pad=7)
    for spine in ("top", "right", "left"):
        ax.spines[spine].set_visible(False)
    ax.spines["bottom"].set_color("#C9C4BC")

for name, color, marker, rates, tokens in SERIES:
    marker_face = "white" if name == "GPT-5.6 Sol" else color
    for ax, x in ((axes[0], range(5)), (axes[1], tokens)):
        ax.plot(x, rates, color=color, linewidth=2.4, marker=marker,
                markersize=6.5, markerfacecolor=marker_face,
                markeredgecolor=color, markeredgewidth=1.4)

axes[0].set_title("(a) Outcome by effort", loc="left", fontsize=12,
                  fontweight="bold", color="#17161A", pad=16)
axes[0].set_xlim(-0.2, 4.2)
axes[0].set_xticks(range(5), EFFORTS)
axes[0].set_xlabel("Reasoning effort", color="#5C5A63", labelpad=10)
axes[0].set_ylabel("Monitor evasion (%)", color="#5C5A63", labelpad=9)

axes[1].set_title("(b) Outcome versus expenditure", loc="left", fontsize=12,
                  fontweight="bold", color="#17161A", pad=16)
axes[1].set_xlim(0, 8)
axes[1].set_xticks([0, 2, 4, 6, 8])
axes[1].set_xlabel("Mean recorded tokens/run (M)", color="#5C5A63", labelpad=10)
axes[1].tick_params(labelleft=True)

# The token lines connect effort levels in order, not sorted token use.
for name, color, _, rates, tokens in SERIES:
    offsets = {
        "GPT-5.6 Luna": ((-12, -12), (5, 4)),
        "GPT-5.6 Sol": ((-12, 6), (5, 0)),
        "GPT-5.6 Terra": ((-12, -13), (5, 4)),
        "GPT-6 Sol": ((-12, -11), (5, 0)),
    }
    for index, label in ((0, "L"), (4, "Max")):
        axes[1].annotate(label, (tokens[index], rates[index]),
                         textcoords="offset points", xytext=offsets[name][0 if index == 0 else 1],
                         fontsize=8.5, color=color, fontweight="bold")

fig.subplots_adjust(left=0.073, right=0.985, top=0.865, bottom=0.18, wspace=0.22)
output = ROOT / "reasoning-effort.svg"
fig.savefig(output, format="svg", transparent=False,
            metadata={"Title": "Reasoning effort and recorded token use",
                      "Date": "2026-09-24",
                      "Description": "Two panels from paper Figure 4: monitor evasion by reasoning effort and by mean recorded tokens per run."})
plt.close(fig)
svg = "\n".join(line.rstrip() for line in output.read_text().splitlines()) + "\n"
# Matplotlib's bundled font is unavailable in some browsers; use the site's fallback.
svg = svg.replace("font-family: 'DejaVu Sans'", "font-family: Arial, sans-serif")
output.write_text(svg)
