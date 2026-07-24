// Android hardware/gesture back support: sub-screens register a handler;
// the most recently registered active handler wins. When nothing is open,
// the app minimizes (Android-polite default).
import { useEffect } from "react";

const stack: (() => void)[] = [];

export function useBackHandler(active: boolean, handler: () => void) {
  useEffect(() => {
    if (!active) return;
    stack.push(handler);
    return () => {
      const i = stack.lastIndexOf(handler);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active, handler]);
}

/** Returns true if a handler consumed the back press. */
export function popBack(): boolean {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
