import type { ReactNode } from "react";

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
  onClick,
}: {
  kicker?: string;
  title?: string;
  value?: ReactNode;
  children?: ReactNode;
  footnote?: string;
  onClick?: () => void;
}) {
  return (
    <section
      onClick={onClick}
      className={`mx-4 mb-3 rounded-2xl bg-card p-4 ${onClick ? "active:opacity-80" : ""}`}
    >
      {kicker && <div className="kicker mb-1">{kicker}</div>}
      {(title || value) && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          {title && <h2 className="text-[15px] font-medium text-ink-2">{title}</h2>}
          {value && <div className={`tnum text-[28px] font-semibold leading-none ${title ? "" : "ml-auto"}`}>{value}</div>}
        </div>
      )}
      {children}
      {footnote && <p className="mt-2 text-[12px] text-ink-3">{footnote}</p>}
    </section>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="mx-4 mt-10 rounded-2xl border border-dashed border-hairline p-8 text-center text-[14px] text-ink-3">
      {text}
    </div>
  );
}
