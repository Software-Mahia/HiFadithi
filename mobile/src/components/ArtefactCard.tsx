import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import type { Artefact, ArtefactStatus } from "../api";
import { colors } from "../theme";
import { Badge, clampLines } from "./ui";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

const toneByStatus: Record<ArtefactStatus, "neutral" | "teal" | "amber" | "brick" | "success"> = {
  draft: "neutral",
  processing: "amber",
  ready: "teal",
  published: "success",
  failed: "brick",
};

export function ArtefactCard({
  artefact,
  onPress,
  showStatus = true,
}: {
  artefact: Artefact;
  onPress: () => void;
  showStatus?: boolean;
}) {
  const cover = artefact.cover_image_url || artefact.images?.[0]?.url;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="overflow-hidden rounded-[18px] border border-border bg-card"
      style={({ pressed }) => (pressed ? { opacity: 0.92 } : undefined)}
    >
      <Box className="h-[170px] bg-[#171211]">
        {cover ? (
          <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
        ) : (
          <Box className="h-full w-full items-center justify-center">
            <Ionicons name="cube-outline" size={32} color={colors.muted} />
          </Box>
        )}
        {artefact.model3d ? (
          <HStack className="absolute bottom-3 right-3 items-center gap-1 rounded-full bg-teal px-2 py-1">
            <Ionicons name="cube" size={12} color={colors.white} />
            <Text className="text-[11px] font-extrabold text-white">3D</Text>
          </HStack>
        ) : null}
      </Box>
      <VStack className="gap-1 p-4">
        <HStack className="items-start gap-2">
          <Text
            className="flex-1 text-lg font-extrabold tracking-tight text-foreground"
            isTruncated
            numberOfLines={clampLines(2)}
          >
            {artefact.name}
          </Text>
          {showStatus ? (
            <Badge label={artefact.status_label || artefact.status} tone={toneByStatus[artefact.status]} />
          ) : null}
        </HStack>
        <Text className="text-xs font-bold tracking-wide text-brick">{artefact.accession_number}</Text>
        {artefact.description ? (
          <Text
            className="text-[13px] leading-[18px] text-muted-foreground"
            isTruncated
            numberOfLines={clampLines(2)}
          >
            {artefact.description}
          </Text>
        ) : null}
      </VStack>
    </Pressable>
  );
}
