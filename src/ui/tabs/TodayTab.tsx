import { useCallback, useEffect, useState } from "react";
import { updateWidgetData } from "../../lib/widget";
import { ScreenHeader, Card } from "../components/ScreenHeader";
import { SubScreen } from "../components/SubScreen";
import { WeekStrip } from "../components/WeekStrip";
import { DailyMetricDetail, type DailyMetric } from "../screens/DailyMetricDetail";
import { useBackHandler } from "../../lib/backstack";
import { useScrollMemory } from "../../lib/scrollMemory";
import { ReadinessRing } from "../charts/ReadinessRing";
import { FactorLadder } from "../components/FactorLadder";
import { BodyBatteryToday } from "../charts/BodyBatteryToday";
import {
  toSleepView,
  useFabScore,
  useLatestWellness,
  useRuns,
  useTrainingWeek,
  useWellnessRange,
} from "../../lib/hooks";
import { useSync } from "../../store/syncStore";
import { useUi } from "../../store/uiStore";
import { syncNow } from "../../lib/sync/engine";
import { fmtDay, fmtHoursMin, fmtKm, fmtPace, isoDate, parseGarminLocal, speedToPace } from "../../lib/format";
import { useTabHome } from "../../lib/tabHome";
import { FootprintsIcon, HeartIcon, WavesIcon } from "../components/icons";

type View = "main" | DailyMetric;

const METRIC_TITLES: Record<DailyMetric, string> = {
  steps: "Steps",
  rhr: "Resting heart rate",
  stress: "Stress",
};

export function TodayTab({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { fab } = useFabScore();
  const [view, setView] = useState<View>("main");
  const week = useTrainingWeek(0);

  useBackHandler(
    view !== "main",
    useCallback(() => setView("main"), []),
  );
  useTabHome(useCallback(() => setView("main"), []));
  useScrollMemory(`today:${view}`);

  // keep the home-screen widget's snapshot fresh; same week math as the card
  useEffect(() => {
    if (!fab || fab.score == null || !week) return;
    updateWidgetData(fab, {
      done: week.runs.done,
      planned: week.runs.planned,
      km: week.runs.km,
      caliDone: week.workouts.done,
      caliPlanned: week.workouts.planned,
    });
  }, [fab, week]);

  if (view !== "main") {
    return (
      <SubScreen title={METRIC_TITLES[view]} onBack={() => setView("main")}>
        <DailyMetricDetail metric={view} />
      </SubScreen>
    );
  }

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

      <SyncErrorBanner />

      <Card kicker="Should I train?">
        {fab && fab.score != null ? (
          <>
            <ReadinessRing fab={fab} />
            <FactorLadder fab={fab} />
          </>
        ) : (
          <p className="py-6 text-center text-[14px] text-ink-3">
            Readiness needs sleep + HRV data. Connect and sync in Settings.
          </p>
        )}
      </Card>

      <WeekStrip />
      <BodyBatteryToday />
      <LastNightMini />
      <DayChips onOpen={setView} />
      <LastRunMini />
    </div>
  );
}

function SyncErrorBanner() {
  const phase = useSync((s) => s.phase);
  const lastError = useSync((s) => s.lastError);
  if (phase !== "error" || !lastError) return null;
  return (
    <div className="mx-4 mb-3 flex items-center gap-3 rounded-2xl border border-status-warn/40 bg-card p-3">
      <span className="text-status-warn" aria-hidden>
        ⚠
      </span>
      <p className="flex-1 text-[12px] leading-snug text-ink-2">{lastError}</p>
      <button onClick={() => syncNow()} className="shrink-0 rounded-lg bg-page px-3 py-1.5 text-[12px] text-ink-2">
        Retry
      </button>
    </div>
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
      onClick={() => useUi.getState().setTab("sleep")}
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

function DayChips({ onOpen }: { onOpen: (m: DailyMetric) => void }) {
  const stepsRows = useWellnessRange("steps", 1);
  const rhrRows = useWellnessRange("rhr", 1);
  const stressRow = useLatestWellness("stress");

  const today = isoDate(new Date());
  const steps = stepsRows?.find((r) => r.date === today)?.payload as { totalSteps?: number } | undefined;
  const rhr = rhrRows?.find((r) => r.date === today)?.payload as { value?: number } | undefined;
  const stress =
    stressRow?.date === today ? (stressRow.payload as { avgStressLevel?: number }) : undefined;

  const chips = [
    steps?.totalSteps != null && {
      metric: "steps" as const,
      label: "steps",
      value: steps.totalSteps.toLocaleString("en-GB"),
      icon: <FootprintsIcon />,
      cls: "text-[var(--accent)]",
    },
    rhr?.value != null && {
      metric: "rhr" as const,
      label: "resting HR",
      value: `${rhr.value} bpm`,
      icon: <HeartIcon />,
      cls: "text-[var(--hr)]",
    },
    stress?.avgStressLevel != null && {
      metric: "stress" as const,
      label: "avg stress",
      value: String(stress.avgStressLevel),
      icon: <WavesIcon />,
      cls: "text-[var(--recency-hi)]",
    },
  ].filter(Boolean) as { metric: DailyMetric; label: string; value: string; icon: React.ReactNode; cls: string }[];

  if (!chips.length) return null;
  return (
    <div className="mx-4 mb-3 flex gap-2">
      {chips.map((c) => (
        <button key={c.label} onClick={() => onOpen(c.metric)} className="flex-1 rounded-2xl bg-card px-3 py-2.5 text-left active:opacity-70">
          <div className="flex items-center gap-1.5">
            <span className={c.cls}>{c.icon}</span>
            <span className="tnum text-[16px] font-semibold">{c.value}</span>
          </div>
          <div className="kicker mt-0.5">{c.label}</div>
        </button>
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
      title={`${fmtDay(d)} · ${r.activityName ?? "Run"}`}
      value={`${fmtKm(r.distance)} km`}
      footnote={`${fmtPace(pace)} /km · ${r.averageHR != null ? Math.round(r.averageHR) : "–"} bpm`}
      onClick={() => useUi.getState().openRun(r.activityId)}
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
