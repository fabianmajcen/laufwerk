import { useState } from "react";
import { ScreenHeader, EmptyState, Card } from "../components/ScreenHeader";
import { SubScreen, ExploreRow } from "../components/SubScreen";
import { HrvBaseline } from "../charts/HrvBaseline";
import { LoadTunnel } from "../charts/LoadTunnel";
import { Vo2maxTrend } from "../charts/Vo2maxTrend";
import { TrainingCalendar } from "../charts/TrainingCalendar";
import { StressRhythm } from "../charts/StressRhythm";
import { RecordsShelf } from "../charts/RecordsShelf";
import { useLatestWellness, useRuns } from "../../lib/hooks";

type View = "main" | "stress" | "records";

export function TrendsTab() {
  const hrv = useLatestWellness("hrv");
  const runs = useRuns();
  const [view, setView] = useState<View>("main");
  const hasData = hrv != null || (runs?.length ?? 0) > 0;

  if (view === "stress") {
    return (
      <SubScreen title="Stress rhythm" onBack={() => setView("main")}>
        <StressRhythm />
      </SubScreen>
    );
  }
  if (view === "records") {
    return (
      <SubScreen title="Personal records" onBack={() => setView("main")}>
        <RecordsShelf />
      </SubScreen>
    );
  }

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
          <Card kicker="Go deeper" title="More trends">
            <ExploreRow
              title="Stress rhythm"
              subtitle="Average stress by weekday × hour"
              onClick={() => setView("stress")}
            />
            <ExploreRow
              title="Personal records"
              subtitle="Fastest 1k / 5k / 10k · longest run · step records"
              onClick={() => setView("records")}
            />
          </Card>
        </>
      )}
    </div>
  );
}
