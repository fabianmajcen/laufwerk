// Light haptic feedback, native only, never throws.
import { Capacitor } from "@capacitor/core";

export function tapFeedback() {
  if (!Capacitor.isNativePlatform()) return;
  import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
    .catch(() => {});
}

/** Rest is over: long and doubled, because this has to land while he is not
 *  looking at the phone. VIBRATE is already merged into the manifest by the
 *  haptics plugin, so this needs no permission work. */
export function restOverBuzz() {
  if (!Capacitor.isNativePlatform()) return;
  import("@capacitor/haptics")
    .then(async ({ Haptics }) => {
      await Haptics.vibrate({ duration: 350 });
      setTimeout(() => void Haptics.vibrate({ duration: 350 }).catch(() => {}), 550);
    })
    .catch(() => {});
}

/** Session finished. */
export function successBuzz() {
  if (!Capacitor.isNativePlatform()) return;
  import("@capacitor/haptics")
    .then(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success }))
    .catch(() => {});
}
