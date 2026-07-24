// Does sleep predict readiness? Sleep score (night) vs the FabScore computed
// retroactively for that morning from cached data. Unlocks at 21 paired
// nights so the correlation isn't noise theater.
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { EChart } from "./EChart";
import { tokens, tooltipDefaults, xAxisDefaults, yAxisDefaults } from "./theme";
import { getRuns, getWellnessRange } from "../../lib/db/repo";
import { toBodyBatteryView, toHrvView, toSleepView } from "../../lib/hooks";
import { computeAcwr } from "../../lib/derive/acwr";
import { computeFabScore } from "../../lib/derive/fabScore";
import { linearFit } from "../../lib/derive/series";
import { parseGarminLocal } from "../../lib/format";
import { Card } from "../components/ScreenHeader";
import { useSettings } from "../../store/settingsStore";

const UNLOCK_N = 21;

interface Pair {
  date: string;
  sleepScore: number;
  fabScore: number;
}

export function SleepReadinessScatter() {
  const theme = useSettings((s) => s.theme);

  const pairs = useLiveQuery(async (): Promise<Pair[]> => {
    const [sleepRows, hrvRows, bbRows, rhrRows, runs] = await Promise.all([
      getWellnessRange("sleep", "0000-00-00", "9999-99-99"),
      getWellnessRange("hrv", "0000-00-00", "9999-99-99"),
      getWellnessRange("rhr", "0000-00-00", "9999-99-99"),
      getWellnessRange("bodyBattery", "0000-00-00", "9999-99-99"),
      getRuns(),
    ]).then(([s, h, r, b, rn]) => [s, h, b, r, rn] as const);

    const hrvByDate = new Map(hrvRows.map((r) => [r.date, toHrvView(r)]));
    const bbByDate = new Map(bbRows.map((r) => [r.date, toBodyBatteryView(r)]));
    const rhrByDate = new Map(
      rhrRows.map((r) => [r.date, (r.payload as { value?: number })?.value ?? null]),
    );
    const runList = runs.map((r) => ({
      date: parseGarminLocal(r.startTimeLocal),
      distanceKm: (r.distance ?? 0) / 1000,
    }));

    const out: Pair[] = [];
    for (const row of sleepRows) {
      const sleep = toSleepView(row);
      if (!sleep?.score) continue;
      const day = new Date(row.date + "T08:00:00"); // "that morning"
      const hrv = hrvByDate.get(row.date) ?? null;
      const bb = bbByDate.get(row.date) ?? null;

      const before = runList.filter((r) => r.date < day);
      const lastRun = before.length ? before.reduce((a, b) => (b.date > a.date ? b : a)) : null;
      const daysSince = lastRun
        ? Math.floor((day.getTime() - lastRun.date.getTime()) / 86400000)
        : null;

      // trailing 7-day rhr average before this date
      const trailing = [...rhrByDate.entries()]
        .filter(([d, v]) => v != null && d < row.date)
        .slice(-7)
        .map(([, v]) => v as number);

      const fab = computeFabScore({
        sleepScore: sleep.score,
        sleepSeconds: sleep.sleepSeconds,
        hrvLastNight: hrv?.lastNight ?? null,
        hrvBaselineLow: hrv?.baselineLow ?? null,
        hrvStatus: hrv?.status ?? null,
        bodyBattery: bb?.peak ?? null,
        daysSinceLastRun: daysSince,
        acwr: computeAcwr(runList, day).ratio,
        rhrToday: rhrByDate.get(row.date) ?? null,
        rhr7dAvg: trailing.length ? trailing.reduce((a, b) => a + b, 0) / trailing.length : null,
      });
      if (fab.score != null) out.push({ date: row.date, sleepScore: sleep.score, fabScore: fab.score });
    }
    return out;
  }, []);

  const option = useMemo(() => {
    if (!pairs || pairs.length < UNLOCK_N) return null;
    const t = tokens();
    const fit = linearFit(pairs.map((p) => p.sleepScore), pairs.map((p) => p.fabScore));
    const lo = Math.min(...pairs.map((p) => p.sleepScore)) - 3;
    const hi = Math.max(...pairs.map((p) => p.sleepScore)) + 3;

    return {
      grid: { left: 34, right: 14, top: 14, bottom: 30 },
      tooltip: {
        ...tooltipDefaults(t),
        formatter: (p: { dataIndex: number }) => {
          const pt = pairs[p.dataIndex];
          return `<b>${new Date(pt.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><br/>sleep ${pt.sleepScore} → readiness ${pt.fabScore}`;
        },
      },
      xAxis: {
        type: "value",
        min: lo,
        max: hi,
        name: "sleep score",
        nameLocation: "middle",
        nameGap: 22,
        nameTextStyle: { color: t.ink3, fontSize: 11 },
        ...xAxisDefaults(t),
        splitLine: { show: false },
      },
      yAxis: { type: "value", scale: true, ...yAxisDefaults(t) },
      series: [
        {
          type: "scatter",
          data: pairs.map((p) => [p.sleepScore, p.fabScore]),
          symbolSize: 11,
          itemStyle: { color: t.accent, opacity: 0.75, borderColor: t.card, borderWidth: 1.5 },
        },
        ...(fit
          ? [
              {
                type: "line",
                data: [
                  [lo, fit[0] * lo + fit[1]],
                  [hi, fit[0] * hi + fit[1]],
                ],
                showSymbol: false,
                silent: true,
                lineStyle: { color: t.ink3, width: 1, type: "dashed" },
              },
            ]
          : []),
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, theme]);

  if (!pairs) return null;

  if (pairs.length < UNLOCK_N) {
    return (
      <Card kicker="Correlation" title="Sleep → readiness">
        <p className="py-4 text-center text-[13px] text-ink-3">
          Unlocks at {UNLOCK_N} nights — {pairs.length}/{UNLOCK_N} collected. One new night per day.
        </p>
        <div className="mx-auto h-1.5 w-2/3 overflow-hidden rounded-full bg-grid">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(pairs.length / UNLOCK_N) * 100}%` }} />
        </div>
      </Card>
    );
  }

  return (
    <Card
      kicker="Correlation"
      title="Sleep → readiness"
      footnote="Each dot is one morning: last night's sleep score vs that day's FabScore. Dashed = trend. Readiness also depends on HRV, load and freshness — expect scatter."
    >
      <EChart option={option!} height={210} />
    </Card>
  );
}
