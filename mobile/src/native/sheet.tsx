/** Native bottom sheet: actions and confirmations slide up from the bottom over
 * a dimmed backdrop and can be dismissed by tapping outside or swiping down.
 * Replaces Alert-based menus on the native screens. Native only. */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "../theme";
import { haptic } from "./haptics";
import type { IconName } from "./kit";

export type SheetAction = {
  label: string;
  icon?: IconName;
  tone?: "default" | "danger";
  onPress: () => void;
};

export function Sheet({
  visible,
  onClose,
  title,
  message,
  actions = [],
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions?: SheetAction[];
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(600);
  const backdrop = useSharedValue(0);

  // Mount as soon as the sheet is asked to show (state adjusted during render,
  // not in an effect); unmount only after the closing animation finishes.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      haptic.tap();
      y.set(withSpring(0, { damping: 22, stiffness: 220 }));
      backdrop.set(withTiming(1, { duration: 200 }));
    } else {
      backdrop.set(withTiming(0, { duration: 180 }));
      y.set(
        withTiming(600, { duration: 220 }, (done) => {
          if (done) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, y, backdrop]);

  const pan = Gesture.Pan()
    .onChange((event) => {
      y.set(Math.max(0, y.get() + event.changeY));
    })
    .onEnd((event) => {
      if (y.get() > 110 || event.velocityY > 900) scheduleOnRN(onClose);
      else y.set(withSpring(0, { damping: 22, stiffness: 220 }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }, sheetStyle]}>
            <View style={styles.grabber} />
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {message ? <Text style={styles.message}>{message}</Text> : null}
            {children}
            {actions.length ? (
              <View style={styles.group}>
                {actions.map((action, index) => (
                  <Pressable
                    key={action.label}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    android_ripple={{ color: "rgba(245,239,234,0.08)" }}
                    onPress={() => {
                      if (action.tone === "danger") haptic.warning();
                      else haptic.select();
                      onClose();
                      // Let the sheet start closing before the next screen or sheet opens.
                      setTimeout(action.onPress, 160);
                    }}
                    style={({ pressed }) => [
                      styles.action,
                      index ? styles.divider : null,
                      pressed ? { backgroundColor: "rgba(245,239,234,0.05)" } : null,
                    ]}
                  >
                    {action.icon ? (
                      <Ionicons name={action.icon} size={20} color={action.tone === "danger" ? "#E0685E" : colors.text} />
                    ) : null}
                    <Text style={[styles.actionText, action.tone === "danger" ? { color: "#E0685E" } : null]}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              android_ripple={{ color: "rgba(245,239,234,0.08)" }}
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, pressed ? { opacity: 0.7 } : null]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(5,4,4,0.62)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#1E1918",
  },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(245,239,234,0.25)", marginBottom: 4 },
  title: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 23, color: colors.text, textAlign: "center", paddingHorizontal: 8 },
  message: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, color: colors.muted, textAlign: "center", paddingHorizontal: 12 },
  group: { borderRadius: 18, overflow: "hidden", backgroundColor: "#2A2321", marginTop: 4 },
  action: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 56, paddingHorizontal: 18 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(245,239,234,0.10)" },
  actionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  cancel: { minHeight: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#2A2321", overflow: "hidden" },
  cancelText: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text },
});
