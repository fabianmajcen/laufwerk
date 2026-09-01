// Bottom sheet: scrim + panel. The app had no modal at all before this (the
// only dialog was a native confirm() in Settings), so this is the shared one.
import { useCallback, type ReactNode } from "react";
import { useBackHandler } from "../../lib/backstack";

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  // registered while open, so it sits above whatever handler is underneath
  useBackHandler(true, useCallback(() => onClose(), [onClose]));
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      {/* --safe-bottom is the REAL nav-bar height, published by MainActivity,
          because this WebView reports env(safe-area-inset-bottom) as 0 while
          Android lays us out behind the bar. 12px floor + a 16px design gap
          reproduces the old 28px if the var never arrives. The panel is also
          capped and its body scrolls, so a long sheet cannot push its own
          actions off screen either. */}
      <div
        className="relative flex max-h-[85vh] flex-col rounded-t-2xl bg-card px-4 pt-4"
        style={{
          paddingBottom:
            "calc(max(var(--safe-bottom, 0px), env(safe-area-inset-bottom, 0px), 12px) + 16px)",
        }}
      >
        <h2 className="shrink-0 text-[17px] font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 shrink-0 text-[13px] text-ink-2">{subtitle}</p>}
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

export function SheetButton({
  children,
  onClick,
  tone = "neutral",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "primary" | "danger" | "neutral";
}) {
  const cls =
    tone === "primary"
      ? "bg-accent text-white"
      : tone === "danger"
        ? "bg-page text-status-critical"
        : "bg-page text-ink-2";
  return (
    <button onClick={onClick} className={`h-12 w-full rounded-xl text-[15px] font-medium ${cls} active:opacity-80`}>
      {children}
    </button>
  );
}
