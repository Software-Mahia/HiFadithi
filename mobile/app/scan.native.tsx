/** Accession-card scan (OCR), native app layout. The web version is scan.tsx.
 * Same flow: capture or pick a card, OCR it, then return the fields to the form. */
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/auth";
import { scanCard, type OCRResult } from "../src/api";
import { pickImageFromLibrary } from "../src/photos";
import { CircleButton, GUTTER, NButton, NScreen, NStateScreen, NavHeader, Notice, SectionHeader, Surface, Touchable, line, space, type } from "../src/native/kit";
import { colors, fonts } from "../src/theme";

export default function ScanScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = params.returnTo || "/artefact-new";
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<ComponentRef<typeof CameraView>>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sweep = useSharedValue(0);
  const [frameHeight, setFrameHeight] = useState(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({ top: 18 + sweep.value * Math.max(0, frameHeight - 36) }));

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
      <NStateScreen
        onBack={() => router.back()}
        icon="scan-outline"
        title="Sign in to scan"
        body="Card scanning reads museum labels and fills the artefact form."
        action={<NButton label="Sign in" onPress={() => router.push("/(auth)/login")} />}
      />
    );
  }

  const pickFromLibrary = async () => {
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setShot(picked.uri);
    await scanFile(picked.photo);
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

  const manual = () => router.replace(returnTo as never);

  // Results view: review the parsed fields before using them.
  if (result && fields) {
    return (
      <NScreen
        footer={
          <>
            <NButton label="Use these fields" trailingIcon="arrow-forward" onPress={useFields} />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <NButton
                label="Retake"
                variant="secondary"
                compact
                style={{ flex: 1 }}
                onPress={() => {
                  setShot(null);
                  setResult(null);
                }}
              />
              <NButton label="Library" variant="secondary" compact style={{ flex: 1 }} onPress={pickFromLibrary} />
            </View>
          </>
        }
      >
        <NavHeader title="Scanned details" onBack={manual} />
        {shot ? (
          <View style={styles.preview}>
            <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        ) : null}
        <SectionHeader
          title="Parsed fields"
          action={
            <View style={styles.confidence}>
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 11, color: colors.teal }}>{result.confidence}% confidence</Text>
            </View>
          }
        />
        <Surface padded={false}>
          {Object.entries(fields).filter(([, value]) => value).map(([key, value], index, all) => (
            <View key={key} style={[styles.field, index === all.length - 1 ? null : styles.divider]}>
              <Text style={[type.caption, { textTransform: "uppercase", letterSpacing: 0.8 }]}>{key.replaceAll("_", " ")}</Text>
              <Text style={type.body}>{value}</Text>
            </View>
          ))}
          {!hasFields ? (
            <View style={{ padding: space.lg }}>
              <Text style={type.subhead}>No labelled fields were recognised. Try a sharper, flatter photo.</Text>
            </View>
          ) : null}
        </Surface>
        <View style={{ marginTop: space.lg }}>
          <Notice tone="warn">Check every field against the physical card before saving.</Notice>
        </View>
      </NScreen>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[{ paddingTop: insets.top + space.sm, paddingHorizontal: GUTTER }]}>
        <NavHeader
          title="Scan accession card"
          subtitle="Position the card inside the frame"
          onBack={manual}
          right={
            <Touchable onPress={manual} accessibilityLabel="Manual entry" style={{ paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 13, color: colors.text }}>Manual</Text>
            </Touchable>
          }
        />
      </View>

      <View style={styles.viewfinder} onLayout={(event) => setFrameHeight(event.nativeEvent.layout.height)}>
        {shot ? (
          <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : permission?.granted ? (
          <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />
        ) : (
          <View style={styles.cardMock}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6, color: "#6E5B3C" }}>MUSEUM ACCESSION CARD</Text>
            {[100, 78, 100, 62, 100].map((w, i) => (
              <View key={i} style={{ height: 2, width: `${w}%`, borderRadius: 1, backgroundColor: colors.teal, opacity: 0.8 }} />
            ))}
          </View>
        )}
        {[styles.cTL, styles.cTR, styles.cBL, styles.cBR].map((corner, index) => (
          <View key={index} pointerEvents="none" style={[styles.corner, corner]} />
        ))}
        {!shot ? (
          <Animated.View pointerEvents="none" style={[sweepStyle, styles.sweep]} />
        ) : null}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.teal} size="large" />
            <Text style={type.callout}>Reading the card…</Text>
          </View>
        ) : null}
        {!permission?.granted && !shot ? (
          <View style={styles.permission}>
            <NButton label="Allow camera access" icon="camera-outline" variant="secondary" compact onPress={requestPermission} />
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={{ paddingHorizontal: GUTTER, marginTop: space.md }}>
          <Notice tone="error">{error}</Notice>
        </View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }]}>
        <Text style={[type.footnote, { textAlign: "center" }]}>Hold steady and keep the card flat.</Text>
        <View style={styles.buttons}>
          <CircleButton icon="images-outline" label="Choose from library" size={48} onPress={pickFromLibrary} />
          <Touchable onPress={capture} haptic="heavy" accessibilityLabel="Scan card" scale={0.92} style={styles.shutter}>
            <View style={styles.shutterInner}>
              <Ionicons name="scan" size={26} color={colors.white} />
            </View>
          </Touchable>
          <CircleButton icon="keypad-outline" label="Manual entry" size={48} onPress={manual} />
        </View>
      </View>
    </View>
  );
}

const C = 32;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  viewfinder: {
    flex: 1,
    marginHorizontal: GUTTER,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#191A18",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.soft,
  },
  cardMock: { margin: "12%", flex: 1, borderRadius: 12, backgroundColor: "#E7D6B6", padding: space.xl, gap: space.md, justifyContent: "center" },
  corner: { position: "absolute", width: C, height: C, borderColor: colors.teal },
  cTL: { left: 14, top: 14, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 12 },
  cTR: { right: 14, top: 14, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 12 },
  cBL: { left: 14, bottom: 14, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 12 },
  cBR: { right: 14, bottom: 14, borderRightWidth: 3, borderBottomWidth: 3, borderBottomRightRadius: 12 },
  sweep: { position: "absolute", left: 20, right: 20, height: 2, borderRadius: 1, backgroundColor: "rgba(0,180,194,0.75)" },
  busy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: space.md, backgroundColor: "rgba(10,8,8,0.75)" },
  permission: { position: "absolute", left: space.xl, right: space.xl, bottom: space.xl },
  controls: { paddingTop: space.lg, paddingHorizontal: GUTTER, gap: space.lg },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl },
  shutter: { width: 74, height: 74, borderRadius: 37, borderWidth: 4, borderColor: colors.text, alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: colors.brick },
  preview: { height: 180, borderRadius: 20, overflow: "hidden", backgroundColor: colors.surface },
  confidence: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,180,194,0.12)" },
  field: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 2 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: line.hair },
});
