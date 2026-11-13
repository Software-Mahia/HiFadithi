/** Failed 3D job, native app layout. The web version is failed/[id].tsx.
 * Same retry checks (height, four photos) and routes. */
import { useCallback, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { generate3D, getArtefact, listJobs } from "../../src/api";
import type { Artefact, Job } from "../../src/api";
import { useAuth } from "../../src/auth";
import { NButton, NLoading, NScreen, NStateScreen, NavHeader, SectionHeader, StatusPill, Surface, Thumb, space, type } from "../../src/native/kit";
import { colors } from "../../src/theme";

const SLOTS = [
  { key: "front", label: "Front" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "back", label: "Back" },
] as const;

export default function FailedJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [record, jobs] = await Promise.all([getArtefact(id), listJobs(id)]);
      setArtefact(record);
      setJob(jobs.find((item) => item.status === "failed") || jobs[0] || null);
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

  const images = useMemo(() => {
    const map = new Map<string, string>();
    for (const image of artefact?.images || []) map.set(image.slot, image.url);
    return map;
  }, [artefact]);

  const retry = async () => {
    if (!artefact) return;
    if (!artefact.height_mm) {
      Alert.alert("Height needed", "Add the artefact height before generating a new 3D model.", [
        { text: "OK", onPress: () => router.push(`/artefact-record/${artefact.id}`) },
      ]);
      return;
    }
    if ((artefact.images?.length || 0) < 4) {
      Alert.alert("Photos needed", "The 3D engine needs four photos: front, left, right and back.", [
        { text: "OK", onPress: () => router.push(`/capture/${artefact.id}`) },
      ]);
      return;
    }
    setRetrying(true);
    try {
      await generate3D(artefact.id);
      router.replace(`/processing/${artefact.id}`);
    } catch (err) {
      Alert.alert("Could not retry", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  if (authLoading) return <NLoading label="Checking access…" />;
  if (!user) {
    return <NStateScreen icon="lock-closed-outline" title="Sign in required" body="Researcher tools are only available after sign in." />;
  }
  if (loading) return <NLoading label="Loading the failed job…" />;
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

  const failureText = job?.error?.trim() || "Please try again with better lighting, a plain background, and less blur.";

  return (
    <NScreen
      footer={
        <>
          <NButton label="Try again" icon="refresh" onPress={retry} loading={retrying} />
          <NButton label="Edit photos and details" variant="outline" icon="camera-outline" onPress={() => router.push(`/artefact-record/${artefact.id}`)} />
        </>
      }
    >
      <NavHeader title="3D model" subtitle={artefact.accession_number} onBack={() => router.replace("/(tabs)/artefacts")} />

      <Surface style={{ gap: space.md, borderColor: "rgba(194,67,57,0.45)" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <View style={styles.alert}>
            <Ionicons name="alert" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <StatusPill status="failed" label={job?.status_label || "Failed"} />
            <Text style={type.headline}>We could not build the 3D model</Text>
          </View>
        </View>
        <Text style={type.subhead}>{failureText}</Text>
        {job ? (
          <Text style={type.caption}>
            Attempt {job.attempts} · {job.engine || "3D engine"}
          </Text>
        ) : null}
      </Surface>

      <View style={{ marginTop: space.xl, gap: 2 }}>
        <Text style={type.title2}>{artefact.name}</Text>
        <Text style={type.subhead}>Your saved artefact details are safe.</Text>
      </View>

      <SectionHeader title={`Captured photos (${artefact.images?.length || 0})`} />
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {SLOTS.map((slot) => (
          <View key={slot.key} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ width: "100%", aspectRatio: 1 }}>
              <Thumb uri={images.get(slot.key)} />
            </View>
            <Text style={type.caption}>{slot.label}</Text>
          </View>
        ))}
      </View>
    </NScreen>
  );
}

const styles = StyleSheet.create({
  alert: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.deepRed },
});
