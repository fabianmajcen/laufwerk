import { useEffect, useState } from "react";
import { TabBar, type TabId } from "./ui/components/TabBar";
import { TodayTab } from "./ui/tabs/TodayTab";
import { RunsTab } from "./ui/tabs/RunsTab";
import { SleepTab } from "./ui/tabs/SleepTab";
import { TrendsTab } from "./ui/tabs/TrendsTab";
import { useSettings } from "./store/settingsStore";

const TAB_IDS: TabId[] = ["today", "runs", "sleep", "trends"];

export default function App() {
  const [tab, setTab] = useState<TabId>(() => {
    const h = window.location.hash.replace("#", "") as TabId;
    return TAB_IDS.includes(h) ? h : "today";
  });
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const dark =
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("light", !dark);
  }, [theme]);

  return (
    <div className="flex h-dvh flex-col bg-page text-ink">
      <main className="flex-1 overflow-y-auto pb-2">
        {tab === "today" && <TodayTab />}
        {tab === "runs" && <RunsTab />}
        {tab === "sleep" && <SleepTab />}
        {tab === "trends" && <TrendsTab />}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
