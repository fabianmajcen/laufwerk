import { useEffect, useState } from "react";
import { TabBar, type TabId } from "./ui/components/TabBar";
import { TodayTab } from "./ui/tabs/TodayTab";
import { RunsTab } from "./ui/tabs/RunsTab";
import { SleepTab } from "./ui/tabs/SleepTab";
import { TrendsTab } from "./ui/tabs/TrendsTab";
import { Settings } from "./ui/screens/Settings";
import { PullToSync } from "./ui/components/PullToSync";
import { useSettings } from "./store/settingsStore";
import { useSync } from "./store/syncStore";
import { isConnected, bootstrapFromJson } from "./lib/garmin/auth";
import { getDisplayName } from "./lib/garmin/client";
import { getKv, getSyncState } from "./lib/db/repo";
import { isMockMode } from "./dev/mockSync";
import { isSyncRunning, syncNow } from "./lib/sync/engine";
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

const TAB_IDS: TabId[] = ["today", "runs", "sleep", "trends"];

export default function App() {
  const [tab, setTab] = useState<TabId>(() => {
    const h = window.location.hash.replace("#", "") as TabId;
    return TAB_IDS.includes(h) ? h : "today";
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("light", !dark);
  }, [theme]);

  // restore auth state on boot; in browser dev (non-mock) auto-bootstrap from
  // the PC token cache via the dev-only /dev-tokens endpoint
  useEffect(() => {
    if (bootStarted) return; // StrictMode double-invokes effects; boot once
    bootStarted = true;
    (async () => {
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

    // sync when the app returns to the foreground and data is stale
    if (Capacitor.isNativePlatform()) {
      const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) autoSyncIfStale();
      });
      return () => {
        sub.then((s) => s.remove());
      };
    }
  }, []);

  return (
    <div className="flex h-dvh flex-col bg-page text-ink">
      <PullToSync>
        {settingsOpen ? (
          <Settings onBack={() => setSettingsOpen(false)} />
        ) : (
          <>
            {tab === "today" && <TodayTab onOpenSettings={() => setSettingsOpen(true)} />}
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
