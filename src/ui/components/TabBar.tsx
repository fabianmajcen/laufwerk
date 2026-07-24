export type TabId = "today" | "runs" | "sleep" | "trends";

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
            onClick={() => onChange(t.id)}
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

function RunIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="5" r="1.6" />
      <path d="M9 20l2.5-5L9 12l3-4 3 2.5 3 .5" />
      <path d="M11.5 15l1.5 5" />
      <path d="M9 12l-3 1" />
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
