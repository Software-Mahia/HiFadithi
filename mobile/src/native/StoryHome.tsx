/** First-visit story for the native app: one continuous, editorial scroll.
 *
 * Reads like an exhibition catalogue: a full-bleed hero, then numbered
 * chapters (the collection, a glimpse inside, how a record is made, what
 * HiFadithi does, ownership) and a single closing decision. Serif headlines
 * (Playfair Display), quiet sans body text, imagery edge to edge, almost no
 * boxes. Native only: imported by index.native.tsx and explore.native.tsx.
 *
 * Rules kept from the web flow: one uniform overlay on the photo, no timer or
 * auto-redirect, only the capped two-item preview, guests go to sign-in,
 * signed-in users to /artefacts, nothing routes while the session restores. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent, StyleProp, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../auth";
import { listPreviewArtefacts } from "../api";
import type { ArtefactPreview } from "../api";
import { colors, fonts } from "../theme";
import { GUTTER, Logo, MuseumStage, NButton, Touchable, line, serif, space } from "./kit";

const WORKFLOW: { title: string; body: string }[] = [
  { title: "Capture", body: "Four guided photographs of the object: front, left, right and back." },
  { title: "AI-assisted 3D model", body: "A three-dimensional draft is generated from the photographs." },
  { title: "Researcher verification", body: "The model is examined against the real object, detail by detail." },
  { title: "Final approval", body: "The record is approved before it enters the collection." },
];

/* ─── Motion ───────────────────────────────────────────────────────── */

type Motion = { scrollY: SharedValue<number>; screenH: number; reduced: boolean };
const MotionContext = createContext<Motion | null>(null);
/** y of the enclosing Section inside the scroll content. onLayout of a direct
 * ScrollView child is content-relative; nested children are parent-relative,
 * so nested blocks add their local y to this. */
const SectionYContext = createContext<SharedValue<number> | null>(null);

/** A direct child of the story ScrollView that measures its own position. */
function Section({
  children,
  style,
  onY,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onY?: (y: number) => void;
}) {
  const y = useSharedValue(100000);
  return (
    <SectionYContext.Provider value={y}>
      <View
        style={style}
        onLayout={(event) => {
          y.set(event.nativeEvent.layout.y);
          onY?.(event.nativeEvent.layout.y);
        }}
      >
        {children}
      </View>
    </SectionYContext.Provider>
  );
}

function useMotion() {
  const motion = useContext(MotionContext);
  const sectionY = useContext(SectionYContext);
  if (!motion || !sectionY) throw new Error("Reveal and Process must be inside StoryHome > Section");
  return { ...motion, sectionY };
}

/** Fades and lifts its children in as they scroll into view; static when the
 * system "reduce motion" setting is on. */
function Reveal({ children }: { children: ReactNode }) {
  const { scrollY, screenH, reduced, sectionY } = useMotion();
  const local = useSharedValue(0);
  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ translateY: 0 }] };
    const start = sectionY.get() + local.get() - screenH + 80;
    const p = interpolate(scrollY.get(), [start, start + 200], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 24 }] };
  });
  return (
    <Animated.View onLayout={(event) => local.set(event.nativeEvent.layout.y)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Catalogue chapter marker: "01 — The collection". */
function Chapter({ index, title }: { index: string; title: string }) {
  return (
    <View style={styles.chapter}>
      <Text style={styles.chapterIndex}>{index}</Text>
      <View style={styles.chapterRule} />
      <Text style={styles.chapterTitle}>{title}</Text>
    </View>
  );
}

/* ─── Glimpse: two approved previews, full-bleed portrait plates ───── */

function Glimpse({ previews, loading }: { previews: ArtefactPreview[]; loading: boolean }) {
  const { width } = useWindowDimensions();
  const plateW = Math.min(260, Math.round(width * 0.62));
  const [page, setPage] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / (plateW + space.lg));
    if (next !== page) setPage(next);
  };

  if (loading) {
    return <View style={{ marginLeft: GUTTER, width: plateW, aspectRatio: 1, backgroundColor: colors.elevated, opacity: 0.5 }} />;
  }
  if (!previews.length) {
    return (
      <View style={{ paddingHorizontal: GUTTER }}>
        <View style={{ aspectRatio: 1.6 }}>
          <MuseumStage height="100%" />
        </View>
        <Text style={[styles.plateCaption, { marginTop: space.md }]}>Approved previews appear here as the collection grows.</Text>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={plateW + space.lg}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: space.lg }}
      >
        {previews.map((artefact) => (
          <View key={artefact.id} style={{ width: plateW }}>
            <View style={styles.plate}>
              {artefact.cover_image_url ? (
                <Image
                  source={{ uri: artefact.cover_image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={300}
                  accessibilityLabel={`Photograph of ${artefact.name}`}
                />
              ) : (
                <MuseumStage height="100%" />
              )}
            </View>
            <Text numberOfLines={1} style={styles.plateTitle}>
              {artefact.name}
            </Text>
            <Text numberOfLines={1} style={styles.plateMeta}>
              {[artefact.material || "Museum artefact", artefact.has_model3d ? "3D model" : null, "Approved preview"]
                .filter(Boolean)
                .join("  ·  ")
                .toUpperCase()}
            </Text>
          </View>
        ))}
      </ScrollView>
      {previews.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {String(page + 1).padStart(2, "0")} <Text style={{ color: colors.mutedDeep }}>/ {String(previews.length).padStart(2, "0")}</Text>
          </Text>
          <View style={styles.counterTrack}>
            <View style={[styles.counterFill, { width: `${((page + 1) / previews.length) * 100}%` }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ─── Process: serif numerals, a rule that draws as you scroll ─────── */

function Process() {
  const { scrollY, screenH, reduced, sectionY } = useMotion();
  const local = useSharedValue(0);
  const height = useSharedValue(1);
  const fill = useAnimatedStyle(() => {
    if (reduced) return { height: "100%" };
    // Starts drawing when the first step is ~60% down the screen, done at the last.
    const start = sectionY.get() + local.get() - screenH * 0.6;
    const p = interpolate(scrollY.get(), [start, start + height.get()], [0, 1], Extrapolation.CLAMP);
    return { height: `${p * 100}%` };
  });
  return (
    <View
      onLayout={(event) => {
        local.set(event.nativeEvent.layout.y);
        height.set(Math.max(1, event.nativeEvent.layout.height));
      }}
    >
      <View style={styles.rule}>
        <Animated.View style={[styles.ruleFill, fill]} />
      </View>
      {WORKFLOW.map((step, index) => (
        <View key={step.title} style={[styles.step, index === WORKFLOW.length - 1 ? { paddingBottom: 0 } : null]}>
          <Text style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</Text>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Screen ───────────────────────────────────────────────────────── */

export function StoryHome({ startAt = "top" }: { startAt?: "top" | "story" }) {
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const heroH = screenH;
  const scrollRef = useRef<Animated.ScrollView>(null);
  const reduced = useReducedMotion();
  const scrollY = useSharedValue(0);
  const stickyShown = useSharedValue(0);
  const finalY = useSharedValue(100000);
  const [storyY, setStoryY] = useState<number | null>(null);
  const [stickyOn, setStickyOn] = useState(false);
  const jumped = useRef(false);

  const [previews, setPreviews] = useState<ArtefactPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Capped server-side: the preview endpoint never returns more than two.
    listPreviewArtefacts()
      .then((items) => {
        if (active) setPreviews(items.slice(0, 2));
      })
      .catch(() => {
        if (active) setPreviews([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const storyOffset = useCallback((y: number) => Math.max(0, y - insets.top - 64), [insets.top]);

  // /explore opens straight at the story for visitors coming back from sign-in.
  useEffect(() => {
    if (startAt === "story" && storyY != null && !jumped.current) {
      jumped.current = true;
      scrollRef.current?.scrollTo({ y: storyOffset(storyY), animated: false });
    }
  }, [startAt, storyY, storyOffset]);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  // Pinned action after the hero; hidden again once the closing decision is on screen.
  useAnimatedReaction(
    () => scrollY.get() > heroH * 0.6 && scrollY.get() + screenH < finalY.get() + 140,
    (on, previous) => {
      if (on === previous) return;
      stickyShown.set(reduced ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: 260 }));
      scheduleOnRN(setStickyOn, on);
    },
  );
  const sticky = useAnimatedStyle(() => ({
    opacity: stickyShown.get(),
    transform: [{ translateY: (1 - stickyShown.get()) * 90 }],
  }));

  const go = useCallback(() => {
    if (authLoading) return;
    router.replace(user ? "/artefacts" : "/(auth)/login");
  }, [authLoading, user]);

  const ctaLabel = authLoading ? "Checking access…" : user ? "Open research workspace" : "Discover the workspace";
  const scrollToStory = () => {
    if (storyY != null) scrollRef.current?.scrollTo({ y: storyOffset(storyY), animated: !reduced });
  };

  /* Hero: slow parallax, gentle stretch on pull-down, copy recedes as you leave. */
  const heroImage = useAnimatedStyle(() => {
    if (reduced) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const y = scrollY.get();
    return {
      transform: [{ translateY: y < 0 ? y : y * 0.4 }, { scale: y < 0 ? 1 + -y / heroH : 1 + y / (heroH * 6) }],
    };
  });
  const heroCopy = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, heroH * 0.4], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.get(), [0, heroH * 0.4], [0, -30], Extrapolation.CLAMP) }],
  }));
  const bar = useAnimatedStyle(() => ({
    backgroundColor: `rgba(18,15,14,${interpolate(scrollY.get(), [heroH * 0.65, heroH * 0.9], [0, 0.97], Extrapolation.CLAMP)})`,
    borderBottomColor: `rgba(245,239,234,${interpolate(scrollY.get(), [heroH * 0.8, heroH * 0.95], [0, 0.1], Extrapolation.CLAMP)})`,
  }));

  /* Scroll cue: a thin line that draws downwards, on a loop. */
  const cueProgress = useSharedValue(0);
  useEffect(() => {
    // No looping motion when the system asks to reduce motion.
    cueProgress.set(reduced ? 0.6 : withRepeat(withTiming(1, { duration: 1600 }), -1, false));
  }, [cueProgress, reduced]);
  const cue = useAnimatedStyle(() => ({
    height: interpolate(cueProgress.get(), [0, 0.6, 1], [0, 28, 28]),
    opacity: interpolate(cueProgress.get(), [0, 0.7, 1], [1, 1, 0]),
  }));

  return (
    <MotionContext.Provider value={{ scrollY, screenH, reduced }}>
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
      >
        {/* ── Hero ───────────────────────────────────────────────── */}
        <View style={{ height: heroH, overflow: "hidden" }}>
          <Animated.View style={[StyleSheet.absoluteFill, heroImage]}>
            <Image
              source={require("../../assets/nairobi-national-museum.jpg")}
              contentFit="cover"
              transition={400}
              style={StyleSheet.absoluteFill}
              accessibilityLabel="Nairobi National Museum entrance"
            />
            {/* One uniform overlay across the whole photo (no partial-height band). */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(12, 9, 8, 0.56)" }]} />
          </Animated.View>

          <Animated.View style={[styles.heroCopy, { paddingBottom: insets.bottom + 28 }, heroCopy]}>
            <Text style={styles.heroKicker}>NAIROBI · MUSEUM HILL</Text>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              <Text style={styles.heroTitleItalic}>Welcome to the{"\n"}</Text>
              National Museums of Kenya
            </Text>
            <Text style={styles.heroLede}>
              Kenya&apos;s heritage, recorded as verified 3D artefacts and the stories that give them meaning.
            </Text>
            <NButton
              label="Explore the collection"
              accessibilityLabel="Explore the museum collection"
              onPress={scrollToStory}
              style={{ marginTop: space.xl, alignSelf: "stretch" }}
            />
            <View style={styles.cueWrap} pointerEvents="none">
              <Text style={styles.cueText}>SCROLL</Text>
              <View style={styles.cueTrack}>
                <Animated.View style={[styles.cueLine, cue]} />
              </View>
            </View>
          </Animated.View>
        </View>

        {/* ── 01 The collection ───────────────────────────────────── */}
        <Section onY={setStoryY} style={{ paddingTop: 56, paddingHorizontal: GUTTER }}>
          <Reveal>
            <Chapter index="01" title="The collection" />
            <Text style={styles.statement}>
              From a photograph to a <Text style={styles.statementItalic}>living</Text> 3D story.
            </Text>
            <Text style={[styles.body, { marginTop: space.lg }]}>
              HiFadithi is how National Museums of Kenya researchers capture artefacts, generate AI-assisted 3D models,
              verify them, preserve their stories and submit them for approval.
            </Text>
          </Reveal>
        </Section>

        {/* ── 02 A glimpse inside ─────────────────────────────────── */}
        <Section style={{ paddingTop: 56 }}>
          <Reveal>
            <View style={{ paddingHorizontal: GUTTER }}>
              <Chapter index="02" title="A glimpse inside" />
              <Text style={[styles.sectionTitle, { marginBottom: space.lg }]}>Two approved works from the collection.</Text>
            </View>
            <Glimpse previews={previews} loading={loading} />
          </Reveal>
        </Section>

        {/* ── 03 How a record is made ─────────────────────────────── */}
        <Section style={{ paddingTop: 56, paddingHorizontal: GUTTER }}>
          <Reveal>
            <Chapter index="03" title="How a record is made" />
            <Text style={[styles.sectionTitle, { marginBottom: space.xl }]}>Four steps, each one accountable.</Text>
          </Reveal>
          <Process />
          <Reveal>
            <View style={styles.note}>
              <Ionicons name="mic-outline" size={16} color={colors.muted} />
              <Text style={[styles.body, { flex: 1 }]}>
                Every record can carry its story, narrated in English or Kiswahili.
              </Text>
            </View>
          </Reveal>
        </Section>

        {/* ── Close: ownership and the single decision ───────────── */}
        <Section onY={(y) => finalY.set(y)} style={{ paddingTop: 64, paddingHorizontal: GUTTER }}>
          <Reveal>
            <View style={styles.seal}>
              <Logo height={30} />
              <Text style={styles.sealOwner}>OWNED BY THE NATIONAL MUSEUMS OF KENYA</Text>
              <Text style={[styles.statement, { textAlign: "center", fontSize: 28, lineHeight: 35 }]}>
                Begin your <Text style={styles.statementItalic}>research</Text>.
              </Text>
              <Text style={[styles.body, { textAlign: "center", maxWidth: 310 }]}>
                For authorised NMK researchers and collection teams. Sign in with your organisation-issued account;
                records, uploads and processing tools open only after sign-in.
              </Text>
            </View>
            <NButton label={ctaLabel} onPress={go} disabled={authLoading} style={{ marginTop: space.xxl }} />
            <Touchable
              onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reduced })}
              accessibilityLabel="Back to top"
              style={{ alignSelf: "center", paddingVertical: space.lg, paddingHorizontal: space.xl, marginTop: space.sm }}
            >
              <Text style={styles.link}>Back to top</Text>
            </Touchable>
            <Text style={styles.colophon}>HIFADITHI · NATIONAL MUSEUMS OF KENYA</Text>
          </Reveal>
        </Section>
      </Animated.ScrollView>

      {/* Top bar: wordmark over the photo, solid once the story begins */}
      <Animated.View style={[styles.bar, { paddingTop: insets.top + 6 }, bar]} pointerEvents="box-none">
        <Touchable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reduced })} accessibilityLabel="HiFadithi, back to top" ripple={false} scale={1}>
          <Logo height={22} />
          <Text style={styles.wordmarkSub}>NATIONAL MUSEUMS OF KENYA</Text>
        </Touchable>
        {user ? null : (
          <Touchable onPress={go} disabled={authLoading} accessibilityLabel="Researcher sign in" style={styles.signIn}>
            <Text style={styles.signInText}>Sign in</Text>
          </Touchable>
        )}
      </Animated.View>

      {/* Pinned action: slides up after the hero, away at the closing decision. */}
      <Animated.View
        pointerEvents={stickyOn ? "auto" : "none"}
        accessibilityElementsHidden={!stickyOn}
        importantForAccessibility={stickyOn ? "auto" : "no-hide-descendants"}
        style={[styles.sticky, { paddingBottom: Math.max(insets.bottom, space.md) }, sticky]}
      >
        <NButton label={ctaLabel} onPress={go} disabled={authLoading} />
      </Animated.View>
    </View>
    </MotionContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroCopy: { flex: 1, justifyContent: "flex-end", paddingHorizontal: GUTTER },
  heroKicker: { fontFamily: fonts.medium, fontSize: 10.5, letterSpacing: 2.6, color: "rgba(245,239,234,0.72)", marginBottom: space.lg },
  heroTitle: { fontFamily: serif.regular, fontSize: 42, lineHeight: 48, letterSpacing: -0.6, color: colors.text },
  heroTitleItalic: { fontFamily: serif.italic, fontSize: 26, lineHeight: 36, color: "rgba(245,239,234,0.88)" },
  heroLede: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24, color: "rgba(245,239,234,0.82)", marginTop: space.lg, maxWidth: 340 },
  cueWrap: { alignItems: "center", marginTop: space.xl, gap: 8 },
  cueText: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 2.4, color: "rgba(245,239,234,0.55)" },
  cueTrack: { width: 1, height: 28, backgroundColor: "rgba(245,239,234,0.18)" },
  cueLine: { width: 1, backgroundColor: colors.text },
  chapter: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.md },
  chapterIndex: { fontFamily: serif.italic, fontSize: 13, color: colors.text },
  chapterRule: { width: 28, height: StyleSheet.hairlineWidth, backgroundColor: line.strong },
  chapterTitle: { fontFamily: fonts.medium, fontSize: 10.5, letterSpacing: 2.2, color: colors.muted, textTransform: "uppercase" },
  statement: { fontFamily: serif.regular, fontSize: 27, lineHeight: 34, letterSpacing: -0.3, color: colors.text },
  statementItalic: { fontFamily: serif.italic, color: colors.amber },
  sectionTitle: { fontFamily: serif.regular, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: "rgba(245,239,234,0.70)" },
  plate: { aspectRatio: 1, overflow: "hidden", backgroundColor: colors.surface, borderRadius: 4 },
  plateTitle: { fontFamily: serif.regular, fontSize: 17, lineHeight: 22, color: colors.text, marginTop: space.md },
  plateMeta: { fontFamily: fonts.medium, fontSize: 9.5, letterSpacing: 1.4, color: colors.muted, marginTop: 4 },
  plateCaption: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  counter: { flexDirection: "row", alignItems: "center", gap: space.lg, paddingHorizontal: GUTTER, marginTop: space.lg },
  counterText: { fontFamily: serif.italic, fontSize: 13, color: colors.text },
  counterTrack: { flex: 1, height: 1, backgroundColor: line.soft },
  counterFill: { height: 1, backgroundColor: colors.text },
  rule: { position: "absolute", left: 13, top: 32, bottom: 8, width: StyleSheet.hairlineWidth * 2, backgroundColor: line.soft, overflow: "hidden" },
  ruleFill: { width: "100%", backgroundColor: colors.amber },
  step: { flexDirection: "row", gap: space.lg, paddingBottom: 26 },
  stepNumber: { width: 28, fontFamily: serif.italic, fontSize: 20, lineHeight: 25, color: "rgba(245,239,234,0.55)", backgroundColor: colors.background, textAlign: "center" },
  stepTitle: { fontFamily: serif.regular, fontSize: 18, lineHeight: 23, color: colors.text },
  seal: { alignItems: "center", gap: space.md, paddingVertical: space.xxl, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: line.soft },
  sealOwner: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 2.2, color: colors.muted, textAlign: "center" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginTop: space.xxl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line.soft,
  },
  link: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, textDecorationLine: "underline" },
  colophon: { fontFamily: fonts.medium, fontSize: 9, letterSpacing: 2.4, color: colors.mutedDeep, textAlign: "center", marginTop: space.xxl },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GUTTER,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  wordmarkSub: { fontFamily: fonts.medium, fontSize: 8, letterSpacing: 2, color: "rgba(245,239,234,0.72)", marginTop: 5 },
  signIn: { paddingHorizontal: space.lg, minHeight: 36, justifyContent: "center", borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(245,239,234,0.45)" },
  signInText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  sticky: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: space.md,
    backgroundColor: "rgba(18,15,14,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line.soft,
  },
});
