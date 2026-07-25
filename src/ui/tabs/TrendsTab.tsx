import { useCallback, useState } from "react";
import { useBackHandler } from "../../lib/backstack";
import { useScrollMemory } from "../../lib/scrollMemory";
import { ScreenHeader, EmptyState, Card } from "../components/ScreenHeader";
import { SubScreen, ExploreRow } from "../components/SubScreen";
import { useTabHome } from "../../lib/tabHome";
import { HrvBaseline } from "../charts/HrvBaseline";
import { LoadTunnel } from "../charts/LoadTunnel";
import { Vo2maxTrend } from "../charts/Vo2maxTrend";
import { TrainingCalendar } from "../charts/TrainingCalendar";
import { StressRhythm } from "../charts/StressRhythm";
import { DaySummary } from "../screens/DaySummary";
import { WavesIcon } from "../components/icons";
import { useLatestWellness, useRuns } from "../../lib/hooks";

type View = "main" | "stress" | { day: string };

export function TrendsTab() {
  const hrv = useLatestWellness("hrv");
  const runs = useRuns();
  const [view, setView] = useState<View>("main");
  const hasData = hrv != null || (runs?.length ?? 0) > 0;

  useBackHandler(
    view !== "main",
    useCallback(() => setView("main"), []),
  );
  useTabHome(useCallback(() => setView("main"), []));
  useScrollMemory(`trends:${typeof view === "object" ? `day${view.day}` : view}`);

  if (view === "stress") {
    return (
      <SubScreen title="Stress rhythm" onBack={() => setView("main")}>
        <StressRhythm />
      </SubScreen>
    );
  }
  if (typeof view === "object") {
    return (
      <SubScreen
        title={new Date(view.day + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        onBack={() => setView("main")}
      >
        <DaySummary date={view.day} />
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
          <TrainingCalendar onOpenDay={(day) => setView({ day })} />
          <Card kicker="Go deeper" title="More trends">
            <ExploreRow
              title="Stress rhythm"
              subtitle="When your week is calm, and when it isn't"
              onClick={() => setView("stress")}
              icon={<WavesIcon />}
              iconClass="text-[var(--recency-hi)]"
            />
          </Card>
        </>
      )}
    </div>
  );
}
