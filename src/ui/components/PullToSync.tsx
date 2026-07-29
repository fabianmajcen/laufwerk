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
    // outer wrapper is NOT a scroll container: the pull indicator lives here,
    // as a sibling of <main>, so it isn't clipped by main's own
    // overflow-y-auto (an absolutely-positioned child with negative top
    // inside a scrolling ancestor is outside its scrollable overflow and
    // never paints, however the transform on that ancestor is animated)
    <div className="relative flex-1 overflow-hidden">
      {(pull > 0 || busy) && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex justify-center"
          style={{ top: 4 + Math.min(pull * 0.4, 40) }}
        >
          <span className="rounded-full bg-elevated px-3 py-1 text-[11px] text-ink-2 shadow-lg">
            {busy ? `syncing ${sync.done}/${sync.total}` : pull >= THRESHOLD_PX * 0.45 ? "release to sync" : "pull to sync"}
          </span>
        </div>
      )}
      <main
        id="scroll-root"
        ref={ref}
        className="h-full overflow-y-auto pb-2"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={pull > 0 ? { transform: `translateY(${pull}px)`, transition: "none" } : { transition: "transform .2s" }}
      >
        {children}
      </main>
    </div>
  );
}
