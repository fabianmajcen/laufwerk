// The bottom dock: the one control he actually uses, always in the same place
// and never scrolled away. Three states — working, timing a hold, resting.
//
// Rule learned the hard way: the working control is NEVER replaced. An early
// version swapped the whole dock for "Finish session" as soon as every main
// exercise had one set, which locked him out of his remaining sets and the
// whole cooldown. Finish is an addition, never a substitution.
import type { PlanExercise, WorkoutSessionRow } from "../../lib/db/schema";
import { fmtClock, useNow } from "../../lib/timer";

export function ActionDock({
  step,
  session,
  allDone,
  onSetDone,
  onStartHold,
  onStopHold,
  onMore,
  onAddRest,
  onSkipRest,
  onFinish,
}: {
  step: PlanExercise | undefined;
  session: WorkoutSessionRow;
  allDone: boolean;
  onSetDone: () => void;
  onStartHold: () => void;
  onStopHold: () => void;
  onMore: () => void;
  onAddRest: (sec: number) => void;
  onSkipRest: () => void;
  onFinish: () => void;
}) {
  const resting = session.restEndsAt != null;
  const holding = session.holdStartedAt != null;
  // only tick while something is actually counting
  const now = useNow(resting || holding);

  if (resting && session.restEndsAt != null) {
    const remaining = (session.restEndsAt - now) / 1000;
    const over = remaining <= 0;
    return (
      <div className="text-center">
        <div className="kicker">{over ? "Rest over" : "Rest"}</div>
        <div className={`tnum mt-1 text-[52px] font-semibold leading-none ${over ? "text-status-good" : ""}`}>
          {over ? "Go" : fmtClock(remaining)}
        </div>
        <div className="mt-3 flex gap-2">
          <DockBtn onClick={() => onAddRest(30)}>+30s</DockBtn>
          <DockBtn onClick={onSkipRest}>{over ? "Continue" : "Skip"}</DockBtn>
        </div>
      </div>
    );
  }

  if (holding && session.holdStartedAt != null) {
    const held = (now - session.holdStartedAt) / 1000;
    return (
      <div className="text-center">
        <div className="kicker">Holding · target {step?.target}</div>
        <div className="tnum mt-1 text-[52px] font-semibold leading-none">{fmtClock(held)}</div>
        <div className="mt-3 flex gap-2">
          <DockBtn onClick={onStopHold}>Cancel</DockBtn>
          <button
            onClick={onSetDone}
            className="h-11 flex-[2] rounded-xl bg-accent text-[15px] font-medium text-white active:opacity-80"
          >
            Hold done
          </button>
        </div>
      </div>
    );
  }

  // past the last exercise: nothing left to log, so finishing IS the action
  if (!step) {
    return (
      <button
        onClick={onFinish}
        className="h-16 w-full rounded-2xl bg-status-good text-[17px] font-semibold text-white active:opacity-80"
      >
        Finish session
      </button>
    );
  }

  const sideLabel = step.perSide ? (session.halfSet ? "Right done" : "Left done") : null;
  return (
    <div>
      <button
        onClick={onSetDone}
        className="h-16 w-full rounded-2xl bg-accent text-[17px] font-semibold text-white active:opacity-80"
      >
        {sideLabel ?? (step.kind === "attempts" ? "Attempt done" : "Set done")}
      </button>
      <div className="mt-2 flex gap-2">
        {step.kind === "hold" && !step.perSide && <DockBtn onClick={onStartHold}>Time the hold</DockBtn>}
        {/* skip and undo live behind this: both are rare, both are destructive,
            and neither belongs a thumb's width from the button pressed 25 times
            a session */}
        <DockBtn onClick={onMore} ariaLabel="More session actions">
          ⋯
        </DockBtn>
      </div>
      {allDone && (
        <button
          onClick={onFinish}
          className="mt-2 h-11 w-full rounded-xl border border-status-good/40 text-[14px] font-medium text-status-good active:opacity-70"
        >
          Finish session
        </button>
      )}
    </div>
  );
}

function DockBtn({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="h-11 flex-1 rounded-xl bg-elevated text-[14px] text-ink-2 active:opacity-70"
    >
      {children}
    </button>
  );
}
