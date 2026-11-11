/** Tactile feedback for the native app. Every call is fire-and-forget and never
 * throws: devices without a haptic engine (or with it disabled) just stay silent.
 *
 * Use sparingly so it stays meaningful:
 * - tap: primary buttons and icon buttons
 * - select: chips, segmented controls, tab changes
 * - heavy: camera shutter
 * - success / warning / error: outcomes (saved, destructive action, failure) */
import * as Haptics from "expo-haptics";

function safe(run: () => Promise<void>) {
  run().catch(() => {});
}

export const haptic = {
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  select: () => safe(() => Haptics.selectionAsync()),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = keyof typeof haptic;
