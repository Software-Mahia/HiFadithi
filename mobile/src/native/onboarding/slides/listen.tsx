/** Slide 3: the ceremonial horn with the "The Horn of Gathering" narration
 * player card underneath. */
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Ellipse } from "react-native-svg";

import { SlideBody, PlayerCard } from "../pieces";
import type { Layout } from "../theme";
import { TONE } from "../theme";

export function SlideListen({ layout }: { layout: Layout }) {
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
          source={require("../../../../assets/onboarding/zeze-blur.png")}
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
          source={require("../../../../assets/onboarding/vessels-blur.png")}
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

        <Image
          source={require("../../../../assets/onboarding/horn.png")}
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
