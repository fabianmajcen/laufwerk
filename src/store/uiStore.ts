import { create } from "zustand";

export type TabId = "today" | "training" | "runs" | "sleep" | "trends";
const TAB_IDS: TabId[] = ["today", "training", "runs", "sleep", "trends"];

interface UiState {
  tab: TabId;
  /** run to open when the Runs tab next renders (cross-tab deep link) */
  pendingRunId: number | null;
  setTab: (t: TabId) => void;
  openRun: (activityId: number) => void;
  consumePendingRun: () => void;
}

export const useUi = create<UiState>((set) => ({
  tab: (() => {
    const h = window.location.hash.replace("#", "") as TabId;
    return TAB_IDS.includes(h) ? h : "today";
  })(),
  pendingRunId: null,
  setTab: (tab) => set({ tab }),
  openRun: (activityId) => set({ tab: "runs", pendingRunId: activityId }),
  consumePendingRun: () => set({ pendingRunId: null }),
}));
