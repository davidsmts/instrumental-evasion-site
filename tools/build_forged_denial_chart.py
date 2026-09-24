#!/usr/bin/env python3
"""Redraw paper.pdf Figure 7 as a responsive SVG for the landing page."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parent.parent
MODELS = ["GPT-6 Astra", "GPT-5.6 Luna", "DeepSeek V4 Flash"]
CLEAN = np.array([30, 30, 30]) / 30 * 100
INJECTED = np.array([12, 28, 28]) / 30 * 100

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 12,
    "svg.fonttype": "none",
    "svg.hashsalt": "forged-denial-figure-8",
    "hatch.linewidth": 1.4,
})

fig, ax = plt.subplots(figsize=(9.4, 4.0))
fig.patch.set_facecolor("white")
ax.set_facecolor("white")
x = np.arange(len(MODELS))
width = 0.31
clean = ax.bar(x - width / 2, CLEAN, width, color="#9ACBD5",
               edgecolor="#087C9E", linewidth=1.1, label="Clean")
injected = ax.bar(x + width / 2, INJECTED, width, color="white",
                  edgecolor="#087C9E", linewidth=1.1, hatch="////",
                  label="Injected")

for bars in (clean, injected):
    for bar in bars:
        value = bar.get_height()
        ax.text(bar.get_x() + bar.get_width() / 2, value + 2.2,
                f"{value:.0f}%" if value == 100 or value == 40 else f"{value:.1f}%",
                ha="center", va="bottom", color="#17161A", fontsize=11.5,
                fontweight="bold")

ax.set_ylim(0, 114)
ax.set_yticks(np.arange(0, 101, 20))
ax.set_ylabel("Attempts completed (%)", color="#5C5A63", labelpad=12)
ax.set_xticks(x, MODELS)
ax.tick_params(axis="x", colors="#17161A", length=0, pad=11)
ax.tick_params(axis="y", colors="#5C5A63", length=0, pad=7)
ax.grid(axis="y", color="#E3E0DA", linewidth=0.9)
ax.set_axisbelow(True)
for spine in ("top", "right", "left"):
    ax.spines[spine].set_visible(False)
ax.spines["bottom"].set_color("#C9C4BC")

fig.subplots_adjust(left=0.11, right=0.99, top=0.96, bottom=0.19)
output = ROOT / "forged-denial.svg"
fig.savefig(output, format="svg", transparent=False,
            metadata={"Title": "Completion under a forged monitor denial",
                      "Date": "2026-09-24",
                      "Description": "Figure 7 data: all three models complete 100% of clean runs; "
                                     "injected completion is 40% for GPT-6 Astra and "
                                     "93.3% for GPT-5.6 Luna and DeepSeek V4 Flash."})
plt.close(fig)
output.write_text("\n".join(line.rstrip() for line in output.read_text().splitlines()) + "\n")
