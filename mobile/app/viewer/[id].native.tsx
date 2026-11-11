/** Full-screen 3D viewer, native app layout. The web version is viewer/[id].tsx.
 * ModelViewer is unchanged (camera-controls, manual movement, optional
 * auto-rotate, NMK label, light museum stage, loading percentage, GLB). */
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getArtefact, getPublicArtefact, publicModelUrl } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ModelViewer } from "../../src/components/ModelViewer";
import { CircleButton, GUTTER, NButton, NLoading, NStateScreen, space } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

export default function ViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRotate, setAutoRotate] = useState(false);

  const load = useCallback(async () => {
    // Wait for the saved session so a researcher is not loaded as a guest first.
    if (!id || authLoading) return;
    try {
      setArtefact(user ? await getArtefact(id) : await getPublicArtefact(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The model could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id, authLoading, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/gallery");
  };

  if (authLoading || loading) return <NLoading label="Preparing 3D model…" />;

  if (!artefact?.model3d) {
    return (
      <NStateScreen
        onBack={goBack}
        icon="cube-outline"
        title="No model available"
        body={error || "This artefact does not have a 3D model yet."}
        action={<NButton label="Back to gallery" onPress={goBack} />}
      />
    );
  }

  return (
    <View style={styles.root}>
      <ModelViewer
        glbUrl={!user && artefact.status === "published" ? publicModelUrl(artefact.id) : artefact.model3d.glb_url}
        autoRotate={autoRotate}
        style={{ flex: 1, height: undefined }}
      />

      {/* Floating controls over the stage */}
      <View style={[styles.top, { top: insets.top + space.sm }]}>
        <CircleButton icon="chevron-back" label="Go back" tone="overlay" onPress={goBack} />
        <View style={styles.titleChip}>
          <Text numberOfLines={1} style={styles.title}>
            {artefact.name}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {artefact.accession_number}
          </Text>
        </View>
        <CircleButton
          icon={autoRotate ? "pause" : "sync-outline"}
          label={autoRotate ? "Stop automatic rotation" : "Start automatic rotation"}
          tone="overlay"
          onPress={() => setAutoRotate((value) => !value)}
        />
      </View>

      <View style={[styles.hint, { bottom: insets.bottom + space.lg }]}>
        <Ionicons name="hand-left-outline" size={13} color={colors.museumInk} />
        <Text style={styles.hintText}>Drag to rotate · Pinch to zoom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.museumLight },
  top: { position: "absolute", left: GUTTER, right: GUTTER, flexDirection: "row", alignItems: "center", gap: space.sm },
  titleChip: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15,11,11,0.55)",
  },
  title: { fontFamily: fonts.semiBold, fontSize: 14, lineHeight: 18, color: colors.text },
  subtitle: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 14, color: "rgba(245,239,234,0.72)" },
  hint: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(242,239,233,0.9)",
  },
  hintText: { fontFamily: fonts.medium, fontSize: 12, color: colors.museumInk },
});
