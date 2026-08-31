// The strip above the tab bar while a session is minimized: the single, obvious
// way back into the player. It ticks for display but owns no alarm — cues live
// in WorkoutRuntime, so they fire whether or not this is mounted.
import { useWorkout, stepAt } from "../../store/workoutStore";
import { fmtClock, useNow } from "../../lib/timer";

export function WorkoutMiniBar() {
  const session = useWorkout((s) => s.session);
  const plan = useWorkout((s) => s.plan);
  const open = useWorkout((s) => s.open);
  const resting = session?.restEndsAt != null;
  const now = useNow(resting);

  if (!session || !plan) return null;
  const step = stepAt(plan, session);
  const remaining = session.restEndsAt != null ? (session.restEndsAt - now) / 1000 : 0;

  return (
    <button
      onClick={open}
      aria-label={`Resume day ${plan.id} workout`}
      className="flex h-12 shrink-0 items-center gap-3 border-t border-hairline bg-elevated px-4 text-left active:opacity-80"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[13px]">
        Day {plan.id} ·{" "}
        {resting
          ? remaining > 0
            ? `resting ${fmtClock(remaining)}`
            : "rest over"
          : (step?.name ?? "session")}
      </span>
      <span className="shrink-0 text-[13px] font-medium text-accent">Resume</span>
    </button>
  );
}
