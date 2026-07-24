// Tap a personal record -> ranked top-10 list, computed from the local cache:
// distance records use best rolling-window efforts per run (validated against
// Garmin's own PR values), steps records rank days/weeks.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../lib/db/schema";
import { getRuns, getWellnessRange } from "../../lib/db/repo";
import { bestEffortForDistance } from "../../lib/derive/bestEfforts";
import { weekStartOf } from "../../lib/derive/weekly";
import { fmtDuration, fmtPace, isoDate, parseGarminLocal } from "../../lib/format";
import { Card } from "../components/ScreenHeader";

export const RECORD_DISTANCES: Record<number, number> = {
  1: 1000,
  3: 5000,
  4: 10000,
  5: 21097.5,
  6: 42195,
};

interface Row {
  rank: number;
  value: string;
  sub: string;
  date: string;
}

export function RecordDetail({ typeId }: { typeId: number }) {
  const rows = useLiveQuery(async (): Promise<{ rows: Row[]; empty?: string }> => {
    // distance efforts
    if (RECORD_DISTANCES[typeId]) {
      const meters = RECORD_DISTANCES[typeId];
      const runs = await getRuns();
      const efforts: { durS: number; date: Date }[] = [];
      let longest = 0;
      for (const r of runs) {
        const data = await db.activityData.get(r.activityId);
        longest = Math.max(longest, r.distance ?? 0);
        const durS = bestEffortForDistance(data?.series, meters);
        if (durS != null) efforts.push({ durS, date: parseGarminLocal(r.startTimeLocal) });
      }
      if (!efforts.length) {
        return {
          rows: [],
          empty: `No run covers ${(meters / 1000).toFixed(meters % 1000 ? 1 : 0)} km yet. Longest so far: ${(longest / 1000).toFixed(2)} km.`,
        };
      }
      efforts.sort((a, b) => a.durS - b.durS);
      return {
        rows: efforts.slice(0, 10).map((e, i) => ({
          rank: i + 1,
          value: fmtDuration(e.durS),
          sub: `${fmtPace(e.durS / 60 / (meters / 1000))} /km`,
          date: fmtShort(e.date),
        })),
      };
    }

    // longest runs
    if (typeId === 7) {
      const runs = await getRuns();
      const sorted = [...runs].sort((a, b) => (b.distance ?? 0) - (a.distance ?? 0)).slice(0, 10);
      return {
        rows: sorted.map((r, i) => ({
          rank: i + 1,
          value: `${((r.distance ?? 0) / 1000).toFixed(2)} km`,
          sub: fmtDuration(r.duration ?? null),
          date: fmtShort(parseGarminLocal(r.startTimeLocal)),
        })),
      };
    }

    // step days / weeks
    if (typeId === 12 || typeId === 13) {
      const stepRows = await getWellnessRange("steps", "0000-00-00", "9999-99-99");
      const days = stepRows
        .map((r) => ({ date: r.date, steps: (r.payload as { totalSteps?: number })?.totalSteps ?? 0 }))
        .filter((d) => d.steps > 0);
      if (typeId === 12) {
        days.sort((a, b) => b.steps - a.steps);
        return {
          rows: days.slice(0, 10).map((d, i) => ({
            rank: i + 1,
            value: d.steps.toLocaleString("en-GB"),
            sub: "steps",
            date: fmtShort(new Date(d.date + "T00:00:00")),
          })),
        };
      }
      const byWeek = new Map<string, number>();
      for (const d of days) {
        const ws = isoDate(weekStartOf(new Date(d.date + "T00:00:00")));
        byWeek.set(ws, (byWeek.get(ws) ?? 0) + d.steps);
      }
      const weeks = [...byWeek.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      return {
        rows: weeks.map(([ws, steps], i) => ({
          rank: i + 1,
          value: steps.toLocaleString("en-GB"),
          sub: "steps",
          date: `wk of ${fmtShort(new Date(ws + "T00:00:00"))}`,
        })),
      };
    }

    return { rows: [] };
  }, [typeId]);

  if (!rows) return null;

  return (
    <Card
      kicker="Top 10"
      title={rows.rows.length ? "Every effort counts once per run" : undefined}
      footnote={
        RECORD_DISTANCES[typeId]
          ? "Fastest rolling window of this distance inside each run, computed from the GPS series (matches Garmin's PR within ~1 s)."
          : undefined
      }
    >
      {rows.empty ? (
        <p className="py-4 text-center text-[13px] text-ink-3">{rows.empty}</p>
      ) : (
        <table className="tnum w-full text-[14px]">
          <tbody>
            {rows.rows.map((r) => (
              <tr key={r.rank} className="border-t border-hairline first:border-t-0">
                <td className="w-8 py-2.5 text-ink-3">{r.rank}</td>
                <td className="font-semibold">{r.value}</td>
                <td className="text-[12px] text-ink-3">{r.sub}</td>
                <td className="text-right text-[12px] text-ink-3">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
