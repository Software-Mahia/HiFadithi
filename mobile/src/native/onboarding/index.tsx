/** Native first-visit onboarding: three paged slides.
 *
 * Built to the written product spec (the reworked mockup): espresso-brown
 * screens, Poppins throughout, two-tone HiFadithi wordmark, gradient pill
 * CTAs, and three scenes — Amani introducing the researchers workflow, the
 * artefact collage, and the horn above the "The Horn of Gathering" player
 * card.
 *
 * Split across this folder: theme.ts (palette + slide geometry), styles.ts
 * (shared StyleSheet), pieces.tsx (slide chrome and widgets), and
 * slides/<name>.tsx (one file per slide).
 *
 * Native only: imported by app/index.native.tsx and app/explore.native.tsx. */
import { useCallback, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollViewInstance,
  TextStyle,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../auth";
import { fonts } from "../../theme";
import { Touchable } from "../kit";
import { SlideFooter } from "./pieces";
import { SlideListen } from "./slides/listen";
import { SlideStory } from "./slides/story";
import { SlideWorkflow } from "./slides/workflow";
import { styles } from "./styles";
import type { Layout } from "./theme";
import { TONE } from "./theme";

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
        <SlideWorkflow layout={layout} />
        <SlideStory layout={layout} />
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
