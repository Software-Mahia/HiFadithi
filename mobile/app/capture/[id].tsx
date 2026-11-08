import { useCallback, useRef, useState, type ComponentRef } from "react";
import { Alert } from "react-native";
import { Image } from "expo-image";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { generate3D, getArtefact, uploadPhoto } from "../../src/api";
import type { Artefact, ArtefactImage } from "../../src/api";
import { pickImageFromLibrary } from "../../src/photos";
import { Button, Loading, Screen, StackHeader } from "../../src/components/ui";
import { colors } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

const SLOTS = [
  { key: "front", label: "Front", hint: "Front view, level with object" },
  { key: "left", label: "Left", hint: "Left side, level with object" },
  { key: "right", label: "Right", hint: "Right side, level with object" },
  { key: "back", label: "Back", hint: "Back view, level with object" },
] as const;

type Slot = (typeof SLOTS)[number]["key"];

function photoName(slot: string) {
  return `${slot}-${Date.now()}.jpg`;
}

export default function CaptureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [images, setImages] = useState<Record<string, ArtefactImage>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<ComponentRef<typeof CameraView>>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getArtefact(id);
      setArtefact(data);
      const map: Record<string, ArtefactImage> = {};
      for (const image of data.images || []) map[image.slot] = image;
      setImages(map);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load this artefact.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Loading label="Preparing camera…" />;

  if (!artefact) {
    return (
      <Screen contentStyle={{ paddingTop: 100 }}>
        <Text className="text-center text-[14px] text-muted-foreground">
          {message || "This artefact could not be found."}
        </Text>
        <Button label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />
      </Screen>
    );
  }

  const current = SLOTS.find((slot) => !images[slot.key]);
  const total = Object.keys(images).length;

  const finish = async () => {
    if (!artefact.height_mm) {
      Alert.alert(
        "Height needed",
        "Add the artefact height before generating the 3D model.",
        [{ text: "OK", onPress: () => router.replace(`/artefact-record/${artefact.id}`) }],
      );
      return;
    }
    setMessage("Starting the 3D engine…");
    try {
      await generate3D(artefact.id);
      router.replace(`/processing/${artefact.id}`);
    } catch (err) {
      Alert.alert("Could not start", err instanceof Error ? err.message : "Please try again.");
      setMessage("");
      setBusy(false);
    }
  };

  const save = async (slot: Slot, file: { uri: string; name: string; type: string }) => {
    setBusy(true);
    setMessage("Saving photograph…");
    try {
      const image = await uploadPhoto(artefact.id, slot, file);
      const next = { ...images, [slot]: image };
      setImages(next);
      setMessage("");
      if (SLOTS.every((item) => next[item.key])) {
        await finish();
      }
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!current) {
      await finish();
      return;
    }
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.88, base64: false });
      if (!photo?.uri) return;
      await save(current.key, {
        uri: photo.uri,
        name: photoName(current.key),
        type: "image/jpeg",
      });
    } catch (err) {
      Alert.alert("Could not capture", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const library = async () => {
    if (!current) return;
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    await save(current.key, picked.photo);
  };

  return (
    <Screen safe={false} scroll={false} contentStyle={{ paddingTop: 0, paddingHorizontal: 16 }}>
      <StackHeader
        title="Capture photos"
        subtitle={
          current
            ? `Photo ${SLOTS.indexOf(current) + 1} of 4: ${current.hint}`
            : "All four photographs are saved"
        }
        onBack={() => router.replace(`/artefact-record/${artefact.id}`)}
      />

      <Text className="mt-2 text-[11.5px] leading-[17px] text-muted-foreground">
        Align the entire artefact inside the guide
      </Text>

      {/* Viewfinder */}
      <Box
        className="mt-2 overflow-hidden rounded-[20px] border"
        style={{ flex: 1, minHeight: 380, backgroundColor: "#191515", borderColor: colors.border }}
      >
        {current && permission?.granted ? (
          <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />
        ) : current ? (
          <Box className="flex-1 items-center justify-center">
            <Image
              source={require("../../assets/kit/props/prop-pot.png")}
              style={{ width: "68%", height: "68%" }}
              contentFit="contain"
            />
          </Box>
        ) : (
          <VStack className="flex-1 items-center justify-center gap-3 px-6">
            <Ionicons name="checkmark-circle" size={44} color={colors.teal} />
            <Text className="text-center text-[17px] font-semibold text-foreground">
              All four photos captured
            </Text>
            <Text className="text-center text-[12px] leading-[18px] text-muted-foreground">
              {artefact.name} is ready to become a 3D model.
            </Text>
          </VStack>
        )}

        {/* Guide frame */}
        {[
          "left-5 top-5 border-l-[2px] border-t-[2px] rounded-tl-lg",
          "right-5 top-5 border-r-[2px] border-t-[2px] rounded-tr-lg",
          "left-5 bottom-5 border-l-[2px] border-b-[2px] rounded-bl-lg",
          "right-5 bottom-5 border-r-[2px] border-b-[2px] rounded-br-lg",
        ].map((cls) => (
          <Box key={cls} className={`absolute h-12 w-12 border-amber ${cls}`} />
        ))}

        <Box className="absolute bottom-6 left-0 right-0 items-center">
          <Box className="rounded-full bg-black/45 px-3 py-1">
            <Text className="text-[9.5px] font-semibold tracking-[1.8px] text-amber">
              {current ? `${current.label.toUpperCase()} VIEW` : "COMPLETE"}
            </Text>
          </Box>
        </Box>

        {busy ? (
          <Box className="absolute inset-0 items-center justify-center gap-2 bg-[rgba(10,8,8,0.7)]">
            <Ionicons name="cloud-upload-outline" size={28} color={colors.teal} />
            <Text className="text-[12px] font-medium text-foreground">{message || "Working…"}</Text>
          </Box>
        ) : null}
      </Box>

      <Text className="mt-2 text-center text-[11px] font-medium text-muted-foreground">
        {current ? "Fill the frame!" : "The 3D model can now be generated."}
      </Text>

      <HStack className="mb-2 mt-1 items-center justify-center gap-7">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          onPress={library}
          className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
        >
          <Ionicons name="images-outline" size={20} color={colors.text} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={current ? "Capture photo" : "Generate 3D model"}
          onPress={current ? capture : finish}
          className="h-[70px] w-[70px] items-center justify-center rounded-full border-[4px] border-white"
          style={{ backgroundColor: colors.brick }}
        >
          <Ionicons name={current ? "camera" : "sparkles"} size={28} color={colors.white} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.replace(`/artefact-record/${artefact.id}`)}
          className="h-11 w-11 items-center justify-center rounded-full border border-border bg-card"
        >
          <Ionicons name="close" size={21} color={colors.text} />
        </Pressable>
      </HStack>

      <HStack className="mb-3 items-center justify-center gap-1.5">
        {SLOTS.map((slot) => (
          <Box
            key={slot.key}
            className="h-1.5 w-7 rounded-full"
            style={{ backgroundColor: images[slot.key] ? colors.teal : colors.elevated }}
          />
        ))}
        <Text className="ml-1 text-[10px] text-muted-foreground">{total}/4</Text>
      </HStack>
    </Screen>
  );
}
