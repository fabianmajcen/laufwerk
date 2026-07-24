import type { ReactNode } from "react";

/** Pushed detail screen with back header — the home of advanced stats. */
export function SubScreen({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="pb-4">
      <header className="flex items-center gap-2 px-3 pb-1 pt-4">
        <button onClick={onBack} aria-label="Back" className="p-2 text-ink-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-[20px] font-semibold">{title}</h1>
      </header>
      {children}
    </div>
  );
}

/** Chevron row linking into a sub-screen. */
export function ExploreRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between border-t border-hairline px-1 py-3 text-left first:border-t-0 active:opacity-70"
    >
      <span>
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[12px] text-ink-3">{subtitle}</span>
      </span>
      <span className="text-ink-3" aria-hidden>
        ›
      </span>
    </button>
  );
}
