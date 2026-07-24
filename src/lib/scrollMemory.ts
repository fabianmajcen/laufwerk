// Per-screen scroll restoration. The position is recorded LIVE from scroll
// events (recording at unmount is too late: the browser clamps scrollTop the
// moment the outgoing screen's content is replaced by a shorter one).
import { useLayoutEffect } from "react";

const positions = new Map<string, number>();

export function useScrollMemory(key: string) {
  useLayoutEffect(() => {
    const el = document.getElementById("scroll-root");
    if (!el) return;

    const want = positions.get(key) ?? 0;
    let restoring = want > 0;
    if (restoring) {
      let tries = 0;
      const restore = () => {
        el.scrollTop = want;
        if (Math.abs(el.scrollTop - want) > 4 && tries++ < 12) {
          setTimeout(restore, 60);
        } else {
          restoring = false;
        }
      };
      restore();
    } else {
      el.scrollTop = 0;
    }

    const onScroll = () => {
      if (!restoring) positions.set(key, el.scrollTop);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [key]);
}
