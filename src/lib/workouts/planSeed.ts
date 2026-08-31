// His calisthenics plan as data, transcribed from Documents\Garmin\cali_training_plan.md.
//
// A TS constant rather than JSON in public/: it is type-checked at build time,
// needs no fetch on first boot, and public/fixtures is mock-mode territory while
// this has to exist in production.
//
// Numbers here are ORIENTATION, which is his own framing ("Numbers below are
// starting targets, not fixed prescriptions"). `sets` takes the LOWER bound of a
// range so finishing a session never leaves an orphan set dot, while the full
// range survives verbatim in `target`. Rest takes the lower bound too, with
// restSecMax for display: a too-short rest costs one tap on "+30s", a too-long
// one costs standing around.
import type { PlanExercise, WorkoutPlanRow } from "../db/schema";

/** Bump when the plan text below changes. Rows he has edited are never
 *  overwritten (see ensureWorkoutPlansSeeded). */
export const PLAN_SEED_VERSION = 1;

const warmup: PlanExercise = {
  id: "mobilisation",
  name: "Mobilisation",
  target: "5 min",
  sets: 1,
  restSec: 0,
  kind: "hold",
  block: "warmup",
  note: "Include wrists every session, not just before skill work.",
};

const cooldown: PlanExercise[] = [
  {
    id: "dead-hang",
    name: "Dead Hang",
    target: "3 x 20-30s",
    sets: 3,
    restSec: 0,
    kind: "hold",
    block: "cooldown",
    note: "Grip is not a limiter here, safe to fit between other cooldown items.",
  },
  {
    id: "stretching",
    name: "Stretching",
    target: "3 min",
    sets: 1,
    restSec: 0,
    kind: "hold",
    block: "cooldown",
  },
];

const bandPullAparts = (sets: number, note?: string): PlanExercise => ({
  id: "band-pull-aparts",
  name: "Band Pull-Aparts / Face Pulls",
  target: sets === 2 ? "2 x 15 reps" : "2-3 x 15 reps",
  sets,
  restSec: 60,
  kind: "reps",
  block: "main",
  note,
});

export const PLAN_SEED: WorkoutPlanRow[] = [
  {
    id: "A",
    title: "Pull focus, front lever",
    subtitle: "Handstand focus: line and endurance (wall-supported)",
    order: 0,
    estMinutes: 45,
    seedVersion: PLAN_SEED_VERSION,
    userEdited: false,
    updatedAt: 0,
    exercises: [
      warmup,
      {
        id: "handstand",
        name: "Handstand",
        target: "4 x 20-40s hold",
        sets: 4,
        restSec: 120,
        kind: "hold",
        block: "main",
        note: "Submaximal. Stop the set as soon as the line breaks, not when it feels hard.",
      },
      {
        id: "front-lever",
        name: "Front Lever",
        target: "4 x 8-12s hold",
        sets: 4,
        restSec: 120,
        restSecMax: 180,
        kind: "hold",
        block: "main",
        note: "Clean form over duration. Progress to the next lever variant only once the time target is hit.",
      },
      {
        id: "pullups-weighted",
        name: "Pull-ups (weighted)",
        target: "4 x 5-8 reps",
        sets: 4,
        restSec: 120,
        restSecMax: 180,
        kind: "reps",
        block: "main",
        note: "Add load once 8 clean reps are hit across all sets.",
      },
      {
        id: "nordic-curls",
        name: "Nordic Curls",
        target: "3 x 4-6 reps",
        sets: 3,
        restSec: 120,
        restSecMax: 180,
        kind: "reps",
        block: "main",
        note: "Eccentric-focused, never to failure.",
      },
      {
        id: "l-sit",
        name: "L-Sit",
        target: "3 x 15-25s",
        sets: 3,
        restSec: 90,
        kind: "hold",
        block: "main",
        note: "Tuck or straddle depending on current level.",
      },
      bandPullAparts(3),
      ...cooldown,
    ],
  },
  {
    id: "B",
    title: "Push focus",
    subtitle: "Handstand focus: pressing strength and compression",
    order: 1,
    estMinutes: 45,
    seedVersion: PLAN_SEED_VERSION,
    userEdited: false,
    updatedAt: 0,
    exercises: [
      warmup,
      {
        id: "handstand",
        name: "Handstand (compression press)",
        target: "4 x 6-10 reps",
        sets: 4,
        restSec: 120,
        restSecMax: 180,
        kind: "reps",
        block: "main",
        note: "Strength work, not balance work: treat it like a near-maximal set. Alternative: 3 x 15-25s compression hold.",
      },
      {
        id: "dips",
        name: "Dips",
        target: "4 x 6-10 reps",
        sets: 4,
        restSec: 120,
        restSecMax: 180,
        kind: "reps",
        block: "main",
        note: "Weighted or deficit once 10 clean reps are hit.",
      },
      {
        id: "pistol-squats",
        name: "Pistol Squats",
        target: "3 x 5-6 / side",
        sets: 3,
        restSec: 120,
        restSecMax: 180,
        kind: "reps",
        block: "main",
        perSide: true,
        note: "Assisted or box until freestanding is clean.",
      },
      {
        id: "l-sit",
        name: "L-Sit / Compression",
        target: "3 x 15-25s",
        sets: 3,
        restSec: 90,
        kind: "hold",
        block: "main",
        note: "Straddle progression builds direct press-handstand transfer.",
      },
      bandPullAparts(2, "Short dose: this day carries the most pressing volume of the week."),
      ...cooldown,
    ],
  },
  {
    id: "C",
    title: "Flag focus, full body",
    subtitle: "Handstand focus: freestanding balance progression",
    order: 2,
    estMinutes: 45,
    seedVersion: PLAN_SEED_VERSION,
    userEdited: false,
    updatedAt: 0,
    exercises: [
      warmup,
      {
        id: "handstand",
        name: "Handstand (freestanding)",
        target: "8-10 attempts x 5-15s, or to fall",
        sets: 8,
        restSec: 45,
        restSecMax: 60,
        kind: "attempts",
        block: "main",
        note: "Skill practice, not conditioning: quality of each attempt matters more than total time. Know your bail-out technique before attempting freestanding.",
      },
      {
        id: "flag",
        name: "Flag",
        target: "5 x 5-10s / side",
        sets: 5,
        restSec: 120,
        restSecMax: 180,
        kind: "hold",
        block: "main",
        perSide: true,
      },
      {
        id: "front-lever-raises",
        name: "Front Lever Raises",
        target: "3 x 6-8 reps",
        sets: 3,
        restSec: 120,
        kind: "reps",
        block: "main",
        note: "Lighter than day A, complements the static hold work.",
      },
      {
        id: "copenhagen-plank",
        name: "Copenhagen Plank",
        target: "3 x 15-20s / side",
        sets: 3,
        restSec: 90,
        kind: "hold",
        block: "main",
        perSide: true,
      },
      bandPullAparts(3),
      ...cooldown,
    ],
  },
];

/** His "Progression Logic" section, shown behind a Card's info toggle. */
export const PROGRESSION_NOTES =
  "Holds (front lever, flag, handstand line, L-sit): increase duration first, and only " +
  "move to the next progression once the time target is consistently hit with clean form. " +
  "Rep-based lifts (pull-ups, dips, pistols): once the top rep target is hit cleanly across " +
  "all sets, add load or move to a harder variant. Nordic curls and Copenhagen planks are " +
  "eccentrically demanding, so never train them to failure or skill quality suffers on the " +
  "following days. Deload every 4 to 6 weeks, given the combined tendon load of isometric " +
  "skill work plus the added handstand frequency.";
