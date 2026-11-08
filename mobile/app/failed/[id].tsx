import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { generate3D, getArtefact, listJobs } from "../../src/api";
import type { Artefact, Job } from "../../src/api";
import { useAuth } from "../../src/auth";
import {
  BrandHeader,
  Button,
  EmptyState,
  Loading,
  Screen,
  StatusBadge,
} from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

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
      Alert.alert(
        "Height needed",
        "Add the artefact height before generating a new 3D model.",
        [{ text: "OK", onPress: () => router.push(`/artefact-record/${artefact.id}`) }],
      );
      return;
    }
    if ((artefact.images?.length || 0) < 4) {
      Alert.alert(
        "Photos needed",
        "The 3D engine needs four photos: front, left, right and back.",
        [{ text: "OK", onPress: () => router.push(`/capture/${artefact.id}`) }],
      );
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

  if (authLoading) return <Loading label="Checking access…" />;

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Sign in required"
          body="Researcher tools are only available after sign in."
        />
      </Screen>
    );
  }

  if (loading) return <Loading label="Loading the failed job…" />;

  if (!artefact) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Artefact unavailable"
          body={error || "This record could not be found."}
          action={
            <Button label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />
          }
        />
      </Screen>
    );
  }

  const failureText =
    job?.error?.trim() ||
    "Please try again with better lighting, a plain background, and less blur.";

  return (
    <Screen contentStyle={{ gap: 14 }} bottomPad={80}>
      <BrandHeader />

      <VStack className="mt-2 gap-1">
        <Text
          className="text-foreground"
          style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: lh(31), letterSpacing: -0.4 }}
        >
          3D Model Generation Failed
        </Text>
        <Text className="text-[12.5px] leading-[18px] text-muted-foreground">
          We could not build your 3D model.
        </Text>
      </VStack>

      <HStack className="items-center justify-between">
        <Text className="text-[13px] font-semibold text-foreground">
          Captured photos ({artefact.images?.length || 0})
        </Text>
        <Text className="text-[10px] uppercase tracking-[1.2px] text-muted-foreground">
          {job?.engine || "3D engine"}
        </Text>
      </HStack>

      <HStack className="gap-2">
        {SLOTS.map((slot) => (
          <VStack key={slot.key} className="flex-1 items-center gap-1">
            <Box
              className="w-full overflow-hidden rounded-[12px] border border-border bg-card"
              style={{ height: 62 }}
            >
              {images.get(slot.key) ? (
                <Image
                  source={{ uri: images.get(slot.key)! }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : (
                <Box className="h-full w-full items-center justify-center">
                  <Ionicons name="image-outline" size={18} color={colors.muted} />
                </Box>
              )}
            </Box>
            <Text className="text-[9.5px] leading-[13px] text-muted-foreground">{slot.label}</Text>
          </VStack>
        ))}
      </HStack>

      <Box className="mt-[8px]"><StatusBadge status="failed" label={job?.status_label || "Failed"} /></Box>

      <VStack className="mt-[10px] items-center gap-3 overflow-hidden rounded-[18px] border border-border bg-card pb-[24px]">
        <Box className="absolute left-0 right-0 top-0 h-[3px]" style={{ backgroundColor: colors.deepRed }} />
        <Box className="mt-[10px] h-[136px] w-[136px] items-center justify-center">
          <Image
            source={require("../../assets/kit/props/prop-pot.png")}
            style={{ width: "100%", height: "100%", opacity: 0.55 }}
            contentFit="contain"
          />
          <Box
            className="absolute h-10 w-10 items-center justify-center rounded-full border-2"
            style={{ backgroundColor: colors.deepRed, borderColor: colors.surface }}
          >
            <Ionicons name="alert" size={22} color={colors.white} />
          </Box>
        </Box>

        <Text
          className="mt-[10px] text-center text-foreground"
          style={{ fontFamily: fonts.semiBold, fontSize: 17, lineHeight: lh(23) }}
        >
          3D model generation failed
        </Text>
        <Text className="max-w-[280px] text-center text-[12px] leading-[18px] text-muted-foreground">
          {failureText}
        </Text>
        {job ? (
          <Text className="text-[10px] uppercase tracking-[1.2px] text-muted-foreground">
            Attempt {job.attempts}
          </Text>
        ) : null}
      </VStack>

      <VStack className="mt-[5px] w-[276px] self-center gap-[11px]">
        <Button label="Try again" icon="refresh-outline" onPress={retry} loading={retrying} height={43} />
        <Button
          label="Edit photos"
          variant="outline"
          icon="camera-outline"
          onPress={() => router.push(`/artefact-record/${artefact.id}`)}
          height={39}
        />
      </VStack>

      <Text className="text-center text-[10.5px] leading-[16px] text-muted-foreground">
        Your saved artefact details are safe.
      </Text>
    </Screen>
  );
}
