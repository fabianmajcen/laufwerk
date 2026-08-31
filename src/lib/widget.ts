// Feeds the Android home-screen widget: whenever the app computes FabScore,
// a compact snapshot goes into Preferences (SharedPreferences "CapacitorStorage"
// on device), where the native ReadinessWidget reads it.
//
// The widget's main content is the week, so `days` is the important field here;
// the score and the counters are the summary line under it.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import type { FabResult } from "./derive/fabScore";
import type { TrainingWeek } from "./derive/trainingWeek";

/** Deliberately short keys: this is JSON in a SharedPreferences string. */
export interface WidgetDay {
  /** weekday label, "Mo".."Su" */
  l: string;
  /** session letters completed that day */
  w: string[];
  /** a run was logged */
  run: boolean;
  /** session letters planned and still outstanding */
  pw: string[];
  /** a run is planned and still outstanding */
  pr: boolean;
  /** rest: either deliberately planned or an empty day in the past */
  rest: boolean;
  restPlanned: boolean;
  /** today */
  t: boolean;
}

export interface WidgetData {
  score: number;
  verdict: string; // "Train" | "Easy only" | "Rest"
  color: string; // verdict hex
  weekLine: string; // "Runs 1/2 · Cali 2/3 · 5.2 km"
  done: number;
  planned: number;
  caliDone: number;
  caliPlanned: number;
  days: WidgetDay[];
  updatedAt: number;
}

const VERDICT_META: Record<string, { word: string; color: string }> = {
  train: { word: "Train", color: "#0ca30c" },
  easy: { word: "Easy only", color: "#fab219" },
  rest: { word: "Rest", color: "#d03b3b" },
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Same rules as the in-app week strip, so the two never disagree. */
function toWidgetDays(week: TrainingWeek): WidgetDay[] {
  return week.days.map((d, i) => {
    const w = d.sessions.map((s) => s.planId);
    const pw = d.slots.filter((s) => s.kind === "workout" && !s.fulfilled).map((s) => s.planId ?? "?");
    const pr = d.slots.some((s) => s.kind === "run" && !s.fulfilled);
    const restPlanned = d.slots.some((s) => s.kind === "rest");
    const run = d.runs.length > 0;
    const empty = !run && !w.length && !pw.length && !pr && !restPlanned;
    return {
      l: WEEKDAYS[i],
      w,
      run,
      pw,
      pr,
      // a past day with nothing on it reads as rest too, just fainter
      rest: restPlanned || (empty && d.isPast),
      restPlanned,
      t: d.isToday,
    };
  });
}

export async function updateWidgetData(fab: FabResult, week: TrainingWeek): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (fab.score == null || fab.verdict == null) return;
  const meta = VERDICT_META[fab.verdict];
  const data: WidgetData = {
    score: fab.score,
    verdict: meta.word,
    color: meta.color,
    weekLine: `Runs ${week.runs.done}/${week.runs.planned} · Cali ${week.workouts.done}/${week.workouts.planned} · ${week.runs.km.toFixed(1)} km`,
    done: week.runs.done,
    planned: week.runs.planned,
    caliDone: week.workouts.done,
    caliPlanned: week.workouts.planned,
    days: toWidgetDays(week),
    updatedAt: Date.now(),
  };
  await Preferences.set({ key: "widgetData", value: JSON.stringify(data) }).catch(() => {});
}
