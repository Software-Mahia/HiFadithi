import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable } from "react-native";

import { colors, fonts, lh } from "../src/theme";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** Museum welcome screen. Navigation is intentional: the visitor chooses when
 * to leave the welcome experience instead of being redirected after a timer. */
export default function Index() {
  const enterMuseum = () => {
    router.replace("/explore");
  };

  return (
    <Box className="flex-1" style={{ backgroundColor: colors.splash }}>
      <Image
        source={require("../assets/nairobi-national-museum.jpg")}
        contentFit="cover"
        transition={250}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        accessibilityLabel="Nairobi National Museum entrance"
      />

      {/* Keep one uniform overlay across the full photo. A second partial-height
          overlay creates a visible horizontal opacity boundary on web. */}
      <Box
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(15, 11, 11, 0.52)" }}
      />

      <VStack className="flex-1 justify-between px-7 pb-10 pt-14">
        <VStack className="gap-3">
          <Text
            style={{
              color: colors.amber,
              fontFamily: fonts.semiBold,
              fontSize: 11,
              letterSpacing: 2.2,
            }}
          >
            NAIROBI · MUSEUM HILL
          </Text>
          <Box className="h-px w-12" style={{ backgroundColor: colors.amber }} />
        </VStack>

        <VStack className="max-w-[620px] gap-4">
          <Text
            style={{
              color: colors.text,
              fontFamily: fonts.bold,
              fontSize: 42,
              lineHeight: lh(48),
              letterSpacing: -1.2,
            }}
          >
            Welcome to the National Museums of Kenya
          </Text>
          <Text
            style={{
              color: "#F2E5D8",
              fontFamily: fonts.regular,
              fontSize: 15,
              lineHeight: lh(23),
              maxWidth: 520,
            }}
          >
            Explore Kenya&apos;s history, culture and stories through interactive
            artefacts made for museum researchers.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore the museum collection"
            onPress={enterMuseum}
            style={({ pressed }) => ({
              alignItems: "center",
              alignSelf: "flex-start",
              backgroundColor: pressed ? colors.brickDark : colors.primary,
              borderColor: colors.amber,
              borderRadius: 999,
              borderWidth: 1,
              minWidth: 190,
              paddingHorizontal: 24,
              paddingVertical: 14,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text
              style={{
                color: colors.white,
                fontFamily: fonts.semiBold,
                fontSize: 13,
                letterSpacing: 0.8,
              }}
            >
              EXPLORE THE COLLECTION
            </Text>
          </Pressable>
        </VStack>
      </VStack>
    </Box>
  );
}
