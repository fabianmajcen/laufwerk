import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlanParams {
  runsPerWeek: number;
  minutesPerRun: number;
  /** plan rule from training_plan.md: at least one rest day between runs */
  minRestDaysBetweenRuns: number;
}

export interface WorkoutParams {
  /** weekly target; he does 2-3, so the last slot renders as a bonus */
  workoutsPerWeek: number;
  minWorkoutsPerWeek: number;
  minRestDaysBetweenWorkouts: number;
  /** rest-over cue: audio rides the media volume stream, vibration is the
   *  independent fallback */
  restCueSound: boolean;
  restCueVibrate: boolean;
  /** keep the screen on for the duration of a session */
  keepAwake: boolean;
  /** offer to schedule the next session after finishing one */
  askToScheduleNext: boolean;
  /** used only when an exercise defines no rest of its own */
  defaultRestSec: number;
}

interface SettingsState {
  backfillDays: number;
  /** per-day metrics are the expensive ones; readiness/status need less depth */
  readinessBackfillDays: number;
  politenessDelayMs: number;
  theme: "dark" | "light" | "system";
  plan: PlanParams;
  workouts: WorkoutParams;
  set: (partial: Partial<Omit<SettingsState, "set" | "setPlan" | "setWorkouts">>) => void;
  setPlan: (partial: Partial<PlanParams>) => void;
  setWorkouts: (partial: Partial<WorkoutParams>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      backfillDays: 90,
      readinessBackfillDays: 30,
      politenessDelayMs: 350,
      theme: "dark",
      plan: { runsPerWeek: 2, minutesPerRun: 37.5, minRestDaysBetweenRuns: 1 },
      workouts: {
        workoutsPerWeek: 3,
        minWorkoutsPerWeek: 2,
        minRestDaysBetweenWorkouts: 1,
        restCueSound: true,
        restCueVibrate: true,
        keepAwake: true,
        askToScheduleNext: true,
        defaultRestSec: 90,
      },
      set: (partial) => set(partial),
      setPlan: (partial) => set((s) => ({ plan: { ...s.plan, ...partial } })),
      setWorkouts: (partial) => set((s) => ({ workouts: { ...s.workouts, ...partial } })),
    }),
    {
      name: "laufwerk-settings",
      // zustand's default merge is SHALLOW, so a key added inside a nested
      // object reads as undefined for anyone who already has state on disk.
      // Merging the known nested groups by hand fixes that for good.
      //
      // Do NOT add `version` here without a `migrate`: persist would find the
      // stored state at version 0, fail to migrate it, and discard every
      // setting. `merge` alone solves the problem with no such risk.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          plan: { ...current.plan, ...(p.plan ?? {}) },
          workouts: { ...current.workouts, ...(p.workouts ?? {}) },
        };
      },
    },
  ),
);
