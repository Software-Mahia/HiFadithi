import { useCallback, useMemo, useState } from "react";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listPublicArtefacts } from "../../src/api";
import type { Artefact } from "../../src/api";
import {
  BrandHeader,
  Chips,
  EmptyState,
  Loading,
  Screen,
  clampLines,
} from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

type Category = "" | "pottery" | "woodwork" | "beadwork" | "basketry" | "instruments";

const categories: { label: string; value: Category }[] = [
  { label: "All", value: "" },
  { label: "Pottery", value: "pottery" },
  { label: "Woodwork", value: "woodwork" },
  { label: "Beadwork", value: "beadwork" },
  { label: "Basketry", value: "basketry" },
  { label: "Instruments", value: "instruments" },
];

const keywords: Record<Exclude<Category, "">, string[]> = {
  pottery: ["pot", "clay", "ceramic", "terracotta", "vessel", "earthenware"],
  woodwork: ["wood", "carv", "timber", "wooden"],
  beadwork: ["bead", "necklace", "ornament"],
  basketry: ["basket", "weav", "fibre", "fiber", "reed"],
  instruments: ["drum", "instrument", "horn", "lyre", "flute", "ngoma"],
};

function matches(artefact: Artefact, category: Category) {
  if (!category) return true;
  const haystack = `${artefact.name} ${artefact.material} ${artefact.description}`.toLowerCase();
  return keywords[category].some((word) => haystack.includes(word));
}

function FeaturePill({
  icon,
  label,
  tone = "teal",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: "teal" | "brick";
}) {
  return (
    <HStack className="items-center gap-1 rounded-full border border-border px-1.5 py-0.5">
      <Ionicons name={icon} size={9} color={tone === "teal" ? colors.teal : colors.brick} />
      <Text className="text-[8.5px] font-medium text-muted-foreground">{label}</Text>
    </HStack>
  );
}

function GalleryCard({ artefact }: { artefact: Artefact }) {
  const cover = artefact.cover_image_url || artefact.images?.[0]?.url;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/artefact/${artefact.id}`)}
      className="overflow-hidden rounded-[16px] border border-border bg-card"
      style={{ width: "48%" }}
    >
      <Box style={{ height: 138 }}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Box className="h-full w-full items-center justify-center">
            <Image
              source={require("../../assets/kit/props/prop-pot.png")}
              style={{ width: 96, height: 96 }}
              contentFit="contain"
            />
          </Box>
        )}
      </Box>
      <VStack className="gap-1.5 p-2.5">
        <Text
          className="text-[13px] leading-[17px] font-semibold text-foreground"
          isTruncated
          numberOfLines={clampLines(1)}
        >
          {artefact.name}
        </Text>
        <Text className="text-[10px] leading-[14px] text-muted-foreground" isTruncated numberOfLines={clampLines(1)}>
          {artefact.material || artefact.accession_number}
        </Text>
        <HStack className="flex-wrap gap-1">
          {(artefact.has_model3d ?? Boolean(artefact.model3d)) ? (
            <FeaturePill icon="cube" label="3D model" />
          ) : null}
          {artefact.narration_ready || artefact.narration?.status === "ready" ? (
            <FeaturePill icon="volume-high" label="Audio narration" tone="brick" />
          ) : null}
          {!(artefact.has_model3d ?? Boolean(artefact.model3d)) &&
          !artefact.narration_ready &&
          artefact.narration?.status !== "ready" ? (
            <FeaturePill icon="eye" label="View" />
          ) : null}
        </HStack>
      </VStack>
    </Pressable>
  );
}

export default function GalleryScreen() {
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<Category>("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setArtefacts(await listPublicArtefacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the gallery.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const visible = useMemo(() => artefacts.filter((item) => matches(item, category)), [artefacts, category]);

  if (loading) return <Loading label="Loading published artefacts…" />;

  if (artefacts.length === 0) {
    return (
      <Screen refreshing={refreshing} onRefresh={refresh} contentStyle={{ gap: 0 }}>
        <BrandHeader />
        <Text
          className="mt-5 text-foreground"
          style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: lh(40), letterSpacing: -0.7 }}
        >
          Gallery
        </Text>
        {error ? (
          <Text className="mt-3 text-[12px] leading-[18px] text-brick">{error}</Text>
        ) : null}
        <Box style={{ height: 56 }} />
        <EmptyState
          title="Nothing published yet"
          body="Researcher artefacts appear here as soon as they are published."
          art="amani-empty"
        />
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh} contentStyle={{ gap: 16 }}>
      <Text
        className="text-foreground"
        style={{ fontFamily: fonts.bold, fontSize: 30, lineHeight: lh(38), letterSpacing: -0.6 }}
      >
        Gallery
      </Text>

      <HStack className="items-center gap-2">
        <VStack className="flex-1 gap-1.5">
          <Text
            className="text-foreground"
            style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: lh(34), letterSpacing: -0.5 }}
          >
            Explore our{"\n"}artefacts
          </Text>
          <Text className="text-[12.5px] leading-[18px] text-muted-foreground">
            Rotate them in 3D and listen to their stories.
          </Text>
        </VStack>
        <Image
          source={require("../../assets/kit/characters/juma-explorer.png")}
          style={{ width: 132, height: 150 }}
          contentFit="contain"
        />
      </HStack>

      {error ? (
        <HStack className="items-center gap-2 rounded-[12px] border border-deepred/50 bg-deepred/20 p-3">
          <Ionicons name="cloud-offline-outline" size={16} color={colors.brick} />
          <Text className="flex-1 text-[12px] leading-[18px] text-brick">{error}</Text>
        </HStack>
      ) : null}

      <Chips items={categories} value={category} onChange={setCategory} />

      {visible.length === 0 ? (
        <VStack className="items-center gap-2 py-10">
          <Ionicons name="search-outline" size={26} color={colors.muted} />
          <Text className="text-[14px] font-semibold text-foreground">No artefacts in this category</Text>
          <Text className="text-center text-[12px] leading-[18px] text-muted-foreground">
            Try another material or browse the full collection.
          </Text>
        </VStack>
      ) : (
        <HStack className="flex-wrap justify-between" style={{ rowGap: 14 }}>
          {visible.map((artefact) => (
            <GalleryCard key={artefact.id} artefact={artefact} />
          ))}
        </HStack>
      )}
    </Screen>
  );
}
