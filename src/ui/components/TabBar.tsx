import type { TabId } from "../../store/uiStore";
import { tapFeedback } from "../../lib/haptics";
import { TAB_HOME_EVENT } from "../../lib/tabHome";
export type { TabId };

const TABS: { id: TabId; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: "today", label: "Today", icon: (a) => <GaugeIcon active={a} /> },
  { id: "runs", label: "Runs", icon: (a) => <RunIcon active={a} /> },
  { id: "sleep", label: "Sleep", icon: (a) => <MoonIcon active={a} /> },
  { id: "trends", label: "Trends", icon: (a) => <TrendIcon active={a} /> },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav
      className="flex shrink-0 border-t border-hairline bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => {
              tapFeedback();
              if (isActive) window.dispatchEvent(new Event(TAB_HOME_EVENT));
              else onChange(t.id);
            }}
            className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
              isActive ? "text-accent" : "text-ink-3"
            }`}
          >
            {t.icon(isActive)}
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function GaugeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round">
      <path d="M4 14a8 8 0 1 1 16 0" />
      <path d="M12 14l3.5-3.5" />
      <path d="M4 18h16" />
    </svg>
  );
}

function RunIcon({ active: _active }: { active: boolean }) {
  // Material Symbols "directions_run" (Apache-2.0) — a runner with the
  // conventional number of limbs
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1l-5.2 2.2v4.7h2v-3.4l1.8-.7-1.6 8.1-4.9-1-.4 2 7 1.4z" />
    </svg>
  );
}

function MoonIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5z" />
    </svg>
  );
}

function TrendIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M7 14l3.5-4 3 2.5L18 7" />
    </svg>
  );
}
