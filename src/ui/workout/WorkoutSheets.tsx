// Two app-level sheets: the finish acknowledgement, and the verdict prompt for a
// session that was left running (app killed, or he forgot to end it yesterday).
import { useWorkout } from "../../store/workoutStore";
import { setsDone } from "../../lib/derive/workout";
import { fmtDuration } from "../../lib/format";
import { Sheet, SheetButton } from "../components/Sheet";

/** Finishing logs silently — no questions — but after 45 minutes of work the
 *  acknowledgement is the point, so this is a summary and not a question. */
export function WorkoutFinishedSheet() {
  const finished = useWorkout((s) => s.finished);
  const dismiss = useWorkout((s) => s.dismissFinished);
  if (!finished) return null;
  const mins = Math.round(((finished.endedAt ?? Date.now()) - finished.startedAt) / 60000);
  return (
    <Sheet
      title={`Day ${finished.planId} done`}
      subtitle={`${mins} min · ${setsDone(finished)} sets${finished.status === "partial" ? " · counted as partial" : ""}`}
      onClose={dismiss}
    >
      <SheetButton tone="primary" onClick={dismiss}>
        Done
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
