// Full-screen player. Rendered from App.tsx outside PullToSync (a downward
// swipe between sets would otherwise fire a Garmin sync) and above the tab bar.
//
// Android back MINIMIZES rather than quitting: back is the most reflexively
// pressed button on the phone, so a confirm dialog on every press would punish
// the common case (glance at something) to guard the rare one. Quitting is the
// explicit End button.
import { useCallback, useState } from "react";
import { useWorkout, stepAt } from "../../store/workoutStore";
import { useSettings } from "../../store/settingsStore";
import { useBackHandler } from "../../lib/backstack";
import { isSessionComplete, sessionProgress, setsDone } from "../../lib/derive/workout";
import { fmtDuration } from "../../lib/format";
import { useNow } from "../../lib/timer";
import { Sheet, SheetButton } from "../components/Sheet";
import { ActionDock } from "./ActionDock";
import { StepList } from "./StepList";

export function WorkoutPlayer() {
  const session = useWorkout((s) => s.session);
  const plan = useWorkout((s) => s.plan);
  const minimize = useWorkout((s) => s.minimize);
  const store = useWorkout;
  const [endOpen, setEndOpen] = useState(false);
  const sound = useSettings((s) => s.workouts.restCueSound);
  const setWorkouts = useSettings((s) => s.setWorkouts);

  // back closes the sheet first, otherwise minimizes; never destructive
  useBackHandler(!endOpen, useCallback(() => minimize(), [minimize]));

  // elapsed ticks once a second; cheap and only while the player is open
  const now = useNow(session != null, 1000);

  if (!session || !plan) return null;

  const step = stepAt(plan, session);
  const prog = sessionProgress(plan, session);
  const allDone = isSessionComplete(plan, session);
  const elapsed = Math.max(0, (now - session.startedAt) / 1000);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-page">
      <header className="flex shrink-0 items-center gap-1 px-1 py-1">
        <button onClick={minimize} aria-label="Minimize workout" className="p-3 text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium">
            Day {plan.id} · {plan.title}
          </div>
          <div className="tnum text-[11px] text-ink-3">{fmtDuration(elapsed)} elapsed</div>
        </div>
        <button
          onClick={() => setWorkouts({ restCueSound: !sound })}
          aria-label="Rest sound cue"
          aria-pressed={sound}
          className={`p-3 ${sound ? "text-ink-2" : "text-ink-3"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4z" />
            {sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7" /> : <path d="M16 9.5l4 5M20 9.5l-4 5" />}
          </svg>
        </button>
        <button onClick={() => setEndOpen(true)} className="px-3 py-3 text-[13px] text-ink-2">
          End
        </button>
      </header>

      <div
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(prog.pct)}
        className="mx-4 h-1 shrink-0 rounded-full bg-grid"
      >
        <div className="h-1 rounded-full bg-accent transition-[width] duration-300" style={{ width: `${prog.pct}%` }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        <StepList plan={plan} session={session} onJump={store.getState().jumpTo} onUndo={store.getState().undoSet} />
      </div>

      <div
        className="shrink-0 border-t border-hairline bg-card px-4 pt-3"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      >
        <ActionDock
          step={step}
          session={session}
          allDone={allDone}
          onSetDone={store.getState().completeSet}
          onStartHold={store.getState().startHold}
          onStopHold={store.getState().stopHold}
          onSkipExercise={store.getState().skipExercise}
          onAddRest={store.getState().addRest}
          onSkipRest={store.getState().skipRest}
          onFinish={() => void store.getState().finish()}
        />
      </div>

      {endOpen && (
        <Sheet
          title={`End day ${plan.id}?`}
          subtitle={
            setsDone(session) === 0
              ? "Nothing logged yet, so this will just be discarded."
              : `You are ${prog.done} of ${prog.total} sets in, ${fmtDuration(elapsed)}.`
          }
          onClose={() => setEndOpen(false)}
        >
          {setsDone(session) > 0 && (
            <SheetButton tone="primary" onClick={() => void store.getState().finish("partial")}>
              Count it
            </SheetButton>
          )}
          <SheetButton tone="danger" onClick={() => void store.getState().finish("discarded")}>
            Discard
          </SheetButton>
          <SheetButton onClick={() => setEndOpen(false)}>Keep going</SheetButton>
        </Sheet>
      )}
    </div>
  );
}
