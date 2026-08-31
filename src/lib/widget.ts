// Feeds the Android home-screen widget: whenever the app computes FabScore,
// a compact snapshot goes into Preferences (SharedPreferences "CapacitorStorage"
// on device), where the native ReadinessWidget reads it.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { FabResult } from "./derive/fabScore";

export interface WidgetData {
  score: number;
  verdict: string; // "Train" | "Easy only" | "Rest"
  color: string; // verdict hex
  weekLine: string; // "Runs 1/2 · Cali 2/3 · 5.2 km"
  /** run slots: the native widget draws its pills from these, so they keep
   *  meaning runs and need no Java change */
  done: number;
  planned: number;
  /** written now though the Java ignores them: it reads with optInt, so a
   *  later Java-only release can draw a second pill row with no JS release */
  caliDone: number;
  caliPlanned: number;
  updatedAt: number;
}

const VERDICT_META: Record<string, { word: string; color: string }> = {
  train: { word: "Train", color: "#0ca30c" },
  easy: { word: "Easy only", color: "#fab219" },
  rest: { word: "Rest", color: "#d03b3b" },
};

export async function updateWidgetData(
  fab: FabResult,
  week: { done: number; planned: number; km: number; caliDone?: number; caliPlanned?: number },
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (fab.score == null || fab.verdict == null) return;
  const meta = VERDICT_META[fab.verdict];
  const data: WidgetData = {
    score: fab.score,
    verdict: meta.word,
    color: meta.color,
    weekLine:
      week.caliPlanned != null
        ? `Runs ${week.done}/${week.planned} · Cali ${week.caliDone ?? 0}/${week.caliPlanned} · ${week.km.toFixed(1)} km`
        : `Runs ${week.done}/${week.planned} · ${week.km.toFixed(1)} km this week`,
    done: week.done,
    planned: week.planned,
    caliDone: week.caliDone ?? 0,
    caliPlanned: week.caliPlanned ?? 0,
    updatedAt: Date.now(),
  };
  await Preferences.set({ key: "widgetData", value: JSON.stringify(data) }).catch(() => {});
}
