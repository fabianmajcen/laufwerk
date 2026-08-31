# Train tab implementation — progress log

**Plan**: `C:\Users\Fabian\.claude\plans\straight-to-capacitor-so-scalable-horizon.md`
(read it first — it holds the data model, seed data, decisions and hazards).

Release 1 = M1 + M2. Update this file as steps complete so a new session can resume
without re-deriving anything.

## Status

- [ ] **M1 — data layer, Train tab, plan viewer**
  - [ ] `src/lib/db/schema.ts` — v2 tables + row interfaces
  - [ ] `src/lib/db/repo.ts` — extend `exportAll()` (same commit as tables)
  - [ ] `src/lib/workouts/planSeed.ts` — A/B/C seed + `PROGRESSION_NOTES`
  - [ ] `src/lib/db/workouts.ts` — plans/sessions/schedule accessors + seeder + reaper
  - [ ] `src/lib/derive/workout.ts` — pure predicates
  - [ ] `src/lib/hooks.ts` — workout hooks
  - [ ] `src/store/settingsStore.ts` — top-level `workouts` group + `merge` fix (NO `version`)
  - [ ] `src/store/uiStore.ts` + `TabBar.tsx` + `App.tsx` — 5th tab at index 1
  - [ ] `src/ui/tabs/TrainingTab.tsx` — hero, week card, A/B/C rows, plan detail sub-screen
  - [ ] `src/ui/screens/Settings.tsx` — calisthenics card, clear-data copy, delete-history button
  - [ ] `src/dev/mockSync.ts` — SEED_VERSION 4→5 + demo sessions
- [ ] **M2 — guided player** (see plan; runtime/cues/timer/wakeLock/player/minibar/sheet)
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
