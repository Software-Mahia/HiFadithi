import { Image } from "expo-image";
import { router } from "expo-router";

import { useAuth } from "../src/auth";
import { Button } from "../src/components/ui";
import { colors, fonts, lh } from "../src/theme";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** Splash / wordmark screen. The native splash hands over to this view, which
 * then routes to the gallery (guests) or My artefacts (researchers). */
export default function Index() {
  const { user, loading } = useAuth();
  const continueToApp = () => router.replace(user ? "/artefacts" : "/(tabs)/gallery");

  return (
    <Box className="flex-1" style={{ backgroundColor: colors.museumForestDeep }}>
      <Box className="absolute -right-24 -top-20 h-72 w-72 rounded-full" style={{ backgroundColor: "rgba(201,162,39,0.14)" }} />
      <Box className="absolute -bottom-24 -left-28 h-80 w-80 rounded-full" style={{ backgroundColor: "rgba(13,59,46,0.9)" }} />
      <VStack className="flex-1 justify-between px-7 pb-10 pt-20">
        <VStack className="gap-2">
          <Text style={{ color: colors.museumGold, fontFamily: fonts.semiBold, fontSize: 11, letterSpacing: 2.1 }}>
            NATIONAL MUSEUM OF KENYA
          </Text>
          <Box className="h-px w-14" style={{ backgroundColor: colors.museumGold }} />
        </VStack>

        <VStack className="items-center gap-5">
        <Image
          source={require("../assets/kit/brand/logo-drum.png")}
          style={{ width: 168, height: 168 }}
          contentFit="contain"
        />
        <Text
          style={{ color: colors.museumSand, fontFamily: fonts.bold, fontSize: 36, lineHeight: lh(44), letterSpacing: -0.8 }}
        >
          Welcome to HiFadithi
        </Text>
        <Text className="text-center text-[14px] leading-[21px]" style={{ color: "rgba(243,235,221,0.72)" }}>
          Preserve, explore, and tell the stories behind Kenya’s heritage.
        </Text>
        </VStack>

        <VStack className="gap-3">
          <Button
            label={loading ? "Preparing collection…" : user ? "Enter workspace" : "Explore the collection"}
            onPress={continueToApp}
            disabled={loading}
            style={{ backgroundColor: colors.museumGold, borderColor: colors.museumGold }}
          />
          <Text className="text-center text-[11px]" style={{ color: "rgba(243,235,221,0.52)" }}>
            AI-assisted 3D models · NMK staff and collection visitors
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
