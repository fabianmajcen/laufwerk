// Plan the next seven days: each day can hold workout slots and run slots.
// Deliberately no recurrence rules — the point is that a week is laid out by
// hand and can look different every week.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "../components/ScreenHeader";
import { Sheet, SheetButton } from "../components/Sheet";
import {
  addScheduleSlot,
  getScheduleRange,
  getWorkoutPlans,
  getWorkoutSessions,
  removeScheduleSlot,
} from "../../lib/db/workouts";
import { isoDate } from "../../lib/format";
import type { ScheduleSlot } from "../../lib/db/schema";

const HORIZON = 14;

export function PlanWeek() {
  const [picking, setPicking] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const now = new Date();
    const from = isoDate(now);
    const to = isoDate(new Date(now.getTime() + (HORIZON - 1) * 86400000));
    const [plans, schedule, sessions] = await Promise.all([
      getWorkoutPlans(),
      getScheduleRange(from, to),
      getWorkoutSessions(from, to),
    ]);
    return { plans, schedule, sessions, from };
  }, []);

  if (!data) return null;
  const { plans, schedule, sessions } = data;
  const today = isoDate(new Date());

  const days = Array.from({ length: HORIZON }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    return {
      iso,
      date: d,
      slots: schedule.find((s) => s.date === iso)?.slots ?? [],
      doneCount: sessions.filter((s) => s.date === iso).length,
    };
  });

  return (
    <>
      <Card
        kicker="Plan"
        title="The next two weeks"
        info="Tap a day to add a workout or a run. Nothing here is enforced: it is a reminder of your own intent, and the rotation still follows what you actually did. A day you already trained shows as done."
      >
        {days.map((d) => (
          <div key={d.iso} className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0">
            <div className="w-16 shrink-0">
              <div className="text-[13px] font-medium">
                {d.iso === today ? "Today" : d.date.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
              <div className="tnum text-[11px] text-ink-3">
                {d.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {d.doneCount > 0 && (
                <span className="rounded-full bg-[var(--recency-hi)] px-2 py-1 text-[11px] font-medium text-white">
                  {d.doneCount > 1 ? `${d.doneCount} done` : "done"}
                </span>
              )}
              {d.slots.map((s, i) => (
                <button
                  key={i}
                  onClick={() => void removeScheduleSlot(d.iso, i)}
                  aria-label={`Remove ${s.kind === "run" ? "run" : `day ${s.planId ?? ""}`} on ${d.iso}`}
                  className={`rounded-full px-2 py-1 text-[11px] font-medium active:opacity-70 ${
                    s.kind === "run" ? "bg-elevated text-accent" : "bg-elevated text-[var(--recency-hi)]"
                  }`}
                >
                  {s.kind === "run" ? "Run" : `Day ${s.planId ?? "?"}`} ✕
                </button>
              ))}
              {d.slots.length === 0 && d.doneCount === 0 && (
                <span className="text-[12px] text-ink-3">nothing planned</span>
              )}
            </div>

            <button
              onClick={() => setPicking(d.iso)}
              aria-label={`Add to ${d.iso}`}
              className="h-8 w-8 shrink-0 rounded-full bg-page text-[18px] leading-none text-ink-2 active:opacity-70"
            >
              +
            </button>
          </div>
        ))}
      </Card>

      {picking && (
        <Sheet
          title={`Add to ${new Date(picking + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`}
          onClose={() => setPicking(null)}
        >
          {plans.map((p) => (
            <SheetButton
              key={p.id}
              onClick={() => {
                void addScheduleSlot(picking, { kind: "workout", planId: p.id, source: "manual" } satisfies ScheduleSlot);
                setPicking(null);
              }}
            >
              Day {p.id} · {p.title}
            </SheetButton>
          ))}
          <SheetButton
            onClick={() => {
              void addScheduleSlot(picking, { kind: "run", source: "manual" });
              setPicking(null);
            }}
          >
            A run
          </SheetButton>
        </Sheet>
      )}
    </>
  );
}
