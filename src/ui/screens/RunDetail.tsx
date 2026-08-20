import { useMemo } from "react";
import { useActivityData } from "../../lib/hooks";
import { setRunExcluded } from "../../lib/db/repo";
import type { ActivityRow } from "../../lib/db/schema";
import { fmtDay, fmtDuration, fmtKm, fmtPace, parseGarminLocal, speedToPace } from "../../lib/format";
import { toRunPoints } from "../../lib/derive/series";
import { computeDecoupling, DECOUPLING_TARGET_PCT } from "../../lib/derive/decoupling";
import { RunPanels } from "../charts/RunPanels";
import { RouteHero } from "../charts/RouteHero";
import { Card } from "../components/ScreenHeader";
import { CloudIcon, CloudSunIcon, RainIcon, SnowIcon, SunIcon } from "../components/icons";

export function RunDetail({ run, onBack }: { run: ActivityRow; onBack: () => void }) {
  const data = useActivityData(run.activityId);
  const d = parseGarminLocal(run.startTimeLocal);
  const pace = speedToPace(run.averageSpeed);

  const decoupling = useMemo(
    () => (data ? computeDecoupling(toRunPoints(data.series)) : null),
    [data],
  );

  const weather = data?.weather;
  const tempC = weather?.temp != null ? ((weather.temp - 32) * 5) / 9 : null;

  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 px-3 pb-1 pt-4">
        <button onClick={onBack} aria-label="Back" className="p-2 text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <h1 className="text-[20px] font-semibold leading-tight">{run.activityName ?? "Run"}</h1>
          <p className="text-[12px] text-ink-3">
            {fmtDay(d)} · {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </header>

      {data?.polyline && data.polyline.length > 1 && (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl bg-card">
          <RouteHero polyline={data.polyline} />
        </div>
      )}

      <div className="tnum mx-4 mb-3 grid grid-cols-3 gap-x-2 gap-y-3 rounded-2xl bg-card p-4">
        <Stat label="distance" value={`${fmtKm(run.distance)} km`} />
        <Stat label="time" value={fmtDuration(run.duration)} />
        <Stat label="avg pace" value={`${fmtPace(pace)} /km`} />
        <Stat label="avg HR" value={run.averageHR != null ? `${Math.round(run.averageHR)} bpm` : "–"} />
        <Stat label="max HR" value={run.maxHR != null ? `${Math.round(run.maxHR)} bpm` : "–"} />
        <Stat label="climb" value={run.elevationGain != null ? `${Math.round(run.elevationGain)} m` : "–"} />
        <Stat label="cadence" value={run.averageRunningCadenceInStepsPerMinute != null ? `${Math.round(run.averageRunningCadenceInStepsPerMinute)} spm` : "–"} />
        <Stat
          label="decoupling"
          value={
            decoupling != null ? (
              <span className={decoupling <= DECOUPLING_TARGET_PCT ? "text-status-good" : "text-status-serious"}>
                {decoupling.toFixed(1)}%
              </span>
            ) : (
              "–"
            )
          }
        />
        <Stat label="calories" value={run.calories != null ? String(Math.round(run.calories)) : "–"} />
      </div>

      {data && <RunPanels data={data} />}

      {!!data?.splits?.length && (
        <Card kicker="Splits" title="Per km">
          <table className="tnum w-full table-fixed text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="py-1 font-medium">km</th>
                <th className="font-medium">pace</th>
                <th className="font-medium">HR</th>
                <th className="font-medium">cadence</th>
              </tr>
            </thead>
            <tbody>
              {data.splits
                .filter((l) => (l.distance ?? 0) >= 200)
                .map((l, i) => {
                  const lapKm = (l.distance ?? 0) / 1000;
                  const lapPace = l.duration && l.distance ? (l.duration / 60) / lapKm : null;
                  return (
                    <tr key={i} className="border-t border-hairline">
                      <td className="py-1.5">{lapKm >= 0.995 ? String(i + 1) : lapKm.toFixed(2)}</td>
                      <td>{fmtPace(lapPace)}</td>
                      <td>{l.averageHR != null ? Math.round(l.averageHR) : "–"}</td>
                      <td>{l.averageRunCadence != null ? Math.round(l.averageRunCadence) : "–"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Card>
      )}

      {weather && (
        <Card
          kicker="Conditions"
          title={
            <span className="flex items-center gap-2">
              <span className="text-ink-3">{weatherIcon(weather.weatherTypeDTO?.desc)}</span>
              {weather.weatherTypeDTO?.desc ?? "Weather"}
            </span>
          }
        >
          <div className="flex gap-5 text-[14px]">
            {tempC != null && <span className="tnum">{tempC.toFixed(0)}°C</span>}
            {weather.relativeHumidity != null && <span className="tnum">{weather.relativeHumidity}% humidity</span>}
            {weather.windSpeed != null && <span className="tnum">wind {Math.round(weather.windSpeed * 1.609)} km/h</span>}
          </div>
        </Card>
      )}

      <CountToggle run={run} />
    </div>
  );
}

/** Keep this run out of every chart, the readiness score and the widget
 *  (social walk-runs, interval sessions, watch-battery fragments). */
function CountToggle({ run }: { run: ActivityRow }) {
  const excluded = run.excluded === true;
  return (
    <Card
      kicker="Stats"
      info="Excluded runs stay in this list but are ignored everywhere else: weekly volume, the efficiency map, decoupling, training load, zones, records and the readiness score. Use it for runs that were not really your own training, like a social run with walking breaks or an interval session. The choice sticks across syncs."
    >
      <button
        onClick={() => setRunExcluded(run.activityId, !excluded)}
        className="flex w-full items-center justify-between gap-3 text-left active:opacity-70"
      >
        <span>
          <span className="block text-[14px] font-medium">
            {excluded ? "Not counted in stats" : "Counted in stats"}
          </span>
          <span className="block text-[12px] text-ink-3">
            {excluded ? "Tap to count this run again" : "Tap to exclude this run"}
          </span>
        </span>
        <span
          aria-hidden
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            excluded ? "bg-grid" : "bg-accent"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              excluded ? "left-0.5" : "left-[22px]"
            }`}
          />
        </span>
      </button>
    </Card>
  );
}

function weatherIcon(desc: string | undefined) {
  const d = (desc ?? "").toLowerCase();
  if (d.includes("thunder") || d.includes("rain") || d.includes("shower") || d.includes("drizzle")) return <RainIcon />;
  if (d.includes("snow") || d.includes("sleet") || d.includes("flurr")) return <SnowIcon />;
  if (d.includes("partly") || d.includes("mostly clear") || d.includes("mostly sunny") || d.includes("fair")) return <CloudSunIcon />;
  if (d.includes("cloud") || d.includes("overcast") || d.includes("fog") || d.includes("haze") || d.includes("mist")) return <CloudIcon />;
  return <SunIcon />;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[15px] font-semibold">{value}</div>
      <div className="kicker mt-0.5">{label}</div>
    </div>
  );
}
