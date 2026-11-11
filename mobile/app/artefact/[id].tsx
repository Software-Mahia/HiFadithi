import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getPublicArtefact, publicModelUrl } from "../../src/api";
import type { Artefact } from "../../src/api";
import { ModelViewer } from "../../src/components/ModelViewer";
import { NarrationPlayer } from "../../src/components/NarrationPlayer";
import {
  ArtefactHero,
  Button,
  DetailRow,
  EmptyState,
  Loading,
  Screen,
} from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: colors.elevated }}
    >
      <Ionicons name={icon} size={19} color={colors.text} />
    </Pressable>
  );
}

export default function PublicArtefactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getPublicArtefact(id);
      setArtefact(data);
      // Warm the model so the full-screen 3D view opens without a fresh
      // download: the stream endpoint is cache-stable, so this fills the
      // WebView/browser HTTP cache the viewer shares.
      if (data.model3d && data.status === "published") {
        fetch(publicModelUrl(data.id)).catch(() => {});
      }
      // Warm the model so the full-screen 3D view opens without a fresh
      // download: the stream endpoint is cache-stable, so this fills the
      // WebView/browser HTTP cache the viewer shares.
      if (data.model3d && data.status === "published") {
        fetch(publicModelUrl(data.id)).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "This artefact is not available.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <Loading label="Opening artefact…" />;

  if (!artefact) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Artefact unavailable"
          body={error || "This record may have been unpublished."}
          action={
            <Button label="Back to gallery" onPress={() => router.replace("/(tabs)/gallery")} />
          }
        />
      </Screen>
    );
  }

  const cover =
    artefact.images?.[0]?.url || artefact.cover_image_url;
  const narrationReady = artefact.narration?.status === "ready" && Boolean(artefact.narration.audio_url);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/gallery");
  };

  return (
    <Screen contentStyle={{ gap: 14 }}>
      <HStack className="items-center justify-between">
        <HeaderButton icon="chevron-back" label="Back to gallery" onPress={goBack} />
        <HStack className="items-center gap-2">
          {artefact.model3d ? (
            <HeaderButton
              icon="expand-outline"
              label="Open full-screen 3D view"
              onPress={() => router.push(`/viewer/${artefact.id}`)}
            />
          ) : null}
        </HStack>
      </HStack>

      {artefact.model3d ? (
        <ModelViewer
          glbUrl={
            artefact.status === "published"
              ? publicModelUrl(artefact.id)
              : artefact.model3d.glb_url
          }
          style={{ height: 280 }}
        />
      ) : (
        <ArtefactHero cover={cover} height={272}>
          <Box className="absolute bottom-3 left-0 right-0 items-center">
            <HStack className="items-center gap-1.5 rounded-full bg-[rgba(10,8,8,0.62)] px-3 py-1">
              <Ionicons name="image-outline" size={11} color={colors.muted} />
              <Text className="text-[10px] font-medium text-white">Artefact photograph</Text>
            </HStack>
          </Box>
        </ArtefactHero>
      )}

      <HStack
        className="items-center justify-between gap-3 rounded-[16px] border border-border bg-card px-4 py-3"
      >
        <Text
          className="flex-1 text-foreground"
          style={{ fontFamily: fonts.semiBold, fontSize: 18, lineHeight: lh(24) }}
        >
          {artefact.name}
        </Text>
        <Text
          className="text-brick"
          style={{ fontFamily: fonts.semiBold, fontSize: 13, lineHeight: lh(19) }}
        >
          {artefact.accession_number}
        </Text>
      </HStack>

      {narrationReady && artefact.narration?.audio_url ? (
        <NarrationPlayer
          key={artefact.narration.audio_url}
          url={artefact.narration.audio_url}
          label="Listen to its story"
        />
      ) : null}

      <VStack className="rounded-[18px] bg-elevated px-[30px] py-[5px]">
        <DetailRow label="Material" value={artefact.material} />
        <DetailRow label="Date or period" value={artefact.date_or_period} />
        <DetailRow
          label="Dimensions"
          value={artefact.dimensions}
          last={!artefact.description}
        />
      </VStack>

      {artefact.description ? (
        <VStack className="gap-2 rounded-[18px] border border-border bg-card px-[30px] py-4">
          <Text
            className="text-foreground"
            style={{ fontFamily: fonts.semiBold, fontSize: 14, lineHeight: lh(20) }}
          >
            Description
          </Text>
          <Text className="text-[12px] leading-[17px] text-muted-foreground">
            {artefact.description}
          </Text>
        </VStack>
      ) : null}
    </Screen>
  );
}
