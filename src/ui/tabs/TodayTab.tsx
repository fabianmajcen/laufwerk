import { useCallback, useEffect, useState } from "react";
import { updateWidgetData } from "../../lib/widget";
import { ScreenHeader, Card } from "../components/ScreenHeader";
import { SubScreen } from "../components/SubScreen";
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
import { useSettings } from "../../store/settingsStore";
import { useSync } from "../../store/syncStore";
import { useUi } from "../../store/uiStore";
import { syncNow } from "../../lib/sync/engine";
import { fmtDay, fmtHoursMin, fmtKm, fmtPace, isoDate, parseGarminLocal, speedToPace } from "../../lib/format";
import { weekStartOf } from "../../lib/derive/weekly";
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

      <WeekPlanCard />
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

function WeekPlanCard() {
  const runs = useRuns();
  const plan = useSettings((s) => s.plan);
  const [weeksBack, setWeeksBack] = useState(0);
  const week = useTrainingWeek(weeksBack);
  if (!runs || !week) return null;

  const now = new Date();
  const currentWeekStart = weekStartOf(now);
  const weekStart = week.weekStart;
  const km = week.runs.km;
  const done = week.runs.done;
  const wDone = week.workouts.done;
  const wGoal = week.workouts.planned;
  const wFloor = week.workouts.floor;

  // browse back to the week of the oldest run
  const oldest = runs.length ? weekStartOf(parseGarminLocal(runs[runs.length - 1].startTimeLocal)) : currentWeekStart;
  const canGoBack = weekStart > oldest;

  const lastRun = runs.length ? parseGarminLocal(runs[0].startTimeLocal) : null;
  // calendar days, not elapsed hours: a run yesterday evening is 1 day ago
  // this morning even if fewer than 24h have passed
  const daysSince = lastRun
    ? Math.floor(
        (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
          new Date(lastRun.getFullYear(), lastRun.getMonth(), lastRun.getDate()).getTime()) /
          86400000,
      )
    : 99;
  const footnote =
    weeksBack === 0
      ? done >= plan.runsPerWeek
        ? "Week's plan complete. Bonus runs are optional."
        : daysSince < 1
          ? "Ran today. Rest tomorrow, next slot after."
          : daysSince === 1
            ? "Ran yesterday. Rest today; tomorrow works."
            : "A run slot is open. Today works."
      : done >= plan.runsPerWeek
        ? "Plan met."
        : `${plan.runsPerWeek - done} short of plan.`;

  const weekLabel =
    weeksBack === 0
      ? "This week"
      : `Week of ${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  // what is actually planned and still open, so the plan is visible where the
  // progress is rather than only inside the planner
  const todayIso = isoDate(now);
  const openWorkoutSlots = week.days
    .filter((d) => d.date >= todayIso)
    .flatMap((d) => d.slots.filter((s) => s.kind === "workout" && !s.fulfilled).map((s) => ({ ...s, date: d.date })));
  const nextSlot = openWorkoutSlots[0];
  const upcoming =
    weeksBack !== 0 || !nextSlot
      ? null
      : nextSlot.date === todayIso
        ? `Day ${nextSlot.planId ?? "?"} planned for today.`
        : `Day ${nextSlot.planId ?? "?"} planned for ${new Date(nextSlot.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" })}.`;

  return (
    // one card, because the week pager governs both, but each discipline gets
    // its own labelled block with a hairline between: stacking two bare pill
    // rows between the arrows left it ambiguous which label owned which row
    <Card kicker="Week">
      <div className="mb-3 flex items-center justify-between">
        <WeekBtn dir="prev" onClick={canGoBack ? () => setWeeksBack(weeksBack + 1) : undefined} />
        <span className="text-[14px] font-medium">{weekLabel}</span>
        <WeekBtn dir="next" onClick={weeksBack > 0 ? () => setWeeksBack(weeksBack - 1) : undefined} />
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium text-ink-2">
          Runs {done}/{plan.runsPerWeek}
        </span>
        <span className="tnum text-[17px] font-semibold">{km.toFixed(1)} km</span>
      </div>
      <div className="mt-2 flex gap-2">
        {Array.from({ length: Math.max(plan.runsPerWeek, done) }, (_, i) => (
          <div
            key={i}
            className={`h-2.5 flex-1 rounded-full ${i < done ? "bg-accent" : "bg-grid"}`}
            aria-label={i < done ? "run done" : "run pending"}
          />
        ))}
      </div>
      {/* the hint is about running, so it lives in the runs block rather than
          floating at the bottom of the card under the workout pills */}
      <p className="mt-2 text-[12px] text-ink-3">{footnote}</p>

      <div className="my-3 border-t border-hairline" />

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium text-ink-2">
          Workouts {wDone}/{wGoal}
        </span>
        {week.workouts.letters.length > 0 && (
          <span className="tnum text-[13px] text-ink-3">{week.workouts.letters.join(" · ")}</span>
        )}
      </div>
      {upcoming && <p className="mt-1 text-[12px] text-ink-3">{upcoming}</p>}
      <div className="mt-2 flex gap-2">
        {/* the third slot is dashed as a bonus, so a two-workout week reads as
            on track rather than failed */}
        {Array.from({ length: Math.max(wGoal, wDone) }, (_, i) => {
          const filled = i < wDone;
          const bonus = i >= wFloor;
          return (
            <div
              key={i}
              aria-label={filled ? "workout done" : bonus ? "bonus workout slot" : "workout pending"}
              className={`h-2.5 flex-1 rounded-full ${
                filled ? "bg-[var(--recency-hi)]" : bonus ? "border border-dashed border-hairline" : "bg-grid"
              }`}
            />
          );
        })}
      </div>
    </Card>
  );
}

function WeekBtn({ dir, onClick }: { dir: "prev" | "next"; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      aria-label={dir === "prev" ? "previous week" : "next week"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-page text-ink-2 disabled:opacity-25"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M14.5 6l-6 6 6 6" /> : <path d="M9.5 6l6 6-6 6" />}
      </svg>
    </button>
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
