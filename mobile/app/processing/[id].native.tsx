/** 3D processing, native app layout. The web version is processing/[id].tsx.
 * Same polling (job every 1.6 s, narration every 2.5 s) and redirects. */
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { getArtefact, getJob, getNarration, listJobs } from "../../src/api";
import type { Artefact, Job, Narration } from "../../src/api";
import { NarrationPlayer } from "../../src/components/NarrationPlayer";
import { ProgressRing } from "../../src/components/ui";
import { NButton, NLoading, NScreen, NStateScreen, NavHeader, Notice, SectionHeader, StatusPill, Surface, Thumb, space, type } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

const LABELS = [
  { key: "front", label: "Front" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "back", label: "Back" },
] as const;

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [narration, setNarration] = useState<Narration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getArtefact(id);
      setArtefact(data);
      if (data.status === "ready" || data.status === "published") {
        router.replace(`/ready/${id}`);
        return;
      }
      const jobs = await listJobs(id);
      const active = jobs.find((item) => item.status === "queued" || item.status === "running") || jobs[0] || null;
      if (active?.status === "failed" || data.status === "failed") {
        router.replace(`/failed/${id}`);
        return;
      }
      setJob(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the job.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!job || job.status === "succeeded" || job.status === "failed") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await getJob(job.id);
        if (cancelled) return;
        setJob(latest);
        if (latest.status === "succeeded") {
          clearInterval(timer);
          router.replace(`/ready/${id}`);
        } else if (latest.status === "failed") {
          clearInterval(timer);
          router.replace(`/failed/${id}`);
        }
      } catch {
        // A transient poll failure is fine; the next tick retries.
      }
    };
    refresh();
    const timer = setInterval(refresh, 1600);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [job?.id, job?.status, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id || narration?.status === "ready" || narration?.status === "failed") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await getNarration(id);
        if (!cancelled) setNarration(latest);
      } catch {
        // Narration is optional; keep the 3D progress screen usable if it is unavailable.
      }
    };
    refresh();
    const timer = setInterval(refresh, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, narration?.status]);

  if (loading) return <NLoading label="Loading the 3D job…" />;

  if (!artefact) {
    return (
      <NStateScreen
        onBack={() => router.replace("/(tabs)/artefacts")}
        icon="alert-circle-outline"
        title="Job unavailable"
        body={error || "This artefact could not be found."}
        action={<NButton label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />}
      />
    );
  }

  const images = new Map((artefact.images || []).map((image) => [image.slot, image]));
  const progress = job?.progress ?? 0;
  const hasStory = Boolean(narration?.story_text || artefact.narration?.story_text);

  return (
    <NScreen footer={<NButton label="Back to my artefacts" variant="secondary" onPress={() => router.replace("/(tabs)/artefacts")} />}>
      <NavHeader title="Processing 3D" subtitle={artefact.accession_number} onBack={() => router.replace("/(tabs)/artefacts")} />

      <Surface style={{ alignItems: "center", gap: space.md, paddingVertical: space.xxl }}>
        <ProgressRing progress={progress} size={168} stroke={10} color={colors.amber}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, color: colors.text }}>{Math.round(progress)}%</Text>
            <Text style={[type.caption, { letterSpacing: 1.2 }]}>COMPLETE</Text>
          </View>
        </ProgressRing>
        <StatusPill status="processing" label={job?.status_label || (job?.status === "running" ? "Processing" : "Queued")} />
        <Text style={[type.title2, { textAlign: "center" }]}>{artefact.name}</Text>
        <Text style={[type.subhead, { textAlign: "center", maxWidth: 280 }]}>
          {hasStory
            ? "Turning your photos into a 3D museum experience. You can listen while it finishes."
            : "Building the AI-assisted 3D model from your four photographs."}
        </Text>
      </Surface>

      {hasStory && narration?.status === "ready" && narration.audio_url ? (
        <>
          <SectionHeader title="Listen while it renders" />
          <NarrationPlayer url={narration.audio_url} label="Play the artefact story" />
        </>
      ) : hasStory && narration?.status === "generating" ? (
        <View style={{ marginTop: space.lg }}>
          <Notice tone="warn" icon="volume-high-outline">
            Your story audio is being prepared and will appear here.
          </Notice>
        </View>
      ) : null}

      <SectionHeader title="Captured photos" action={<Text style={type.caption}>{images.size} of 4</Text>} />
      <View style={styles.photos}>
        {LABELS.map((slot) => (
          <View key={slot.key} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ width: "100%", aspectRatio: 1 }}>
              <Thumb uri={images.get(slot.key)?.url} />
            </View>
            <Text style={type.caption}>{slot.label}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: space.xl }}>
        <Notice tone="info" icon="time-outline">
          Usually takes a few minutes. You can leave this screen; your photos are saved and progress continues.
        </Notice>
      </View>
    </NScreen>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: "row", gap: space.sm },
});
