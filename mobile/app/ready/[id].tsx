import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getArtefact, publishArtefact } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import {
  ArtefactHero,
  Button,
  DetailRow,
  EmptyState,
  Loading,
  Screen,
  StackHeader,
  StatusBadge,
} from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

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

  if (authLoading) return <Loading label="Checking access…" />;

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Sign in required"
          body="Only signed-in researchers can publish artefacts."
        />
      </Screen>
    );
  }

  if (loading) return <Loading label="Loading your model…" />;

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
    <Screen contentStyle={{ gap: 14 }} bottomPad={40}>
      <StackHeader title="Ready to publish" subtitle="Your 3D model is complete" />

      <Box className="mt-[16px]">
        <ArtefactHero cover={cover} height={287}>
          <Box className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-[rgba(10,8,8,0.62)] px-2.5 py-1">
            <Ionicons name="cube" size={12} color={colors.teal} />
            <Text className="text-[9.5px] font-semibold tracking-[1px] text-white">3D MODEL</Text>
          </Box>
          <Box className="absolute bottom-3 left-0 right-0 items-center">
            <HStack className="items-center gap-1.5 rounded-full bg-[rgba(10,8,8,0.62)] px-3 py-1">
              <Ionicons name="sync" size={11} color={colors.muted} />
              <Text className="text-[10px] font-medium text-white">Drag to rotate</Text>
            </HStack>
          </Box>
        </ArtefactHero>
      </Box>

      <Box className="mt-[12px]">
        <StatusBadge status="ready" label="Ready" />
      </Box>

      <HStack className="items-baseline justify-between gap-3">
        <Text
          className="flex-1 text-foreground"
          style={{ fontFamily: fonts.bold, fontSize: 23, lineHeight: lh(30), letterSpacing: -0.4 }}
        >
          {artefact.name}
        </Text>
        <Text
          className="text-brick"
          style={{ fontFamily: fonts.semiBold, fontSize: 14, lineHeight: lh(20) }}
        >
          {artefact.accession_number}
        </Text>
      </HStack>

      <VStack className="mt-[7px] rounded-[18px] border border-border bg-card px-[30px] py-[5px]">
        <DetailRow label="Material" value={artefact.material} />
        <DetailRow label="Date or period" value={artefact.date_or_period} />
        <DetailRow label="Provenance" value={artefact.provenance} />
        <DetailRow label="Location" value={artefact.location} />
        <DetailRow label="Donor" value={artefact.donor} last />
      </VStack>

      <HStack className="mt-[8px] h-10 w-[302px] self-center items-center gap-2 rounded-[12px] bg-elevated px-4">
        <Ionicons name="eye-outline" size={15} color={colors.teal} />
        <Text className="flex-1 text-[11.5px] leading-[16px] text-muted-foreground">
          Visible to guests once published.
        </Text>
      </HStack>

      <VStack className="mt-[11px] w-[298px] self-center gap-2">
        <Button
          label="Publish artefact"
          icon="globe-outline"
          onPress={publish}
          loading={publishing}
          height={44}
        />
        <Button
          label="Edit details"
          variant="outline"
          onPress={() => router.push(`/artefact-record/${artefact.id}`)}
          height={38}
        />
      </VStack>
    </Screen>
  );
}
