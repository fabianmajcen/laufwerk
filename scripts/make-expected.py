"""Generates expected.json for validating the TS formula ports against the
original python implementations in ../generate_plots.py (same 8 runs)."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
GARMIN_DIR = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, GARMIN_DIR)

import generate_plots as gp  # noqa: E402

runs = gp.load_run_details()
ddf = gp.compute_decoupling(runs)

decoupling = {}
for r, (_, row) in zip(runs, ddf.iterrows()):
    aid = r["act"]["activityId"]
    val = row["decoupling_pct"]
    decoupling[str(aid)] = None if val != val else float(val)  # NaN -> None

# distance-weighted lap averages — same logic as plot_running_form_trend()
form = {}
for r in runs:
    laps = [l for l in r["splits"].get("lapDTOs", []) if (l.get("distance") or 0) > 200]
    aid = str(r["act"]["activityId"])

    def wavg(key):
        vals = [(l.get(key), l.get("distance")) for l in laps if l.get(key) is not None]
        return (sum(v * w for v, w in vals) / sum(w for _, w in vals)) if vals else None

    form[aid] = {
        "cadenceSpm": wavg("averageRunCadence"),
        "strideLengthCm": wavg("strideLength"),
        "verticalOscCm": wavg("verticalOscillation"),
        "groundContactMs": wavg("groundContactTime"),
    }

# weekly volume — same grouping as plot_weekly_volume()
import pandas as pd  # noqa: E402

df = gp.load_summary()
d = df.copy()
d["week_start"] = (d["date"] - pd.to_timedelta(d["date"].dt.dayofweek, unit="D")).dt.normalize()
weekly = d.groupby("week_start")["distance_km"].sum()
full_range = pd.date_range(weekly.index.min(), weekly.index.max(), freq="7D")
weekly = weekly.reindex(full_range, fill_value=0).reset_index()
weekly.columns = ["week_start", "distance_km"]
weekly["cumulative"] = weekly["distance_km"].cumsum()
weekly_out = [
    {
        "weekStart": row.week_start.strftime("%Y-%m-%d"),
        "distanceKm": float(row.distance_km),
        "cumulativeKm": float(row.cumulative),
    }
    for row in weekly.itertuples()
]

out = {"decoupling": decoupling, "form": form, "weekly": weekly_out}
out_path = os.path.join(HERE, "expected.json")
with open(out_path, "w") as f:
    json.dump(out, f, indent=1)
print(f"wrote {out_path}")
print(json.dumps(out["decoupling"], indent=1))
