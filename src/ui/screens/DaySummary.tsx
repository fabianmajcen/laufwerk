// One day, everything: sleep, runs, steps, vitals, battery. Opened from the
// training-calendar cells.
import { useLiveQuery } from "dexie-react-hooks";
import { getRuns, getWellnessDay } from "../../lib/db/repo";
import { toHrvView, toSleepView } from "../../lib/hooks";
import { fmtDay, fmtDuration, fmtHoursMin, fmtKm, fmtPace, isoDate, parseGarminLocal, speedToPace } from "../../lib/format";
import { useUi } from "../../store/uiStore";
import { Card } from "../components/ScreenHeader";
import type { ActivityRow } from "../../lib/db/schema";

export function DaySummary({ date }: { date: string }) {
  const data = useLiveQuery(async () => {
    const [sleepRow, hrvRow, stressRow, stepsRow, rhrRow, bbRow, runs] = await Promise.all([
      getWellnessDay("sleep", date),
      getWellnessDay("hrv", date),
      getWellnessDay("stress", date),
      getWellnessDay("steps", date),
      getWellnessDay("rhr", date),
      getWellnessDay("bodyBattery", date),
      getRuns(),
    ]);
    return {
      sleep: toSleepView(sleepRow),
      hrv: toHrvView(hrvRow),
      stress: (stressRow?.payload as { avgStressLevel?: number } | null)?.avgStressLevel ?? null,
      steps: (stepsRow?.payload as { totalSteps?: number } | null)?.totalSteps ?? null,
      rhr: (rhrRow?.payload as { value?: number } | null)?.value ?? null,
      battery: (bbRow?.payload as { charged?: number; drained?: number } | null) ?? null,
      dayRuns: runs.filter((r) => isoDate(parseGarminLocal(r.startTimeLocal)) === date),
    };
  }, [date]);

  if (!data) return null;
  const { sleep, hrv, stress, steps, rhr, battery, dayRuns } = data;
  const hasAnything =
    sleep != null || steps != null || rhr != null || stress != null || dayRuns.length > 0;

  return (
    <>
      {!hasAnything && (
        <Card kicker="Day" title="No data cached for this day">
          <p className="text-[13px] text-ink-3">This date may be outside your sync window.</p>
        </Card>
      )}

      {dayRuns.map((r) => (
        <RunRow key={r.activityId} run={r} />
      ))}

      {sleep && (
        <Card
          kicker="Sleep"
          title={sleep.qualifier ? sleep.qualifier.toLowerCase() : "Night"}
          value={sleep.score != null ? String(sleep.score) : undefined}
          footnote={`${fmtHoursMin((sleep.sleepSeconds ?? 0) / 60)} asleep · deep ${Math.round(sleep.deepS / 60)}m · REM ${Math.round(sleep.remS / 60)}m${sleep.avgOvernightHrv != null ? ` · HRV ${sleep.avgOvernightHrv} ms` : ""}`}
        />
      )}

      <Card kicker="Day stats" title={new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}>
        <div className="grid grid-cols-3 gap-3">
          <Tile label="steps" value={steps != null ? steps.toLocaleString("en-GB") : "-"} />
          <Tile label="resting HR" value={rhr != null ? `${rhr}` : "-"} unit={rhr != null ? "bpm" : ""} />
          <Tile label="avg stress" value={stress != null && stress >= 0 ? String(stress) : "-"} />
          <Tile label="HRV" value={hrv?.lastNight != null ? String(hrv.lastNight) : "-"} unit={hrv?.lastNight != null ? "ms" : ""} />
          <Tile label="charged" value={battery?.charged != null ? `+${battery.charged}` : "-"} />
          <Tile label="drained" value={battery?.drained != null ? `-${battery.drained}` : "-"} />
        </div>
      </Card>
    </>
  );
}

function RunRow({ run }: { run: ActivityRow }) {
  const d = parseGarminLocal(run.startTimeLocal);
  const pace = speedToPace(run.averageSpeed);
  return (
    <Card
      kicker="Run"
      title={`${fmtDay(d)} · ${run.activityName ?? "Run"}`}
      footnote={`${fmtKm(run.distance)} km · ${fmtPace(pace)} /km · ${fmtDuration(run.duration)} · ${run.averageHR != null ? Math.round(run.averageHR) : "-"} bpm. Tap for full details.`}
      onClick={() => useUi.getState().openRun(run.activityId)}
    />
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-page p-3">
      <div className="tnum flex items-baseline gap-1">
        <span className="text-[17px] font-semibold">{value}</span>
        {unit && <span className="text-[11px] text-ink-3">{unit}</span>}
      </div>
      <div className="kicker mt-0.5">{label}</div>
    </div>
  );
}
