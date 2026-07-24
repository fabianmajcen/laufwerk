// Pull-to-refresh on the main scroll container: pulling down ≥70px from the
// top triggers a sync. Pure touch handling, no library.
import { useRef, useState, type ReactNode } from "react";
import { syncNow, isSyncRunning } from "../../lib/sync/engine";
import { useSync } from "../../store/syncStore";
import { isMockMode } from "../../dev/mockSync";

const THRESHOLD_PX = 70;

export function PullToSync({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const sync = useSync();
  const busy = sync.phase === "running" || sync.phase === "planning";

  const onTouchStart = (e: React.TouchEvent) => {
    if (ref.current && ref.current.scrollTop <= 0) startY.current = e.touches[0].clientY;
    else startY.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null || busy) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && (ref.current?.scrollTop ?? 1) <= 0) {
      setPull(Math.min(dy * 0.45, 90)); // rubber-band
    } else {
      setPull(0);
    }
  };
  const onTouchEnd = () => {
    if (pull >= THRESHOLD_PX * 0.45 && !busy && !isMockMode && !isSyncRunning()) {
      if (useSync.getState().authStatus === "connected") syncNow();
    }
    startY.current = null;
    setPull(0);
  };

  return (
    <main
      ref={ref}
      className="relative flex-1 overflow-y-auto pb-2"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={pull > 0 ? { transform: `translateY(${pull}px)`, transition: "none" } : { transition: "transform .2s" }}
    >
      {(pull > 0 || busy) && (
        <div className="pointer-events-none absolute -top-9 left-0 right-0 flex justify-center">
          <span className="rounded-full bg-elevated px-3 py-1 text-[11px] text-ink-2">
            {busy ? `syncing ${sync.done}/${sync.total}` : pull >= THRESHOLD_PX * 0.45 ? "release to sync" : "pull to sync"}
          </span>
        </div>
      )}
      {children}
    </main>
  );
}
