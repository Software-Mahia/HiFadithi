/** Shared layout for the public screens (welcome, overview, sign-in).
 *
 * One content width, one gutter scale and one top bar keep the three screens
 * reading as a single, deliberate experience on phones and wide browsers. */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";

import { colors, fonts, lh } from "../theme";
import { Text } from "@/components/ui/text";

export const MAX_WIDTH = 1180;

/** Breakpoints: phone < 720 <= tablet < 1024 <= desktop. */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 1024;
  const medium = width >= 720;
  const gutter = wide ? 48 : medium ? 36 : 22;
  return { width, height, wide, medium, gutter };
}

/** Centres content at MAX_WIDTH with the responsive gutter. */
export function Container({
  children,
  style,
  max = MAX_WIDTH,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  max?: number;
}) {
  const { gutter } = useLayout();
  return (
    <View style={[{ width: "100%", maxWidth: max + gutter * 2, alignSelf: "center", paddingHorizontal: gutter }, style]}>
      {children}
    </View>
  );
}

export function Eyebrow({ children, color = colors.amber }: { children: ReactNode; color?: string }) {
  return (
    <Text
      style={{
        color,
        fontFamily: fonts.semiBold,
        fontSize: 11,
        lineHeight: lh(16),
        letterSpacing: 2.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </Text>
  );
}

/** HiFadithi mark + NMK attribution. Tapping it returns to the welcome page. */
export function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="HiFadithi, National Museums of Kenya. Go to the welcome page"
      onPress={() => router.replace("/")}
      style={styles.brand}
    >
      <View style={{ gap: 5 }}>
        {/* Official HiFadithi wordmark (982x182). */}
        <Image
          source={require("../../assets/brand/hifadithi-logo.png")}
          style={{ height: 24, width: Math.round((24 * 982) / 182) }}
          contentFit="contain"
          accessibilityLabel="HiFadithi"
        />
        <Text
          style={{
            color: light ? "rgba(245,239,234,0.72)" : colors.muted,
            fontFamily: fonts.medium,
            fontSize: 9.5,
            lineHeight: lh(12),
            letterSpacing: 1.6,
          }}
        >
          NATIONAL MUSEUMS OF KENYA
        </Text>
      </View>
    </Pressable>
  );
}

/** Quiet text action for the top bar (e.g. "Researcher sign in"). */
export function TopBarLink({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.topLink,
        (hovered || pressed) && !disabled ? { borderColor: "rgba(234,160,0,0.55)" } : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
    >
      <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 13, lineHeight: lh(18) }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function TopBar({ right, light }: { right?: ReactNode; light?: boolean }) {
  return (
    <Container>
      <View style={styles.topBar}>
        <BrandMark light={light} />
        {right}
      </View>
    </Container>
  );
}

/** Primary call to action: brick fill, amber hairline, clear focus of the page. */
export function PrimaryAction({
  label,
  onPress,
  disabled,
  accessibilityLabel,
  full,
  trailing = "→",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  full?: boolean;
  trailing?: string | null;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.primary,
        full ? { alignSelf: "stretch" } : { alignSelf: "flex-start" },
        {
          backgroundColor: pressed ? colors.brickDark : hovered ? "#B13A30" : colors.brick,
          transform: [{ scale: pressed ? 0.985 : 1 }],
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: colors.white,
          fontFamily: fonts.semiBold,
          fontSize: 14,
          lineHeight: lh(20),
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
      {trailing ? (
        <Text style={{ color: colors.white, fontFamily: fonts.medium, fontSize: 16, lineHeight: lh(20) }}>
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function Footer() {
  return (
    <Container>
      <View style={styles.footer}>
        <Text style={styles.footerText}>© National Museums of Kenya · Museum Hill, Nairobi</Text>
        <Text style={styles.footerText}>HiFadithi research workspace · Authorised staff only</Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  topLink: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(245,239,234,0.18)",
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(234,160,0,0.55)",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(245,239,234,0.14)",
    paddingVertical: 22,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 6,
    columnGap: 24,
  },
  footerText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: lh(16) },
});
