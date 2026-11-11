/** Artefact detail, native app layout. The web version is artefact/[id].tsx.
 * Same rules: wait for the saved session; guests stream the cacheable public
 * model (preview artefacts only), staff use the signed glb_url. */
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getPublicArtefact, publicModelUrl } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ModelViewer } from "../../src/components/ModelViewer";
import { NarrationPlayer } from "../../src/components/NarrationPlayer";
import {
  CircleButton,
  GUTTER,
  KeyValue,
  MuseumStage,
  NButton,
  NLoading,
  NScreen,
  NStateScreen,
  SectionHeader,
  Surface,
  space,
  type,
} from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

export default function PublicArtefactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    // Wait for the saved session: a signed-in researcher must not be served the guest view.
    if (!id || authLoading) return;
    try {
      const data = await getPublicArtefact(id);
      setArtefact(data);
      // Guests only: warm the cache-stable stream so the full-screen view opens fast.
      if (!user && data.model3d && data.status === "published") {
        fetch(publicModelUrl(data.id)).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "This artefact is not available.");
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

  if (authLoading || loading) return <NLoading label="Opening artefact…" />;

  if (!artefact) {
    return (
      <NStateScreen
        onBack={goBack}
        icon="alert-circle-outline"
        title="Artefact unavailable"
        body={error || "This record may have been unpublished."}
        action={<NButton label="Back to gallery" onPress={() => router.replace("/(tabs)/gallery")} />}
      />
    );
  }

  const cover = artefact.images?.[0]?.url || artefact.cover_image_url;
  const narrationReady = artefact.narration?.status === "ready" && Boolean(artefact.narration.audio_url);
  const heroHeight = 360 + insets.top;

  return (
    <NScreen topInset={false}>
      {/* Edge-to-edge hero: the 3D model (or photograph) with floating controls */}
      <View style={{ height: heroHeight, marginHorizontal: -GUTTER, backgroundColor: colors.museumLight }}>
        {artefact.model3d ? (
          <ModelViewer
            glbUrl={!user && artefact.status === "published" ? publicModelUrl(artefact.id) : artefact.model3d.glb_url}
            style={{ height: heroHeight }}
          />
        ) : cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`Photograph of ${artefact.name}`} />
        ) : (
          <MuseumStage height={heroHeight} />
        )}
        <View style={[styles.heroBar, { top: insets.top + space.sm }]}>
          <CircleButton icon="chevron-back" label="Back to gallery" tone="overlay" onPress={goBack} />
          {artefact.model3d ? (
            <CircleButton icon="expand-outline" label="Open full-screen 3D view" tone="overlay" onPress={() => router.push(`/viewer/${artefact.id}`)} />
          ) : null}
        </View>
        {artefact.model3d ? (
          <View style={styles.heroHint}>
            <Ionicons name="hand-left-outline" size={12} color={colors.museumInk} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.museumInk }}>Drag to rotate · pinch to zoom</Text>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: space.xl, gap: space.xs }}>
        <Text style={[type.overline, { color: colors.brick }]}>{artefact.accession_number}</Text>
        <Text accessibilityRole="header" style={type.title1}>
          {artefact.name}
        </Text>
        {artefact.material ? <Text style={type.subhead}>{artefact.material}</Text> : null}
      </View>

      {narrationReady && artefact.narration?.audio_url ? (
        <View style={{ marginTop: space.xl }}>
          <NarrationPlayer key={artefact.narration.audio_url} url={artefact.narration.audio_url} label="Listen to its story" />
        </View>
      ) : null}

      <SectionHeader title="Record" />
      <Surface padded={false}>
        <KeyValue label="Material" value={artefact.material} />
        <KeyValue label="Date or period" value={artefact.date_or_period} />
        <KeyValue label="Dimensions" value={artefact.dimensions} last />
      </Surface>

      {artefact.description ? (
        <>
          <SectionHeader title="Description" />
          <Text style={[type.body, { color: "rgba(245,239,234,0.82)" }]}>{artefact.description}</Text>
        </>
      ) : null}
    </NScreen>
  );
}

const styles = StyleSheet.create({
  heroBar: { position: "absolute", left: GUTTER, right: GUTTER, flexDirection: "row", justifyContent: "space-between" },
  heroHint: {
    position: "absolute",
    bottom: space.md,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(242,239,233,0.85)",
  },
});
