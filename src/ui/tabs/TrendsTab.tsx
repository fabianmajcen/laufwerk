import { ScreenHeader, EmptyState } from "../components/ScreenHeader";
import { HrvBaseline } from "../charts/HrvBaseline";
import { LoadTunnel } from "../charts/LoadTunnel";
import { Vo2maxTrend } from "../charts/Vo2maxTrend";
import { TrainingCalendar } from "../charts/TrainingCalendar";
import { useLatestWellness, useRuns } from "../../lib/hooks";

export function TrendsTab() {
  const hrv = useLatestWellness("hrv");
  const runs = useRuns();
  const hasData = hrv != null || (runs?.length ?? 0) > 0;

  return (
    <div className="pb-4">
      <ScreenHeader title="Trends" />
      {!hasData ? (
        <EmptyState text="Trends need a few weeks of synced data — HRV baseline, training load and VO₂max land here." />
      ) : (
        <>
          <HrvBaseline />
          <LoadTunnel />
          <Vo2maxTrend />
          <TrainingCalendar />
        </>
      )}
    </div>
  );
}
