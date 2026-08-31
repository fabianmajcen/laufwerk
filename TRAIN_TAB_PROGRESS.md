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
- [x] **M2 — guided player** — commit `67d740e`, RELEASED as v0.2.33
  - [x] `src/lib/timer.ts` — `useNow(active)` gated, `useDeadlineAlarm` (3 triggers)
  - [x] `src/lib/workouts/cues.ts` — WebAudio beep + `primeAudio()`
  - [x] `src/lib/workouts/screenAwake.ts` — refcounted wake lock
  - [x] `src/lib/haptics.ts` — `restOverBuzz`, `successBuzz`
  - [x] `src/store/workoutStore.ts` — live session machine, write-through, `hydrate()`
  - [x] `src/ui/workout/` — `WorkoutRuntime` (headless), `WorkoutPlayer`, `StepList`,
        `ActionDock`, `WorkoutMiniBar`
  - [x] `src/ui/components/Sheet.tsx` — bottom sheet for quit prompt
  - [x] `App.tsx` — player outside `PullToSync`, mini-bar, hydrate on boot
  - [x] enable the Start button in `TrainingTab.tsx` (remove the disabled state and
        the "arrives in the next update" note)
- [ ] **M3 Today integration** ← NEXT
  - [ ] `src/lib/derive/trainingWeek.ts` + `useTrainingWeek` — land as a pure no-op
        refactor of `WeekPlanCard` and the widget effect FIRST, verify identical, then add
  - [ ] `TodayTab.tsx` second pill row (Runs + Workouts, A/B/C letters, 3rd dashed)
  - [ ] `widget.ts` weekLine "Runs 1/2 · Cali 2/3 · 5.2 km" + caliDone/caliPlanned
- [ ] M4 scheduling · M5 history + JSON restore

## Verified in the browser (M2)

- rest expiry fires exactly one cue (4 tones); 6 further resume checks add none
- no premature cue during an active rest across 5 visibility events
- kill/reload mid-session resumes the same exercise and set with the rest clock
  continued (1:56, not restarted)
- minimize shows the mini-bar and restores the tab bar; resume reopens mid-set
- end-early sheet reports "3 of 26 sets"; "count it" logs partial and the rotation
  advances to Day B with the week card at 1/3

## Still unverified (needs the phone)

audible beep at real media volume and while music plays · vibration · screen staying
awake for a full session and sleeping again afterwards · hardware back minimizing ·
force-stop and relaunch · the Dexie v2 upgrade over an installed v1 build

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
