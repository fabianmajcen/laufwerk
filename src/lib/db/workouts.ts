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

export async function addScheduleSlot(date: string, slot: ScheduleSlot): Promise<void> {
  const day = await db.schedule.get(date);
  await setScheduleSlots(date, [...(day?.slots ?? []), slot]);
}

export async function removeScheduleSlot(date: string, index: number): Promise<void> {
  const day = await db.schedule.get(date);
  if (!day) return;
  await setScheduleSlots(date, day.slots.filter((_, i) => i !== index));
}

/** The plan after the last one that actually happened, cycling on order.
 *  Future scheduled slots count as history, so planning three days ahead
 *  yields A, B, C rather than B, B, B. */
export async function nextPlanInRotation(): Promise<WorkoutPlanRow | undefined> {
  const plans = await getWorkoutPlans();
  if (!plans.length) return undefined;

  const sessions = (await db.workoutSessions.toArray()).filter(countsTowardWeek);
  const pairs: { date: string; planId: string }[] = sessions.map((s) => ({ date: s.date, planId: s.planId }));

  const today = isoDate(new Date());
  for (const day of await db.schedule.where("date").above(today).toArray()) {
    for (const slot of day.slots) {
      if (slot.kind === "workout" && slot.planId) pairs.push({ date: day.date, planId: slot.planId });
    }
  }

  if (!pairs.length) return plans[0];
  pairs.sort((a, b) => a.date.localeCompare(b.date));
  const lastId = pairs[pairs.length - 1].planId;
  const idx = plans.findIndex((p) => p.id === lastId);
  if (idx < 0) return plans[0]; // last one was archived or unknown
  return plans[(idx + 1) % plans.length];
}

export async function hasFutureSlot(kind: "workout" | "run", today = isoDate(new Date())): Promise<boolean> {
  const days = await db.schedule.where("date").above(today).toArray();
  return days.some((d) => d.slots.some((s) => s.kind === kind));
}
