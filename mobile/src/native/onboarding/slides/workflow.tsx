/** Slide 1: Amani introduces the researchers workflow. */
import { View } from "react-native";
import { Image } from "expo-image";

import { SlideBody } from "../pieces";
import type { Layout } from "../theme";

export function SlideWorkflow({ layout }: { layout: Layout }) {
  const { width, stageH } = layout;
  const size = Math.min(Math.max(width * 0.62, 220), 280);
  return (
    <SlideBody
      layout={layout}
      headline={"Researchers\nworkflow"}
      lede="Capture, generate an AI-assisted 3D model, verify it against the object and submit it for approval."
    >
      <View style={{ width, height: stageH }}>
        <Image
          source={require("../../../../assets/kit/characters/amani-camera.png")}
          style={{
            position: "absolute",
            top: stageH * 0.5 - size / 2,
            left: width * 0.5 - size / 2,
            width: size,
            height: size,
          }}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="Amani photographing an artefact"
        />
      </View>
    </SlideBody>
  );
}
