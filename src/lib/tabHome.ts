// Tap the active tab again -> back to that tab's root view, scrolled to top.
// The TabBar dispatches the event; each mounted tab resets its own sub-view.
import { useEffect } from "react";

export const TAB_HOME_EVENT = "laufwerk:tab-home";

export function useTabHome(reset: () => void) {
  useEffect(() => {
    const handler = () => {
      reset();
      // after the root view renders (and scroll memory restores), take over
      requestAnimationFrame(() => {
        document.querySelector(".overflow-y-auto")?.scrollTo({ top: 0, behavior: "smooth" });
      });
    };
    window.addEventListener(TAB_HOME_EVENT, handler);
    return () => window.removeEventListener(TAB_HOME_EVENT, handler);
  }, [reset]);
}
