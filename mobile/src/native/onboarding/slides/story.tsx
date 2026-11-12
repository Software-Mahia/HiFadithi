/** Slide 2: the artefact collage — cap, horn, lyre and vessels around the
 * "Every artefact has a story" story. Deliberately free of trails and
 * chevrons. */
import { View } from "react-native";
import { Image } from "expo-image";

import { ArtefactChip, ListenPill, SlideBody } from "../pieces";
import type { Layout } from "../theme";

export function SlideStory({ layout }: { layout: Layout }) {
  const { width, stageH } = layout;
  const cap = Math.min(Math.max(width * 0.46, 160), 200);
  return (
    <SlideBody
      layout={layout}
      headline={"Every artefact\nhas a story"}
      lede="Discover treasures from our museums and hear the voices behind them."
    >
      <View style={{ width, height: stageH }}>
        <Image
          source={require("../../../../assets/onboarding/beaded-cap.png")}
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
          source={require("../../../../assets/onboarding/horn.png")}
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
        <ListenPill
          style={{
            position: "absolute",
            top: stageH * 0.52,
            right: width * 0.06,
          }}
        />
        <Image
          source={require("../../../../assets/onboarding/zeze.png")}
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
          source={require("../../../../assets/onboarding/vessels.png")}
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
