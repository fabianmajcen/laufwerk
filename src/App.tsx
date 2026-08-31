import { useCallback, useEffect, useState } from "react";
import { TabBar } from "./ui/components/TabBar";
import { TodayTab } from "./ui/tabs/TodayTab";
import { TrainingTab } from "./ui/tabs/TrainingTab";
import { RunsTab } from "./ui/tabs/RunsTab";
import { SleepTab } from "./ui/tabs/SleepTab";
import { TrendsTab } from "./ui/tabs/TrendsTab";
import { Settings } from "./ui/screens/Settings";
import { PullToSync } from "./ui/components/PullToSync";
import { useSettings } from "./store/settingsStore";
import { useSync } from "./store/syncStore";
import { useUi } from "./store/uiStore";
import { isConnected, bootstrapFromJson } from "./lib/garmin/auth";
import { getDisplayName } from "./lib/garmin/client";
import { getKv, getSyncState } from "./lib/db/repo";
import { ensureWorkoutPlansSeeded } from "./lib/db/workouts";
import { isMockMode } from "./dev/mockSync";
import { isSyncRunning, syncNow } from "./lib/sync/engine";
import { popBack, useBackHandler } from "./lib/backstack";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const AUTO_SYNC_AFTER_MS = 6 * 3600 * 1000;
let bootStarted = false;

async function autoSyncIfStale() {
  if (isMockMode || isSyncRunning()) return;
  if (useSync.getState().authStatus !== "connected") return;
  const last = (await getSyncState<number>("lastSyncAt")) ?? 0;
  if (Date.now() - last > AUTO_SYNC_AFTER_MS) syncNow();
}

export default function App() {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useSettings((s) => s.theme);

  useBackHandler(
    settingsOpen,
    useCallback(() => setSettingsOpen(false), []),
  );

  useEffect(() => {
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("light", !dark);
    if (Capacitor.isNativePlatform()) {
      // status-bar icons: light-on-dark / dark-on-light
      import("@capacitor/status-bar")
        .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
        .catch(() => {});
    }
  }, [theme]);

  // restore auth state on boot; in browser dev (non-mock) auto-bootstrap from
  // the PC token cache via the dev-only /dev-tokens endpoint
  useEffect(() => {
    if (bootStarted) return; // StrictMode double-invokes effects; boot once
    bootStarted = true;
    (async () => {
      // his calisthenics plan must exist in production, not just mock mode;
      // idempotent and never overwrites a plan he has edited
      ensureWorkoutPlansSeeded().catch((e) => console.error("[workouts] seed failed", e));

      const sync = useSync.getState();
      const last = await getSyncState<number>("lastSyncAt");
      if (last) sync.setLastSyncAt(last);

      if (await isConnected()) {
        sync.setAuth("connected", (await getKv<string>("displayName")) ?? null);
      } else if (import.meta.env.DEV && !isMockMode) {
        try {
          const res = await fetch("/dev-tokens");
          if (res.ok) {
            await bootstrapFromJson(await res.text());
            sync.setAuth("connected", await getDisplayName());
            console.info("[dev] auto-bootstrapped from ~/.garmin_tokens");
          } else {
            sync.setAuth("disconnected");
          }
        } catch {
          sync.setAuth("disconnected");
        }
      } else {
        sync.setAuth("disconnected");
      }
      autoSyncIfStale();
    })();

    if (Capacitor.isNativePlatform()) {
      // hardware/gesture back: close the topmost sub-screen, else minimize
      const backSub = CapApp.addListener("backButton", () => {
        if (!popBack()) CapApp.minimizeApp();
      });
      // sync when the app returns to the foreground and data is stale
      const stateSub = CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) autoSyncIfStale();
      });
      return () => {
        backSub.then((s) => s.remove());
        stateSub.then((s) => s.remove());
      };
    }
  }, []);

  return (
    <div
      className="flex h-dvh flex-col bg-page text-ink"
      // Android 15 draws edge-to-edge under the status bar; env() gives the
      // exact inset where supported, 32px covers WebViews where it reports 0
      style={Capacitor.isNativePlatform() ? { paddingTop: "max(env(safe-area-inset-top, 0px), 32px)" } : undefined}
    >
      <PullToSync>
        {settingsOpen ? (
          <Settings onBack={() => setSettingsOpen(false)} />
        ) : (
          <>
            {tab === "today" && <TodayTab onOpenSettings={() => setSettingsOpen(true)} />}
            {tab === "training" && <TrainingTab />}
            {tab === "runs" && <RunsTab />}
            {tab === "sleep" && <SleepTab />}
            {tab === "trends" && <TrendsTab />}
          </>
        )}
      </PullToSync>
      {!settingsOpen && <TabBar active={tab} onChange={setTab} />}
    </div>
  );
}
