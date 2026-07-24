import { useState } from "react";
import { useRuns } from "../../lib/hooks";
import { fmtDay, fmtDuration, fmtKm, fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { ScreenHeader, EmptyState } from "../components/ScreenHeader";
import { RunDetail } from "../screens/RunDetail";
import { EfficiencyMap } from "../charts/EfficiencyMap";
import { DecouplingBars } from "../charts/DecouplingBars";
import { WeeklyVolume } from "../charts/WeeklyVolume";
import { Constellation } from "../charts/Constellation";
import { PacingChart } from "../charts/PacingChart";
import { FormGrid } from "../charts/FormGrid";
import { ZoneDiscipline } from "../charts/ZoneDiscipline";
import type { ActivityRow } from "../../lib/db/schema";

export function RunsTab() {
  const runs = useRuns();
  const [openId, setOpenId] = useState<number | null>(null);

  const open = openId != null ? runs?.find((r) => r.activityId === openId) : undefined;
  if (open) return <RunDetail run={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="pb-4">
      <ScreenHeader title="Runs" />
      {!runs?.length ? (
        <EmptyState text="No runs yet — connect your Garmin account in Settings and sync." />
      ) : (
        <>
          {runs.map((r) => (
            <RunCard key={r.activityId} run={r} onOpen={() => setOpenId(r.activityId)} />
          ))}
          <h2 className="kicker mx-4 mb-2 mt-6">Analytics</h2>
          <EfficiencyMap onOpenRun={setOpenId} />
          <DecouplingBars onOpenRun={setOpenId} />
          <WeeklyVolume />
          <Constellation />
          <PacingChart />
          <FormGrid />
          <ZoneDiscipline />
        </>
      )}
    </div>
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
