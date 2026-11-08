import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";

import { useAuth } from "../src/auth";
import { colors, fonts, lh } from "../src/theme";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/** Splash / wordmark screen. The native splash hands over to this view, which
 * then routes to the gallery (guests) or My artefacts (researchers). */
export default function Index() {
  const { user, loading } = useAuth();
  const [minDone, setMinDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), 1400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!minDone || loading) return;
    router.replace(user ? "/artefacts" : "/(tabs)/gallery");
  }, [minDone, loading, user]);

  return (
    <Box className="flex-1 items-center justify-center" style={{ backgroundColor: colors.splash }}>
      {/* Gallery backdrop: deep base with soft amber glows instead of a photo,
          so there is no third-party image licence to clear (AGENTS.md rule 12). */}
      <Box
        className="absolute -right-24 -top-24 h-72 w-72 rounded-full"
        style={{ backgroundColor: "rgba(234,160,0,0.08)" }}
      />
      <Box
        className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full"
        style={{ backgroundColor: "rgba(234,160,0,0.05)" }}
      />
      <VStack className="items-center gap-3">
        <Text
          style={{ color: colors.amber, fontFamily: fonts.semiBold, fontSize: 10, letterSpacing: 1.8 }}
        >
          NATIONAL MUSEUMS OF KENYA
        </Text>
        <Box className="h-px w-10" style={{ backgroundColor: colors.amber }} />
        <Image
          source={require("../assets/kit/brand/logo-drum.png")}
          style={{ width: 168, height: 168 }}
          contentFit="contain"
        />
        <Text
          className="text-foreground"
          style={{ fontFamily: fonts.bold, fontSize: 36, lineHeight: lh(44), letterSpacing: -0.8 }}
        >
          HiFadithi
        </Text>
        <Text className="text-[14px] leading-[20px] text-muted-foreground">
          Welcome to the National Museums of Kenya
        </Text>
      </VStack>
    </Box>
  );
}
