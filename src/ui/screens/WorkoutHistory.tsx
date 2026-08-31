// Every logged session, plus how consistent the weeks have been. Bars are plain
// divs rather than ECharts: this view has to stay light because it can be open
// while a session is running.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Card, EmptyState } from "../components/ScreenHeader";
import { Sheet, SheetButton } from "../components/Sheet";
import { getRecentWorkoutSessions, getWorkoutSessions, deleteWorkoutSession, setSessionNote } from "../../lib/db/workouts";
import { setsDone } from "../../lib/derive/workout";
import { weekStartOf } from "../../lib/derive/weekly";
import { isoDate, fmtDuration } from "../../lib/format";
import { useSettings } from "../../store/settingsStore";
import type { WorkoutSessionRow } from "../../lib/db/schema";

const WEEKS = 12;

const PLAN_COLOR: Record<string, string> = {
  A: "var(--recency-hi)",
  B: "var(--hrv)",
  C: "var(--elevation)",
};

export function WorkoutHistory() {
  const [open, setOpen] = useState<WorkoutSessionRow | null>(null);
  const goal = useSettings((s) => s.workouts.workoutsPerWeek);

  const data = useLiveQuery(async () => {
    const from = isoDate(new Date(Date.now() - WEEKS * 7 * 86400000));
    const [recent, counted] = await Promise.all([
      getRecentWorkoutSessions(60),
      getWorkoutSessions(from, isoDate(new Date())),
    ]);
    return { recent, counted };
  }, []);

  if (!data) return null;
  if (!data.recent.length) {
    return <EmptyState text="No sessions logged yet. Finish one and it lands here." />;
  }

  // sessions per week, oldest week first
  const buckets = new Map<string, number>();
  for (let i = WEEKS - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 86400000);
    buckets.set(isoDate(weekStartOf(d)), 0);
  }
  for (const s of data.counted) {
    const key = isoDate(weekStartOf(new Date(s.date + "T00:00:00")));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const weeks = [...buckets.entries()];
  const peak = Math.max(goal, ...weeks.map(([, n]) => n));

  return (
    <>
      <Card
        kicker="Consistency"
        title={`${WEEKS} weeks`}
        info="Sessions per week against your weekly target. The point is the shape over time, not any single week."
        footnote={`Target ${goal} a week. ${weeks.filter(([, n]) => n >= goal).length} of ${WEEKS} weeks hit it.`}
      >
        <div className="flex h-20 items-end gap-1">
          {weeks.map(([wk, n]) => (
            // h-full on the column matters: a percentage height needs a parent
            // with a definite height, otherwise every bar collapses to nothing
            <div key={wk} className="flex h-full flex-1 flex-col justify-end" title={`week of ${wk}: ${n}`}>
              <div
                className={`w-full rounded-sm ${n >= goal ? "bg-accent" : n > 0 ? "bg-[var(--recency-hi)]" : "bg-grid"}`}
                style={{ height: `${Math.max(4, (n / peak) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-ink-3">
          <span>{WEEKS} weeks ago</span>
          <span>this week</span>
        </div>
      </Card>

      <Card kicker="Log" title={`${data.recent.length} sessions`}>
        {data.recent.map((s) => {
          const dimmed = s.status === "discarded";
          return (
            <button
              key={s.id}
              onClick={() => setOpen(s)}
              className={`flex w-full items-center gap-3 border-t border-hairline py-2.5 text-left first:border-t-0 active:opacity-70 ${
                dimmed ? "opacity-45" : ""
              }`}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-page text-[13px] font-semibold"
                style={{ color: PLAN_COLOR[s.planId] ?? "var(--ink-2)" }}
              >
                {s.planId}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{s.planTitle}</span>
                <span className="block text-[11px] text-ink-3">
                  {new Date(s.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="tnum block text-[13px]">{setsDone(s)} sets</span>
                {s.status !== "done" && (
                  <span className="block text-[10px] uppercase tracking-wide text-ink-3">{s.status}</span>
                )}
              </span>
            </button>
          );
        })}
      </Card>

      {open && <SessionSheet session={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SessionSheet({ session, onClose }: { session: WorkoutSessionRow; onClose: () => void }) {
  const [note, setNote] = useState(session.note ?? "");
  const mins = Math.round(((session.endedAt ?? session.startedAt) - session.startedAt) / 60000);
  return (
    <Sheet
      title={`Day ${session.planId} · ${session.planTitle}`}
      subtitle={`${new Date(session.date + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })} · ${mins < 1 ? "under a minute" : `${mins} min`} · ${setsDone(session)} sets${
        session.status !== "done" ? ` · ${session.status}` : ""
      }`}
      onClose={onClose}
    >
      {/* one free line, for the progression actually used — not rep tracking */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note, e.g. tuck front lever"
        maxLength={80}
        className="h-12 w-full rounded-xl bg-page px-3 text-[14px] text-ink placeholder:text-ink-3"
      />
      <SheetButton
        tone="primary"
        onClick={() => {
          void setSessionNote(session.id, note.trim());
          onClose();
        }}
      >
        Save note
      </SheetButton>
      <SheetButton
        tone="danger"
        onClick={() => {
          if (!confirm("Delete this session? It cannot be recovered.")) return;
          void deleteWorkoutSession(session.id);
          onClose();
        }}
      >
        Delete session
      </SheetButton>
      <p className="text-center text-[11px] text-ink-3">
        Started {new Date(session.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        {session.endedAt ? ` · ${fmtDuration((session.endedAt - session.startedAt) / 1000)}` : ""}
      </p>
    </Sheet>
  );
}
