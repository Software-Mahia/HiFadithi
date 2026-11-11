/** Guided capture, native app layout. The web version is capture/[id].tsx.
 * Same flow: front → left → right → back, upload each, then start the 3D job. */
import { useCallback, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { generate3D, getArtefact, uploadPhoto } from "../../src/api";
import type { Artefact, ArtefactImage } from "../../src/api";
import { pickImageFromLibrary } from "../../src/photos";
import { CircleButton, GUTTER, MuseumStage, NButton, NLoading, NStateScreen, Touchable, space, type } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

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
  const insets = useSafeAreaInsets();
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

  if (loading) return <NLoading label="Preparing camera…" />;

  if (!artefact) {
    return (
      <NStateScreen
        onBack={() => router.replace("/(tabs)/artefacts")}
        icon="alert-circle-outline"
        title="Artefact unavailable"
        body={message || "This artefact could not be found."}
        action={<NButton label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />}
      />
    );
  }

  const current = SLOTS.find((slot) => !images[slot.key]);
  const total = Object.keys(images).length;

  const finish = async () => {
    if (!artefact.height_mm) {
      Alert.alert("Height needed", "Add the artefact height before generating the 3D model.", [
        { text: "OK", onPress: () => router.replace(`/artefact-record/${artefact.id}`) },
      ]);
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
      await save(current.key, { uri: photo.uri, name: photoName(current.key), type: "image/jpeg" });
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

  const close = () => router.replace(`/artefact-record/${artefact.id}`);
  const step = current ? SLOTS.indexOf(current) + 1 : 4;

  return (
    <View style={styles.root}>
      {/* Viewfinder fills the screen */}
      <View style={StyleSheet.absoluteFill}>
        {current && permission?.granted ? (
          <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />
        ) : current ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <MuseumStage height="62%" />
          </View>
        ) : (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={56} color={colors.teal} />
            <Text style={[type.title2, { textAlign: "center" }]}>All four photos captured</Text>
            <Text style={[type.subhead, { textAlign: "center" }]}>{artefact.name} is ready to become a 3D model.</Text>
          </View>
        )}
      </View>

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <CircleButton icon="close" label="Close" tone="overlay" onPress={close} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.topTitle}>{current ? `${current.label} view` : "Complete"}</Text>
          <Text style={styles.topSub}>{current ? `Photo ${step} of 4 · ${current.hint}` : artefact.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Guide frame */}
      {current ? (
        <View pointerEvents="none" style={[styles.frame, { top: insets.top + 96, bottom: insets.bottom + 190 }]}>
          {[styles.cTL, styles.cTR, styles.cBL, styles.cBR].map((corner, index) => (
            <View key={index} style={[styles.corner, corner]} />
          ))}
          <View style={styles.frameLabel}>
            <Text style={styles.frameLabelText}>Fill the frame with the whole artefact</Text>
          </View>
        </View>
      ) : null}

      {/* Camera permission prompt */}
      {current && !permission?.granted ? (
        <View style={[styles.permission, { bottom: insets.bottom + 200 }]}>
          <NButton label="Allow camera access" icon="camera-outline" variant="secondary" compact onPress={requestPermission} />
        </View>
      ) : null}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
        <View style={styles.progress}>
          {SLOTS.map((slot) => (
            <View key={slot.key} style={{ alignItems: "center", gap: 4, flex: 1 }}>
              <View style={[styles.progressBar, { backgroundColor: images[slot.key] ? colors.teal : current?.key === slot.key ? colors.amber : "rgba(245,239,234,0.22)" }]} />
              <Text style={[styles.progressLabel, { color: images[slot.key] || current?.key === slot.key ? colors.text : colors.muted }]}>
                {slot.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <CircleButton icon="images-outline" label="Choose from library" tone="overlay" size={48} onPress={library} />
          <Touchable onPress={current ? capture : finish} haptic="heavy" accessibilityLabel={current ? "Capture photo" : "Generate 3D model"} scale={0.92} style={styles.shutter}>
            <View style={styles.shutterInner}>
              <Ionicons name={current ? "camera" : "sparkles"} size={28} color={colors.white} />
            </View>
          </Touchable>
          <View style={{ width: 48, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.semiBold, fontSize: 14, color: colors.text }}>{total}/4</Text>
          </View>
        </View>
      </View>

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.amber} size="large" />
          <Text style={type.callout}>{message || "Working…"}</Text>
        </View>
      ) : null}
    </View>
  );
}

const C = 34;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0B0908" },
  done: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, paddingHorizontal: space.xxxl, backgroundColor: colors.background },
  top: { position: "absolute", left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: GUTTER, paddingBottom: space.md, backgroundColor: "rgba(11,9,8,0.55)" },
  topTitle: { fontFamily: fonts.semiBold, fontSize: 16, lineHeight: 21, color: colors.text },
  topSub: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, color: "rgba(245,239,234,0.75)" },
  frame: { position: "absolute", left: GUTTER + 4, right: GUTTER + 4 },
  corner: { position: "absolute", width: C, height: C, borderColor: colors.amber },
  cTL: { left: 0, top: 0, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 14 },
  cTR: { right: 0, top: 0, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 14 },
  cBL: { left: 0, bottom: 0, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 14 },
  cBR: { right: 0, bottom: 0, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 14 },
  frameLabel: { position: "absolute", bottom: -36, alignSelf: "center", paddingHorizontal: space.md, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(11,9,8,0.6)" },
  frameLabelText: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  permission: { position: "absolute", left: GUTTER * 2, right: GUTTER * 2 },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: space.lg, paddingHorizontal: GUTTER, gap: space.lg, backgroundColor: "rgba(11,9,8,0.82)" },
  progress: { flexDirection: "row", gap: space.sm },
  progressBar: { height: 4, borderRadius: 2, alignSelf: "stretch" },
  progressLabel: { fontFamily: fonts.medium, fontSize: 11 },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: colors.white, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", backgroundColor: colors.brick },
  busy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: space.md, backgroundColor: "rgba(11,9,8,0.78)" },
});
