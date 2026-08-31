// Keep the screen on for the duration of a session, so the next exercise and
// the rest countdown stay readable with the phone on the floor.
//
// Uses the Screen Wake Lock web API rather than a Capacitor plugin: it is typed
// in lib.dom, and Capacitor serves this WebView from https://localhost, which is
// a secure context — so no dependency, no permission, and it also works in
// browser dev. If it ever proves unreliable on device, swapping in
// @capacitor-community/keep-awake is a change inside this file only.
import { useEffect } from "react";

// Refcounted on purpose: React StrictMode mounts, unmounts and remounts effects,
// and a naive acquire/release pair leaves the screen pinned on forever after one
// session ("my phone never sleeps again").
let depth = 0;
let sentinel: WakeLockSentinel | null = null;

function supported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

async function acquire(): Promise<void> {
  if (++depth > 1) return;
  if (!supported()) return;
  try {
    sentinel = await navigator.wakeLock.request("screen");
    // the browser drops the lock on its own when the page hides
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
  } catch {
    sentinel = null;
  }
}

async function release(): Promise<void> {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  try {
    await sentinel?.release();
  } catch {
    /* already gone */
  }
  sentinel = null;
}

/** Holds a screen wake lock while `active`. Released in the effect cleanup, so
 *  unmount, an error boundary and a hot reload all let the screen sleep again. */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    void acquire();
    // re-request after the page comes back: the lock is auto-released on hide
    const onVisible = () => {
      if (document.visibilityState === "visible" && depth > 0 && !sentinel && supported()) {
        depth = 0;
        void acquire();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void release();
    };
  }, [active]);
}
