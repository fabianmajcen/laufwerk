// The Train tab: his calisthenics plan, weekly adherence, and the way into a
// session. Deliberately not an analytics tab — the question it answers is "what
// do I do today, and am I keeping up".
import { useCallback, useState } from "react";
import { ScreenHeader, Card, EmptyState } from "../components/ScreenHeader";
import { SubScreen } from "../components/SubScreen";
import { useBackHandler } from "../../lib/backstack";
import { useScrollMemory } from "../../lib/scrollMemory";
import { useTabHome } from "../../lib/tabHome";
import {
  useNextPlanInRotation,
  useWorkoutPlans,
  useWorkoutSessions,
} from "../../lib/hooks";
import { useSettings } from "../../store/settingsStore";
import { PROGRESSION_NOTES } from "../../lib/workouts/planSeed";
import { weekStartOf } from "../../lib/derive/weekly";
import { isoDate } from "../../lib/format";
import type { WorkoutPlanRow, WorkoutSessionRow } from "../../lib/db/schema";

type View = "main" | { plan: string };

export function TrainingTab() {
  const [view, setView] = useState<View>("main");
  const plans = useWorkoutPlans();
  const sessions = useWorkoutSessions(120);
  const next = useNextPlanInRotation();
  const goal = useSettings((s) => s.workouts);

  useBackHandler(view !== "main", useCallback(() => setView("main"), []));
  useTabHome(useCallback(() => setView("main"), []));
  useScrollMemory(`training:${typeof view === "string" ? view : `plan${view.plan}`}`);

  if (typeof view === "object") {
    const plan = plans?.find((p) => p.id === view.plan);
    return (
      <SubScreen title={plan ? `Day ${plan.id}` : "Session"} onBack={() => setView("main")}>
        {plan ? <PlanDetail plan={plan} /> : <EmptyState text="This session is no longer in your plan." />}
      </SubScreen>
    );
  }

  if (!plans?.length) {
    return (
      <div className="pb-4">
        <ScreenHeader title="Train" />
        <EmptyState text="Your calisthenics plan lands here on the next app start." />
      </div>
    );
  }

  const done = sessions ? countThisWeek(sessions) : 0;

  return (
    <div className="pb-4">
      <ScreenHeader title="Train" />
      <NextUpCard plan={next} lastDone={next ? lastDoneOf(sessions, next.id) : null} />
      <WeekCard done={done} goal={goal.workoutsPerWeek} floor={goal.minWorkoutsPerWeek} />
      <Card
        kicker="Your plan"
        title="Sessions"
        info={PROGRESSION_NOTES}
      >
        {plans.map((p) => (
          <PlanRow
            key={p.id}
            plan={p}
            lastDone={lastDoneOf(sessions, p.id)}
            onClick={() => setView({ plan: p.id })}
          />
        ))}
      </Card>
    </div>
  );
}

// ---------- pieces ----------

function NextUpCard({ plan, lastDone }: { plan: WorkoutPlanRow | undefined; lastDone: string | null }) {
  if (!plan) return null;
  return (
    <Card
      kicker="Next up"
      title={`Day ${plan.id} · ${plan.title}`}
      info="Suggested from your rotation: the session you did least recently. Nothing is forced, you can start any of the three."
      footnote={lastDone ? `Last done ${lastDone}.` : "Not done yet."}
    >
      <p className="mb-3 text-[13px] text-ink-2">{plan.subtitle}</p>
      <button
        disabled
        className="h-12 w-full rounded-xl bg-accent text-[15px] font-medium text-white disabled:opacity-40"
      >
        Start session
      </button>
      <p className="mt-2 text-center text-[11px] text-ink-3">The guided player arrives in the next update.</p>
    </Card>
  );
}

function WeekCard({ done, goal, floor }: { done: number; goal: number; floor: number }) {
  const slots = Math.max(goal, done);
  return (
    <Card
      kicker="This week"
      title={`Workouts ${done}/${goal}`}
      info={`Your target is ${floor} to ${goal} sessions a week, so the last slot is drawn as a bonus: hitting ${floor} already counts as on track.`}
      footnote={
        done >= goal
          ? "Week complete. Anything more is a bonus."
          : done >= floor
            ? "On track. One more if you feel fresh."
            : `${floor - done} to go to stay on track.`
      }
    >
      <div className="flex gap-2">
        {Array.from({ length: slots }, (_, i) => {
          const filled = i < done;
          const bonus = i >= floor;
          return (
            <div
              key={i}
              aria-label={filled ? "workout done" : bonus ? "bonus slot" : "workout pending"}
              className={`h-2.5 flex-1 rounded-full ${
                filled ? "bg-accent" : bonus ? "border border-dashed border-hairline" : "bg-grid"
              }`}
            />
          );
        })}
      </div>
    </Card>
  );
}

function PlanRow({
  plan,
  lastDone,
  onClick,
}: {
  plan: WorkoutPlanRow;
  lastDone: string | null;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-t border-hairline px-1 py-3 text-left first:border-t-0 active:opacity-70"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-page text-[15px] font-semibold text-accent">
        {plan.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{plan.title}</span>
        <span className="block text-[12px] text-ink-3">{lastDone ? `Last done ${lastDone}` : "Not done yet"}</span>
      </span>
      <span className="text-ink-3" aria-hidden>
        ›
      </span>
    </button>
  );
}

function PlanDetail({ plan }: { plan: WorkoutPlanRow }) {
  const main = plan.exercises.filter((e) => e.block === "main");
  const warm = plan.exercises.filter((e) => e.block === "warmup");
  const cool = plan.exercises.filter((e) => e.block === "cooldown");
  return (
    <>
      <Card kicker={`Day ${plan.id}`} title={plan.title} footnote={plan.subtitle}>
        <p className="text-[13px] text-ink-2">
          {main.length} exercises · about {plan.estMinutes} min
        </p>
      </Card>
      {[
        { label: "Warm-up", items: warm },
        { label: "Main", items: main },
        { label: "Cooldown", items: cool },
      ].map(({ label, items }) =>
        items.length ? (
          <Card key={label} kicker={label}>
            {items.map((e) => (
              <div key={`${label}-${e.id}`} className="border-t border-hairline py-2.5 first:border-t-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-medium">
                    {e.name}
                    {e.perSide && (
                      <span className="ml-2 rounded-full bg-elevated px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-3">
                        per side
                      </span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-[13px] text-ink-2">{e.target}</span>
                </div>
                {e.restSec > 0 && (
                  <div className="tnum mt-0.5 text-[11px] text-ink-3">
                    rest {fmtRest(e.restSec, e.restSecMax)}
                  </div>
                )}
                {e.note && <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{e.note}</p>}
              </div>
            ))}
          </Card>
        ) : null,
      )}
    </>
  );
}

// ---------- helpers ----------

function fmtRest(sec: number, max?: number): string {
  const one = (s: number) => (s % 60 === 0 ? `${s / 60} min` : `${s}s`);
  return max && max !== sec ? `${one(sec)} to ${one(max)}` : one(sec);
}

function countThisWeek(sessions: WorkoutSessionRow[]): number {
  const from = isoDate(weekStartOf(new Date()));
  return sessions.filter((s) => s.date >= from).length;
}

function lastDoneOf(sessions: WorkoutSessionRow[] | undefined, planId: string): string | null {
  if (!sessions?.length) return null;
  const mine = sessions.filter((s) => s.planId === planId);
  if (!mine.length) return null;
  const last = mine[mine.length - 1];
  const days = Math.floor(
    (new Date(isoDate(new Date()) + "T00:00:00").getTime() - new Date(last.date + "T00:00:00").getTime()) / 86400000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
