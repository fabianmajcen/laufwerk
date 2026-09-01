// The week at a glance: Mon to Sun, what was done, what is planned, and which
// days were rest. Replaces both the old two-pill-row week card (whose labels
// were not clearly tied to their rows) and the separate week-planner screen,
// since tapping a day schedules it and the pager reaches future weeks.
import { useState } from "react";
import { Card } from "./ScreenHeader";
import { Sheet, SheetButton } from "./Sheet";
import { DumbbellGlyph, RunGlyph } from "./icons";
import { useTrainingWeek } from "../../lib/hooks";
import { addScheduleSlot, removeScheduleSlot } from "../../lib/db/workouts";
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
  const describeSlot = (s: TrainingDay["slots"][number]) =>
    s.kind === "run" ? "a run" : s.kind === "rest" ? "rest" : `day ${s.planId ?? "workout"}`;
  const open = (d: TrainingDay) => d.slots.filter((s) => s.kind === "rest" || !s.fulfilled);

  const today = week.days.find((d) => d.isToday);
  const todayOpen = today ? open(today) : [];
  const nextPlanned = week.days.find((d) => !d.isPast && !d.isToday && open(d).length > 0);
  const hint =
    offset !== 0
      ? undefined
      : todayOpen.length > 0
        ? `Planned today: ${todayOpen.map(describeSlot).join(" and ")}.`
        : nextPlanned
          ? `Next up ${new Date(nextPlanned.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" })}: ${open(
              nextPlanned,
            )
              .map(describeSlot)
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
            extra={`${runs.km.toFixed(1)} km`}
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
          {/* clearing comes first when there is something to clear. A rest day
              counts as fulfilled the moment you do not train, so it is always
              removable, unlike a run or workout that already happened. */}
          {pickedDay.slots.map((s, i) =>
            s.fulfilled && s.kind !== "rest" ? null : (
              <SheetButton
                key={`rm${i}`}
                tone="danger"
                onClick={() => {
                  void removeScheduleSlot(picking, i);
                  setPicking(null);
                }}
              >
                Remove planned {s.kind === "run" ? "run" : s.kind === "rest" ? "rest day" : `day ${s.planId ?? "workout"}`}
              </SheetButton>
            ),
          )}
          {/* no letter to choose: which session it becomes follows from where
              it lands in the order, and inserting an earlier one reshuffles
              the rest automatically */}
          <SheetButton
            onClick={() => {
              void addScheduleSlot(picking, { kind: "workout", planId: null, source: "manual" });
              setPicking(null);
            }}
          >
            Plan a workout
          </SheetButton>
          <SheetButton
            onClick={() => {
              void addScheduleSlot(picking, { kind: "run", source: "manual" });
              setPicking(null);
            }}
          >
            Plan a run
          </SheetButton>
          <SheetButton
            onClick={() => {
              void addScheduleSlot(picking, { kind: "rest", source: "manual" });
              setPicking(null);
            }}
          >
            Plan a rest day
          </SheetButton>
        </Sheet>
      )}
    </>
  );
}

/** One mark inside a day tile: a session letter or a run. */
interface Mark {
  color: string;
  done: boolean;
  /** the session letter; absent means this is a run */
  letter?: string;
}

/** Chip size steps down as a day fills up, so one mark fills its tile and
 *  three still fit. Sizes are in px because they drive both the circle and
 *  the glyph inside it. */
function chipSizes(count: number) {
  if (count <= 1) return { chip: 32, text: 17, glyph: 19 };
  if (count === 2) return { chip: 24, text: 13, glyph: 14 };
  return { chip: 17, text: 10, glyph: 11 };
}

function DayCell({ day, weekday, onClick }: { day: TrainingDay; weekday: string; onClick: () => void }) {
  const plannedRest = day.slots.some((s) => s.kind === "rest");
  const marks: Mark[] = [
    ...day.sessions.map((sess) => ({ color: planColor(sess.planId), done: true, letter: sess.planId ?? "?" })),
    ...(day.runs.length > 0 ? [{ color: "var(--accent)", done: true }] : []),
    ...day.slots
      .filter((s) => s.kind === "workout" && !s.fulfilled)
      .map((s) => ({ color: planColor(s.planId), done: false, letter: s.planId ?? "?" })),
    ...(day.slots.some((s) => s.kind === "run" && !s.fulfilled) ? [{ color: "var(--accent)", done: false }] : []),
  ];
  // a past day with nothing on it reads as rest too, just more faintly than one
  // you deliberately planned
  const impliedRest = !marks.length && !plannedRest && day.isPast;
  const size = chipSizes(marks.length);

  return (
    <button
      onClick={onClick}
      aria-label={`${day.date}: ${describeDay(day)}. Tap to plan.`}
      className="flex flex-1 flex-col items-center gap-1 active:opacity-70"
    >
      <span className={`text-[10px] ${day.isToday ? "font-semibold text-ink" : "text-ink-3"}`}>{weekday}</span>
      <span
        className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-lg bg-page ${
          day.isToday ? "ring-1 ring-accent" : ""
        }`}
      >
        {/* Done is a filled stamp, planned is a dashed outline. Opacity alone
            was the previous encoding and it did not read: a finished session
            has to look like an achievement, not a dimmer intention. */}
        {marks.map((m, i) => (
          <span
            key={i}
            className={`flex items-center justify-center rounded-full font-bold leading-none ${
              m.done ? "" : "border-[1.5px] border-dashed"
            }`}
            style={{
              width: size.chip,
              height: size.chip,
              background: m.done ? m.color : "transparent",
              borderColor: m.done ? undefined : m.color,
              color: m.done ? "var(--page)" : m.color,
              opacity: m.done ? 1 : 0.75,
            }}
          >
            {m.letter ? (
              <span style={{ fontSize: size.text }}>{m.letter}</span>
            ) : (
              <RunGlyph size={size.glyph} />
            )}
          </span>
        ))}
        {/* a deliberate rest day is a visible dash; an unplanned empty past day
            gets the same shape, fainter */}
        {plannedRest && !marks.length && <span className="h-[3px] w-4 rounded-full bg-[var(--ink-3)]" />}
        {impliedRest && <span className="h-[3px] w-4 rounded-full bg-grid" />}
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
  extra,
}: {
  icon: React.ReactNode;
  color: string;
  done: number;
  goal: number;
  floor?: number;
  label: string;
  /** a secondary stat pinned right, e.g. the week's km */
  extra?: string;
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
        {extra && <span className="tnum ml-auto shrink-0 text-[12px] font-medium text-ink-2">{extra}</span>}
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
    if (s.kind === "rest") {
      parts.push("rest day planned");
      continue;
    }
    if (s.fulfilled) continue;
    parts.push(s.kind === "run" ? "run planned" : `day ${s.planId ?? "workout"} planned`);
  }
  if (!parts.length) return day.isPast ? "rest day" : "nothing planned";
  return parts.join(" · ");
}
