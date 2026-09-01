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
- [x] **Session picker** (v0.2.34): Day A/B/C chips on the Next-up card + a Start
      button on the plan detail. Needed because his real rotation began outside the app.
      No rotation logic changed: it follows what was actually done.
- [x] **M3 Today integration** — v0.2.35
  - [x] `src/lib/derive/trainingWeek.ts` + `useTrainingWeek`; both old copies of the
        week math (WeekPlanCard + widget effect) now use it
  - [x] `TodayTab.tsx` second pill row (violet, dashed bonus slot, session letters)
  - [x] `widget.ts` weekLine + caliDone/caliPlanned (no Java change needed)
- [x] **Week card separation** (v0.2.36): pager on its own line, then a runs block and a
      workouts block split by a hairline, each label directly above its own pills
- [x] **M4 scheduling** — v0.2.36
  - [x] "Plan your week" SubScreen: 14 day rows, workout (A/B/C) or run slots via sheet,
        tap a chip to remove, trained days show "done"
  - [x] `suggestNextWorkoutDates`: after the rest gap, skips days already holding a
        workout or a done session, prefers run-free days
  - [x] post-session prompt gated on counted + setting + no future workout slot.
        Verified both ways: first finish offered Wed/Thu/Fri, next finish offered nothing
  - [x] Today card says "Day B planned for Wednesday"
  - [ ] optional later: a "suggest this week" bulk button writing `source: "suggested"`
        (the field exists; only manual slots are written today)
- [x] **Week strip** (v0.2.37): Mon-Sun day tiles replacing BOTH the old week card
      and the PlanWeek screen (deleted). Run glyph + A/B/C letters in their own subtle
      colours, done solid / planned faded / past-empty = rest dash, today ringed.
      Tap a day to schedule; pager reaches 4 weeks ahead. Same component on Today and
      Train. Colours: A violet (--recency-hi), B teal (--hrv), C copper (--elevation).
- [x] Device check (user): sound, vibration and screen-awake all work.
- [x] **Letterless scheduling + rest days + km** (v0.2.38): planned workout slots store
      `planId: null`; the letter is DERIVED from position via `assignScheduledWorkouts()`
      (walked globally from today, so sequences hold across week boundaries). Inserting an
      earlier workout reshuffles later letters automatically — verified Fri=A alone, then
      insert Wed => Wed A / Fri B. `nextPlanInRotation` now keys off completed history only.
      `ScheduleSlot.kind` gained "rest" (fulfilled by not training, excluded from
      suggestions, always removable). Week km sits right of the runs counter.
- [x] **M5 history + JSON restore** — v0.2.39
  - [x] history sub-screen: 12-week consistency bars (plain divs, no ECharts) + full log,
        discarded dimmed, partial badged
  - [x] per-session sheet with a one-line note and delete
  - [x] `importWorkouts(json)` + Settings paste box; merges by primary key, files any
        "active" session as abandoned. Round trip verified (3 plans / 1 session restored)
  - Gotcha fixed: percentage-height bars need a parent with a definite height (`h-full`
    on the column) or they collapse invisibly.

- [x] **Widget workout pills** (v0.2.40): ReadinessWidget draws two rows (runs blue over
      cali violet). The slots ImageView had to grow 11dp -> 26dp because it is fitXY and
      squashed both rows otherwise. A payload without the cali fields still renders one row.
      NOTE: widget changes need `assembleDebug` to verify; `tsc` cannot catch Java errors.

## The whole feature is shipped (M1-M5 + widget). Possible next steps, none committed:

- Plan editing in-app (the data model already supports it: `userEdited` + `seedVersion`
  null stop the seeder from clobbering edits)
- Day B's handstand "or" variant as a two-way toggle on that step
- A "suggest this week" bulk button (`ScheduleSlot.source: "suggested"` already exists)
- Notifications: morning readiness verdict + run/workout reminders (the original
  someday-item, needs a native alarm or WorkManager since there is no background sync)

## Gotchas hit during implementation

- **zustand selectors must return primitives.** `useSettings((s) => ({...}))` builds a new
  object every render and zustand compares by identity, so it re-renders forever. Cost an
  infinite-loop bug in `useTrainingWeek`; select the fields separately.
- Puppeteer hash-only navigation does NOT remount the app (uiStore reads the hash once at
  creation). Use a query param to force a real reload when testing a specific tab.
- The scratchpad's puppeteer install and the mock dev server both get cleared by temp
  reaping between sessions: `npm i puppeteer-core` and restart `npm run dev:mock -- --port 5199`.

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

## Widget (v0.2.43)

The Mon-Sun grid IS the widget, and now it is the ONLY thing on it at one cell.
Rejected twice before this; the fixes that mattered:

- **Draw one bitmap at the widget's REAL pixel size.** `AppWidgetManager.getAppWidgetOptions`
  gives `OPTION_APPWIDGET_MIN_WIDTH/MIN_HEIGHT` in dp; `onAppWidgetOptionsChanged` redraws on
  resize. A fixed-size bitmap under `fitXY` either distorted or wasted a whole cell, and
  RemoteViews cannot measure anything for us. The layout is now a single full-bleed ImageView.
- **Contrast**: tiles were `#1F1F1E` against a `#232322 -> #161615` gradient, i.e. invisible.
  Now `TILE_BG #332F2C` / `TILE_BG_TODAY #3D3833`, labels `INK2` (white bold for today),
  planned alpha 150 not 105, brighter plan colours A `#B4A9FF` B `#2FBF8F` C `#D68B4A`.
- **Every metric scales with the measured size.** Fixed dp constants each looked right at one
  size and broke at another: at half width the weekday labels grew wider than their own tiles,
  at the 48dp minimum height the tiles ran off the bottom edge. padX/padY, labelH, gapX/gapY,
  the label text size and the tile-height floor are all proportional now.
- **Score and verdict are gone.** Counters (runs, cali, km) draw only when `hDp >= 92`, in three
  separated groups, so a one-cell widget spends all its space on the calendar.
- Run glyph is a real vector (`res/drawable/ic_run.xml`) drawn tinted, matching the app.
- Provider: `minHeight 48dp`, `targetCellHeight 1`, `resizeMode horizontal|vertical`.
- Widget only redraws when the app writes a payload or every 30 min (updatePeriodMillis),
  so after an APK update: open the app once, then look. A size change may need re-adding it.
- Java is invisible to tsc: always run `assembleDebug` after touching it. Set
  `$env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-21"` first (release.ps1 does this itself).
- **Verifying widget rendering without a device**: replicate the draw math on an HTML canvas at
  the real dp sizes and screenshot it. Not the Java, but it catches fit, contrast and text size,
  which is exactly what the two rejected versions got wrong.

## Week strip encoding (v0.2.44)

Done vs planned was opacity alone (100% vs 40%) and it did not read as an
achievement. Now:

- **done = a filled stamp**: a solid disc in the mark's colour with the letter or
  run glyph knocked out in `var(--page)`. That token inverts with the theme, so the
  ink is dark on a light disc in dark mode and light on a dark disc in light mode,
  with no per-theme branching.
- **planned = a dashed outline**: same disc, 1.5px dashed border in the colour, no
  fill, glyph in the colour at 75%. Fill-vs-outline is a shape difference, not a
  brightness one, so it survives glare and colourblindness.
- Marks grew and the tile went h-11 -> h-14. `chipSizes()` steps the disc down as a
  day fills (32 / 24 / 17 px for 1 / 2 / 3+ marks) so one mark fills its tile and
  three still fit.
- **The widget uses the same encoding** (v0.2.45), ported to Canvas: filled circle
  with the glyph knocked out in `STAMP_INK #14130F` for done, `DashPathEffect` ring
  for planned. Two things the canvas preview caught that guessing would not have:
  dashes fragment into visual noise below ~16dp, so the ring goes solid under that
  size (fill-vs-outline is the encoding; the dash is only texture), and a single
  stamp at `slotH * 0.94` collided with the today ring, so discs are
  `min(tileW*0.90, slotH*0.86, 34dp)`.

## Player design rules (learned from real use, v0.2.41)

1. **Never substitute the working control.** "Finish session" used to REPLACE the dock once
   every main exercise had one set, which locked him out of remaining sets AND the whole
   cooldown. It is now an additive secondary button; it only becomes primary when the cursor
   is past the last exercise.
2. **Skip and undo live behind the "..." button.** Both are rare and destructive; neither
   belongs next to the control pressed ~25 times a session. He mis-tapped both in one
   session.
3. **Logging a set un-skips that exercise**, so a mis-tapped skip self-heals.
4. **Bottom padding floor is 28px**, not 12: `env(safe-area-inset-bottom)` reports 0 in this
   WebView (same reason App.tsx uses a 32px floor at the top) and the gesture bar clipped
   the dock's secondary row.

## Two widgets (v0.2.47)

The launcher picker now offers two sizes, because one provider class can only be
one picker entry:

- `ReadinessWidget` - the compact one-cell week (unchanged).
- `WeekWidget` - two lines: readiness score + verdict on the left, the runs and
  workouts progress bars on the right, the Mon-Sun week underneath.

`WeekWidget` is a thin provider that calls `ReadinessWidget.render(ctx, mgr, id, true)`.
ALL drawing stays in `ReadinessWidget` behind a `twoLine` flag so the two cannot
drift apart, and `refreshAll` walks both `ComponentName`s or one of them silently
stops updating. Both share `widget_readiness.xml`, since it is a single full-bleed
ImageView either way.

Tuning the preview caught: a 42% top band left the tiles at 26dp at exactly two
cells, with the marks inside unreadable. The band is capped at
`min(36dp, h * 0.32)`, which keeps tiles in the mid 30s there. The tile cap also
went 52 -> 60dp so a taller widget fills instead of leaving dead space at the bottom.

The score, verdict and colour were already in the payload (only the drawing was
removed in v0.2.43), so no JS change was needed for this.

## Trends calendar (v0.2.47)

The 3-month heatmap gained a third series: a copper filled dot per counted
calisthenics session, inside the green run ring so a day with both still reads.
Copper, not the app's usual workout violet, because the cell fill itself ramps to
`--recency-hi` and a violet dot vanishes on a good-sleep day. The dot carries a
1px `--card` hairline so it separates from whatever the sleep score painted.

## Edge-to-edge insets (v0.2.46) - the real fix for "cut off at the bottom"

`targetSdk 36` means Android lays the activity out **behind** the status and
navigation bars, and this WebView reports `env(safe-area-inset-*)` as **0**. So CSS
could not know how tall the nav bar was, and everything pinned to the bottom of the
`h-dvh` shell (tab bar, player dock, bottom sheet) sat underneath it. The 12px ->
28px floor bumps were papering over this; on a 48dp three-button nav bar 28px is
still short.

`MainActivity` now publishes the measured insets as CSS custom properties:

- `setOnApplyWindowInsetsListener` on `android.R.id.content`, `systemBars()` insets
  divided by density, injected with `evaluateJavascript` as `--safe-top` /
  `--safe-bottom`.
- The first inset pass can land before the page exists, so `onResume()` calls
  `requestApplyInsets` and re-publishes the cached values.
- Every consumer keeps its old hardcoded floor as the fallback, so a browser, mock
  mode, or a failed injection all behave exactly as before. Verified:
  no var -> 28px sheet padding (identical to v0.2.45), `--safe-bottom: 48px` -> 64px
  sheet / 48px tab bar, `24px` -> 40px / 24px.

Do NOT "fix" bottom clipping with another magic number. Read `--safe-bottom`.

## Schedule slot exclusivity (v0.2.46)

A day holds **at most one workout and at most one run**, and **rest excludes both**.
Enforced in `addScheduleSlot` itself, not only in the picker, so the post-session
prompt and any future bulk suggest cannot write a contradiction: a rest slot replaces
everything, and a workout/run slot drops any rest slot plus any existing slot of the
same kind. All 11 combinations are covered by `combos.mjs` in the scratchpad.

The picker only offers what makes sense: no second workout or run, no rest day on a
day already trained, and where an action replaces something the label says "instead"
so the removal is not a surprise.

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
