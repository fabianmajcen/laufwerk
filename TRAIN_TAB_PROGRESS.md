# Train tab implementation — progress log

**Plan**: `C:\Users\Fabian\.claude\plans\straight-to-capacitor-so-scalable-horizon.md`
(read it first — it holds the data model, seed data, decisions and hazards).

Release 1 = M1 + M2. Update this file as steps complete so a new session can resume
without re-deriving anything.

## Status

- [x] **M1 — data layer, Train tab, plan viewer** — commit `9cf2fb9`, NOT yet released
  - [x] `schema.ts` v2 (workoutPlans, workoutSessions, schedule) + row interfaces
  - [x] `repo.ts` `exportAll()` covers the three new tables
  - [x] `workouts/planSeed.ts` — A/B/C transcribed + `PROGRESSION_NOTES`
  - [x] `db/workouts.ts` — accessors, `ensureWorkoutPlansSeeded`, `reapStaleWorkoutSessions`,
        `nextPlanInRotation`, `hasFutureSlot`
  - [x] `derive/workout.ts` — pure predicates
  - [x] `hooks.ts` — `useWorkoutPlans/Plan/ActiveWorkoutSession/RecentWorkoutSessions/
        NextPlanInRotation/WorkoutSessions`
  - [x] `settingsStore.ts` — top-level `workouts` group + persist `merge` fix
  - [x] 5th tab "Train" at index 1 (rings icon); verified 5×72px at 360px, no wrap
  - [x] `TrainingTab.tsx` — Next-up hero (Start **disabled** pending M2), week card
        (3 slots, 3rd dashed), A/B/C rows, plan-detail sub-screen
  - [x] `Settings.tsx` — calisthenics card + toggles, "Clear synced Garmin data"
        reworded, separate "Delete workout history"
  - [ ] `src/dev/mockSync.ts` — demo sessions for dev (optional; seeding already works
        in mock because it runs on the production boot path)
- [ ] **M2 — guided player** ← NEXT. Ship M1+M2 together as release 1.
  - [ ] `src/lib/timer.ts` — `useNow(active)` gated, `useDeadlineAlarm` (3 triggers)
  - [ ] `src/lib/workouts/cues.ts` — WebAudio beep + `primeAudio()`
  - [ ] `src/lib/workouts/screenAwake.ts` — refcounted wake lock
  - [ ] `src/lib/haptics.ts` — `restOverBuzz`, `successBuzz`
  - [ ] `src/store/workoutStore.ts` — live session machine, write-through, `hydrate()`
  - [ ] `src/ui/workout/` — `WorkoutRuntime` (headless), `WorkoutPlayer`, `StepList`,
        `ActionDock`, `WorkoutMiniBar`
  - [ ] `src/ui/components/Sheet.tsx` — bottom sheet for quit prompt
  - [ ] `App.tsx` — player outside `PullToSync`, mini-bar, hydrate on boot
  - [ ] enable the Start button in `TrainingTab.tsx` (remove the disabled state and
        the "arrives in the next update" note)
- [ ] M3 Today integration · M4 scheduling · M5 history+restore

## Hazards (do not rediscover)

1. **Never add `version:` to settings `persist` without `migrate`** — it discards all his
   settings. Use the hand-written `merge` instead.
2. **Dexie v2 is a one-way door** — an older APK then fails with `VersionError`. Test the
   update on-device before releasing.
3. **`primeAudio()` must be called synchronously in the click handler**, never in an effect,
   or audio is silently mute forever on Android WebView.
4. `VIBRATE` is already in the merged manifest via `@capacitor/haptics` — no manifest edit.
5. `navigator.wakeLock` is typed and the WebView is a secure context (`https://localhost`),
   so no keep-awake plugin unless it proves unreliable on device.
6. Wake lock must be **refcounted** or StrictMode leaves the screen pinned on.
7. Player renders outside `PullToSync` and must not reuse the id `scroll-root`.
8. Workout tables stay out of Settings' "Clear cached data" (user-authored, not re-syncable).

## Conventions

- All UI reads go through `useLiveQuery` hooks returning `T | undefined`.
- No em dashes in user-facing copy.
- Verify with Puppeteer at **360x800 DPR 3** against `npm run dev:mock` on port 5199.
- Ship with `.\release.ps1` (PowerShell tool, not Bash — execution policy).
