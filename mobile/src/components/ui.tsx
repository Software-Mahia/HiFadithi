import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge as UIBadge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button as UIButton, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card as UICard } from "@/components/ui/card";
import {
  FormControl,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";

import { colors, fonts, lh } from "../theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

const buttonPalettes = {
  // White text only on Brick / Deep Red, per the mockups.
  primary: { box: "border-brick bg-brick", text: "text-white", icon: colors.white },
  secondary: { box: "border-border bg-elevated", text: "text-foreground", icon: colors.text },
  outline: { box: "border-brick bg-transparent", text: "text-brick", icon: colors.brick },
  ghost: { box: "border-transparent bg-transparent", text: "text-muted-foreground", icon: colors.muted },
  danger: { box: "border-deepred bg-deepred", text: "text-white", icon: colors.white },
} as const;

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  style,
  compact,
  height,
}: ButtonProps & { height?: number }) {
  const palette = buttonPalettes[variant];
  return (
    <UIButton
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={height ? { minHeight: height, ...(style as object) } : style}
      className={`w-full flex-row items-center justify-center gap-2 rounded-[12px] border px-4 ${
        compact ? "min-h-10 py-2" : "min-h-12 py-3"
      } ${palette.box} ${disabled ? "opacity-50" : ""}`}
    >
      {loading ? (
        <ButtonSpinner color={palette.icon} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={palette.icon} /> : null}
          <ButtonText className={`text-[15px] font-semibold ${palette.text}`}>{label}</ButtonText>
        </>
      )}
    </UIButton>
  );
}

export function Field({
  label,
  hint,
  multiline,
  style,
  ...props
}: TextInputProps & { label: string; hint?: string }) {
  return (
    <FormControl className="gap-1.5">
      <FormControlLabel>
        <FormControlLabelText className="text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
          {label}
        </FormControlLabelText>
      </FormControlLabel>
      {multiline ? (
        <Textarea className="min-h-24 rounded-[12px] border-border bg-elevated px-3 py-2">
          <TextareaInput
            multiline
            placeholderTextColor={colors.mutedDeep}
            style={style}
            className="text-[14px] leading-[20px] text-foreground placeholder:text-muted-foreground"
            {...props}
          />
        </Textarea>
      ) : (
        <Input className="min-h-12 rounded-[12px] border-border bg-elevated px-3">
          <InputField
            placeholderTextColor={colors.mutedDeep}
            style={style}
            className="text-[14px] leading-[20px] text-foreground placeholder:text-muted-foreground"
            {...props}
          />
        </Input>
      )}
      {hint ? (
        <FormControlHelper>
          <FormControlHelperText className="text-[11px] leading-[16px] text-muted-foreground">
            {hint}
          </FormControlHelperText>
        </FormControlHelper>
      ) : null}
    </FormControl>
  );
}

export function Card({
  children,
  style,
  className,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
}) {
  return (
    <UICard
      className={`gap-3 rounded-[18px] border border-border bg-card p-4 ${className || ""}`}
      style={style}
    >
      {children}
    </UICard>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <HStack className="items-center justify-between gap-3">
      <Text className="flex-1 text-[18px] leading-[24px] font-semibold text-foreground">
        {children}
      </Text>
      {action}
    </HStack>
  );
}

/* ─── Status badges ─────────────────────────────────────────────────── */

export type StatusKind = "draft" | "processing" | "ready" | "published" | "failed" | "neutral";

const statusPalettes: Record<StatusKind, { fg: string; bg: string; icon?: keyof typeof Ionicons.glyphMap }> = {
  draft: { fg: "#9A8876", bg: "rgba(154,136,118,0.16)" },
  processing: { fg: "#EAA000", bg: "rgba(234,160,0,0.16)", icon: "sync" },
  ready: { fg: "#00B4C2", bg: "rgba(0,180,194,0.16)", icon: "checkmark-circle" },
  published: { fg: "#00B4C2", bg: "rgba(0,180,194,0.16)", icon: "checkmark-circle" },
  failed: { fg: "#C24339", bg: "rgba(194,67,57,0.18)", icon: "alert-circle" },
  neutral: { fg: "#9A8876", bg: "rgba(154,136,118,0.16)" },
};

export function StatusBadge({
  status,
  label,
  showIcon = true,
}: {
  status: StatusKind;
  label?: string;
  showIcon?: boolean;
}) {
  const palette = statusPalettes[status] ?? statusPalettes.neutral;
  return (
    <HStack
      className="items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: palette.bg }}
    >
      {showIcon && palette.icon ? (
        <Ionicons name={palette.icon} size={11} color={palette.fg} />
      ) : null}
      <Text className="text-[10px] font-semibold" style={{ color: palette.fg }}>
        {label || status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </HStack>
  );
}

const badgeTones = {
  neutral: { box: "bg-[#8A7F7B]/15 border-transparent", text: "text-[#9A8876]" },
  draft: { box: "bg-[#8A7F7B]/15 border-transparent", text: "text-[#9A8876]" },
  teal: { box: "bg-teal/15 border-transparent", text: "text-teal" },
  amber: { box: "bg-amber/15 border-transparent", text: "text-amber" },
  brick: { box: "bg-deepred/20 border-transparent", text: "text-brick" },
  success: { box: "bg-teal/15 border-transparent", text: "text-teal" },
  published: { box: "bg-teal/15 border-transparent", text: "text-teal" },
} as const;

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof badgeTones;
}) {
  const palette = badgeTones[tone];
  const published = tone === "success" || tone === "published";
  return (
    <UIBadge
      variant="outline"
      className={`self-start rounded-full border px-2.5 py-1 ${palette.box}`}
    >
      {published ? <Ionicons name="checkmark" size={11} color={colors.teal} /> : null}
      <BadgeText className={`text-[10px] font-semibold normal-case tracking-normal ${palette.text}`}>
        {label}
      </BadgeText>
    </UIBadge>
  );
}

/* ─── Empty + loading states ────────────────────────────────────────── */

export function EmptyState({
  title,
  body,
  action,
  art = "amani-empty",
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: ReactNode;
  art?: "amani-empty" | "juma-explorer" | "prop-pot";
}) {
  const source =
    art === "juma-explorer"
      ? require("../../assets/kit/characters/juma-explorer.png")
      : art === "prop-pot"
        ? require("../../assets/kit/props/prop-pot.png")
        : require("../../assets/kit/characters/amani-empty.png");
  return (
    <VStack className="items-center gap-3 px-4 py-8">
      <Image source={source} style={{ width: 152, height: 152 }} contentFit="contain" />
      <Text className="text-center text-[18px] leading-[24px] font-semibold text-foreground">
        {title}
      </Text>
      <Text className="max-w-[280px] text-center text-[13px] leading-[20px] text-muted-foreground">
        {body}
      </Text>
      {action}
    </VStack>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <VStack
      className="items-center justify-center gap-3 bg-background px-4"
      style={{ flex: 1, minHeight: 280 }}
    >
      <ActivityIndicator color={colors.brick} size="large" />
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
    </VStack>
  );
}

/* ─── Screen shell ──────────────────────────────────────────────────── */

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentStyle,
  style,
  safe = true,
  bottomPad = 120,
  keyboardAdjust = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  safe?: boolean;
  bottomPad?: number;
  /** Keep the focused input above the keyboard while typing. */
  keyboardAdjust?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const top = safe ? Math.max(insets.top, 14) + 8 : 0;
  if (!scroll) {
    return (
      <View style={[styles.screen, style]}>
        <Box
          className="flex-1 bg-background"
          style={StyleSheet.flatten([{ paddingTop: top }, contentStyle])}
        >
          {children}
        </Box>
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.screen, style]}
      contentContainerStyle={[
        styles.screenContent,
        { paddingTop: top, paddingBottom: bottomPad },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets={keyboardAdjust}
      keyboardDismissMode={keyboardAdjust ? "on-drag" : "none"}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.brick}
            colors={[colors.brick]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingHorizontal: 28, gap: 16 },
  photoSlot: { aspectRatio: 1, minHeight: 64 },
});

/* ─── Headers ───────────────────────────────────────────────────────── */

/** Centred brand lock-up used on My artefacts + Profile (and the empty
 * gallery), measured at ~75pt from the top of the mockups. */
export function BrandHeader({
  tagline = "Stories behind every artefact",
  compact = false,
}: {
  tagline?: string;
  compact?: boolean;
}) {
  return (
    <VStack className="items-center gap-1.5">
      {/* Official HiFadithi wordmark (982x182). */}
      <Image
        source={require("../../assets/brand/hifadithi-logo.png")}
        style={{ height: compact ? 22 : 26, width: Math.round(((compact ? 22 : 26) * 982) / 182) }}
        contentFit="contain"
        accessibilityLabel="HiFadithi"
      />
      <Text className="text-[10px] leading-[14px] text-muted-foreground">{tagline}</Text>
    </VStack>
  );
}

export function StackHeader({
  title,
  back = true,
  onBack,
  right,
  subtitle,
}: {
  title: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <VStack style={{ paddingTop: Math.max(insets.top, 14) + 6 }} className="gap-1">
      <HStack className="min-h-10 items-center gap-2">
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack || (() => router.back())}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.elevated }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        <Text
          className="flex-1 text-foreground"
          style={{ fontFamily: fonts.semiBold, fontSize: 19, lineHeight: lh(26) }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {right}
      </HStack>
      {subtitle ? (
        <Text className="text-[12px] leading-[18px] text-muted-foreground">{subtitle}</Text>
      ) : null}
    </VStack>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = "surface",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  tone?: "surface" | "ghost";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`h-10 w-10 items-center justify-center rounded-full ${
        tone === "surface" ? "bg-elevated" : "bg-transparent"
      }`}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/* ─── Rows + chips ──────────────────────────────────────────────────── */

export function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value?: string | null;
  last?: boolean;
}) {
  return (
    <HStack
      className={`items-center justify-between gap-4 py-[5px] ${
        last ? "" : "border-b border-border/70"
      }`}
    >
      <Text className="text-[12.5px] leading-[18px] text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-[12.5px] leading-[18px] font-medium text-foreground">
        {value || "—"}
      </Text>
    </HStack>
  );
}

export function Tag({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`rounded-full border px-3.5 py-2 ${
        active ? "border-brick bg-brick" : "border-border bg-elevated"
      }`}
    >
      <Text
        className={`text-[12px] font-medium ${active ? "text-white" : "text-muted-foreground"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Chips<T extends string>({
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
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      {items.map((item) => (
        <Tag
          key={item.value}
          label={item.label}
          active={item.value === value}
          onPress={() => onChange(item.value)}
        />
      ))}
    </ScrollView>
  );
}

/* ─── Photo slots + media ───────────────────────────────────────────── */

export function PhotoSlot({
  label,
  uri,
  onPress,
  busy,
  style,
}: {
  label: string;
  uri?: string | null;
  onPress?: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} photo`}
      className="overflow-hidden rounded-[14px] border border-dashed border-border bg-card"
      style={StyleSheet.flatten([styles.photoSlot, style])}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <VStack className="flex-1 items-center justify-center gap-1 px-1">
          <Ionicons name="camera-outline" size={20} color={colors.muted} />
          <Text className="text-[9.5px] font-medium text-muted-foreground">{label}</Text>
        </VStack>
      )}
      {busy ? (
        <Box className="absolute inset-0 items-center justify-center bg-[rgba(10,8,8,0.65)]">
          <ActivityIndicator color={colors.white} />
        </Box>
      ) : null}
    </Pressable>
  );
}

/** Turntable plinth with the kit prop-pot, used wherever the mockups show a
 * photoreal 3D render that this repository does not ship. Real uploaded
 * photography always wins. */
export function ArtefactHero({
  cover,
  height = 260,
  style,
  children,
}: {
  cover?: string | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <Box
      className="overflow-hidden rounded-[20px] border border-border bg-[#171211]"
      style={StyleSheet.flatten([{ height }, style])}
    >
      {cover ? (
        <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      ) : (
        <Box className="h-full w-full items-center justify-center">
          <Image
            source={require("../../assets/kit/ui/ui-turntable.png")}
            style={{ position: "absolute", width: "130%", height: "130%", opacity: 0.5 }}
            contentFit="contain"
          />
          <Image
            source={require("../../assets/kit/props/prop-pot.png")}
            style={{ width: "58%", height: "78%" }}
            contentFit="contain"
          />
        </Box>
      )}
      {children}
    </Box>
  );
}

/* ─── Existing design-language extras ───────────────────────────────── */

/** `numberOfLines` is a native-only prop; gluestack's web Text renders a plain
 * <span>, so RN-web surfaces it as a DOM attribute warning instead of an
 * ellipsis. Pass `clampLines(n)` as numberOfLines and pair it with
 * `isTruncated` so truncation works on both platforms. */
export function clampLines(n: number) {
  return Platform.OS === "web" ? undefined : n;
}

const statTones = {
  brick: { chip: "bg-[#C24339]/15", icon: colors.brick },
  amber: { chip: "bg-amber/15", icon: colors.amber },
  teal: { chip: "bg-teal/15", icon: colors.teal },
  jungle: { chip: "bg-teal/15", icon: colors.teal },
  neutral: { chip: "bg-[#8A7F7B]/15", icon: colors.muted },
} as const;

export function StatTile({
  icon,
  value,
  label,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tone?: keyof typeof statTones;
}) {
  const palette = statTones[tone];
  return (
    <Box className="flex-1 items-center gap-1 rounded-[14px] border border-border bg-card px-2 py-3">
      <Box className={`h-7 w-7 items-center justify-center rounded-full ${palette.chip}`}>
        <Ionicons name={icon} size={14} color={palette.icon} />
      </Box>
      <Text className="text-[17px] font-semibold leading-5 text-foreground">{value}</Text>
      <Text className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Text>
    </Box>
  );
}

export function BentoTile({
  icon,
  title,
  caption,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
  tone: keyof typeof statTones;
  onPress: () => void;
}) {
  const palette = statTones[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 gap-3 rounded-[16px] border border-border bg-card p-4"
    >
      <Box className={`h-10 w-10 items-center justify-center rounded-xl self-start ${palette.chip}`}>
        <Ionicons name={icon} size={20} color={palette.icon} />
      </Box>
      <VStack className="gap-0.5">
        <Text className="text-[14px] font-semibold text-foreground">{title}</Text>
        {caption ? <Text className="text-[11px] text-muted-foreground">{caption}</Text> : null}
      </VStack>
    </Pressable>
  );
}

export function ProgressRing({
  progress,
  size = 120,
  stroke = 9,
  color = colors.teal,
  track = colors.elevated,
  children,
}: {
  /** 0–100 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? (
        <Box className="absolute inset-0 items-center justify-center">{children}</Box>
      ) : null}
    </View>
  );
}
