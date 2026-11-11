/** Ready to publish, native app layout. The web version is ready/[id].tsx.
 * Same actions: publish → /published/{id}, or edit the record. */
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getArtefact, publishArtefact } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { KeyValue, MuseumStage, NButton, NLoading, NScreen, NStateScreen, NavHeader, Notice, SectionHeader, StatusPill, Surface, space, type } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

export default function ReadyToPublishScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setArtefact(await getArtefact(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this artefact.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (authLoading) return <NLoading label="Checking access…" />;

  if (!user) {
    return <NStateScreen icon="lock-closed-outline" title="Sign in required" body="Only signed-in researchers can publish artefacts." />;
  }

  if (loading) return <NLoading label="Loading your model…" />;

  if (!artefact) {
    return (
      <NStateScreen
        onBack={() => router.replace("/(tabs)/artefacts")}
        icon="alert-circle-outline"
        title="Artefact unavailable"
        body={error || "This record could not be found."}
        action={<NButton label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />}
      />
    );
  }

  const cover = artefact.images?.find((image) => image.slot === "front")?.url || artefact.cover_image_url;

  const publish = async () => {
    setPublishing(true);
    try {
      await publishArtefact(artefact.id);
      router.replace(`/published/${artefact.id}`);
    } catch (err) {
      Alert.alert("Could not publish", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <NScreen
      footer={
        <>
          <NButton label="Publish artefact" icon="globe-outline" onPress={publish} loading={publishing} />
          <NButton label="Edit details" variant="ghost" compact onPress={() => router.push(`/artefact-record/${artefact.id}`)} />
        </>
      }
    >
      <NavHeader title="Ready to publish" subtitle="Your 3D model is complete" onBack={() => router.replace("/(tabs)/artefacts")} />

      <View style={styles.hero}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <MuseumStage height={280} />}
        <View style={styles.heroTag}>
          <Ionicons name="cube" size={12} color={colors.teal} />
          <Text style={styles.heroTagText}>AI-assisted 3D model</Text>
        </View>
      </View>

      <View style={{ marginTop: space.xl, gap: space.sm }}>
        <StatusPill status="ready" label="Ready" />
        <Text style={type.title1}>{artefact.name}</Text>
        <Text style={[type.callout, { color: colors.brick, fontFamily: fonts.semiBold }]}>{artefact.accession_number}</Text>
      </View>

      <SectionHeader title="Record" />
      <Surface padded={false}>
        <KeyValue label="Material" value={artefact.material} />
        <KeyValue label="Date or period" value={artefact.date_or_period} />
        <KeyValue label="Provenance" value={artefact.provenance} />
        <KeyValue label="Location" value={artefact.location} />
        <KeyValue label="Donor" value={artefact.donor} last />
      </Surface>

      <View style={{ marginTop: space.lg }}>
        <Notice tone="success" icon="eye-outline">
          Visible to signed-in NMK staff in the gallery once published.
        </Notice>
      </View>
    </NScreen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280, borderRadius: 22, overflow: "hidden", backgroundColor: colors.museumLight },
  heroTag: {
    position: "absolute",
    left: 12,
    top: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(15,11,11,0.72)",
  },
  heroTagText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.text },
});
