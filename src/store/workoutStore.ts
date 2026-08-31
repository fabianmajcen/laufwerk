// The live session. Lives here rather than in the Train tab because tabs
// unmount when you switch away, which would kill a workout mid-set.
//
// The store is the working copy; the Dexie row with status "active" is the
// durable truth. Writes go through on discrete transitions only (set done, side
// done, skip, jump, rest change, hold start/stop, finish) — never on a tick — so
// a force-kill resumes at the last thing he actually did.
import { create } from "zustand";
import type { PlanExercise, WorkoutPlanRow, WorkoutSessionRow } from "../lib/db/schema";
import {
  finishWorkoutSession,
  getActiveWorkoutSession,
  getWorkoutPlan,
  saveWorkoutSession,
  startWorkoutSession,
} from "../lib/db/workouts";
import { isSessionComplete, shouldPromptOnQuit } from "../lib/derive/workout";
import { cue, primeAudio } from "../lib/workouts/cues";
import { restOverBuzz, successBuzz, tapFeedback } from "../lib/haptics";
import { useSettings } from "./settingsStore";

interface WorkoutState {
  session: WorkoutSessionRow | null;
  plan: WorkoutPlanRow | null;
  /** player visible vs minimized to the mini-bar */
  playerOpen: boolean;
  /** a stale session from an earlier day, waiting for a verdict */
  pendingVerdict: WorkoutSessionRow | null;
  /** set when the session just finished, so the player can show a summary */
  finished: WorkoutSessionRow | null;

  hydrate: () => Promise<void>;
  start: (planId: string) => Promise<void>;
  open: () => void;
  minimize: () => void;
  /** one set (or the second side of a per-side set) done */
  completeSet: () => void;
  undoSet: () => void;
  skipExercise: () => void;
  jumpTo: (index: number) => void;
  startHold: () => void;
  stopHold: () => void;
  addRest: (sec: number) => void;
  skipRest: () => void;
  cueRestOver: (deadline: number) => void;
  finish: (status?: "done" | "partial" | "discarded") => Promise<void>;
  dismissFinished: () => void;
  resolveVerdict: (counts: boolean) => Promise<void>;
}

const persist = (row: WorkoutSessionRow) => void saveWorkoutSession(row).catch(() => {});

export const useWorkout = create<WorkoutState>((set, get) => ({
  session: null,
  plan: null,
  playerOpen: false,
  pendingVerdict: null,
  finished: null,

  hydrate: async () => {
    const active = await getActiveWorkoutSession();
    if (!active) return;
    const plan = await getWorkoutPlan(active.planId);
    if (!plan) return; // plan archived out from under it: leave it for the reaper
    const today = new Date().toISOString().slice(0, 10);
    const stale = active.date !== today || Date.now() - active.startedAt > 6 * 3600 * 1000;
    if (stale) {
      set({ pendingVerdict: active });
      return;
    }
    // land straight back in the player: he was mid-workout
    set({ session: active, plan, playerOpen: true });
  },

  start: async (planId) => {
    // must run inside the click handler, before any await, or audio stays mute
    primeAudio();
    const plan = await getWorkoutPlan(planId);
    if (!plan) return;
    const session = await startWorkoutSession(planId);
    set({ session, plan, playerOpen: true, finished: null });
  },

  open: () => set({ playerOpen: true }),
  minimize: () => set({ playerOpen: false }),

  completeSet: () => {
    const { session, plan } = get();
    if (!session || !plan) return;
    primeAudio(); // re-unlock after a backgrounding, still inside the gesture
    tapFeedback();
    const step = stepAt(plan, session);
    if (!step) return;

    // per-side: the first tap banks the left side and starts no rest
    if (step.perSide && !session.halfSet) {
      const next = { ...session, halfSet: true, holdStartedAt: null };
      set({ session: next });
      persist(next);
      return;
    }

    const done = (session.progress[step.id] ?? 0) + 1;
    const progress = { ...session.progress, [step.id]: done };
    // doing a set on a skipped exercise un-skips it: recovering from a
    // mis-tapped skip should just be a matter of doing the work
    const skipped = (session.skipped ?? []).filter((id) => id !== step.id);
    const lastSet = done >= step.sets;
    const cursor = lastSet ? Math.min((session.cursor ?? 0) + 1, plan.exercises.length) : (session.cursor ?? 0);
    // rest is per exercise; 0 means self-paced, so never invent one
    const rest = lastSet ? nextRestFor(plan, cursor) : step.restSec;
    const next: WorkoutSessionRow = {
      ...session,
      progress,
      skipped,
      cursor,
      halfSet: false,
      holdStartedAt: null,
      restEndsAt: rest > 0 ? Date.now() + rest * 1000 : null,
      restCuedAt: null,
    };
    set({ session: next });
    persist(next);
  },

  undoSet: () => {
    const { session, plan } = get();
    if (!session || !plan) return;
    // undo applies to the exercise we are on, or the previous one if we just
    // advanced off the end of it
    let idx = session.cursor ?? 0;
    let step = plan.exercises[idx];
    if (!step || (session.progress[step.id] ?? 0) === 0) {
      idx = Math.max(0, idx - 1);
      step = plan.exercises[idx];
    }
    if (!step) return;
    const done = Math.max(0, (session.progress[step.id] ?? 0) - 1);
    const next: WorkoutSessionRow = {
      ...session,
      progress: { ...session.progress, [step.id]: done },
      cursor: idx,
      halfSet: false,
      restEndsAt: null,
      restCuedAt: null,
      holdStartedAt: null,
    };
    set({ session: next });
    persist(next);
  },

  skipExercise: () => {
    const { session, plan } = get();
    if (!session || !plan) return;
    const step = stepAt(plan, session);
    if (!step) return;
    const cursor = Math.min((session.cursor ?? 0) + 1, plan.exercises.length);
    const next: WorkoutSessionRow = {
      ...session,
      skipped: [...(session.skipped ?? []), step.id],
      cursor,
      halfSet: false,
      restEndsAt: null,
      restCuedAt: null,
      holdStartedAt: null,
    };
    set({ session: next });
    persist(next);
  },

  jumpTo: (index) => {
    const { session, plan } = get();
    if (!session || !plan) return;
    const cursor = Math.max(0, Math.min(index, plan.exercises.length - 1));
    const next: WorkoutSessionRow = {
      ...session,
      cursor,
      halfSet: false,
      restEndsAt: null,
      restCuedAt: null,
      holdStartedAt: null,
    };
    set({ session: next });
    persist(next);
  },

  startHold: () => {
    const { session } = get();
    if (!session) return;
    primeAudio();
    const next = { ...session, holdStartedAt: Date.now() };
    set({ session: next });
    persist(next);
  },

  stopHold: () => {
    const { session } = get();
    if (!session) return;
    const next = { ...session, holdStartedAt: null };
    set({ session: next });
    persist(next);
  },

  addRest: (sec) => {
    const { session } = get();
    if (!session?.restEndsAt) return;
    const next = { ...session, restEndsAt: session.restEndsAt + sec * 1000, restCuedAt: null };
    set({ session: next });
    persist(next);
  },

  skipRest: () => {
    const { session } = get();
    if (!session) return;
    const next = { ...session, restEndsAt: null, restCuedAt: null };
    set({ session: next });
    persist(next);
  },

  /** Guarded on the persisted restCuedAt so the cue fires exactly once per
   *  deadline, across StrictMode remounts, backgrounding and app kills. */
  cueRestOver: (deadline) => {
    const { session } = get();
    if (!session || session.restCuedAt === deadline) return;
    const next = { ...session, restCuedAt: deadline };
    set({ session: next });
    persist(next);
    const s = useSettings.getState().workouts;
    if (s.restCueSound) cue("restOver");
    if (s.restCueVibrate) restOverBuzz();
  },

  finish: async (status) => {
    const { session, plan } = get();
    if (!session || !plan) return;
    const resolved = status ?? (isSessionComplete(plan, session) ? "done" : "partial");
    await finishWorkoutSession(session.id, resolved);
    if (resolved !== "discarded") {
      if (useSettings.getState().workouts.restCueSound) cue("sessionDone");
      successBuzz();
    }
    set({
      session: null,
      plan: null,
      playerOpen: false,
      finished: resolved === "discarded" ? null : { ...session, status: resolved, endedAt: Date.now() },
    });
  },

  dismissFinished: () => set({ finished: null }),

  resolveVerdict: async (counts) => {
    const { pendingVerdict } = get();
    if (!pendingVerdict) return;
    await finishWorkoutSession(pendingVerdict.id, counts ? "partial" : "discarded");
    set({ pendingVerdict: null });
  },
}));

// Dev-only handle so the rest timer can be driven without waiting out real
// 2-3 minute rests (and so the exactly-once cue guarantee is testable).
if (import.meta.env.DEV) {
  (window as unknown as { __workout?: typeof useWorkout }).__workout = useWorkout;
}

// ---------- helpers shared with the UI ----------

export function stepAt(plan: WorkoutPlanRow, session: WorkoutSessionRow): PlanExercise | undefined {
  return plan.exercises[session.cursor ?? 0];
}

/** Rest after finishing the exercise at `cursor - 1`: use that exercise's own
 *  rest, since rest belongs to the work just done. */
function nextRestFor(plan: WorkoutPlanRow, cursor: number): number {
  const justDone = plan.exercises[cursor - 1];
  return justDone?.restSec ?? 0;
}

export function sessionNeedsQuitPrompt(plan: WorkoutPlanRow, session: WorkoutSessionRow): boolean {
  return shouldPromptOnQuit(plan, session);
}
