import { useCallback, useState } from "react";
import { useBackHandler } from "../../lib/backstack";
import { useScrollMemory } from "../../lib/scrollMemory";
import { ClockIcon, MoonBedIcon, SwapIcon } from "../components/icons";
import { ScreenHeader, EmptyState, Card } from "../components/ScreenHeader";
import { SubScreen, ExploreRow } from "../components/SubScreen";
import { Hypnogram } from "../charts/Hypnogram";
import { SleepStages } from "../charts/SleepStages";
import { ConsistencyClock } from "../charts/ConsistencyClock";
import { SleepDebt } from "../charts/SleepDebt";
import { StageBalance } from "../charts/StageBalance";
import { RunVsRestSleep } from "../charts/RunVsRestSleep";
import { SleepReadinessScatter } from "../charts/SleepReadinessScatter";
import { toSleepView, useLatestWellness, useWellnessRange } from "../../lib/hooks";
import { computeRegularity } from "../../lib/derive/sleepStats";
import { fmtHoursMin } from "../../lib/format";

type View = "main" | { night: string } | "rhythm" | "training" | "duration";

export function SleepTab() {
  const latest = toSleepView(useLatestWellness("sleep"));
  const [view, setView] = useState<View>("main");
  const [browseDate, setBrowseDate] = useState<string | null>(null);
  const rows = useWellnessRange("sleep", 60);

  useBackHandler(
    view !== "main",
    useCallback(() => setView("main"), []),
  );
  useScrollMemory(`sleep:${typeof view === "object" ? `night${view.night}` : view}`);

  // nights with real data, ascending by date
  const nights = (rows ?? []).map(toSleepView).filter((v): v is NonNullable<typeof v> => v != null);
  const heroIdx = browseDate != null ? nights.findIndex((n) => n.date === browseDate) : nights.length - 1;
  const hero = heroIdx >= 0 ? nights[heroIdx] : latest;

  if (typeof view === "object") {
    const night = toSleepView(rows?.find((r) => r.date === view.night));
    return (
      <SubScreen title="Night" onBack={() => setView("main")}>
        {night ? <Hypnogram sleep={night} /> : <EmptyState text="No data for this night." />}
      </SubScreen>
    );
  }

  if (view === "rhythm") {
    return (
      <SubScreen title="Rhythm & regularity" onBack={() => setView("main")}>
        <ConsistencyClock />
        <RegularityCard />
      </SubScreen>
    );
  }

  if (view === "training") {
    return (
      <SubScreen title="Sleep × training" onBack={() => setView("main")}>
        <RunVsRestSleep />
        <SleepReadinessScatter />
      </SubScreen>
    );
  }

  if (view === "duration") {
    return (
      <SubScreen title="Duration & stages" onBack={() => setView("main")}>
        <SleepDebt />
        <StageBalance />
      </SubScreen>
    );
  }

  return (
    <div className="pb-4">
      <ScreenHeader title="Sleep" />
      {!hero ? (
        <EmptyState text="Sleep data arrives with the first sync. Hypnogram, stages and consistency live here." />
      ) : (
        <>
          <Hypnogram
            sleep={hero}
            nav={{
              isLatest: heroIdx === nights.length - 1,
              onPrev: heroIdx > 0 ? () => setBrowseDate(nights[heroIdx - 1].date) : undefined,
              onNext: heroIdx < nights.length - 1 ? () => setBrowseDate(nights[heroIdx + 1].date) : undefined,
            }}
          />
          <SleepStages onOpenNight={(night) => setView({ night })} />
          <Card kicker="Go deeper" title="Sleep analytics">
            <ExploreRow
              title="Duration & stages"
              subtitle="Are you sleeping enough, and deep enough?"
              onClick={() => setView("duration")}
              icon={<MoonBedIcon />}
              iconClass="text-[var(--sleep-light)]"
            />
            <ExploreRow
              title="Rhythm & regularity"
              subtitle="Your bed & wake times, night by night"
              onClick={() => setView("rhythm")}
              icon={<ClockIcon />}
              iconClass="text-[var(--recency-hi)]"
            />
            <ExploreRow
              title="Sleep × training"
              subtitle="How running and sleep affect each other"
              onClick={() => setView("training")}
              icon={<SwapIcon />}
              iconClass="text-hrv"
            />
          </Card>
        </>
      )}
    </div>
  );
}

function RegularityCard() {
  const rows = useWellnessRange("sleep", 30);
  const nights = (rows ?? []).map(toSleepView).filter((v): v is NonNullable<typeof v> => v != null);
  const reg = computeRegularity(nights);
  if (!reg) return null;

  const verdictFor = (sd: number) => (sd <= 30 ? "very regular" : sd <= 60 ? "fairly regular" : "irregular");

  return (
    <Card
      kicker="Regularity"
      title="How consistent is your schedule?"
      footnote={`Standard deviation over ${reg.nights} nights. Under 30 min counts as very regular. Regular beats long for how rested you feel.`}
    >
      <div className="grid grid-cols-3 gap-3">
        <RegStat label="bedtime ±" value={fmtHoursMin(reg.bedtimeSdMin)} note={verdictFor(reg.bedtimeSdMin)} />
        <RegStat label="wake ±" value={fmtHoursMin(reg.wakeSdMin)} note={verdictFor(reg.wakeSdMin)} />
        <RegStat
          label="weekend shift"
          value={reg.socialJetlagMin != null ? `${reg.socialJetlagMin >= 0 ? "+" : "−"}${fmtHoursMin(Math.abs(reg.socialJetlagMin))}` : "–"}
          note="social jetlag"
        />
      </div>
    </Card>
  );
}

function RegStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl bg-page p-3">
      <div className="kicker">{label}</div>
      <div className="tnum mt-1 text-[18px] font-semibold">{value}</div>
      <div className="text-[10px] text-ink-3">{note}</div>
    </div>
  );
}
