import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlanParams {
  runsPerWeek: number;
  minutesPerRun: number;
  /** plan rule from training_plan.md: at least one rest day between runs */
  minRestDaysBetweenRuns: number;
}

interface SettingsState {
  backfillDays: number;
  /** per-day metrics are the expensive ones; readiness/status need less depth */
  readinessBackfillDays: number;
  politenessDelayMs: number;
  theme: "dark" | "light" | "system";
  plan: PlanParams;
  set: (partial: Partial<Omit<SettingsState, "set" | "setPlan">>) => void;
  setPlan: (partial: Partial<PlanParams>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      backfillDays: 90,
      readinessBackfillDays: 30,
      politenessDelayMs: 350,
      theme: "dark",
      plan: { runsPerWeek: 2, minutesPerRun: 37.5, minRestDaysBetweenRuns: 1 },
      set: (partial) => set(partial),
      setPlan: (partial) => set((s) => ({ plan: { ...s.plan, ...partial } })),
    }),
    { name: "laufwerk-settings" },
  ),
);
