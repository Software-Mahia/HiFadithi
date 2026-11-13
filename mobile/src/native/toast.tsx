/** Transient confirmation ("Saved", "Story audio ready") that slides down from
 * the top and disappears, instead of a blocking alert dialog. Native only. */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "../theme";
import { haptic } from "./haptics";

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastHost({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: Tone = "success") => {
    if (timer.current) clearTimeout(timer.current);
    if (tone === "error") haptic.error();
    else if (tone === "success") haptic.success();
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const icon = toast?.tone === "error" ? "alert-circle" : toast?.tone === "info" ? "information-circle" : "checkmark-circle";
  const tint = toast?.tone === "error" ? "#E0685E" : toast?.tone === "info" ? colors.amber : colors.teal;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp.springify().damping(18)}
          exiting={FadeOutUp.duration(180)}
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + 8 }]}
        >
          <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
            <Ionicons name={icon} size={18} color={tint} />
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#2A2321",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  text: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.text, flexShrink: 1 },
});
