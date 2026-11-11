/** HiFadithi native design kit (Android / iOS only).
 *
 * Imported only from `*.native.tsx` files, so Metro never puts it in the web
 * bundle. Built on plain React Native primitives (not gluestack/uniwind) so
 * layout and type behave identically on every device.
 *
 * Scale: 4-pt spacing, 20-pt gutter, iOS-style type ramp, 52-pt primary
 * actions, 44-pt minimum touch targets. */
import type { ReactNode } from "react";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { PressableProps, StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, fonts } from "../theme";
import { haptic as feedback } from "./haptics";
import type { HapticKind } from "./haptics";

export type IconName = keyof typeof Ionicons.glyphMap;

/* ─── Tokens ───────────────────────────────────────────────────────── */

/** Editorial display serif (loaded in app/_layout.native.tsx). Headlines only;
 * body text, labels and buttons stay in Poppins. */
export const serif = {
  regular: "PlayfairDisplay_500Medium",
  italic: "PlayfairDisplay_500Medium_Italic",
  semi: "PlayfairDisplay_600SemiBold",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;
export const GUTTER = 20;
export const TAB_BAR_HEIGHT = 64;

export const line = {
  hair: "rgba(245,239,234,0.08)",
  soft: "rgba(245,239,234,0.12)",
  strong: "rgba(245,239,234,0.20)",
} as const;

export const type = StyleSheet.create({
  display: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 36, lineHeight: 42, letterSpacing: -0.6, color: colors.text },
  title1: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 30, lineHeight: 36, letterSpacing: -0.4, color: colors.text },
  title2: { fontFamily: "PlayfairDisplay_500Medium", fontSize: 23, lineHeight: 29, letterSpacing: -0.2, color: colors.text },
  headline: { fontFamily: fonts.semiBold, fontSize: 17, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  subhead: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.muted },
  footnote: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  caption: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 15, color: colors.muted },
  overline: {
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.muted,
  },
});

/* ─── Press feedback ───────────────────────────────────────────────── */

/** Pressable with platform-native feedback: Android ripple, iOS dim + slight
 * scale. 44-pt minimum hit area via hitSlop. */
export function Touchable({
  style,
  children,
  scale = 0.98,
  ripple = true,
  haptic,
  onPress,
  ...props
}: Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scale?: number;
  ripple?: boolean;
  /** Tactile feedback fired on press (see src/native/haptics.ts). */
  haptic?: HapticKind;
  children: ReactNode;
}) {
  const android = Platform.OS === "android";
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      android_ripple={android && ripple ? { color: "rgba(245,239,234,0.10)", foreground: true } : undefined}
      onPress={
        onPress
          ? (event) => {
              if (haptic) feedback[haptic]();
              onPress(event);
            }
          : undefined
      }
      {...props}
      style={({ pressed }) => [
        style,
        android && ripple && StyleSheet.flatten(style)?.borderRadius ? { overflow: "hidden" } : null,
        pressed && !(android && ripple) ? { opacity: 0.72, transform: [{ scale }] } : null,
        pressed && android && scale < 0.95 ? { transform: [{ scale }] } : null,
        props.disabled ? { opacity: 0.5 } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Pulsing placeholder shape shown while content loads (instead of a spinner). */
export function Skeleton({
  width = "100%",
  height,
  radius = 14,
  style,
}: {
  width?: number | `${number}%`;
  height: number | `${number}%`;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.9, { duration: 850 }), -1, true);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.elevated }, animated, style]} />;
}

/** Tab-root screen with an iOS-style large title that collapses into a compact
 * bar as you scroll. Pull-to-refresh and bottom-tab spacing included. */
export function TabScreen({
  title,
  subtitle,
  right,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    y.value = event.contentOffset.y;
  });
  const bar = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [36, 64], [0, 1], Extrapolation.CLAMP),
  }));
  const large = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 48], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: y.value < 0 ? 0 : interpolate(y.value, [0, 60], [0, -8], Extrapolation.CLAMP) },
      { scale: y.value < 0 ? 1 + Math.min(0.08, -y.value / 900) : 1 },
    ],
  }));

  return (
    <View style={styles.screen}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + space.sm, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + space.xxxl }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.text}
              colors={[colors.brick]}
              progressBackgroundColor={colors.surface}
              progressViewOffset={insets.top}
            />
          ) : undefined
        }
      >
        <View style={{ paddingHorizontal: GUTTER, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <BrandChip />
          {right}
        </View>
        <Animated.View style={[{ paddingHorizontal: GUTTER, paddingTop: space.xl, paddingBottom: space.lg, gap: 4, transformOrigin: "left" }, large]}>
          <Text accessibilityRole="header" style={[type.display, { fontSize: 34 }]}>
            {title}
          </Text>
          {subtitle ? <Text style={type.subhead}>{subtitle}</Text> : null}
        </Animated.View>
        {children}
      </Animated.ScrollView>

      {/* Compact bar that takes over once the large title scrolls away */}
      <Animated.View pointerEvents="box-none" style={[styles.compactBar, { paddingTop: insets.top, height: insets.top + 52 }, bar]}>
        <Text numberOfLines={1} style={[type.headline, { fontSize: 16 }]}>
          {title}
        </Text>
        {right ? <View style={{ position: "absolute", right: GUTTER, bottom: 6 }}>{right}</View> : null}
      </Animated.View>
    </View>
  );
}

/* ─── Screen scaffolding ───────────────────────────────────────────── */

/** Scrollable screen with safe areas, 20-pt gutter and optional pinned footer. */
export function NScreen({
  children,
  footer,
  refreshing,
  onRefresh,
  scroll = true,
  tabBar = false,
  topInset = true,
  contentStyle,
  keyboard = false,
}: {
  children: ReactNode;
  /** Pinned action area above the home indicator (primary CTA). */
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** Leave room for the bottom tab bar. */
  tabBar?: boolean;
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = topInset ? insets.top + space.sm : 0;
  const bottomRoom = footer ? space.lg : (tabBar ? TAB_BAR_HEIGHT : 0) + insets.bottom + space.xxxl;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[{ paddingTop: top, paddingBottom: bottomRoom, paddingHorizontal: GUTTER }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={keyboard}
      keyboardDismissMode={keyboard ? "interactive" : "none"}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.brick]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingTop: top, paddingHorizontal: GUTTER }, contentStyle]}>{children}</View>
  );
  return (
    <View style={styles.screen}>
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

/** Large-title header used on tab roots. */
export function LargeTitle({
  title,
  subtitle,
  eyebrow,
  right,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  right?: ReactNode;
}) {
  return (
    <View style={{ paddingTop: space.sm, paddingBottom: space.lg, gap: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 }}>
        <BrandChip />
        {right}
      </View>
      {eyebrow ? <Text style={[type.overline, { marginTop: space.lg }]}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={[type.title1, { marginTop: eyebrow ? 2 : space.lg }]}>
        {title}
      </Text>
      {subtitle ? <Text style={type.subhead}>{subtitle}</Text> : null}
    </View>
  );
}

/** Compact header for pushed screens: back button, centred title, right slot. */
export function NavHeader({
  title,
  subtitle,
  onBack,
  right,
  back = true,
  tone = "dark",
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  back?: boolean;
  tone?: "dark" | "overlay";
}) {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        {back ? (
          <CircleButton
            icon="chevron-back"
            label="Go back"
            tone={tone}
            onPress={onBack || (() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/artefacts")))}
          />
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: "center" }}>
        {title ? (
          <Text numberOfLines={1} style={[type.headline, { fontSize: 16 }]}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text numberOfLines={1} style={[type.caption, { marginTop: 1 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.navSide, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
}

/** Official HiFadithi wordmark (assets/brand/hifadithi-logo.png, 982x182). */
export const LOGO_RATIO = 982 / 182;

export function Logo({ height = 22 }: { height?: number }) {
  return (
    <Image
      source={require("../../assets/brand/hifadithi-logo.png")}
      style={{ height, width: Math.round(height * LOGO_RATIO) }}
      contentFit="contain"
      accessibilityLabel="HiFadithi"
      accessibilityRole="image"
    />
  );
}

/** Wordmark with the NMK attribution underneath, used in screen headers. */
export function BrandChip({ height = 20 }: { height?: number }) {
  return (
    <View style={{ gap: 4 }}>
      <Logo height={height} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 8.5, lineHeight: 11, letterSpacing: 1.8, color: colors.muted }}>
        NATIONAL MUSEUMS OF KENYA
      </Text>
    </View>
  );
}

/* ─── Buttons ──────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

const buttonTone: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brick, fg: colors.white, border: colors.brick },
  secondary: { bg: colors.elevated, fg: colors.text, border: line.soft },
  outline: { bg: "transparent", fg: colors.text, border: line.strong },
  ghost: { bg: "transparent", fg: colors.muted, border: "transparent" },
  danger: { bg: "rgba(194,67,57,0.12)", fg: colors.brick, border: "rgba(194,67,57,0.45)" },
};

export function NButton({
  label,
  onPress,
  variant = "primary",
  icon,
  trailingIcon,
  loading,
  disabled,
  compact,
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const tone = buttonTone[variant];
  return (
    <Touchable
      onPress={onPress}
      haptic={variant === "danger" ? "warning" : "tap"}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      style={[
        styles.button,
        { minHeight: compact ? 44 : 54, backgroundColor: tone.bg, borderColor: tone.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={tone.fg} /> : null}
          <Text style={{ fontFamily: fonts.medium, fontSize: compact ? 14 : 15.5, lineHeight: 20, letterSpacing: 0.2, color: tone.fg }}>
            {label}
          </Text>
          {trailingIcon ? <Ionicons name={trailingIcon} size={18} color={tone.fg} /> : null}
        </>
      )}
    </Touchable>
  );
}

export function CircleButton({
  icon,
  label,
  onPress,
  tone = "dark",
  size = 40,
  color,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: "dark" | "overlay" | "brick";
  size?: number;
  color?: string;
}) {
  const bg = tone === "brick" ? colors.brick : tone === "overlay" ? "rgba(15,11,11,0.55)" : colors.elevated;
  return (
    <Touchable
      onPress={onPress}
      haptic="tap"
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tone === "brick" ? "transparent" : line.soft,
      }}
      scale={0.92}
    >
      <Ionicons name={icon} size={Math.round(size * 0.48)} color={color ?? colors.text} />
    </Touchable>
  );
}

/* ─── Surfaces ─────────────────────────────────────────────────────── */

export function Surface({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[styles.surface, padded ? { padding: space.lg } : null, style]}>{children}</View>;
}

export function SectionHeader({ title, action, style }: { title: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xxl, marginBottom: space.md }, style]}>
      <Text style={[type.overline, { color: colors.muted }]}>{title}</Text>
      {action}
    </View>
  );
}

/** Grouped list (settings style). Children are ListRow items. */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.surface, { paddingVertical: 2 }, style]}>{children}</View>;
}

export function ListRow({
  icon,
  label,
  value,
  onPress,
  tone = "default",
  last,
  detail,
}: {
  icon?: IconName;
  label: string;
  value?: string | null;
  onPress?: () => void;
  tone?: "default" | "danger" | "teal" | "amber";
  last?: boolean;
  detail?: string;
}) {
  const fg = tone === "danger" ? colors.brick : colors.text;
  const iconColor =
    tone === "danger" ? colors.brick : tone === "teal" ? colors.teal : tone === "amber" ? colors.amber : colors.muted;
  const content = (
    <View style={[styles.row, last ? null : styles.rowDivider]}>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={17} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.callout, { color: fg }]}>{label}</Text>
        {detail ? <Text style={[type.footnote, { marginTop: 1 }]}>{detail}</Text> : null}
      </View>
      {value ? (
        <Text numberOfLines={1} style={[type.subhead, { maxWidth: "55%", textAlign: "right" }]}>
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.mutedDeep} /> : null}
    </View>
  );
  return onPress ? (
    <Touchable onPress={onPress} accessibilityLabel={label} scale={1}>
      {content}
    </Touchable>
  ) : (
    content
  );
}

/** Label/value line for record metadata. */
export function KeyValue({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  return (
    <View style={[styles.kv, last ? null : styles.rowDivider]}>
      <Text style={type.subhead}>{label}</Text>
      <Text style={[type.callout, { flex: 1, textAlign: "right" }]}>{value || "—"}</Text>
    </View>
  );
}

/* ─── Status ───────────────────────────────────────────────────────── */

export type Status = "draft" | "processing" | "ready" | "published" | "failed";

const statusTone: Record<Status, { fg: string; bg: string; icon: IconName }> = {
  draft: { fg: "#B3A392", bg: "rgba(154,136,118,0.16)", icon: "create-outline" },
  processing: { fg: colors.amber, bg: "rgba(234,160,0,0.14)", icon: "sync" },
  ready: { fg: colors.teal, bg: "rgba(0,180,194,0.14)", icon: "checkmark-circle" },
  published: { fg: colors.teal, bg: "rgba(0,180,194,0.14)", icon: "globe-outline" },
  failed: { fg: "#E0685E", bg: "rgba(194,67,57,0.18)", icon: "alert-circle" },
};

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const tone = statusTone[status] ?? statusTone.draft;
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Ionicons name={tone.icon} size={11} color={tone.fg} />
      <Text style={{ fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14, color: tone.fg }}>
        {label || status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}

export function Notice({
  tone = "info",
  icon,
  children,
}: {
  tone?: "info" | "warn" | "error" | "success";
  icon?: IconName;
  children: ReactNode;
}) {
  const map = {
    info: { fg: colors.muted, bg: colors.elevated, icon: "information-circle-outline" as IconName },
    warn: { fg: colors.amber, bg: "rgba(234,160,0,0.10)", icon: "alert-circle-outline" as IconName },
    error: { fg: "#E0685E", bg: "rgba(194,67,57,0.14)", icon: "alert-circle-outline" as IconName },
    success: { fg: colors.teal, bg: "rgba(0,180,194,0.10)", icon: "checkmark-circle-outline" as IconName },
  }[tone];
  return (
    <View accessibilityRole={tone === "error" ? "alert" : undefined} style={[styles.notice, { backgroundColor: map.bg }]}>
      <Ionicons name={icon ?? map.icon} size={16} color={map.fg} />
      <Text style={[type.footnote, { flex: 1, color: map.fg }]}>{children}</Text>
    </View>
  );
}

/* ─── Inputs ───────────────────────────────────────────────────────── */

export function NField({
  label,
  hint,
  multiline,
  trailing,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string; trailing?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[type.caption, { color: colors.muted, letterSpacing: 0.3 }]}>{label}</Text>
      <View style={[styles.input, multiline ? { minHeight: 112, alignItems: "flex-start", paddingVertical: 12 } : null]}>
        <TextInput
          placeholderTextColor={colors.mutedDeep}
          selectionColor={colors.amber}
          cursorColor={colors.amber}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          style={[styles.inputText, multiline ? { minHeight: 88 } : null, style as StyleProp<TextStyle>]}
          {...props}
        />
        {trailing}
      </View>
      {hint ? <Text style={type.footnote}>{hint}</Text> : null}
    </View>
  );
}

/** Two-option segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Touchable
            key={option.value}
            onPress={() => onChange(option.value)}
            haptic="select"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            scale={1}
            style={[styles.segmentItem, active ? styles.segmentActive : null]}
          >
            <Text style={{ fontFamily: active ? fonts.semiBold : fonts.medium, fontSize: 13, color: active ? colors.text : colors.muted }}>
              {option.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

export function FilterChips<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -GUTTER }}
      contentContainerStyle={{ gap: space.sm, paddingHorizontal: GUTTER }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <Touchable
            key={item.value}
            onPress={() => onChange(item.value)}
            haptic="select"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Filter: ${item.label}`}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: active ? colors.background : colors.text }}>
              {item.label}
            </Text>
          </Touchable>
        );
      })}
    </ScrollView>
  );
}

/* ─── Media ────────────────────────────────────────────────────────── */

/** Neutral museum plinth shown where an artefact photograph is not available
 * yet: a lit stage, a plinth and a quiet caption, never an illustration. */
export function MuseumStage({ height, compact }: { height: number | `${number}%`; compact?: boolean }) {
  return (
    <View style={{ height, backgroundColor: "#E9E4DC", alignItems: "center", justifyContent: "flex-end", overflow: "hidden" }}>
      <View style={{ position: "absolute", top: "-30%", width: "140%", aspectRatio: 1, borderRadius: 9999, backgroundColor: "#F4F1EC" }} />
      <View style={{ alignItems: "center", marginBottom: compact ? "16%" : "14%" }}>
        <Ionicons name="cube-outline" size={compact ? 18 : 26} color="rgba(51,44,40,0.38)" />
        <View
          style={{
            marginTop: compact ? 6 : 10,
            width: compact ? 54 : 96,
            height: compact ? 26 : 46,
            backgroundColor: "#D4CCC0",
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
          }}
        />
        <View style={{ width: compact ? 70 : 128, height: compact ? 5 : 8, borderRadius: 999, backgroundColor: "rgba(51,44,40,0.12)" }} />
      </View>
      {compact ? null : (
        <Text style={{ position: "absolute", bottom: 12, fontFamily: fonts.medium, fontSize: 9.5, letterSpacing: 1.6, color: "rgba(51,44,40,0.45)" }}>
          PHOTOGRAPH FORTHCOMING
        </Text>
      )}
    </View>
  );
}

/** Square thumbnail. Omit `size` to fill the parent box. */
export function Thumb({ uri, size, radius = 14 }: { uri?: string | null; size?: number; radius?: number }) {
  return (
    <View style={{ width: size ?? "100%", height: size ?? "100%", borderRadius: radius, overflow: "hidden", backgroundColor: colors.museumLight }}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      ) : (
        <MuseumStage height="100%" compact />
      )}
    </View>
  );
}

/* ─── States ───────────────────────────────────────────────────────── */

export function NLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <View style={[styles.screen, { alignItems: "center", justifyContent: "center", gap: space.md }]}>
      <ActivityIndicator color={colors.text} size="large" />
      <Text style={type.subhead}>{label}</Text>
    </View>
  );
}

export function NEmpty({
  icon = "albums-outline",
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: space.huge, paddingHorizontal: space.lg, gap: space.md }}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.text} />
      </View>
      <Text style={[type.headline, { textAlign: "center" }]}>{title}</Text>
      <Text style={[type.subhead, { textAlign: "center", maxWidth: 300 }]}>{body}</Text>
      {action ? <View style={{ alignSelf: "stretch", marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

/** Full-screen state (signed out, missing record) with safe areas. */
export function NStateScreen(props: Parameters<typeof NEmpty>[0] & { onBack?: () => void }) {
  const { onBack, ...empty } = props;
  return (
    <NScreen contentStyle={{ flexGrow: 1 }}>
      {onBack ? <NavHeader onBack={onBack} /> : null}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <NEmpty {...empty} />
      </View>
    </NScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  compactBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,15,14,0.98)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(245,239,234,0.12)",
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line.soft,
  },
  nav: { flexDirection: "row", alignItems: "center", minHeight: 52, gap: space.sm, marginBottom: space.sm },
  navSide: { width: 72, justifyContent: "center" },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xl,
    borderRadius: 999,
    borderWidth: 1,
  },
  surface: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.soft,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line.hair },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
  kv: { flexDirection: "row", alignItems: "center", gap: space.lg, minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.md },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  notice: { flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: 14, paddingHorizontal: space.md, paddingVertical: space.md },
  input: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: line.soft,
    backgroundColor: colors.elevated,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  inputText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 0 },
  segment: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: colors.elevated, gap: 4 },
  segmentItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  segmentActive: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: line.strong },
  chip: {
    minHeight: 38,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.soft,
  },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.elevated,
  },
});
