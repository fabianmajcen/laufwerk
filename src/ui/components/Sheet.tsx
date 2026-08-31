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
      <div
        className="relative rounded-t-2xl bg-card px-4 pt-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 text-[13px] text-ink-2">{subtitle}</p>}
        <div className="mt-4 flex flex-col gap-2">{children}</div>
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
