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
import { useWorkout } from "../../store/workoutStore";
import { PROGRESSION_NOTES } from "../../lib/workouts/planSeed";
import { WeekStrip } from "../components/WeekStrip";
import { WorkoutHistory } from "../screens/WorkoutHistory";
import { ExploreRow } from "../components/SubScreen";
import { ClockIcon } from "../components/icons";
import { isoDate } from "../../lib/format";
import type { WorkoutPlanRow, WorkoutSessionRow } from "../../lib/db/schema";

type View = "main" | { plan: string } | "history";

export function TrainingTab() {
  const [view, setView] = useState<View>("main");
  /** overrides the rotation suggestion for this visit: the rotation itself is
   *  history-driven, so picking C now makes A the suggestion afterwards */
  const [picked, setPicked] = useState<string | null>(null);
  const plans = useWorkoutPlans();
  const sessions = useWorkoutSessions(120);
  const next = useNextPlanInRotation();

  useBackHandler(view !== "main", useCallback(() => setView("main"), []));
  useTabHome(useCallback(() => setView("main"), []));
  useScrollMemory(`training:${typeof view === "string" ? view : `plan${view.plan}`}`);

  if (view === "history") {
    return (
      <SubScreen title="History" onBack={() => setView("main")}>
        <WorkoutHistory />
      </SubScreen>
    );
  }

  if (typeof view === "object") {
    const plan = plans?.find((p) => p.id === view.plan);
    return (
      <SubScreen title={plan ? `Day ${plan.id}` : "Session"} onBack={() => setView("main")}>
        {plan ? (
          <PlanDetail plan={plan} onStart={() => setView("main")} />
        ) : (
          <EmptyState text="This session is no longer in your plan." />
        )}
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

  const hero = plans.find((p) => p.id === picked) ?? next;

  return (
    <div className="pb-4">
      <ScreenHeader title="Train" />
      <NextUpCard
        plan={hero}
        plans={plans}
        suggestedId={next?.id}
        pickedId={picked}
        onPick={setPicked}
        lastDone={hero ? lastDoneOf(sessions, hero.id) : null}
      />
      <WeekStrip />
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
      <Card kicker="Go deeper" title="Your training">
        <ExploreRow
          title="History"
          subtitle="Every session and how the weeks look"
          onClick={() => setView("history")}
          icon={<ClockIcon />}
          iconClass="text-[var(--recency-hi)]"
        />
      </Card>
    </div>
  );
}

// ---------- pieces ----------

function NextUpCard({
  plan,
  plans,
  suggestedId,
  pickedId,
  onPick,
  lastDone,
}: {
  plan: WorkoutPlanRow | undefined;
  plans: WorkoutPlanRow[];
  suggestedId: string | undefined;
  pickedId: string | null;
  onPick: (id: string | null) => void;
  lastDone: string | null;
}) {
  if (!plan) return null;
  const overridden = pickedId != null && pickedId !== suggestedId;
  return (
    <Card
      kicker={overridden ? "Starting" : "Next up"}
      title={`Day ${plan.id} · ${plan.title}`}
      info="The suggestion is whichever session you did least recently, so the A to B to C order keeps itself. Pick a different day whenever you like: the rotation follows what you actually did, not a fixed calendar."
      footnote={lastDone ? `Last done ${lastDone}.` : "Not done yet."}
    >
      <p className="mb-3 text-[13px] text-ink-2">{plan.subtitle}</p>

      {/* pick the day: needed the moment your real rotation started outside
          the app, and useful any time you want to swap the order */}
      <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Choose session">
        {plans.map((p) => {
          const active = p.id === plan.id;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={active}
              onClick={() => onPick(p.id === suggestedId ? null : p.id)}
              className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium ${
                active ? "bg-elevated text-ink" : "bg-page text-ink-3"
              }`}
            >
              Day {p.id}
              {p.id === suggestedId && !active && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  title="suggested next"
                  aria-label="suggested next"
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => void useWorkout.getState().start(plan.id)}
        className="h-12 w-full rounded-xl bg-accent text-[15px] font-medium text-white active:opacity-80"
      >
        Start day {plan.id}
      </button>
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

function PlanDetail({ plan, onStart }: { plan: WorkoutPlanRow; onStart: () => void }) {
  const main = plan.exercises.filter((e) => e.block === "main");
  const warm = plan.exercises.filter((e) => e.block === "warmup");
  const cool = plan.exercises.filter((e) => e.block === "cooldown");
  return (
    <>
      <Card kicker={`Day ${plan.id}`} title={plan.title} footnote={plan.subtitle}>
        <p className="mb-3 text-[13px] text-ink-2">
          {main.length} exercises · about {plan.estMinutes} min
        </p>
        <button
          onClick={() => {
            // leave the sub-screen behind, so ending the session returns to the
            // tab root rather than this list
            onStart();
            void useWorkout.getState().start(plan.id);
          }}
          className="h-12 w-full rounded-xl bg-accent text-[15px] font-medium text-white active:opacity-80"
        >
          Start day {plan.id}
        </button>
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
