import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Image } from "expo-image";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../src/auth";
import { scanCard, type OCRResult } from "../src/api";
import { photoFromAsset } from "../src/photos";
import { Button, Card, Screen, SectionTitle, StackHeader, Tag } from "../src/components/ui";
import { colors } from "../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function AccessionCard() {
  return (
    <Box
      className="w-[74%] items-center justify-center rounded-[12px] px-5 py-5"
      style={{ backgroundColor: "#E7D6B6" }}
    >
      <Text
        className="text-[8px] font-bold tracking-[1.6px]"
        style={{ color: "#6E5B3C" }}
      >
        MUSEUM ACCESSION CARD
      </Text>
      <VStack className="mt-4 w-full gap-3">
        <Box className="h-[2px] w-full rounded-full" style={{ backgroundColor: colors.teal }} />
        <Box className="h-[2px] w-[78%] self-start rounded-full" style={{ backgroundColor: colors.teal }} />
        <Box className="h-[2px] w-full rounded-full" style={{ backgroundColor: colors.teal }} />
        <Box className="h-[2px] w-[62%] self-start rounded-full" style={{ backgroundColor: colors.teal }} />
        <Box className="h-[2px] w-full rounded-full" style={{ backgroundColor: colors.teal }} />
      </VStack>
    </Box>
  );
}

export default function ScanScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo || "/artefact-new";
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<ComponentRef<typeof CameraView>>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    top: 22 + sweep.value * 340,
  }));

  const scanFile = async (file: { uri: string; name: string; type: string }) => {
    setBusy(true);
    setError("");
    try {
      setResult(await scanCard(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "OCR failed. Check the API and Tesseract.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Screen contentStyle={{ paddingTop: 100 }}>
        <VStack className="items-center gap-3">
          <Image
            source={require("../assets/kit/characters/amani-scan-card.png")}
            style={{ width: 150, height: 150 }}
            contentFit="contain"
          />
          <Text className="text-center text-[18px] font-semibold text-foreground">
            Sign in to scan
          </Text>
          <Text className="max-w-[280px] text-center text-[12px] leading-[18px] text-muted-foreground">
            Card scanning reads museum labels with Tesseract and fills the artefact form.
          </Text>
          <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
          <Button label="Close" variant="ghost" onPress={() => router.back()} />
        </VStack>
      </Screen>
    );
  }

  const pickFromLibrary = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (picked.canceled || !picked.assets[0]) return;
    setShot(picked.assets[0].uri);
    await scanFile(photoFromAsset(picked.assets[0]));
  };

  const capture = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9, base64: false });
      if (!photo?.uri) return;
      setShot(photo.uri);
      await scanFile({ uri: photo.uri, name: `scan-${Date.now()}.jpg`, type: "image/jpeg" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture the photo.");
    }
  };

  const fields = result?.fields;
  const hasFields = Boolean(fields && Object.values(fields).some(Boolean));

  const useFields = () => {
    if (!result) return;
    const f = result.fields;
    router.replace({
      pathname: returnTo as never,
      params: {
        accession_number: f.accession_number,
        name: f.name || f.description.split("\n")[0] || "",
        description: f.description,
        material: f.material,
        dimensions: f.dimensions,
        date_or_period: f.date_or_period,
        provenance: f.provenance,
        donor: f.donor,
        location: f.location,
      },
    });
  };

  return (
    <Screen safe={false} contentStyle={{ gap: 0, paddingTop: 0, paddingBottom: 32 }}>
      <StackHeader
        title="Scan accession card"
        subtitle="Position accession card within frame"
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace(returnTo as never)}
            className="px-1 py-1"
          >
            <Text className="text-[11px] font-medium text-brick">Manual entry</Text>
          </Pressable>
        }
      />

      {/* Viewfinder */}
      <Box
        className="mt-3 overflow-hidden rounded-[22px] border"
        style={{ height: 400, backgroundColor: "#191A18", borderColor: colors.border }}
      >
        {shot ? (
          <Image source={{ uri: shot }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : permission?.granted ? (
          <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />
        ) : (
          <Box className="flex-1 items-center justify-center">
            <AccessionCard />
          </Box>
        )}

        {/* Corner brackets */}
        {[
          "left-4 top-4 border-l-[3px] border-t-[3px] rounded-tl-xl",
          "right-4 top-4 border-r-[3px] border-t-[3px] rounded-tr-xl",
          "left-4 bottom-4 border-l-[3px] border-b-[3px] rounded-bl-xl",
          "right-4 bottom-4 border-r-[3px] border-b-[3px] rounded-br-xl",
        ].map((cls) => (
          <Box key={cls} className={`absolute h-14 w-14 border-teal ${cls}`} />
        ))}

        {!shot ? (
          <Animated.View style={[sweepStyle, { left: 20, right: 20, position: "absolute" }]}>
            <Box className="h-[2px] rounded-full bg-teal/70" />
          </Animated.View>
        ) : null}

        {busy ? (
          <Box className="absolute inset-0 items-center justify-center gap-2 bg-[rgba(10,8,8,0.72)]">
            <Ionicons name="scan" size={28} color={colors.teal} />
            <Text className="text-[13px] font-semibold text-foreground">Reading the card…</Text>
            <Text className="text-[11px] text-muted-foreground">Tesseract is recognising the fields.</Text>
          </Box>
        ) : null}

        {!permission?.granted ? (
          <Pressable
            accessibilityRole="button"
            onPress={requestPermission}
            className="absolute bottom-4 left-4 right-4 items-center rounded-full bg-black/50 py-2"
          >
            <Text className="text-[11px] font-medium text-foreground">Tap to allow camera access</Text>
          </Pressable>
        ) : null}
      </Box>

      <Text className="mt-4 text-center text-[11.5px] font-medium text-muted-foreground">
        Hold steady to scan details!
      </Text>

      <HStack className="mt-3 items-center justify-center gap-6">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          onPress={pickFromLibrary}
          className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
        >
          <Ionicons name="images-outline" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan card"
          onPress={capture}
          className="h-[62px] w-[62px] items-center justify-center rounded-full"
          style={{ backgroundColor: colors.brick }}
        >
          <Ionicons name="camera" size={27} color={colors.white} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Manual entry"
          onPress={() => router.replace(returnTo as never)}
          className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
        >
          <Ionicons name="keypad-outline" size={20} color={colors.text} />
        </Pressable>
      </HStack>

      {error ? (
        <Text className="mt-3 text-center text-[12px] text-brick">{error}</Text>
      ) : null}

      {result && fields ? (
        <VStack className="mt-5 gap-3">
          <SectionTitle
            action={<Tag label={`${result.confidence}% confidence`} active />}
          >
            Parsed fields
          </SectionTitle>
          <Card className="gap-1">
            {Object.entries(fields).map(([key, value]) =>
              value ? (
                <VStack key={key} className="gap-0.5 border-b border-border/70 py-1.5 last:border-b-0">
                  <Text className="text-[9px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
                    {key.replaceAll("_", " ")}
                  </Text>
                  <Text className="text-[12px] leading-[18px] text-foreground">{value}</Text>
                </VStack>
              ) : null,
            )}
            {!hasFields ? (
              <Text className="text-[12px] leading-[18px] text-muted-foreground">
                No labelled fields were recognised. Try a sharper, flatter photo.
              </Text>
            ) : null}
          </Card>
          <Button label="Use these fields" icon="arrow-forward-circle-outline" onPress={useFields} />
          <HStack className="gap-2">
            <Box className="flex-1">
              <Button
                label="Retake"
                variant="secondary"
                onPress={() => {
                  setShot(null);
                  setResult(null);
                }}
              />
            </Box>
            <Box className="flex-1">
              <Button label="Library" variant="secondary" onPress={pickFromLibrary} />
            </Box>
          </HStack>
        </VStack>
      ) : null}
    </Screen>
  );
}
