// Calisthenics accessors: plans, session log, schedule. Same thin-async style as
// repo.ts, kept in its own module so repo.ts does not sprawl.
//
// The live session is a workoutSessions row with status "active" — no separate
// draft store — so a force-kill resumes from whatever was last written.
import { db, type ScheduleDayRow, type ScheduleSlot, type WorkoutPlanRow, type WorkoutSessionRow } from "./schema";
import { PLAN_SEED, PLAN_SEED_VERSION } from "../workouts/planSeed";
import { mainExercises, countsTowardWeek } from "../derive/workout";
import { isoDate } from "../format";

// ---------- plans ----------

/** Active plans in rotation order. */
export async function getWorkoutPlans(): Promise<WorkoutPlanRow[]> {
  const all = await db.workoutPlans.orderBy("order").toArray();
  return all.filter((p) => !p.archived);
}

export async function getWorkoutPlan(id: string): Promise<WorkoutPlanRow | undefined> {
  return db.workoutPlans.get(id);
}

/** Any write from the UI marks the row as his, so seeding leaves it alone forever. */
export async function putWorkoutPlan(plan: WorkoutPlanRow): Promise<void> {
  await db.workoutPlans.put({ ...plan, userEdited: true, seedVersion: null, updatedAt: Date.now() });
}

/** Soft delete: a hard delete would be resurrected by the next seed run, and
 *  history needs the row to keep resolving planId. */
export async function archiveWorkoutPlan(id: string): Promise<void> {
  const p = await db.workoutPlans.get(id);
  if (p) await db.workoutPlans.put({ ...p, archived: true, updatedAt: Date.now() });
}

/** Idempotent. Installs missing plans and refreshes seeded rows he has never
 *  touched when PLAN_SEED_VERSION moves. Never writes over userEdited or
 *  archived rows, so shipping an improved plan cannot clobber his edits. */
export async function ensureWorkoutPlansSeeded(): Promise<void> {
  const now = Date.now();
  for (const seed of PLAN_SEED) {
    const existing = await db.workoutPlans.get(seed.id);
    if (!existing) {
      await db.workoutPlans.put({ ...seed, updatedAt: now });
      continue;
    }
    if (existing.userEdited || existing.archived) continue;
    if ((existing.seedVersion ?? 0) < PLAN_SEED_VERSION) {
      await db.workoutPlans.put({ ...seed, updatedAt: now });
    }
  }
}

// ---------- sessions ----------

export async function getActiveWorkoutSession(): Promise<WorkoutSessionRow | undefined> {
  return db.workoutSessions.where("status").equals("active").first();
}

export async function startWorkoutSession(planId: string): Promise<WorkoutSessionRow> {
  const plan = await db.workoutPlans.get(planId);
  if (!plan) throw new Error(`unknown plan ${planId}`);
  const startedAt = Date.now();
  const row: WorkoutSessionRow = {
    id: String(startedAt),
    date: isoDate(new Date(startedAt)),
    planId,
    planTitle: plan.title,
    plannedMainCount: mainExercises(plan).length,
    status: "active",
    startedAt,
    endedAt: null,
    progress: {},
    skipped: [],
    cursor: 0,
    restEndsAt: null,
    restCuedAt: null,
    holdStartedAt: null,
    halfSet: false,
  };
  await db.workoutSessions.put(row);
  return row;
}

/** Write-through for the live session. Called on discrete transitions only
 *  (set done, skip, rest change, hold start/stop) — never on a timer tick. */
export async function saveWorkoutSession(row: WorkoutSessionRow): Promise<void> {
  await db.workoutSessions.put(row);
}

export async function finishWorkoutSession(
  id: string,
  status: "done" | "partial" | "discarded",
): Promise<void> {
  const row = await db.workoutSessions.get(id);
  if (!row) return;
  await db.workoutSessions.put({
    ...row,
    status,
    endedAt: Date.now(),
    // runtime fields are meaningless once the session is closed
    restEndsAt: null,
    restCuedAt: null,
    holdStartedAt: null,
    halfSet: false,
  });
}

export async function setSessionNote(id: string, note: string): Promise<void> {
  const row = await db.workoutSessions.get(id);
  if (row) await db.workoutSessions.put({ ...row, note });
}

/** Sessions that count, in [from, to] inclusive, oldest first. */
export async function getWorkoutSessions(from: string, to: string): Promise<WorkoutSessionRow[]> {
  const rows = await db.workoutSessions.where("date").between(from, to, true, true).toArray();
  return rows.filter(countsTowardWeek).sort((a, b) => a.startedAt - b.startedAt);
}

/** Every status, newest first — the history list. */
export async function getRecentWorkoutSessions(limit = 30): Promise<WorkoutSessionRow[]> {
  const rows = await db.workoutSessions.orderBy("startedAt").reverse().limit(limit + 5).toArray();
  return rows.filter((r) => r.status !== "active" && r.status !== "abandoned").slice(0, limit);
}

export async function deleteWorkoutSession(id: string): Promise<void> {
  await db.workoutSessions.delete(id);
}

/** Boot housekeeping. An "active" row from an earlier day is stale: if nothing
 *  was done it becomes "abandoned" silently, otherwise it is returned so the UI
 *  can ask once whether it counted. */
export async function reapStaleWorkoutSessions(): Promise<WorkoutSessionRow | undefined> {
  const active = await getActiveWorkoutSession();
  if (!active) return undefined;
  const stale = active.date !== isoDate(new Date()) || Date.now() - active.startedAt > 6 * 3600 * 1000;
  if (!stale) return undefined;
  const did = Object.values(active.progress).reduce((a, b) => a + b, 0) > 0;
  if (!did) {
    await db.workoutSessions.put({ ...active, status: "abandoned", endedAt: active.startedAt });
    return undefined;
  }
  return active;
}

// ---------- backup restore ----------

/** Restore plans, sessions and the schedule from a Laufwerk JSON export.
 *
 *  This exists because workout data is the only thing in the app Garmin cannot
 *  give back: everything else re-syncs, so exporting without an import path
 *  meant the backup was not actually a backup. Merges by primary key rather
 *  than replacing, so importing an older file cannot delete newer sessions. */
export async function importWorkouts(json: string): Promise<{ plans: number; sessions: number; schedule: number }> {
  const parsed = JSON.parse(json) as {
    workoutPlans?: WorkoutPlanRow[];
    workoutSessions?: WorkoutSessionRow[];
    schedule?: ScheduleDayRow[];
  };
  const plans = Array.isArray(parsed.workoutPlans) ? parsed.workoutPlans.filter((p) => p && typeof p.id === "string") : [];
  const sessions = Array.isArray(parsed.workoutSessions)
    ? parsed.workoutSessions.filter((s) => s && typeof s.id === "string" && typeof s.date === "string")
    : [];
  const schedule = Array.isArray(parsed.schedule)
    ? parsed.schedule.filter((d) => d && typeof d.date === "string" && Array.isArray(d.slots))
    : [];

  if (!plans.length && !sessions.length && !schedule.length) {
    throw new Error("No workout data found in that file.");
  }
  // never bring back a half-finished session as if it were live
  const cleaned = sessions.map((s) => (s.status === "active" ? { ...s, status: "abandoned" as const } : s));

  if (plans.length) await db.workoutPlans.bulkPut(plans);
  if (cleaned.length) await db.workoutSessions.bulkPut(cleaned);
  if (schedule.length) await db.schedule.bulkPut(schedule);
  return { plans: plans.length, sessions: cleaned.length, schedule: schedule.length };
}

// ---------- schedule ----------

export async function getScheduleRange(from: string, to: string): Promise<ScheduleDayRow[]> {
  return db.schedule.where("date").between(from, to, true, true).toArray();
}

export async function getScheduleDay(date: string): Promise<ScheduleDayRow | undefined> {
  return db.schedule.get(date);
}

/** An empty slot list deletes the row rather than leaving an empty one behind. */
export async function setScheduleSlots(date: string, slots: ScheduleSlot[]): Promise<void> {
  if (!slots.length) await db.schedule.delete(date);
  else await db.schedule.put({ date, slots, updatedAt: Date.now() });
}

/** A day holds at most one workout and at most one run, and a rest day excludes
 *  both: resting means not training, so the combination is never a plan, it is a
 *  mistake. Enforced here rather than only in the picker so no caller (the
 *  post-session prompt, a future bulk suggest) can write a contradiction. */
export async function addScheduleSlot(date: string, slot: ScheduleSlot): Promise<void> {
  const day = await db.schedule.get(date);
  const existing = day?.slots ?? [];
  const kept =
    slot.kind === "rest"
      ? [] // rest replaces whatever was planned
      : existing.filter((s) => s.kind !== "rest" && s.kind !== slot.kind);
  await setScheduleSlots(date, [...kept, slot]);
}

export async function removeScheduleSlot(date: string, index: number): Promise<void> {
  const day = await db.schedule.get(date);
  if (!day) return;
  await setScheduleSlots(date, day.slots.filter((_, i) => i !== index));
}

/** The plan after the last one actually completed, cycling on order. Based only
 *  on history: scheduled slots carry no letter of their own, they inherit one
 *  from their position (assignScheduledWorkouts). */
export async function nextPlanInRotation(): Promise<WorkoutPlanRow | undefined> {
  const plans = await getWorkoutPlans();
  if (!plans.length) return undefined;

  const done = (await db.workoutSessions.toArray())
    .filter(countsTowardWeek)
    .sort((a, b) => a.startedAt - b.startedAt);
  if (!done.length) return plans[0];

  const idx = plans.findIndex((p) => p.id === done[done.length - 1].planId);
  if (idx < 0) return plans[0]; // the last one was archived or unknown
  return plans[(idx + 1) % plans.length];
}

/** Which session each upcoming scheduled workout becomes, keyed "date#index".
 *  Walks every future workout slot in date order from the rotation's next plan,
 *  so adding a workout on Wednesday when Friday was already planned makes
 *  Wednesday the earlier letter and pushes Friday to the next one. */
export async function assignScheduledWorkouts(now = new Date()): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const plans = await getWorkoutPlans();
  if (!plans.length) return out;

  const start = await nextPlanInRotation();
  let i = Math.max(0, plans.findIndex((p) => p.id === start?.id));

  const days = (await db.schedule.where("date").aboveOrEqual(isoDate(now)).toArray()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  for (const day of days) {
    day.slots.forEach((slot, index) => {
      if (slot.kind !== "workout") return;
      out.set(`${day.date}#${index}`, plans[i % plans.length].id);
      i++;
    });
  }
  return out;
}

export async function hasFutureSlot(kind: "workout" | "run", today = isoDate(new Date())): Promise<boolean> {
  const days = await db.schedule.where("date").above(today).toArray();
  return days.some((d) => d.slots.some((s) => s.kind === kind));
}

/** Candidate dates for the next workout, earliest first: start after the rest
 *  gap, skip days that already hold a workout or a done session, and prefer
 *  run-free days (2 runs + 3 workouts in 7 days means doubling up happens, it
 *  just should not be the first suggestion). */
export async function suggestNextWorkoutDates(
  restDays: number,
  count = 3,
  now = new Date(),
): Promise<string[]> {
  const from = isoDate(now);
  const horizon = isoDate(new Date(now.getTime() + 21 * 86400000));
  const [schedule, sessions, runs] = await Promise.all([
    getScheduleRange(from, horizon),
    db.workoutSessions.where("date").between(from, horizon, true, true).toArray(),
    db.activities.where("startTimeLocal").aboveOrEqual(from).toArray(),
  ]);

  const hasWorkout = new Set<string>();
  const hasRun = new Set<string>();
  for (const day of schedule) {
    for (const s of day.slots) {
      // a planned rest day is off limits for a workout, same as one already
      // holding a workout
      if (s.kind === "workout" || s.kind === "rest") hasWorkout.add(day.date);
      else if (s.kind === "run") hasRun.add(day.date);
    }
  }
  for (const s of sessions) if (countsTowardWeek(s)) hasWorkout.add(s.date);
  for (const r of runs) {
    if (r.typeKey.toLowerCase().includes("run")) hasRun.add(r.startTimeLocal.slice(0, 10));
  }

  const free: string[] = [];
  const busyWithRun: string[] = [];
  for (let i = restDays + 1; i <= 14 && free.length < count; i++) {
    const iso = isoDate(new Date(now.getTime() + i * 86400000));
    if (hasWorkout.has(iso)) continue;
    (hasRun.has(iso) ? busyWithRun : free).push(iso);
  }
  return [...free, ...busyWithRun].slice(0, count);
}
