import { useCallback, useState } from "react";
import { useBackHandler } from "../../lib/backstack";
import { useScrollMemory } from "../../lib/scrollMemory";
import { ScreenHeader, EmptyState, Card } from "../components/ScreenHeader";
import { SubScreen, ExploreRow } from "../components/SubScreen";
import { HrvBaseline } from "../charts/HrvBaseline";
import { LoadTunnel } from "../charts/LoadTunnel";
import { Vo2maxTrend } from "../charts/Vo2maxTrend";
import { TrainingCalendar } from "../charts/TrainingCalendar";
import { StressRhythm } from "../charts/StressRhythm";
import { useLatestWellness, useRuns } from "../../lib/hooks";

type View = "main" | "stress";

export function TrendsTab() {
  const hrv = useLatestWellness("hrv");
  const runs = useRuns();
  const [view, setView] = useState<View>("main");
  const hasData = hrv != null || (runs?.length ?? 0) > 0;

  useBackHandler(
    view !== "main",
    useCallback(() => setView("main"), []),
  );
  useScrollMemory(`trends:${view}`);

  if (view === "stress") {
    return (
      <SubScreen title="Stress rhythm" onBack={() => setView("main")}>
        <StressRhythm />
      </SubScreen>
    );
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Trends" />
      {!hasData ? (
        <EmptyState text="Trends need a few weeks of synced data. HRV baseline, training load and VO₂max land here." />
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
          </Card>
        </>
      )}
    </div>
  );
}
