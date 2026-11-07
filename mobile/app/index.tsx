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
      <VStack className="items-center gap-3">
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
          Stories behind every artefact
        </Text>
      </VStack>
    </Box>
  );
}
