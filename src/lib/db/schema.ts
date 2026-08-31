import Dexie, { type Table } from "dexie";
import type { ActivityData, ActivitySummary, WellnessRow } from "../garmin/types";

export interface SyncStateRow {
  key: string;
  value: unknown;
}

export interface KvRow {
  key: string;
  value: unknown;
}

export interface ActivityRow extends ActivitySummary {
  /** duplicated from activityType.typeKey for indexing */
  typeKey: string;
  /** manually excluded from analytics; set at read time, never stored on the
   *  row itself (the sync engine overwrites rows from Garmin) */
  excluded?: boolean;
}

// ---------- calisthenics (v2) ----------
// Workout data is USER-AUTHORED and never re-syncable, unlike everything above
// it, which comes from Garmin. Two consequences that must not be undone:
//   1. it must be in exportAll(), and
//   2. it must NOT be wiped by Settings' "Clear cached data".
// Workouts also never enter `activities`, which is what makes it structurally
// impossible for FabScore / ACWR to see them (running readiness stays a
// running score).

export type ExerciseKind = "hold" | "reps" | "attempts";
export type ExerciseBlock = "warmup" | "main" | "cooldown";

/** One line of a session. sets/restSec/target are ORIENTATION ONLY: never
 *  enforced, never compared against actuals. `target` is display prose lifted
 *  from cali_training_plan.md and is never parsed. */
export interface PlanExercise {
  /** slug, shared across plans so "how often did I train front lever" stays
   *  answerable later */
  id: string;
  name: string;
  /** "4 x 8-12s hold" */
  target: string;
  /** set dots to draw; the LOWER bound of any range, so finishing never leaves
   *  an orphan dot */
  sets: number;
  /** suggested rest; 0 = self-paced, no timer is started */
  restSec: number;
  /** upper end of a rest range, for display only */
  restSecMax?: number;
  kind: ExerciseKind;
  block: ExerciseBlock;
  /** two taps per set (left, then right), rest only after the second */
  perSide?: boolean;
  /** his own progression pick, e.g. "tuck front lever" — editable later */
  variant?: string;
  /** coaching note, verbatim from his plan: this is what guides a set */
  note?: string;
}

export interface WorkoutPlanRow {
  /** "A" | "B" | "C" */
  id: string;
  title: string;
  /** the per-day handstand focus line */
  subtitle?: string;
  order: number;
  estMinutes?: number;
  exercises: PlanExercise[];
  /** which seed produced this row; null once he edits it */
  seedVersion: number | null;
  /** seeding must never overwrite a true */
  userEdited: boolean;
  /** soft delete, so re-seeding cannot resurrect it and history still resolves */
  archived?: boolean;
  updatedAt: number;
}

export type SessionStatus =
  /** live and resumable */ "active"
  /** worked through the list — auto-logged, no prompt */ | "done"
  /** quit part-way, he said it counts */ | "partial"
  /** quit part-way, he said it does not */ | "discarded"
  /** app died with nothing done */ | "abandoned";

export interface WorkoutSessionRow {
  /** String(startedAt): unique and sortable */
  id: string;
  /** local isoDate of the START — the weekly bucket */
  date: string;
  planId: string;
  /** snapshots, so later plan edits cannot corrupt history */
  planTitle: string;
  plannedMainCount: number;
  status: SessionStatus;
  startedAt: number;
  endedAt: number | null;
  /** per-exercise sets ticked. Deliberately NOT reps, NOT load. */
  progress: Record<string, number>;
  skipped?: string[];
  note?: string;
  /** filled a scheduled slot */
  scheduled?: boolean;

  // --- live runtime, only meaningful while status === "active" ---
  // Kept on the row rather than in a ref so a process kill resumes mid-rest,
  // and so React StrictMode's mount/unmount/mount cannot double-fire the cue.
  /** index into the step list */
  cursor?: number;
  /** epoch ms — the rest timer's single source of truth (never a tick count) */
  restEndsAt?: number | null;
  /** the deadline already cued, making the alarm exactly-once */
  restCuedAt?: number | null;
  /** count-up hold stopwatch */
  holdStartedAt?: number | null;
  /** per-side: first side done */
  halfSet?: boolean;
}

export interface ScheduleSlot {
  kind: "workout" | "run";
  /** null = "a workout, decide later" */
  planId?: string | null;
  /** a re-suggest may rewrite "suggested" slots, never "manual" ones */
  source: "manual" | "suggested";
}

export interface ScheduleDayRow {
  /** YYYY-MM-DD, the primary key */
  date: string;
  /** one row per DAY: it is always read and written as a day */
  slots: ScheduleSlot[];
  updatedAt: number;
}

class LaufwerkDB extends Dexie {
  activities!: Table<ActivityRow, number>;
  activityData!: Table<ActivityData, number>;
  wellness!: Table<WellnessRow, [string, string]>;
  ranges!: Table<WellnessRow, [string, string]>;
  syncState!: Table<SyncStateRow, string>;
  kv!: Table<KvRow, string>;
  workoutPlans!: Table<WorkoutPlanRow, string>;
  workoutSessions!: Table<WorkoutSessionRow, string>;
  schedule!: Table<ScheduleDayRow, string>;

  constructor() {
    super("laufwerk");
    this.version(1).stores({
      activities: "activityId, startTimeLocal, typeKey",
      activityData: "activityId",
      wellness: "[metric+date], date, metric",
      ranges: "[metric+date], date, metric",
      syncState: "key",
      kv: "key",
    });
    // A later version() is a DELTA: only new/changed tables are listed, and v1
    // stays exactly as written above (Dexie validates the schema chain).
    // Purely additive, so no .upgrade() callback is needed — but note this is a
    // one-way door: once v2 has opened the DB, an older APK throws VersionError.
    this.version(2).stores({
      workoutPlans: "id, order",
      workoutSessions: "id, date, planId, status, startedAt",
      schedule: "date",
    });
  }
}

export const db = new LaufwerkDB();
