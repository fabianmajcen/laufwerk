import { useState } from "react";
import { ScreenHeader, EmptyState, Card } from "../components/ScreenHeader";
import { Hypnogram } from "../charts/Hypnogram";
import { SleepStages } from "../charts/SleepStages";
import { ConsistencyClock } from "../charts/ConsistencyClock";
import { toSleepView, useLatestWellness, useWellnessRange } from "../../lib/hooks";

export function SleepTab() {
  const latest = toSleepView(useLatestWellness("sleep"));
  const [openDate, setOpenDate] = useState<string | null>(null);
  const rows = useWellnessRange("sleep", 60);

  const openNight =
    openDate != null ? toSleepView(rows?.find((r) => r.date === openDate)) : null;

  if (openNight) {
    return (
      <div className="pb-4">
        <header className="flex items-center gap-2 px-3 pb-1 pt-4">
          <button onClick={() => setOpenDate(null)} aria-label="Back" className="p-2 text-ink-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-[20px] font-semibold">Night</h1>
        </header>
        <Hypnogram sleep={openNight} />
      </div>
    );
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Sleep" />
      {!latest ? (
        <EmptyState text="Sleep data arrives with the first sync — hypnogram, stages and consistency live here." />
      ) : (
        <>
          <Hypnogram sleep={latest} />
          <SleepStages onOpenNight={setOpenDate} />
          <ConsistencyClock />
          <VitalsGrid />
        </>
      )}
    </div>
  );
}

function VitalsGrid() {
  const rhrRows = useWellnessRange("rhr", 30);
  const hrvRows = useWellnessRange("hrv", 30);

  const rhr = (rhrRows ?? [])
    .map((r) => (r.payload as { value?: number })?.value)
    .filter((v): v is number => typeof v === "number");
  const hrv = (hrvRows ?? [])
    .map((r) => (r.payload as { hrvSummary?: { lastNightAvg?: number } })?.hrvSummary?.lastNightAvg)
    .filter((v): v is number => typeof v === "number");

  if (!rhr.length && !hrv.length) return null;

  return (
    <Card kicker="Recovery vitals" title="30-day tiles">
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Resting HR" unit="bpm" values={rhr} betterWhen="lower" />
        <Tile label="Overnight HRV" unit="ms" values={hrv} betterWhen="higher" />
      </div>
    </Card>
  );
}

function Tile({
  label,
  unit,
  values,
  betterWhen,
}: {
  label: string;
  unit: string;
  values: number[];
  betterWhen: "higher" | "lower";
}) {
  if (!values.length) return null;
  const current = values[values.length - 1];
  const prevAvg = values.length > 1 ? values.slice(0, -1).reduce((a, b) => a + b, 0) / (values.length - 1) : current;
  const delta = current - prevAvg;
  const improving = betterWhen === "higher" ? delta >= 0 : delta <= 0;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * 100;
      const y = max === min ? 14 : 26 - ((v - min) / (max - min)) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl bg-page p-3">
      <div className="kicker">{label}</div>
      <div className="tnum mt-1 flex items-baseline gap-1">
        <span className="text-[22px] font-semibold">{Math.round(current)}</span>
        <span className="text-[11px] text-ink-3">{unit}</span>
        <span className={`ml-auto text-[11px] ${improving ? "text-status-good" : "text-status-warn"}`}>
          {delta >= 0 ? "↑" : "↓"}
          {Math.abs(delta).toFixed(0)}
        </span>
      </div>
      <svg viewBox="0 0 100 28" className="mt-1 h-7 w-full" preserveAspectRatio="none" aria-hidden>
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
