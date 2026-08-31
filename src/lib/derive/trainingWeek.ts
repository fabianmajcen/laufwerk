// One week of training, runs and workouts together. Extracted because the week
// window was being recomputed in two places (the Today card and the widget
// effect), and the workout row plus the scheduler would have made it four.
import type { ActivityRow, ScheduleDayRow, WorkoutSessionRow } from "../db/schema";
import { countsTowardWeek } from "./workout";
import { weekStartOf } from "./weekly";
import { isoDate, parseGarminLocal } from "../format";

export interface TrainingDay {
  date: string;
  isToday: boolean;
  isPast: boolean;
  runs: ActivityRow[];
  sessions: WorkoutSessionRow[];
  /** fulfilment is derived, never stored: runs arrive from Garmin long after a
   *  slot was written, so a stored flag would go stale */
  slots: { kind: "workout" | "run"; planId?: string | null; fulfilled: boolean }[];
}

export interface TrainingWeek {
  weekStart: Date;
  weekStartIso: string;
  runs: { done: number; planned: number; km: number };
  workouts: { done: number; planned: number; floor: number; letters: string[] };
  days: TrainingDay[];
}

export function weekRange(weeksBack = 0, now = new Date()): { start: Date; end: Date } {
  const start = weekStartOf(now);
  start.setDate(start.getDate() - weeksBack * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function buildTrainingWeek(args: {
  weeksBack?: number;
  runs: ActivityRow[];
  sessions: WorkoutSessionRow[];
  schedule?: ScheduleDayRow[];
  goals: { runsPerWeek: number; workoutsPerWeek: number; minWorkoutsPerWeek: number };
  now?: Date;
}): TrainingWeek {
  const now = args.now ?? new Date();
  const { start, end } = weekRange(args.weeksBack ?? 0, now);
  const startIso = isoDate(start);
  const todayIso = isoDate(now);

  const runsIn = args.runs.filter((r) => {
    const d = parseGarminLocal(r.startTimeLocal);
    return d >= start && d < end;
  });
  const endIso = isoDate(new Date(end.getTime() - 86400000));
  const sessionsIn = args.sessions
    .filter(countsTowardWeek)
    .filter((s) => s.date >= startIso && s.date <= endIso);

  const days: TrainingDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = isoDate(d);
    const dayRuns = runsIn.filter((r) => isoDate(parseGarminLocal(r.startTimeLocal)) === iso);
    const daySessions = sessionsIn.filter((s) => s.date === iso);
    const planned = args.schedule?.find((s) => s.date === iso)?.slots ?? [];
    let runsLeft = dayRuns.length;
    let sessionsLeft = daySessions.length;
    days.push({
      date: iso,
      isToday: iso === todayIso,
      isPast: iso < todayIso,
      runs: dayRuns,
      sessions: daySessions,
      slots: planned.map((slot) => {
        // a slot is filled by any matching activity that day, regardless of
        // which plan: scheduled B and did C still counts
        if (slot.kind === "run" && runsLeft > 0) {
          runsLeft--;
          return { kind: slot.kind, planId: slot.planId, fulfilled: true };
        }
        if (slot.kind === "workout" && sessionsLeft > 0) {
          sessionsLeft--;
          return { kind: slot.kind, planId: slot.planId, fulfilled: true };
        }
        return { kind: slot.kind, planId: slot.planId, fulfilled: false };
      }),
    });
  }

  return {
    weekStart: start,
    weekStartIso: startIso,
    runs: {
      done: runsIn.length,
      planned: args.goals.runsPerWeek,
      km: runsIn.reduce((s, r) => s + (r.distance ?? 0) / 1000, 0),
    },
    workouts: {
      done: sessionsIn.length,
      planned: args.goals.workoutsPerWeek,
      floor: args.goals.minWorkoutsPerWeek,
      letters: sessionsIn.map((s) => s.planId),
    },
    days,
  };
}
