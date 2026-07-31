# 検討用モックのみ（実装は Tremor CategoryBar）。在位年数は site と同じ approxDays/365 で割る。
import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

plt.rcParams["font.family"] = "Noto Sans CJK JP"
plt.rcParams["axes.unicode_minus"] = False

OUT = "/home/sakis/emperor-stats/site/design-plans/tools/rebuild-shots/"
# 予約スロットの実測 434x398px を 100px/inch で再現（fontsize 10 ≒ サイト14px）
FIG = (4.34, 3.98)
DPI = 200

FG = "#171717"; MUTED = "#737373"; BORDER = "#e5e5e5"
S = dict(blue="#2a78d6", orange="#eb6834", green="#1baf7a", amber="#eda100",
         pink="#e87ba4", dgreen="#008300", purple="#4a3aa7", red="#e34948",
         gray="#b0b0b0")

d = json.load(open("/home/sakis/emperor-stats/data/emperors.json"))
cats = d["meta"]["catalogs"]
ERAS = [(e["id"], e["label"]) for e in sorted(cats["eras"], key=lambda x: x["sortOrder"])]
V = {"assassination", "execution", "killed-in-battle", "suicide"}
U = {"unknown", "disputed"}
rows = []
for e in d["emperors"]:
    rs = e.get("reignSummary") or {}
    dur = (rs.get("totalReignDuration") or {}).get("approxDays")
    rows.append(dict(reign=(dur / 365 if dur is not None else None), eraId=e.get("eraId"),
                     dc=(e.get("deathCause") or {}).get("category"),
                     era=(e.get("eraChangeCount") or {}).get("count"),
                     amn=(e.get("amnestyCount") or {}).get("count")))

def frame(title, sub):
    fig, ax = plt.subplots(figsize=FIG, dpi=DPI)
    fig.subplots_adjust(left=0.20, right=0.97, top=0.84, bottom=0.16)
    fig.text(0.045, 0.945, title, fontsize=10.5, fontweight="bold", color=FG, va="top")
    fig.text(0.045, 0.882, sub, fontsize=7.6, color=MUTED, va="top")
    for s in ax.spines.values():
        s.set_visible(False)
    return fig, ax

# ---------- 案1: 在位年数 × 死因 ----------
BANDS = [(0, 1, "1年未満"), (1, 3, "1〜3年"), (3, 10, "3〜10年"),
         (10, 20, "10〜20年"), (20, 999, "20年以上")]

def band_rows():
    out = []
    for lo, hi, lab in BANDS:
        s = [r for r in rows if r["reign"] is not None and lo <= r["reign"] < hi]
        out.append((lab, s))
    return out

def stacked(segs, fname, title, sub, label_first=True):
    """segs: [(名前, 色, 判定関数)]  上から下へ帯を積む"""
    fig, ax = frame(title, sub)
    data = band_rows()
    ys = list(range(len(data)))[::-1]
    for y, (lab, s) in zip(ys, data):
        n = len(s)
        left = 0.0
        for i, (nm, col, fn) in enumerate(segs):
            w = 100 * sum(1 for r in s if fn(r)) / n
            # 面どうしを 2px の地色で分ける（dataviz: spacer）
            ax.barh(y, w, left=left, height=0.62, color=col,
                    edgecolor="white", linewidth=1.1, zorder=2)
            if label_first and i == 0 and w > 12:
                ax.text(left + w / 2, y, f"{round(w)}%", ha="center", va="center",
                        fontsize=8.6, fontweight="bold", color="white", zorder=3)
            left += w
        ax.text(-2.5, y, lab, ha="right", va="center", fontsize=8.4, color=FG)
        ax.text(-2.5, y - 0.42, f"n={n}", ha="right", va="center", fontsize=6.6, color=MUTED)
    ax.set_xlim(0, 100); ax.set_ylim(-0.7, len(data) - 0.3)
    ax.set_yticks([]); ax.set_xticks([])
    fig.legend(handles=[Patch(facecolor=c, label=nm) for nm, c, _ in segs],
               loc="lower center", bbox_to_anchor=(0.5, 0.005), ncol=len(segs),
               frameon=False, fontsize=7.0, handlelength=0.9, handleheight=0.9,
               columnspacing=1.0, handletextpad=0.4)
    fig.savefig(OUT + fname, facecolor="white")
    plt.close(fig)

stacked([("非業の死", S["red"], lambda r: r["dc"] in V),
         ("病死", S["blue"], lambda r: r["dc"] == "illness"),
         ("不詳・諸説あり・事故死", S["gray"], lambda r: r["dc"] in U or r["dc"] == "accident")],
        "plan1a-reign-death-3seg.png", "在位年数と死因",
        "在位が短いほど非業の死の割合が高い（365名）")

stacked([("暗殺", S["red"], lambda r: r["dc"] == "assassination"),
         ("処刑・戦死・自尽", S["orange"], lambda r: r["dc"] in {"execution", "killed-in-battle", "suicide"}),
         ("病死", S["blue"], lambda r: r["dc"] == "illness"),
         ("不詳系ほか", S["gray"], lambda r: r["dc"] in U or r["dc"] == "accident")],
        "plan1b-reign-death-4seg.png", "在位年数と死因",
        "在位が短いほど非業の死の割合が高い（365名）")

# ---------- 案2: 時代 × 非業率 ----------
fig, ax = frame("時代別の非業の死", "在位中・退位後に暗殺・処刑・戦死・自尽で没した皇帝の割合")
items = []
for eid, lab in ERAS:
    s = [r for r in rows if r["eraId"] == eid]
    if len(s) < 2:
        continue
    items.append((lab, len(s), 100 * sum(1 for r in s if r["dc"] in V) / len(s)))
ys = list(range(len(items)))[::-1]
for y, (lab, n, v) in zip(ys, items):
    ax.barh(y, v, height=0.6, color=S["red"], zorder=2)
    ax.text(v + 1.5, y, f"{round(v)}%", ha="left", va="center", fontsize=7.4,
            color=FG, fontweight="bold")
    ax.text(-1.5, y, f"{lab}", ha="right", va="center", fontsize=7.4, color=FG)
    ax.text(-1.5, y - 0.34, f"n={n}", ha="right", va="center", fontsize=5.8, color=MUTED)
ax.set_xlim(0, 72); ax.set_ylim(-0.7, len(items) - 0.3)
ax.set_yticks([]); ax.set_xticks([])
fig.subplots_adjust(left=0.30, right=0.94, top=0.84, bottom=0.06)
fig.savefig(OUT + "plan2-era-violent.png", facecolor="white")
plt.close(fig)

# ---------- 案4: 改元頻度 × 大赦頻度 ----------
fig, ax = frame("改元と大赦の頻度", "1年あたりの回数・在位2年以上の263名。率どうし r=+0.50／偏相関 r=+0.55")
pts = [(r["era"] / r["reign"], r["amn"] / r["reign"])
       for r in rows if r["reign"] and r["reign"] >= 2]
ax.scatter([p[0] for p in pts], [p[1] for p in pts], s=13,
           facecolor=S["blue"], edgecolor="white", linewidth=0.5, alpha=0.75, zorder=2)
mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
sxx = sum((p[0] - mx) ** 2 for p in pts)
b = sxy / sxx; a = my - b * mx
xs = [0, 1.35]
ax.plot(xs, [a + b * x for x in xs], color=S["red"], linewidth=1.4, zorder=3)
ax.set_xlim(-0.03, 1.35); ax.set_ylim(-0.05, 1.6)
ax.set_xlabel("改元（回/年）", fontsize=7.4, color=MUTED)
ax.set_ylabel("大赦（回/年）", fontsize=7.4, color=MUTED)
ax.tick_params(labelsize=6.6, colors=MUTED, length=0)
ax.grid(True, color=BORDER, linewidth=0.6, zorder=0)
ax.set_axisbelow(True)
fig.subplots_adjust(left=0.15, right=0.96, top=0.84, bottom=0.16)
fig.savefig(OUT + "plan4-scatter-era-amnesty.png", facecolor="white")
plt.close(fig)
print("done")
