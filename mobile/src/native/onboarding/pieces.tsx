/** Onboarding slide chrome and widgets: body scaffolding, footer with dots
 * and CTA, plus the decorative artefact pieces (chip, Listen pill, player
 * card, primary button).
 *
 * Content directions applied on top of the reference: the artefact chip's
 * tagline reads "Luo" in place of "Yoruba", and the mockup's cartoon
 * characters are intentionally omitted. */
import { Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../theme";
import { Touchable } from "../kit";
import { styles } from "./styles";
import type { Layout } from "./theme";
import { TONE } from "./theme";

/** Floating artefact label: two lines per the spec ("Beaded Cap ·" / "Luo · 1920s"). */
export function ArtefactChip({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]}>
      <Text style={styles.chipText}>Beaded Cap ·</Text>
      <Text style={styles.chipText}>Luo · 1920s</Text>
    </View>
  );
}

/** Decorative teal Listen pill from the spec. */
export function ListenPill({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.listenPill, style]} pointerEvents="none">
      <Ionicons name="play" size={14} color={colors.white} />
      <Text style={styles.listenText}>Listen</Text>
    </View>
  );
}

/** Static narration player card per spec: title, EN|SW toggle, play, waveform
 * (teal left half → amber right half), red progress at ~40% with the time. */
export function PlayerCard({ width }: { width: number }) {
  const bars = Array.from({ length: 34 }, (_, i) => {
    const wave = Math.abs(Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.9) * 0.5);
    const teal = i < 17;
    return {
      h: 7 + wave * 15,
      color: teal
        ? i % 3 === 0
          ? "rgba(0,180,194,0.55)"
          : TONE.teal
        : i % 4 === 1
          ? "rgba(234,160,0,0.6)"
          : TONE.amber,
    };
  });
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>The Horn of Gathering</Text>
        <View style={styles.langChip}>
          <Text style={styles.langOn}>EN</Text>
          <Text style={styles.langSep}>|</Text>
          <Text style={styles.langOff}>SW</Text>
        </View>
      </View>
      <View style={styles.playerRow}>
        <View style={styles.playButton}>
          <Ionicons
            name="play"
            size={19}
            color={colors.white}
            style={{ marginLeft: 2 }}
          />
        </View>
        <View style={styles.wave}>
          {bars.map((bar, i) => (
            <View
              key={i}
              style={{
                width: 2.5,
                height: bar.h,
                borderRadius: 2,
                marginRight: 2.5,
                backgroundColor: bar.color,
              }}
            />
          ))}
        </View>
      </View>
      <View style={styles.progressRow}>
        <View style={styles.track}>
          <View style={styles.trackFill} />
          <View style={styles.knob} />
        </View>
        <Text style={styles.time}>2:14 / 4:36</Text>
      </View>
    </View>
  );
}

/** Primary pill CTA: red vertical gradient approximated with layered overlays
 * (true gradients would need expo-linear-gradient — not installed), soft red
 * glow and a thin inner top highlight, per spec. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={styles.cta}
    >
      <View style={styles.ctaShade} pointerEvents="none" />
      <Text style={styles.ctaText}>{label}</Text>
    </Touchable>
  );
}

/** Footer under the pager: page dots, optional link, primary CTA. */
export function SlideFooter({
  index,
  total,
  padBottom,
  cta,
  onCta,
  link,
  onLink,
}: {
  index: number;
  total: number;
  /** Safe-area-aware padding so the CTA stays clear of the home indicator. */
  padBottom: number;
  cta: string;
  onCta: () => void;
  link?: string;
  onLink?: () => void;
}) {
  return (
    <View style={[styles.footer, { paddingBottom: padBottom }]}>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index ? styles.dotActive : null]}
          />
        ))}
      </View>
      {link ? (
        <Touchable
          onPress={onLink}
          accessibilityLabel={link}
          style={{ marginTop: 12 }}
        >
          <Text style={styles.link}>{link}</Text>
        </Touchable>
      ) : null}
      <PrimaryButton label={cta} onPress={onCta} disabled={false} />
    </View>
  );
}

/** Every slide's shared body: full-screen cell, stage for the artwork and the
 * headline/lede copy block underneath. */
export function SlideBody({
  layout,
  headline,
  lede,
  children,
}: {
  layout: Layout;
  headline: string;
  lede: string;
  children: React.ReactNode;
}) {
  const { width, height, topPad, bottomPad } = layout;
  return (
    <View
      style={{ width, height, paddingTop: topPad, paddingBottom: bottomPad }}
    >
      <View style={styles.stage}>{children}</View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.headline}>
          {headline}
        </Text>
        <Text style={styles.lede}>{lede}</Text>
      </View>
    </View>
  );
}
