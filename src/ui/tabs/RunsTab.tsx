import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAllRuns, useDecouplingSeries } from "../../lib/hooks";
import { useUi } from "../../store/uiStore";
import { useBackHandler } from "../../lib/backstack";
import { useScrollMemory } from "../../lib/scrollMemory";
import { useTabHome } from "../../lib/tabHome";
import { getKv } from "../../lib/db/repo";
import { fmtDay, fmtDuration, fmtKm, fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { weekStartOf } from "../../lib/derive/weekly";
import { RecordsShelf } from "../charts/RecordsShelf";
import { RecordDetail } from "../screens/RecordDetail";
import { ScreenHeader, EmptyState, Card } from "../components/ScreenHeader";
import { SubScreen } from "../components/SubScreen";
import { RunDetail } from "../screens/RunDetail";
import { EfficiencyMap } from "../charts/EfficiencyMap";
import { DecouplingBars } from "../charts/DecouplingBars";
import { WeeklyVolume } from "../charts/WeeklyVolume";
import { Constellation } from "../charts/Constellation";
import { PacingChart } from "../charts/PacingChart";
import { FormGrid } from "../charts/FormGrid";
import { ZoneDiscipline } from "../charts/ZoneDiscipline";
import { RunShape } from "../charts/RunShape";
import { WeatherLens } from "../charts/WeatherLens";
import { RouteExplorer } from "../charts/RouteExplorer";
import { FORM_META } from "../charts/FormGrid";
import { FormDetail } from "../screens/FormDetail";
import { BarsIcon, PulseIcon, RouteIcon, StrideIcon, TrophyIcon } from "../components/icons";
import type { FormMetrics } from "../../lib/derive/form";
import type { ActivityRow } from "../../lib/db/schema";

type View =
  | "main"
  | "fitness"
  | "volume"
  | "routes"
  | "technique"
  | "records"
  | { record: number; label: string }
  | { form: keyof FormMetrics }
  | { week: string };

export function RunsTab() {
  // the list shows everything (so an excluded run stays findable); the
  // analytics hub and every chart below see only the runs that count
  const allRuns = useAllRuns();
  const runs = useMemo(() => allRuns?.filter((r) => !r.excluded), [allRuns]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [view, setView] = useState<View>("main");

  // cross-tab deep link (e.g. "last run" card on Today)
  const pendingRunId = useUi((s) => s.pendingRunId);
  useEffect(() => {
    if (pendingRunId != null) {
      setOpenId(pendingRunId);
      useUi.getState().consumePendingRun();
    }
  }, [pendingRunId]);

  // android back: close the run first, then leave the sub-screen
  useBackHandler(
    view !== "main" && openId == null,
    useCallback(
      () =>
        setView(
          typeof view === "object"
            ? "record" in view
              ? "records"
              : "week" in view
                ? "volume"
                : "technique"
            : "main",
        ),
      [view],
    ),
  );
  useBackHandler(
    openId != null,
    useCallback(() => setOpenId(null), []),
  );
  useTabHome(
    useCallback(() => {
      setOpenId(null);
      setView("main");
    }, []),
  );

  useScrollMemory(
    `runs:${
      openId != null
        ? `run${openId}`
        : typeof view === "string"
          ? view
          : "record" in view
            ? `rec${view.record}`
            : "week" in view
              ? `week${view.week}`
              : `form${view.form}`
    }`,
  );

  // allRuns, not runs: an excluded run must stay openable to un-exclude it
  const open = openId != null ? allRuns?.find((r) => r.activityId === openId) : undefined;
  if (open) return <RunDetail run={open} onBack={() => setOpenId(null)} />;

  if (view === "fitness") {
    return (
      <SubScreen title="Fitness" onBack={() => setView("main")}>
        <EfficiencyMap onOpenRun={setOpenId} />
        <DecouplingBars onOpenRun={setOpenId} />
        <RunShape />
        <WeatherLens onOpenRun={setOpenId} />
      </SubScreen>
    );
  }
  if (view === "volume") {
    return (
      <SubScreen title="Volume & plan" onBack={() => setView("main")}>
        <WeeklyVolume onOpenWeek={(week) => setView({ week })} />
      </SubScreen>
    );
  }
  if (typeof view === "object" && "week" in view) {
    const weekStart = new Date(view.week + "T00:00:00");
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekRuns = (runs ?? []).filter((r) => {
      const d = parseGarminLocal(r.startTimeLocal);
      return d >= weekStart && d < weekEnd;
    });
    const weekKm = weekRuns.reduce((s, r) => s + (r.distance ?? 0) / 1000, 0);
    return (
      <SubScreen
        title={`Week of ${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
        onBack={() => setView("volume")}
      >
        <Card kicker="Week" title={`${weekRuns.length} run${weekRuns.length === 1 ? "" : "s"}`} value={`${weekKm.toFixed(1)} km`} />
        {weekRuns.length ? (
          weekRuns.map((r) => <RunCard key={r.activityId} run={r} onOpen={() => setOpenId(r.activityId)} />)
        ) : (
          <EmptyState text="No runs this week." />
        )}
      </SubScreen>
    );
  }
  if (view === "routes") {
    return (
      <SubScreen title="Routes" onBack={() => setView("main")}>
        <Constellation />
        <RouteExplorer />
      </SubScreen>
    );
  }
  if (view === "technique") {
    return (
      <SubScreen title="Technique" onBack={() => setView("main")}>
        <PacingChart />
        <FormGrid onSelect={(form) => setView({ form })} />
        <ZoneDiscipline />
      </SubScreen>
    );
  }
  if (typeof view === "object" && "form" in view) {
    return (
      <SubScreen title={FORM_META[view.form].label} onBack={() => setView("technique")}>
        <FormDetail metric={view.form} onOpenRun={setOpenId} />
      </SubScreen>
    );
  }
  if (view === "records") {
    return (
      <SubScreen title="Personal records" onBack={() => setView("main")}>
        <RecordsShelf onSelect={(typeId, label) => setView({ record: typeId, label })} />
      </SubScreen>
    );
  }
  if (typeof view === "object") {
    return (
      <SubScreen title={view.label} onBack={() => setView("records")}>
        <RecordDetail typeId={view.record} />
      </SubScreen>
    );
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Runs" />
      {!allRuns?.length ? (
        <EmptyState text="No runs yet. Connect your Garmin account in Settings and sync." />
      ) : (
        <>
          <AnalyticsHub runs={runs ?? []} onOpen={setView} />
          {allRuns.map((r) => (
            <RunCard key={r.activityId} run={r} onOpen={() => setOpenId(r.activityId)} />
          ))}
        </>
      )}
    </div>
  );
}

function AnalyticsHub({ runs, onOpen }: { runs: ActivityRow[]; onOpen: (v: View) => void }) {
  const decoupling = useDecouplingSeries();
  const latestDec = decoupling?.filter((d) => d.decoupling != null).at(-1)?.decoupling ?? null;

  const weekStart = weekStartOf(new Date());
  const weekKm = runs
    .filter((r) => parseGarminLocal(r.startTimeLocal) >= weekStart)
    .reduce((s, r) => s + (r.distance ?? 0) / 1000, 0);
  const totalKm = runs.reduce((s, r) => s + (r.distance ?? 0) / 1000, 0);
  const cadence = runs[0]?.averageRunningCadenceInStepsPerMinute;

  const tiles: {
    view: View;
    label: string;
    icon: React.ReactNode;
    iconClass: string;
    stat: string;
    unit: string;
    note: string;
  }[] = [
    {
      view: "fitness",
      label: "Fitness",
      icon: <PulseIcon />,
      iconClass: "text-hr",
      stat: latestDec != null ? `${latestDec.toFixed(1)}%` : "–",
      unit: "decoupling",
      note: "Is the base building?",
    },
    {
      view: "volume",
      label: "Volume",
      icon: <BarsIcon />,
      iconClass: "text-accent",
      stat: `${weekKm.toFixed(1)} km`,
      unit: "this week",
      note: "Distance vs your plan",
    },
    {
      view: "routes",
      label: "Routes",
      icon: <RouteIcon />,
      iconClass: "text-[var(--recency-hi)]",
      stat: `${totalKm.toFixed(0)} km`,
      unit: `${runs.length} runs`,
      note: "Where you've run",
    },
    {
      view: "technique",
      label: "Technique",
      icon: <StrideIcon />,
      iconClass: "text-cadence",
      stat: cadence != null ? `${Math.round(cadence)}` : "–",
      unit: "spm cadence",
      note: "How you run",
    },
  ];

  return (
    <Card kicker="Analytics" title="Go deeper">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <button
            key={tile.view as string}
            onClick={() => onOpen(tile.view)}
            className="rounded-xl bg-page p-3 text-left active:opacity-70"
          >
            <div className="flex items-center gap-2">
              <span className={tile.iconClass}>{tile.icon}</span>
              <span className="kicker">{tile.label}</span>
              <span className="ml-auto text-ink-3" aria-hidden>
                ›
              </span>
            </div>
            <div className="tnum mt-2 flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold leading-none">{tile.stat}</span>
              <span className="text-[11px] text-ink-3">{tile.unit}</span>
            </div>
            <div className="mt-1 text-[11px] leading-tight text-ink-2">{tile.note}</div>
          </button>
        ))}
      </div>
      <RecordsTile onOpen={() => onOpen("records")} />
    </Card>
  );
}

function RecordsTile({ onOpen }: { onOpen: () => void }) {
  const stored = useLiveQuery(
    async () => getKv<{ payload: { typeId: number; value?: number }[] }>("personalRecords"),
    [],
  );
  const best5k = stored?.payload?.find((p) => p.typeId === 3)?.value;

  return (
    <button onClick={onOpen} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-page p-3 text-left active:opacity-70">
      <span className="text-status-warn">
        <TrophyIcon />
      </span>
      <div>
        <span className="kicker">Records</span>
        <div className="mt-0.5 text-[11px] leading-tight text-ink-2">Your bests & top 10s</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {best5k != null && (
          <span className="tnum text-[20px] font-semibold">
            5k {fmtDuration(best5k)}
          </span>
        )}
        <span className="text-ink-3" aria-hidden>
          ›
        </span>
      </div>
    </button>
  );
}

function RunCard({ run, onOpen }: { run: ActivityRow; onOpen: () => void }) {
  const d = parseGarminLocal(run.startTimeLocal);
  const pace = speedToPace(run.averageSpeed);
  return (
    <article onClick={onOpen} className="mx-4 mb-3 rounded-2xl bg-card p-4 active:opacity-80">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="kicker">
          {fmtDay(d)} · {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
        {run.excluded && (
          <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-3">
            not counted
          </span>
        )}
      </div>
      <h2 className={`mb-2 text-[15px] font-medium ${run.excluded ? "text-ink-3" : ""}`}>
        {run.activityName ?? "Run"}
      </h2>
      {/* a 4-column grid, not a flex row: an hour-plus duration (1:02:14)
          overflowed the inline layout and clipped the heart rate */}
      <div className={`tnum grid grid-cols-4 gap-x-2 ${run.excluded ? "opacity-45" : ""}`}>
        <Stat label="km" value={fmtKm(run.distance)} />
        <Stat label="/km" value={fmtPace(pace)} />
        <Stat label="time" value={fmtDuration(run.duration)} />
        <Stat label="bpm" value={run.averageHR != null ? String(Math.round(run.averageHR)) : "–"} accent="hr" />
      </div>
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "hr" }) {
  return (
    <div className="min-w-0">
      <div className={`truncate text-[17px] font-semibold leading-tight ${accent === "hr" ? "text-hr" : ""}`}>
        {value}
      </div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}
