// Two app-level sheets: the finish acknowledgement, and the verdict prompt for a
// session that was left running (app killed, or he forgot to end it yesterday).
import { useLiveQuery } from "dexie-react-hooks";
import { useWorkout } from "../../store/workoutStore";
import { useSettings } from "../../store/settingsStore";
import { setsDone } from "../../lib/derive/workout";
import { addScheduleSlot, hasFutureSlot, nextPlanInRotation, suggestNextWorkoutDates } from "../../lib/db/workouts";
import { fmtDuration } from "../../lib/format";
import { Sheet, SheetButton } from "../components/Sheet";

/** Finishing logs silently — no questions — but after 45 minutes of work the
 *  acknowledgement is the point, so this is a summary and not a question.
 *  It then offers to schedule the next session, but only when nothing is
 *  already scheduled ahead: that condition is what keeps it from nagging. */
export function WorkoutFinishedSheet() {
  const finished = useWorkout((s) => s.finished);
  const dismiss = useWorkout((s) => s.dismissFinished);
  const ask = useSettings((s) => s.workouts.askToScheduleNext);
  const restDays = useSettings((s) => s.workouts.minRestDaysBetweenWorkouts);

  const offer = useLiveQuery(async () => {
    if (!finished || !ask) return null;
    if (await hasFutureSlot("workout")) return null; // already planned ahead
    const [next, dates] = await Promise.all([
      nextPlanInRotation(),
      suggestNextWorkoutDates(restDays, 3),
    ]);
    return next && dates.length ? { next, dates } : null;
  }, [finished?.id, ask, restDays]);

  if (!finished) return null;
  const mins = Math.round(((finished.endedAt ?? Date.now()) - finished.startedAt) / 60000);
  return (
    <Sheet
      title={`Day ${finished.planId} done`}
      subtitle={`${mins < 1 ? "under a minute" : `${mins} min`} · ${setsDone(finished)} sets${
        finished.status === "partial" ? " · counted as partial" : ""
      }`}
      onClose={dismiss}
    >
      {offer && (
        <>
          <p className="text-[13px] text-ink-2">
            Nothing scheduled yet. Put day {offer.next.id} in the calendar?
          </p>
          {offer.dates.map((d) => (
            <SheetButton
              key={d}
              onClick={() => {
                // letterless: the session it becomes follows from the upcoming order
                void addScheduleSlot(d, { kind: "workout", planId: null, source: "manual" });
                dismiss();
              }}
            >
              {new Date(d + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
            </SheetButton>
          ))}
        </>
      )}
      <SheetButton tone="primary" onClick={dismiss}>
        {offer ? "Not now" : "Done"}
      </SheetButton>
    </Sheet>
  );
}

/** Asked once, on the next app open, for a session that was interrupted with
 *  real work in it. Nothing-was-done sessions are dropped silently instead. */
export function StaleSessionSheet() {
  const pending = useWorkout((s) => s.pendingVerdict);
  const resolve = useWorkout((s) => s.resolveVerdict);
  if (!pending) return null;
  const when = new Date(pending.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" });
  return (
    <Sheet
      title={`Day ${pending.planId} was left running`}
      subtitle={`${when}, ${setsDone(pending)} sets in, ${fmtDuration(
        ((pending.endedAt ?? pending.startedAt) - pending.startedAt) / 1000,
      )}. Should it count as a workout?`}
      onClose={() => void resolve(false)}
    >
      <SheetButton tone="primary" onClick={() => void resolve(true)}>
        Count it
      </SheetButton>
      <SheetButton tone="danger" onClick={() => void resolve(false)}>
        Discard
      </SheetButton>
    </Sheet>
  );
}
