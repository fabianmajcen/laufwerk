import { create } from "zustand";

export type AuthStatus = "unknown" | "disconnected" | "connected" | "expired";
export type SyncPhase = "idle" | "planning" | "running" | "error" | "done";

interface SyncState {
  authStatus: AuthStatus;
  displayName: string | null;
  phase: SyncPhase;
  done: number;
  total: number;
  currentLabel: string;
  lastError: string | null;
  lastSyncAt: number | null;
  setAuth: (status: AuthStatus, displayName?: string | null) => void;
  progress: (done: number, total: number, label: string) => void;
  setPhase: (phase: SyncPhase, error?: string | null) => void;
  setLastSyncAt: (t: number) => void;
}

export const useSync = create<SyncState>((set) => ({
  authStatus: "unknown",
  displayName: null,
  phase: "idle",
  done: 0,
  total: 0,
  currentLabel: "",
  lastError: null,
  lastSyncAt: null,
  setAuth: (authStatus, displayName) =>
    set((s) => ({ authStatus, displayName: displayName !== undefined ? displayName : s.displayName })),
  progress: (done, total, currentLabel) => set({ done, total, currentLabel }),
  setPhase: (phase, lastError = null) => set({ phase, lastError }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}));
