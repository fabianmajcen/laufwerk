// Does running change how you sleep? Nights after run days vs rest days —
// stat rows, not a chart: with ~2 runs/week the honest presentation is
// paired averages with visible sample sizes.
import { useMemo } from "react";
import { toSleepView, useRuns, useWellnessRange } from "../../lib/hooks";
import { compareRunVsRestSleep } from "../../lib/derive/sleepStats";
import { isoDate, parseGarminLocal } from "../../lib/format";
import { Card } from "../components/ScreenHeader";

export function RunVsRestSleep() {
  const rows = useWellnessRange("sleep", 60);
  const runs = useRuns();

  const comparison = useMemo(() => {
    const nights = (rows ?? []).map(toSleepView).filter((v): v is NonNullable<typeof v> => v != null);
    const runDates = new Set((runs ?? []).map((r) => isoDate(parseGarminLocal(r.startTimeLocal))));
    return compareRunVsRestSleep(nights, runDates);
  }, [rows, runs]);

  const nRun = comparison[0]?.nRun ?? 0;
  const nRest = comparison[0]?.nRest ?? 0;
  if (nRun < 2 || nRest < 2) {
    return (
      <Card kicker="Sleep × training" title="Run nights vs rest nights">
        <p className="py-4 text-center text-[13px] text-ink-3">
          Collecting data — needs at least 2 nights of each ({nRun} run · {nRest} rest so far). Keep syncing.
        </p>
      </Card>
    );
  }

  return (
    <Card
      kicker="Sleep × training"
      title="Nights after running vs rest"
      footnote={`Averages over ${nRun} post-run and ${nRest} rest nights. Small samples — read direction, not decimals.`}
    >
      <table className="tnum w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
            <th className="py-1 font-medium">metric</th>
            <th className="text-right font-medium">after run</th>
            <th className="text-right font-medium">after rest</th>
            <th className="w-14 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {comparison.map((c) => {
            const delta = c.afterRun != null && c.afterRest != null ? c.afterRun - c.afterRest : null;
            return (
              <tr key={c.metric} className="border-t border-hairline">
                <td className="py-2 text-ink-2">{c.metric}</td>
                <td className="text-right">
                  {c.afterRun != null ? `${c.afterRun.toFixed(c.unit === "min" ? 0 : 1)}${c.unit ? " " + c.unit : ""}` : "–"}
                </td>
                <td className="text-right">
                  {c.afterRest != null ? `${c.afterRest.toFixed(c.unit === "min" ? 0 : 1)}${c.unit ? " " + c.unit : ""}` : "–"}
                </td>
                <td className={`text-right ${delta == null ? "text-ink-3" : delta >= 0 ? "text-status-good" : "text-status-warn"}`}>
                  {delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
