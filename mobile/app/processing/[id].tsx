import { useCallback, useEffect, useState } from "react";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getArtefact, getJob, getNarration, listJobs } from "../../src/api";
import type { Artefact, Job, Narration } from "../../src/api";
import {
  Button,
  Card,
  Loading,
  ProgressRing,
  Screen,
  StackHeader,
  StatusBadge,
} from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { NarrationPlayer } from "../../src/components/NarrationPlayer";

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
      const active =
        jobs.find((item) => item.status === "queued" || item.status === "running") || jobs[0] || null;
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

  if (loading) return <Loading label="Loading the 3D job…" />;

  if (!artefact) {
    return (
      <Screen contentStyle={{ paddingTop: 100 }}>
        <Text className="text-center text-[14px] text-muted-foreground">
          {error || "This artefact could not be found."}
        </Text>
        <Button label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />
      </Screen>
    );
  }

  const images = new Map((artefact.images || []).map((image) => [image.slot, image]));
  const progress = job?.progress ?? 0;

  return (
    <Screen safe={false} contentStyle={{ paddingTop: 0 }}>
      <StackHeader
        title="Processing 3D"
        subtitle="Building your artefact model"
        onBack={() => router.replace("/(tabs)/artefacts")}
      />

      <VStack className="gap-0.5 pt-1">
        <Text
          className="text-foreground"
          style={{ fontFamily: fonts.semiBold, fontSize: 20, lineHeight: lh(27) }}
        >
          {artefact.name}
        </Text>
        <Text className="text-[10.5px] text-muted-foreground">
          Accession no. {artefact.accession_number}
        </Text>
      </VStack>

      <HStack className="items-center justify-between">
        <Text className="text-[12px] font-medium text-foreground">Captured photos</Text>
        <Text className="text-[10.5px] text-muted-foreground">{images.size} of 4</Text>
      </HStack>

      <HStack className="gap-2">
        {LABELS.map((slot) => {
          const image = images.get(slot.key);
          return (
            <VStack key={slot.key} className="flex-1 items-center gap-1">
              <Box
                className="w-full overflow-hidden rounded-[12px] border border-border bg-card"
                style={{ aspectRatio: 1 }}
              >
                {image ? (
                  <Image
                    source={{ uri: image.url }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <Box className="h-full w-full items-center justify-center">
                    <Ionicons name="image-outline" size={18} color={colors.muted} />
                  </Box>
                )}
              </Box>
              <Text className="text-[9px] text-muted-foreground">{slot.label}</Text>
            </VStack>
          );
        })}
      </HStack>

      <Card className="mt-1 items-center gap-2 py-5">
        <ProgressRing progress={progress} size={142} stroke={10}>
          <VStack className="items-center">
            <Text className="text-[28px] leading-[34px] font-semibold text-foreground">
              {Math.round(progress)}%
            </Text>
            <Text className="text-[9px] uppercase tracking-[1.2px] text-muted-foreground">
              Complete
            </Text>
          </VStack>
        </ProgressRing>
        <StatusBadge
          status={job?.status === "failed" ? "failed" : "processing"}
          label={job?.status_label || (job?.status === "running" ? "Processing" : "Queued")}
        />
        <Text
          className="text-foreground"
          style={{ fontFamily: fonts.semiBold, fontSize: 19, lineHeight: lh(26) }}
        >
          Building 3D model
        </Text>
        <Text className="max-w-[260px] text-center text-[12px] leading-[18px] text-muted-foreground">
          Turning your photos into a 3D museum experience. You can leave this screen safely.
        </Text>
      </Card>

      {narration?.status === "ready" && narration.audio_url ? (
        <VStack className="gap-2 pt-1">
          <Text className="text-[12px] font-semibold text-foreground">
            Listen while your model renders
          </Text>
          <NarrationPlayer url={narration.audio_url} label="Play the artefact story" />
        </VStack>
      ) : narration?.status === "generating" ? (
        <Text className="pt-1 text-center text-[11px] leading-[17px] text-amber">
          Your story audio is being prepared and will appear here while the model renders.
        </Text>
      ) : null}

      <VStack className="gap-1 pt-1">
        <Text className="text-[12px] font-semibold text-foreground">Generating geometry</Text>
        <Text className="text-[11px] leading-[17px] text-muted-foreground">
          Usually takes a few minutes. You may safely exit.
        </Text>
      </VStack>

      <Button
        label="Back to my artefacts"
        variant="secondary"
        onPress={() => router.replace("/(tabs)/artefacts")}
        style={{ marginTop: 4 }}
      />

      <Text className="text-center text-[10.5px] leading-[16px] text-muted-foreground">
        Your photos are saved while we process.
      </Text>
    </Screen>
  );
}
