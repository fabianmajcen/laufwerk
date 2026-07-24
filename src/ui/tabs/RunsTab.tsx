import { useLiveQuery } from "dexie-react-hooks";
import { getRuns } from "../../lib/db/repo";
import { fmtDay, fmtDuration, fmtKm, fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { ScreenHeader, EmptyState } from "../components/ScreenHeader";
import type { ActivityRow } from "../../lib/db/schema";

export function RunsTab() {
  const runs = useLiveQuery(getRuns, []);

  return (
    <div>
      <ScreenHeader title="Runs" />
      {!runs?.length ? (
        <EmptyState text="No runs yet — connect your Garmin account in Settings and sync." />
      ) : (
        runs.map((r) => <RunCard key={r.activityId} run={r} />)
      )}
    </div>
  );
}

function RunCard({ run }: { run: ActivityRow }) {
  const d = parseGarminLocal(run.startTimeLocal);
  const pace = speedToPace(run.averageSpeed);
  return (
    <article className="mx-4 mb-3 rounded-2xl bg-card p-4 active:opacity-80">
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
