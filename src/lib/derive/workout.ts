// Pure session predicates. Kept out of the UI so the player, the boot reaper and
// the weekly count can never disagree about what "done" means.
import type { PlanExercise, WorkoutPlanRow, WorkoutSessionRow } from "../db/schema";

/** Warmup and cooldown never gate completion: skipping the stretch must not
 *  demote a real session to "partial". */
export function mainExercises(plan: WorkoutPlanRow): PlanExercise[] {
  return plan.exercises.filter((e) => e.block === "main");
}

export function setsDone(session: WorkoutSessionRow): number {
  return Object.values(session.progress).reduce((a, b) => a + b, 0);
}

/** Progress over non-skipped steps, using max(planned, done) so an extra set
 *  cannot push past 100% and skipping still lets the bar reach 100%. */
export function sessionProgress(
  plan: WorkoutPlanRow,
  session: WorkoutSessionRow,
): { done: number; total: number; pct: number } {
  const skipped = new Set(session.skipped ?? []);
  let done = 0;
  let total = 0;
  for (const e of plan.exercises) {
    if (skipped.has(e.id)) continue;
    const d = session.progress[e.id] ?? 0;
    done += d;
    total += Math.max(e.sets, d);
  }
  return { done, total, pct: total === 0 ? 0 : Math.min(100, (done / total) * 100) };
}

/** How many main exercises he actually worked (at least one set, or explicitly
 *  skipped after working). The "5 of 6 exercises" numerator. */
export function mainExercisesTouched(plan: WorkoutPlanRow, session: WorkoutSessionRow): number {
  return mainExercises(plan).filter((e) => (session.progress[e.id] ?? 0) > 0).length;
}

/** Every main exercise has at least one set in. Not "every set of every
 *  exercise": his plan is explicit that the numbers are orientation, so
 *  working an exercise counts as having done it. */
export function isSessionComplete(plan: WorkoutPlanRow, session: WorkoutSessionRow): boolean {
  const skipped = new Set(session.skipped ?? []);
  const main = mainExercises(plan).filter((e) => !skipped.has(e.id));
  return main.length > 0 && main.every((e) => (session.progress[e.id] ?? 0) > 0);
}

/** Some work done but not all: the only case that earns a prompt on quit.
 *  Quitting with nothing done is discarded silently, because nothing happened. */
export function shouldPromptOnQuit(plan: WorkoutPlanRow, session: WorkoutSessionRow): boolean {
  return setsDone(session) > 0 && !isSessionComplete(plan, session);
}

/** Counts toward the weekly goal. */
export function countsTowardWeek(s: WorkoutSessionRow): boolean {
  return s.status === "done" || s.status === "partial";
}
