"""Expected segment stats from the original python implementation."""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "..", "..")))

import generate_plots as gp  # noqa: E402

runs = gp.load_run_details()
cluster = gp.find_segment_cluster(runs)
if cluster is None:
    print("no cluster found")
    sys.exit(1)

stats, seg = gp.compute_segment_stats(cluster)
ref, seg_end_idx, seg_len_m = seg

by_date = {r["date"]: r["act"]["activityId"] for r in runs}
out = {
    "clusterSize": len(cluster),
    "segLenM": float(seg_len_m),
    "stats": [
        {
            "activityId": by_date[row.date],
            "durS": float(row.dur_s),
            "avgHr": None if row.avg_hr != row.avg_hr else float(row.avg_hr),
            "pace": None if row.pace != row.pace else float(row.pace),
        }
        for row in stats.itertuples()
    ],
}
path = os.path.join(HERE, "expected-segments.json")
with open(path, "w") as f:
    json.dump(out, f, indent=1)
print(json.dumps(out, indent=1))
