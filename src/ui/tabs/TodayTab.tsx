import { ScreenHeader, Card } from "../components/ScreenHeader";
import { ReadinessRing } from "../charts/ReadinessRing";
import { FactorLadder } from "../components/FactorLadder";
import { BodyBatteryToday } from "../charts/BodyBatteryToday";
import {
  toSleepView,
  useFabScore,
  useLatestWellness,
  useRuns,
  useWellnessRange,
} from "../../lib/hooks";
import { useSettings } from "../../store/settingsStore";
import { fmtDay, fmtHoursMin, fmtKm, fmtPace, isoDate, parseGarminLocal, speedToPace } from "../../lib/format";
import { weekStartOf } from "../../lib/derive/weekly";

export function TodayTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { fab } = useFabScore();

  return (
    <div className="pb-4">
      <ScreenHeader
        title="Today"
        right={
          <button aria-label="Settings" className="p-2 text-ink-3" onClick={onOpenSettings}>
            <GearIcon />
          </button>
        }
      />

      <Card kicker="Should I train?">
        {fab && fab.score != null ? (
          <>
            <ReadinessRing fab={fab} />
            <FactorLadder fab={fab} />
          </>
        ) : (
          <p className="py-6 text-center text-[14px] text-ink-3">
            Readiness needs sleep + HRV data — connect and sync in Settings.
          </p>
        )}
      </Card>

      <WeekPlanCard />
      <BodyBatteryToday />
      <LastNightMini />
      <DayChips />
      <LastRunMini />
    </div>
  );
}

function WeekPlanCard() {
  const runs = useRuns();
  const plan = useSettings((s) => s.plan);
  if (!runs) return null;

  const now = new Date();
  const weekStart = weekStartOf(now);
  const thisWeek = runs.filter((r) => parseGarminLocal(r.startTimeLocal) >= weekStart);
  const km = thisWeek.reduce((s, r) => s + (r.distance ?? 0) / 1000, 0);
  const done = thisWeek.length;

  const lastRun = runs.length ? parseGarminLocal(runs[0].startTimeLocal) : null;
  const daysSince = lastRun ? Math.floor((now.getTime() - lastRun.getTime()) / 86400000) : 99;
  const suggestion =
    done >= plan.runsPerWeek
      ? "Week's plan complete — bonus runs are optional."
      : daysSince < 1
        ? "Ran today — rest tomorrow, next slot after."
        : "A run slot is open — today works.";

  return (
    <Card kicker="This week" title={`Runs ${done}/${plan.runsPerWeek}`} value={`${km.toFixed(1)} km`} footnote={suggestion}>
      <div className="mt-1 flex gap-2">
        {Array.from({ length: Math.max(plan.runsPerWeek, done) }, (_, i) => (
          <div
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i < done ? "bg-accent" : "bg-grid"}`}
            aria-label={i < done ? "run done" : "run pending"}
          />
        ))}
      </div>
    </Card>
  );
}

function LastNightMini() {
  const sleep = toSleepView(useLatestWellness("sleep"));
  if (!sleep) return null;

  const totalMin = (sleep.sleepSeconds ?? 0) / 60;
  const stages = [
    { key: "deep", s: sleep.deepS, cls: "bg-[var(--sleep-deep)]" },
    { key: "light", s: sleep.lightS, cls: "bg-[var(--sleep-light)]" },
    { key: "rem", s: sleep.remS, cls: "bg-[var(--sleep-rem)]" },
    { key: "awake", s: sleep.awakeS, cls: "bg-[var(--sleep-awake)]" },
  ];
  const totalS = stages.reduce((a, b) => a + b.s, 0) || 1;

  return (
    <Card
      kicker="Last night"
      title={sleep.qualifier ? sleep.qualifier.toLowerCase() : "Sleep"}
      value={sleep.score != null ? String(sleep.score) : undefined}
      footnote={`${fmtHoursMin(totalMin)} asleep · HRV ${sleep.avgOvernightHrv ?? "–"} ms · RHR ${sleep.restingHeartRate ?? "–"} bpm`}
    >
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
        {stages.map((st) => (
          <div key={st.key} className={st.cls} style={{ width: `${(st.s / totalS) * 100}%` }} />
        ))}
      </div>
      <div className="mt-1.5 flex gap-3 text-[11px] text-ink-3">
        <span>■ deep {Math.round(sleep.deepS / 60)}m</span>
        <span>light {Math.round(sleep.lightS / 60)}m</span>
        <span>REM {Math.round(sleep.remS / 60)}m</span>
        <span>awake {Math.round(sleep.awakeS / 60)}m</span>
      </div>
    </Card>
  );
}

function DayChips() {
  const stepsRows = useWellnessRange("steps", 1);
  const rhrRows = useWellnessRange("rhr", 1);
  const stressRow = useLatestWellness("stress");

  const today = isoDate(new Date());
  const steps = stepsRows?.find((r) => r.date === today)?.payload as { totalSteps?: number } | undefined;
  const rhr = rhrRows?.find((r) => r.date === today)?.payload as { value?: number } | undefined;
  const stress =
    stressRow?.date === today ? (stressRow.payload as { avgStressLevel?: number }) : undefined;

  const chips = [
    steps?.totalSteps != null && { label: "steps", value: steps.totalSteps.toLocaleString("en-GB") },
    rhr?.value != null && { label: "resting HR", value: `${rhr.value} bpm` },
    stress?.avgStressLevel != null && { label: "avg stress", value: String(stress.avgStressLevel) },
  ].filter(Boolean) as { label: string; value: string }[];

  if (!chips.length) return null;
  return (
    <div className="mx-4 mb-3 flex gap-2">
      {chips.map((c) => (
        <div key={c.label} className="flex-1 rounded-2xl bg-card px-3 py-2.5">
          <div className="tnum text-[16px] font-semibold">{c.value}</div>
          <div className="kicker mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function LastRunMini() {
  const runs = useRuns();
  if (!runs?.length) return null;
  const r = runs[0];
  const d = parseGarminLocal(r.startTimeLocal);
  const pace = speedToPace(r.averageSpeed);
  return (
    <Card
      kicker="Last run"
      title={`${fmtDay(d)} — ${r.activityName ?? "Run"}`}
      footnote={`${fmtKm(r.distance)} km · ${fmtPace(pace)} /km · ${r.averageHR != null ? Math.round(r.averageHR) : "–"} bpm`}
    />
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.09a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
    </svg>
  );
}
