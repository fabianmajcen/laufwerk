// Light haptic feedback, native only, never throws.
import { Capacitor } from "@capacitor/core";

export function tapFeedback() {
  if (!Capacitor.isNativePlatform()) return;
  import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
}
