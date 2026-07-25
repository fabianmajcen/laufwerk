import { useState, type ReactNode } from "react";

export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-4 pb-2 pt-5">
      <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      {right}
    </header>
  );
}

export function Card({
  kicker,
  title,
  value,
  children,
  footnote,
  info,
  onClick,
}: {
  kicker?: string;
  title?: string;
  value?: ReactNode;
  children?: ReactNode;
  /** always-visible line under the chart: dynamic status or data only */
  footnote?: string;
  /** explanation behind the ⓘ toggle: how to read the chart, caveats, methods */
  info?: string;
  onClick?: () => void;
}) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <section
      onClick={onClick}
      className={`relative mx-4 mb-3 rounded-2xl bg-card p-4 ${onClick ? "active:opacity-80" : ""}`}
    >
      {info && (
        <button
          aria-label="About this chart"
          aria-expanded={showInfo}
          onClick={(e) => {
            e.stopPropagation();
            setShowInfo((v) => !v);
          }}
          className={`absolute right-3 top-3 p-1 ${showInfo ? "text-ink" : "text-ink-3"}`}
        >
          <InfoIcon />
        </button>
      )}
      {kicker && <div className={`kicker mb-1 ${info ? "pr-7" : ""}`}>{kicker}</div>}
      {(title || value) && (
        <div className={`mb-2 flex items-baseline justify-between gap-2 ${info && !kicker ? "pr-7" : ""}`}>
          {title && <h2 className="text-[15px] font-medium text-ink-2">{title}</h2>}
          {value && <div className={`tnum text-[28px] font-semibold leading-none ${title ? "" : "ml-auto"}`}>{value}</div>}
        </div>
      )}
      {info && showInfo && (
        <p className="mb-2 rounded-lg bg-elevated px-3 py-2 text-[12px] leading-relaxed text-ink-2">{info}</p>
      )}
      {children}
      {footnote && <p className="mt-2 text-[12px] text-ink-3">{footnote}</p>}
    </section>
  );
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.2" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="mx-4 mt-10 rounded-2xl border border-dashed border-hairline p-8 text-center text-[14px] text-ink-3">
      {text}
    </div>
  );
}
