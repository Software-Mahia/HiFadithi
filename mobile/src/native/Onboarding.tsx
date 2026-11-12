/** Native first-visit onboarding: three paged slides.
 *
 * Built to the written product spec (the reworked mockup): espresso-brown
 * screens with chevron edge bands, Poppins throughout, two-tone HiFadithi
 * wordmark, gradient pill CTAs, and three scenes — the artefact collage, the
 * cap with a rotation ring, and the horn above the "The Horn of
 * Gathering" player card.
 *
 * Content directions applied on top of the reference: the tagline reads
 * "Luo" in place of "Yoruba", and the mockup's cartoon characters are
 * intentionally omitted.
 *
 * Native only: imported by index.native.tsx and explore.native.tsx. */
import { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../auth";
import { colors, fonts } from "../theme";
import { Touchable } from "./kit";

/* ─── Palette (from the product spec) ─────────────────────────────── */

const TONE = {
  screenTop: "#2A1810",
  screenMid: "#1E0F0B",
  screenEdge: "#150A07",
  band: "#6B2A1F",
  cream: "#F4ECE6",
  subtext: "#D9CFC8",
  dotActive: "#C8402F",
  dotIdle: "#8A7A72",
  ctaTop: "#D8473A",
  ctaBottom: "#A82A20",
  red: "#C8402F",
  amber: "#EAA000",
  teal: colors.teal,
  chipBg: "rgba(24,13,10,0.88)",
  cardBg: "rgba(38,20,15,0.82)",
} as const;

/* ─── Shared pieces ───────────────────────────────────────────────── */

/** Two-tone wordmark per spec: brick "Hi", teal "Fadithi", Poppins bold. */
function Wordmark() {
  const style: TextStyle = {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
  };
  return (
    <Text accessibilityRole="header" style={style}>
      <Text style={{ color: "#D6402F" }}>Hi</Text>
      <Text style={{ color: TONE.teal }}>Fadithi</Text>
    </Text>
  );
}

/** Screen backdrop: warm radial centre glow, with chevron bands in dark
 * red-brown running down both edges and fading toward the middle. */
function Backdrop({ width, height }: { width: number; height: number }) {
  const bandW = 64;
  const chevrons = (left: boolean) => {
    const rows: React.ReactNode[] = [];
    for (let y = 6; y < height; y += 24) {
      let d = `M 0 ${y}`;
      for (let x = 0; x < bandW; x += 16) d += ` l 8 9 l 8 -9`;
      rows.push(
        <Path
          key={`${left}-${y}`}
          d={d}
          transform={left ? undefined : `translate(${width} 0) scale(-1 1)`}
          stroke={TONE.band}
          strokeWidth={2}
          fill="none"
        />,
      );
    }
    return rows;
  };
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="bg" cx="50%" cy="40%" r="85%">
          <Stop offset="0%" stopColor={TONE.screenTop} />
          <Stop offset="55%" stopColor={TONE.screenMid} />
          <Stop offset="100%" stopColor={TONE.screenEdge} />
        </RadialGradient>
        {/* Chevron visibility: strong at the edges, gone by mid-screen. */}
        <LinearGradient id="fade" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="16%" stopColor="#FFFFFF" />
          <Stop offset="38%" stopColor="#000000" />
          <Stop offset="62%" stopColor="#000000" />
          <Stop offset="84%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#FFFFFF" />
        </LinearGradient>
        <Mask id="edgeFade">
          <Rect width={width} height={height} fill="url(#fade)" />
        </Mask>
      </Defs>
      <Rect width={width} height={height} fill="url(#bg)" />
      <G mask="url(#edgeFade)" opacity={0.25}>
        {chevrons(true)}
        {chevrons(false)}
      </G>
    </Svg>
  );
}

/** Warm amber pool behind a slide's hero cluster. */
function HeroGlow({
  width,
  height,
  style,
}: {
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      width={width}
      height={height}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#C8722F" stopOpacity={0.2} />
          <Stop offset="60%" stopColor="#C8722F" stopOpacity={0.08} />
          <Stop offset="100%" stopColor="#C8722F" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={width / 2}
        cy={height / 2}
        rx={width * 0.46}
        ry={height * 0.4}
        fill="url(#glow)"
      />
    </Svg>
  );
}

/** Three sound arcs; flip mirrors them from ")))" into "(((". */
function SoundCue({
  size = 22,
  color = TONE.teal,
  flip = false,
  style,
}: {
  size?: number;
  color?: string;
  flip?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg
      width={size}
      height={size}
      style={[style, flip ? { transform: [{ scaleX: -1 }] } : null]}
      pointerEvents="none"
    >
      {[0, 1, 2].map((i) => (
        <Path
          key={i}
          d={`M ${2 + i * (size / 6)} ${size * 0.28} Q ${3 + i * (size / 6) + size / 8} ${size / 2} ${2 + i * (size / 6)} ${size * 0.72}`}
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
          opacity={1 - i * 0.22}
        />
      ))}
    </Svg>
  );
}

/** Floating artefact label: two lines per the spec ("Beaded Cap ·" / "Luo · 1920s"). */
function ArtefactChip({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, style]}>
      <Text style={styles.chipText}>Beaded Cap ·</Text>
      <Text style={styles.chipText}>Luo · 1920s</Text>
    </View>
  );
}

/** Decorative teal Listen pill from the spec. */
function ListenPill({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.listenPill, style]} pointerEvents="none">
      <Ionicons name="play" size={14} color={colors.white} />
      <Text style={styles.listenText}>Listen</Text>
    </View>
  );
}

/** Static narration player card per spec: title, EN|SW toggle, play, waveform
 * (teal left half → amber right half), red progress at ~40% with the time. */
function PlayerCard({ width }: { width: number }) {
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
function PrimaryButton({
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

/* ─── Slide scaffolding ───────────────────────────────────────────── */

function SlideFooter({
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

/** Geometry shared by every slide: header clearance, footer reservation and
 * the collage height. Keeps the artwork centred in the room actually left. */
type Layout = {
  width: number;
  height: number;
  stageH: number;
  topPad: number;
  bottomPad: number;
};

function SlideBody({
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

/* ─── The three slides ────────────────────────────────────────────── */

function SlideStory({ layout }: { layout: Layout }) {
  const { width, stageH } = layout;
  const cap = Math.min(Math.max(width * 0.46, 160), 200);
  return (
    <SlideBody
      layout={layout}
      headline={"Every artefact\nhas a story"}
      lede="Discover treasures from our museums and hear the voices behind them."
    >
      <View style={{ width, height: stageH }}>
        <HeroGlow width={width} height={stageH} />
        {/* Dotted trail weaving around the cluster, behind the artefacts:
         * enters at the left, dips under the lyre, sweeps along the bottom
         * beneath the gourds and climbs the right side; a short arc links the
         * cap to the chip/horn above. Matches the mockup's flowing trail. */}
        <Svg
          width={width}
          height={stageH}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Path
            d={`M ${width * 0.0} ${stageH * 0.4}
                C ${width * 0.06} ${stageH * 0.5}, ${width * 0.1} ${stageH * 0.58}, ${width * 0.18} ${stageH * 0.62}
                C ${width * 0.28} ${stageH * 0.68}, ${width * 0.34} ${stageH * 0.7}, ${width * 0.44} ${stageH * 0.72}
                C ${width * 0.58} ${stageH * 0.76}, ${width * 0.72} ${stageH * 0.76}, ${width * 0.82} ${stageH * 0.68}
                C ${width * 0.9} ${stageH * 0.62}, ${width * 0.94} ${stageH * 0.52}, ${width * 0.95} ${stageH * 0.4}`}
            stroke={TONE.red}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="0.1 8.5"
            fill="none"
          />
          <Path
            d={`M ${width * 0.46} ${stageH * 0.26}
                C ${width * 0.52} ${stageH * 0.2}, ${width * 0.58} ${stageH * 0.18}, ${width * 0.64} ${stageH * 0.22}
                C ${width * 0.67} ${stageH * 0.24}, ${width * 0.68} ${stageH * 0.26}, ${width * 0.68} ${stageH * 0.29}`}
            stroke={TONE.red}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="0.1 8.5"
            fill="none"
          />
        </Svg>
        <Image
          source={require("../../assets/onboarding/beaded-cap.png")}
          style={{
            position: "absolute",
            top: stageH * 0.02,
            left: width * 0.04,
            width: cap,
            height: cap * 0.96,
            transform: [{ rotate: "-6deg" }],
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Beaded cap"
        />
        <ArtefactChip
          style={{
            position: "absolute",
            top: stageH * 0.05,
            right: width * 0.02,
          }}
        />
        <Image
          source={require("../../assets/onboarding/horn.png")}
          style={{
            position: "absolute",
            top: stageH * 0.3,
            right: width * 0.01,
            width: width * 0.44,
            height: width * 0.22,
            transform: [{ rotate: "-14deg" }],
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Ceremonial horn"
        />
        <SoundCue
          size={22}
          style={{
            position: "absolute",
            top: stageH * 0.42,
            left: width * 0.47,
          }}
        />
        <ListenPill
          style={{
            position: "absolute",
            top: stageH * 0.52,
            right: width * 0.06,
          }}
        />
        <Image
          source={require("../../assets/onboarding/zeze.png")}
          style={{
            position: "absolute",
            bottom: stageH * 0.04,
            left: width * 0.02,
            width: width * 0.42,
            height: width * 0.32,
            transform: [{ rotate: "-12deg" }],
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Wooden lyre with a cowhide body"
        />
        <Image
          source={require("../../assets/onboarding/vessels.png")}
          style={{
            position: "absolute",
            bottom: 0,
            right: width * 0.02,
            width: width * 0.44,
            height: width * 0.3,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Woven gourds wrapped in leather"
        />
      </View>
    </SlideBody>
  );
}

function SlideExplore({ layout }: { layout: Layout }) {
  const { width, stageH } = layout;
  const cap = Math.min(Math.max(width * 0.64, 220), 280);
  return (
    <SlideBody
      layout={layout}
      headline="Explore in 3D"
      lede="Rotate, zoom and look closer at every detail, just like holding it in your hands."
    >
      <View style={{ width, height: stageH }}>
        {/* Blurred, faded collection in the top corners. */}
        <Image
          source={require("../../assets/onboarding/zeze-blur.png")}
          style={{
            position: "absolute",
            top: 0,
            left: width * 0.03,
            width: width * 0.24,
            height: width * 0.18,
            opacity: 0.4,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Lyre in the background"
        />
        <Image
          source={require("../../assets/onboarding/vessels-blur.png")}
          style={{
            position: "absolute",
            top: stageH * 0.01,
            right: width * 0.02,
            width: width * 0.3,
            height: width * 0.21,
            opacity: 0.4,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Woven gourd in the background"
        />
        <HeroGlow width={width} height={stageH} />
        {/* Cap floating on the glow. */}
        <Image
          source={require("../../assets/onboarding/beaded-cap.png")}
          style={{
            position: "absolute",
            top: stageH * 0.06,
            alignSelf: "center",
            width: cap,
            height: cap * 0.96,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Beaded cap"
        />
        <View
          style={[styles.badge3d, { top: stageH * 0.1, right: width * 0.18 }]}
        >
          <Text style={styles.badge3dText}>3D</Text>
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: -6,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View style={styles.dragPill}>
            <Ionicons name="hand-left-outline" size={15} color={TONE.subtext} />
            <Text style={styles.dragText}>Drag to rotate</Text>
          </View>
        </View>
      </View>
    </SlideBody>
  );
}

function SlideListen({ layout }: { layout: Layout }) {
  const { width, stageH } = layout;
  const cardW = Math.min(width * 0.92, 360);
  return (
    <SlideBody
      layout={layout}
      headline="Hear their stories"
      lede="Listen to narrations in English and Swahili, told in the words of the people who know them best."
    >
      <View style={{ width, height: stageH, alignItems: "center" }}>
        {/* Blurred, faded collection in the top corners. */}
        <Image
          source={require("../../assets/onboarding/zeze-blur.png")}
          style={{
            position: "absolute",
            top: 0,
            left: width * 0.04,
            width: width * 0.2,
            height: width * 0.15,
            opacity: 0.4,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Lyre in the background"
        />
        <Image
          source={require("../../assets/onboarding/vessels-blur.png")}
          style={{
            position: "absolute",
            top: stageH * 0.01,
            right: width * 0.03,
            width: width * 0.24,
            height: width * 0.17,
            opacity: 0.4,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Woven gourd in the background"
        />
        <HeroGlow width={width} height={stageH} />
        {/* Dotted red arc wrapped around the horn. */}
        <Svg
          width={width}
          height={stageH}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Ellipse
            cx={width * 0.52}
            cy={stageH * 0.24}
            rx={width * 0.4}
            ry={stageH * 0.22}
            stroke={TONE.red}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeDasharray="0.1 10"
            fill="none"
          />
        </Svg>
        {/* Horn angled up to the right, amber arcs upper-left, teal lower-right. */}
        <SoundCue
          size={36}
          color={TONE.amber}
          flip
          style={{
            position: "absolute",
            top: stageH * 0.04,
            left: width * 0.12,
          }}
        />
        <SoundCue
          size={36}
          style={{
            position: "absolute",
            top: stageH * 0.34,
            right: width * 0.07,
          }}
        />
        <Image
          source={require("../../assets/onboarding/horn.png")}
          style={{
            position: "absolute",
            top: stageH * 0.08,
            alignSelf: "center",
            width: width * 0.62,
            height: width * 0.31,
            transform: [{ rotate: "-14deg" }],
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Ceremonial horn"
        />
        <View style={{ position: "absolute", bottom: 0 }}>
          <PlayerCard width={cardW} />
        </View>
      </View>
    </SlideBody>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────── */

export function Onboarding() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const [page, setPage] = useState(0);

  const go = useCallback(() => {
    if (authLoading) return;
    router.replace(user ? "/artefacts" : "/(auth)/login");
  }, [authLoading, user]);

  /* Room actually available: header clearance above, footer reservation below,
   * then the collage fills the middle and centres itself there. The footer
   * keeps the CTA clear of the home indicator via the safe-area inset. */
  const footerPad = Math.max(insets.bottom, 16) + 32;
  const topPad = insets.top + 56;
  const bottomPad = footerPad + 140;
  const stageH = Math.min(Math.max(height * 0.36, 240), 340);
  const layout: Layout = { width, height, stageH, topPad, bottomPad };
  const nextPage = () =>
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });

  const onPageEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(Math.max(0, Math.min(2, next)));
  };

  return (
    <View style={styles.root}>
      <Backdrop width={width} height={height} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Wordmark />
        <Touchable
          onPress={go}
          disabled={authLoading}
          accessibilityLabel="Skip onboarding"
          hitSlop={12}
          style={[styles.skipWrap, { top: insets.top + 6 }]}
        >
          <Text style={styles.skip}>Skip</Text>
        </Touchable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPageEnd}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
      >
        <SlideStory layout={layout} />
        <SlideExplore layout={layout} />
        <SlideListen layout={layout} />
      </ScrollView>

      <View style={styles.overlayFooter}>
        <SlideFooter
          index={page}
          total={3}
          padBottom={footerPad}
          cta={page === 2 ? "Get Started" : "Next"}
          onCta={page === 2 ? go : nextPage}
          link={page === 2 ? "I'm a researcher, log in" : undefined}
          onLink={() => router.push("/(auth)/login")}
        />
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TONE.screenEdge },
  header: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 2,
    alignItems: "center",
  },
  skipWrap: { position: "absolute", right: 24 },
  skip: { fontFamily: fonts.regular, fontSize: 15, color: TONE.cream },
  stage: { flex: 1, justifyContent: "center", alignItems: "center" },
  copy: { alignItems: "center", paddingHorizontal: 32, gap: 10 },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.3,
    color: TONE.cream,
    textAlign: "center",
  },
  lede: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: TONE.subtext,
    textAlign: "center",
    maxWidth: 300,
  },
  chip: {
    backgroundColor: TONE.chipBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(244,236,230,0.22)",
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    color: TONE.cream,
  },
  listenPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TONE.teal,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  listenText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  badge3d: {
    position: "absolute",
    backgroundColor: TONE.amber,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badge3dText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  dragPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(24,13,10,0.85)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,236,230,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  dragText: { fontFamily: fonts.medium, fontSize: 13.5, color: TONE.subtext },
  card: {
    backgroundColor: TONE.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(244,236,230,0.14)",
    padding: 15,
    gap: 13,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: TONE.cream,
    flex: 1,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,236,230,0.3)",
    backgroundColor: "rgba(24,13,10,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  langOn: { fontFamily: fonts.medium, fontSize: 11.5, color: TONE.cream },
  langSep: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: "rgba(244,236,230,0.45)",
  },
  langOff: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: "rgba(244,236,230,0.85)",
  },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TONE.red,
    alignItems: "center",
    justifyContent: "center",
  },
  wave: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    overflow: "hidden",
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(244,236,230,0.16)",
  },
  trackFill: {
    width: "40%",
    height: 4,
    borderRadius: 2,
    backgroundColor: TONE.red,
  },
  knob: {
    position: "absolute",
    left: "40%",
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TONE.red,
  },
  time: { fontFamily: fonts.medium, fontSize: 11.5, color: TONE.subtext },
  overlayFooter: { position: "absolute", left: 0, right: 0, bottom: 0 },
  footer: { paddingHorizontal: 24, alignItems: "center" },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: TONE.dotIdle },
  dotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: TONE.dotActive,
  },
  link: { fontFamily: fonts.semiBold, fontSize: 16, color: TONE.teal },
  cta: {
    alignSelf: "stretch",
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: TONE.ctaTop,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    overflow: "hidden",
    shadowColor: TONE.red,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ctaShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  ctaText: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.white,
  },
});
