// The week at a glance: Mon to Sun, what was done, what is planned, and which
// days were rest. Replaces both the old two-pill-row week card (whose labels
// were not clearly tied to their rows) and the separate week-planner screen,
// since tapping a day schedules it and the pager reaches future weeks.
import { useState } from "react";
import { Card } from "./ScreenHeader";
import { Sheet, SheetButton } from "./Sheet";
import { DumbbellGlyph, RunGlyph } from "./icons";
import { useTrainingWeek, useWorkoutPlans } from "../../lib/hooks";
import { addScheduleSlot, removeScheduleSlot } from "../../lib/db/workouts";
import { isoDate } from "../../lib/format";
import type { TrainingDay } from "../../lib/derive/trainingWeek";

/** Distinct but low-saturation per session, so A/B/C are told apart at a glance
 *  without competing with the accent blue that means "run". */
const PLAN_COLOR: Record<string, string> = {
  A: "var(--recency-hi)",
  B: "var(--hrv)",
  C: "var(--elevation)",
};
const planColor = (id: string | null | undefined) => (id && PLAN_COLOR[id]) || "var(--ink-2)";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
/** how far ahead you can page to plan */
const MAX_WEEKS_AHEAD = 4;

export function WeekStrip() {
  // negative = future weeks, so planning ahead uses the same pager as reviewing
  const [offset, setOffset] = useState(0);
  const [picking, setPicking] = useState<string | null>(null);
  const week = useTrainingWeek(offset);
  const plans = useWorkoutPlans();

  if (!week) return null;

  const runs = week.runs;
  const workouts = week.workouts;
  const label =
    offset === 0
      ? "This week"
      : offset === 1
        ? "Last week"
        : offset === -1
          ? "Next week"
          : `Week of ${week.weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const pickedDay = picking ? week.days.find((d) => d.date === picking) : undefined;

  // what is actually next: the readiness card above already gives the run
  // advice, so this stays factual about the plan rather than repeating it
  const today = week.days.find((d) => d.isToday);
  const todayOpen = today?.slots.filter((s) => !s.fulfilled) ?? [];
  const nextPlanned = week.days.find((d) => !d.isPast && !d.isToday && d.slots.some((s) => !s.fulfilled));
  const hint =
    offset !== 0
      ? undefined
      : todayOpen.length > 0
        ? `Planned today: ${todayOpen.map((s) => (s.kind === "run" ? "a run" : `day ${s.planId ?? "?"}`)).join(" and ")}.`
        : nextPlanned
          ? `Next up ${new Date(nextPlanned.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" })}: ${nextPlanned.slots
              .filter((s) => !s.fulfilled)
              .map((s) => (s.kind === "run" ? "a run" : `day ${s.planId ?? "?"}`))
              .join(" and ")}.`
          : "Nothing planned yet. Tap a day to put something in.";

  return (
    <>
      {/* no kicker and no info toggle: the week label lives in the pager row, so
          a kicker would just repeat it and an empty kicker row left dead space
          above the arrows. Filled vs faded is self-evident, and tapping a day
          teaches the scheduling. */}
      <Card footnote={hint}>
        <div className="mb-3 flex items-center gap-2">
          <PagerBtn dir="prev" onClick={() => setOffset(offset + 1)} />
          <span className="flex-1 text-center text-[15px] font-semibold">{label}</span>
          <PagerBtn dir="next" onClick={offset > -MAX_WEEKS_AHEAD ? () => setOffset(offset - 1) : undefined} />
        </div>

        <div className="flex gap-1.5">
          {week.days.map((d, i) => (
            <DayCell key={d.date} day={d} weekday={WEEKDAYS[i]} onClick={() => setPicking(d.date)} />
          ))}
        </div>

        <div className="mt-3 flex gap-3">
          <Counter
            icon={<RunGlyph size={13} />}
            color="var(--accent)"
            done={runs.done}
            goal={runs.planned}
            label="runs"
          />
          <Counter
            icon={<DumbbellGlyph size={13} />}
            color="var(--recency-hi)"
            done={workouts.done}
            goal={workouts.planned}
            floor={workouts.floor}
            label="workouts"
          />
        </div>
      </Card>

      {picking && pickedDay && (
        <Sheet
          title={new Date(picking + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
          subtitle={describeDay(pickedDay)}
          onClose={() => setPicking(null)}
        >
          {/* clearing comes first when there is something to clear */}
          {pickedDay.slots.map((s, i) =>
            s.fulfilled ? null : (
              <SheetButton
                key={`rm${i}`}
                tone="danger"
                onClick={() => {
                  void removeScheduleSlot(picking, i);
                  setPicking(null);
                }}
              >
                Remove planned {s.kind === "run" ? "run" : `day ${s.planId ?? ""}`}
              </SheetButton>
            ),
          )}
          {(plans ?? []).map((p) => (
            <SheetButton
              key={p.id}
              onClick={() => {
                void addScheduleSlot(picking, { kind: "workout", planId: p.id, source: "manual" });
                setPicking(null);
              }}
            >
              Plan day {p.id} · {p.title}
            </SheetButton>
          ))}
          <SheetButton
            onClick={() => {
              void addScheduleSlot(picking, { kind: "run", source: "manual" });
              setPicking(null);
            }}
          >
            Plan a run
          </SheetButton>
        </Sheet>
      )}
    </>
  );
}

function DayCell({ day, weekday, onClick }: { day: TrainingDay; weekday: string; onClick: () => void }) {
  const doneLetters = day.sessions.map((s) => s.planId);
  const didRun = day.runs.length > 0;
  const plannedWorkouts = day.slots.filter((s) => s.kind === "workout" && !s.fulfilled);
  const plannedRun = day.slots.some((s) => s.kind === "run" && !s.fulfilled);
  const empty = !didRun && !doneLetters.length && !plannedWorkouts.length && !plannedRun;
  // only a past day can be called a rest day; today is not over yet
  const rest = empty && day.isPast;

  return (
    <button
      onClick={onClick}
      aria-label={`${day.date}: ${describeDay(day)}. Tap to plan.`}
      className="flex flex-1 flex-col items-center gap-1 active:opacity-70"
    >
      <span className={`text-[10px] ${day.isToday ? "text-ink" : "text-ink-3"}`}>{weekday}</span>
      <span
        className={`flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-page ${
          day.isToday ? "ring-1 ring-accent" : ""
        }`}
      >
        {doneLetters.map((id, i) => (
          <span key={`d${i}`} className="text-[13px] font-semibold leading-none" style={{ color: planColor(id) }}>
            {id}
          </span>
        ))}
        {didRun && (
          <span style={{ color: "var(--accent)" }} className="leading-none">
            <RunGlyph size={15} />
          </span>
        )}
        {/* planned but not done: same mark, faded, so it reads as an intention */}
        {plannedWorkouts.map((s, i) => (
          <span
            key={`p${i}`}
            className="text-[13px] font-semibold leading-none opacity-40"
            style={{ color: planColor(s.planId) }}
          >
            {s.planId ?? "?"}
          </span>
        ))}
        {plannedRun && (
          <span style={{ color: "var(--accent)" }} className="leading-none opacity-40">
            <RunGlyph size={15} />
          </span>
        )}
        {/* a past day with nothing on it: read as rest, not as a gap */}
        {rest && <span className="h-0.5 w-3.5 rounded-full bg-grid" />}
      </span>
    </button>
  );
}

function Counter({
  icon,
  color,
  done,
  goal,
  floor,
  label,
}: {
  icon: React.ReactNode;
  color: string;
  done: number;
  goal: number;
  floor?: number;
  label: string;
}) {
  const pct = goal > 0 ? Math.min(100, (done / goal) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span style={{ color }}>{icon}</span>
        <span className="tnum text-[13px] font-medium">
          {done}/{goal}
        </span>
        <span className="truncate text-[11px] text-ink-3">{label}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-grid">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
      </div>
      {/* the goal is a range (e.g. 2-3), so say when the floor is already met */}
      {floor != null && done >= floor && done < goal && (
        <div className="mt-0.5 text-[10px] text-ink-3">on track</div>
      )}
    </div>
  );
}

function PagerBtn({ dir, onClick }: { dir: "prev" | "next"; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      aria-label={dir === "prev" ? "previous week" : "next week"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-page text-ink-2 disabled:opacity-25"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {dir === "prev" ? <path d="M14.5 6l-6 6 6 6" /> : <path d="M9.5 6l6 6-6 6" />}
      </svg>
    </button>
  );
}

function describeDay(day: TrainingDay): string {
  const parts: string[] = [];
  for (const s of day.sessions) parts.push(`day ${s.planId} done`);
  if (day.runs.length) parts.push(day.runs.length > 1 ? `${day.runs.length} runs` : "run done");
  for (const s of day.slots) {
    if (s.fulfilled) continue;
    parts.push(s.kind === "run" ? "run planned" : `day ${s.planId ?? "?"} planned`);
  }
  if (!parts.length) return day.isPast ? "rest day" : "nothing planned";
  return parts.join(" · ");
}

/** today's ISO date, exported so callers can compare without re-deriving it */
export const todayIso = () => isoDate(new Date());
