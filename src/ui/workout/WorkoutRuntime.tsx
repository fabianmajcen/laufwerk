// Headless. Mounted from App.tsx for as long as a session exists, renders
// nothing, and owns everything time-critical: the rest alarm, the cues and the
// screen wake lock.
//
// The point of splitting this out: "did the beep fire" is then completely
// independent of "is the player on screen". Cues still land while the player is
// minimized to the mini-bar or while he is reading the Today tab.
import { useEffect } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useWorkout } from "../../store/workoutStore";
import { useSettings } from "../../store/settingsStore";
import { useDeadlineAlarm } from "../../lib/timer";
import { useKeepAwake } from "../../lib/workouts/screenAwake";
import { resumeAudio } from "../../lib/workouts/cues";
import { saveWorkoutSession } from "../../lib/db/workouts";

export function WorkoutRuntime() {
  const session = useWorkout((s) => s.session);
  const cueRestOver = useWorkout((s) => s.cueRestOver);
  const keepAwakeWanted = useSettings((s) => s.workouts.keepAwake);

  useKeepAwake(session != null && keepAwakeWanted);
  useDeadlineAlarm(session?.restEndsAt ?? null, cueRestOver);

  // flush to Dexie when the app goes to the background, and re-resume the audio
  // context when it comes back (legal without a gesture once unlocked once)
  useEffect(() => {
    if (!session) return;
    const flush = () => {
      const cur = useWorkout.getState().session;
      if (cur) void saveWorkoutSession(cur).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
      else resumeAudio();
    };
    document.addEventListener("visibilitychange", onVisibility);
    let sub: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) {
      sub = CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) resumeAudio();
        else flush();
      });
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      sub?.then((s) => s.remove()).catch(() => {});
      flush();
    };
  }, [session]);

  return null;
}
