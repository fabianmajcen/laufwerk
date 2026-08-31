// Timing primitives for the workout player. The project had no setInterval at
// all before this, so the rules are written down here:
//
// NOTHING COUNTS TICKS. Every consumer derives from Date.now() against a stored
// deadline, so a throttled or skipped interval (which Android does freely when
// the WebView is backgrounded) can only make the display briefly stale. It can
// never accumulate drift, and it self-heals on the next tick or on resume.
import { useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

/** Subscribe to the wall clock while `active`. Gated deliberately: a session is
 *  ~45 min of which only the rests need a ticking display, and an idle 4 Hz
 *  interval for the rest of it is pure battery. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const resync = () => setNow(Date.now());
    document.addEventListener("visibilitychange", resync);
    let sub: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) sub = CapApp.addListener("appStateChange", resync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", resync);
      sub?.then((s) => s.remove()).catch(() => {});
    };
  }, [active, intervalMs]);
  return now;
}

/** Fire `onFire` when `deadline` passes. Three independent triggers, because a
 *  throttled WebView can swallow any one of them:
 *    1. a setTimeout armed for the exact remaining ms,
 *    2. visibilitychange / appStateChange asking "did it already pass?",
 *    3. an immediate check on mount, for the resumed-from-kill case.
 *  Exactly-once is the CALLER's job (see workoutStore.cueRestOver, which guards
 *  on a persisted restCuedAt): a local ref would double-fire under StrictMode
 *  and would not survive the process being killed. */
export function useDeadlineAlarm(deadline: number | null | undefined, onFire: (deadline: number) => void) {
  useEffect(() => {
    if (deadline == null) return;
    const check = () => {
      if (Date.now() >= deadline) onFire(deadline);
    };
    const id = setTimeout(check, Math.max(0, deadline - Date.now()));
    document.addEventListener("visibilitychange", check);
    let sub: Promise<{ remove: () => void }> | null = null;
    if (Capacitor.isNativePlatform()) sub = CapApp.addListener("appStateChange", check);
    check();
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", check);
      sub?.then((s) => s.remove()).catch(() => {});
    };
  }, [deadline, onFire]);
}

/** mm:ss, zero-padded, for a countdown. fmtDuration gives "0:07" which reads
 *  oddly mid-rest; this gives "0:07" -> "00:07" consistency at a glance. */
export function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.ceil(totalSec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
