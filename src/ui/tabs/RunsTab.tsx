import { useState } from "react";
import { useDecouplingSeries, useRuns } from "../../lib/hooks";
import { fmtDay, fmtDuration, fmtKm, fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { weekStartOf } from "../../lib/derive/weekly";
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
import { HomeSegment } from "../charts/HomeSegment";
import { RunShape } from "../charts/RunShape";
import type { ActivityRow } from "../../lib/db/schema";

type View = "main" | "fitness" | "volume" | "routes" | "technique";

export function RunsTab() {
  const runs = useRuns();
  const [openId, setOpenId] = useState<number | null>(null);
  const [view, setView] = useState<View>("main");

  const open = openId != null ? runs?.find((r) => r.activityId === openId) : undefined;
  if (open) return <RunDetail run={open} onBack={() => setOpenId(null)} />;

  if (view === "fitness") {
    return (
      <SubScreen title="Fitness" onBack={() => setView("main")}>
        <EfficiencyMap onOpenRun={setOpenId} />
        <DecouplingBars onOpenRun={setOpenId} />
        <RunShape />
      </SubScreen>
    );
  }
  if (view === "volume") {
    return (
      <SubScreen title="Volume & plan" onBack={() => setView("main")}>
        <WeeklyVolume />
      </SubScreen>
    );
  }
  if (view === "routes") {
    return (
      <SubScreen title="Routes & segment" onBack={() => setView("main")}>
        <HomeSegment onOpenRun={setOpenId} />
        <Constellation />
      </SubScreen>
    );
  }
  if (view === "technique") {
    return (
      <SubScreen title="Technique" onBack={() => setView("main")}>
        <PacingChart />
        <FormGrid />
        <ZoneDiscipline />
      </SubScreen>
    );
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Runs" />
      {!runs?.length ? (
        <EmptyState text="No runs yet — connect your Garmin account in Settings and sync." />
      ) : (
        <>
          <AnalyticsHub runs={runs} onOpen={setView} />
          {runs.map((r) => (
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

  const tiles: { view: View; label: string; stat: string; note: string }[] = [
    {
      view: "fitness",
      label: "Fitness",
      stat: latestDec != null ? `${latestDec.toFixed(1)}%` : "–",
      note: "decoupling · efficiency · run shape",
    },
    {
      view: "volume",
      label: "Volume",
      stat: `${weekKm.toFixed(1)} km`,
      note: "this week · plan · cumulative",
    },
    {
      view: "routes",
      label: "Routes",
      stat: `${runs.length} · ${totalKm.toFixed(0)} km`,
      note: "constellation · home segment",
    },
    {
      view: "technique",
      label: "Technique",
      stat: cadence != null ? `${Math.round(cadence)} spm` : "–",
      note: "pacing · form · HR zones",
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
            <div className="flex items-center justify-between">
              <span className="kicker">{tile.label}</span>
              <span className="text-ink-3" aria-hidden>
                ›
              </span>
            </div>
            <div className="tnum mt-1 text-[20px] font-semibold">{tile.stat}</div>
            <div className="mt-0.5 text-[10px] leading-tight text-ink-3">{tile.note}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function RunCard({ run, onOpen }: { run: ActivityRow; onOpen: () => void }) {
  const d = parseGarminLocal(run.startTimeLocal);
  const pace = speedToPace(run.averageSpeed);
  return (
    <article onClick={onOpen} className="mx-4 mb-3 rounded-2xl bg-card p-4 active:opacity-80">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="kicker">
          {fmtDay(d)} · {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <h2 className="mb-2 text-[15px] font-medium">{run.activityName ?? "Run"}</h2>
      <div className="tnum flex gap-5 text-[14px]">
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
    <div className="flex items-baseline gap-1">
      <span className={`text-[17px] font-semibold ${accent === "hr" ? "text-hr" : ""}`}>{value}</span>
      <span className="text-[11px] text-ink-3">{label}</span>
    </div>
  );
}
