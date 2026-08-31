// The exercise list. Three states: done collapses to a dim line, the current one
// is a card with an accent ring (reads instantly, needs no keyframes), upcoming
// ones stay tappable so he can jump.
import { useEffect, useRef } from "react";
import type { WorkoutPlanRow, WorkoutSessionRow } from "../../lib/db/schema";

export function StepList({
  plan,
  session,
  onJump,
}: {
  plan: WorkoutPlanRow;
  session: WorkoutSessionRow;
  onJump: (i: number) => void;
}) {
  const cursor = session.cursor ?? 0;
  const currentRef = useRef<HTMLDivElement>(null);
  const skipped = new Set(session.skipped ?? []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    currentRef.current?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [cursor]);

  return (
    <div>
      {plan.exercises.map((e, i) => {
        const done = session.progress[e.id] ?? 0;
        const isSkipped = skipped.has(e.id);
        const isCurrent = i === cursor;

        if (isCurrent) {
          return (
            <div key={e.id + i} ref={currentRef} className="mx-4 mb-2 rounded-2xl bg-card p-4 ring-1 ring-accent">
              <div className="kicker">
                {e.block === "warmup" ? "Warm-up" : e.block === "cooldown" ? "Cooldown" : `Exercise ${mainIndex(plan, i)}`}
              </div>
              <h2 className="mt-0.5 flex flex-wrap items-center gap-2 text-[20px] font-semibold leading-tight">
                {e.name}
                {e.perSide && (
                  <span className="rounded-full bg-elevated px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-3">
                    per side
                  </span>
                )}
              </h2>
              <div className="mt-1 text-[13px] text-ink-2">{e.target}</div>

              <div className="mt-3 flex items-center gap-2">
                <span className="flex gap-1.5" aria-hidden>
                  {Array.from({ length: Math.max(e.sets, done) }, (_, k) => (
                    <span
                      key={k}
                      className={`h-2.5 w-2.5 rounded-full ${
                        k < done ? "bg-accent" : k === done ? "ring-1 ring-accent" : "ring-1 ring-hairline"
                      }`}
                    />
                  ))}
                </span>
                <span className="tnum text-[12px] text-ink-3">
                  set {Math.min(done + 1, e.sets)} of {e.sets}
                  {e.perSide && session.halfSet ? " · right side" : ""}
                </span>
              </div>

              {e.note && (
                <p className="mt-3 rounded-lg bg-elevated px-3 py-2 text-[12px] leading-relaxed text-ink-2">{e.note}</p>
              )}
            </div>
          );
        }

        const complete = done >= e.sets || isSkipped;
        return (
          <button
            key={e.id + i}
            onClick={() => onJump(i)}
            aria-label={`Jump to ${e.name}`}
            className="flex w-full items-center gap-3 px-5 py-2 text-left active:opacity-70"
          >
            <span className={`text-[13px] ${complete ? "text-ink-3" : "text-ink-2"}`} aria-hidden>
              {isSkipped ? "–" : complete ? "✓" : "○"}
            </span>
            <span className={`min-w-0 flex-1 truncate text-[13px] ${complete ? "text-ink-3" : "text-ink-2"}`}>
              {e.name}
            </span>
            <span className="tnum shrink-0 text-[12px] text-ink-3">
              {isSkipped ? "skipped" : `${done}/${e.sets}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** "Exercise 3" counts only main-block work, so the warmup doesn't shift it. */
function mainIndex(plan: WorkoutPlanRow, i: number): string {
  const main = plan.exercises.filter((e) => e.block === "main");
  const pos = main.findIndex((e) => e === plan.exercises[i]);
  return pos < 0 ? "" : `${pos + 1} of ${main.length}`;
}
