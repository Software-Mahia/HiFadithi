import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getArtefact, getPublicArtefact, publicModelUrl } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ModelViewer } from "../../src/components/ModelViewer";
import { Button, EmptyState, Loading, Screen } from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function ViewerButton({
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

export default function ViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setArtefact(user ? await getArtefact(id) : await getPublicArtefact(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The model could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/gallery");
  };

  if (loading) return <Loading label="Preparing 3D model…" />;

  if (!artefact?.model3d) {
    return (
      <Screen>
        <EmptyState
          icon="cube-outline"
          title="No model available"
          body={error || "This artefact does not have a 3D model yet."}
          action={<Button label="Back to gallery" onPress={goBack} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll={false}
      contentStyle={{ gap: 10, paddingTop: 8, paddingBottom: 14 }}
    >
      {/* Header: back + name, with comfortable spacing from the screen top */}
      <HStack className="items-center gap-2">
        <ViewerButton icon="chevron-back" label="Go back" onPress={goBack} />
        <VStack className="flex-1 gap-0.5" style={{ alignItems: "flex-end" }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.semiBold, fontSize: 17, lineHeight: lh(23) }}
          >
            {artefact.name}
          </Text>
          <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
            {artefact.accession_number}
          </Text>
        </VStack>
      </HStack>

      {/* Canvas: full-bleed, no card chrome; fills everything below the header
          and above the gesture-hint pill */}
      <Box className="overflow-hidden rounded-[18px]" style={{ flex: 1 }}>
        <ModelViewer
          glbUrl={
            artefact.status === "published"
              ? publicModelUrl(artefact.id)
              : artefact.model3d.glb_url
          }
          style={{ flex: 1, height: undefined }}
        />
      </Box>

      {/* Gesture hint as its own pill, instead of an overlaid caption */}
      <HStack className="items-center justify-center gap-1.5 self-center rounded-full bg-elevated px-3 py-1.5">
        <Ionicons name="hand-left-outline" size={12} color={colors.muted} />
        <Text className="text-[11px] text-muted-foreground">
          Drag to rotate · Pinch to zoom
        </Text>
      </HStack>
    </Screen>
  );
}
