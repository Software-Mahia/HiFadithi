/** Researcher gallery, native app layout. The web version is gallery.tsx.
 * Same access rules: wait for the saved session, guests go to /explore, the
 * published list is only requested for a signed-in user. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listPublicArtefacts } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { FilterChips, GUTTER, MuseumStage, NEmpty, NLoading, Notice, Skeleton, TabScreen, Touchable, space, type } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

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

function GalleryCard({ artefact }: { artefact: Artefact }) {
  const cover = artefact.cover_image_url || artefact.images?.[0]?.url;
  const has3d = artefact.has_model3d ?? Boolean(artefact.model3d);
  const hasAudio = artefact.narration_ready || artefact.narration?.status === "ready";
  return (
    <Touchable onPress={() => router.push(`/artefact/${artefact.id}`)} accessibilityLabel={`Open ${artefact.name}`} ripple={false} scale={0.97}>
      <View style={styles.media}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <MuseumStage height="100%" compact />
        )}
        <View style={styles.badges}>
          {has3d ? (
            <View style={styles.badge}>
              <Ionicons name="cube" size={10} color={colors.teal} />
              <Text style={styles.badgeText}>3D</Text>
            </View>
          ) : null}
          {hasAudio ? (
            <View style={styles.badge}>
              <Ionicons name="volume-high" size={10} color={colors.text} />
              <Text style={styles.badgeText}>Story</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text numberOfLines={1} style={[type.callout, { fontFamily: fonts.semiBold, marginTop: space.sm }]}>
        {artefact.name}
      </Text>
      <Text numberOfLines={1} style={type.caption}>
        {artefact.material || artefact.accession_number}
      </Text>
    </Touchable>
  );
}

function GridSkeleton() {
  return (
    <View style={styles.grid}>
      {[0, 1, 2, 3].map((key) => (
        <View key={key} style={styles.cell}>
          <Skeleton height={190} radius={18} />
          <Skeleton height={14} width="70%" radius={6} style={{ marginTop: space.sm }} />
          <Skeleton height={10} width="45%" radius={5} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

export default function GalleryScreen() {
  const { user, loading: authLoading } = useAuth();
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<Category>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/explore");
  }, [authLoading, user]);

  const load = useCallback(async () => {
    if (authLoading || !user) return;
    setError("");
    try {
      setArtefacts(await listPublicArtefacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the gallery.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

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

  if (authLoading || !user) return <NLoading label="Checking researcher access…" />;

  return (
    <TabScreen
      title="Gallery"
      subtitle={loading ? "Loading the collection…" : `${artefacts.length} published ${artefacts.length === 1 ? "artefact" : "artefacts"}`}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={{ paddingHorizontal: GUTTER }}>
        {error ? (
          <View style={{ marginBottom: space.md }}>
            <Notice tone="error" icon="cloud-offline-outline">
              {error}
            </Notice>
          </View>
        ) : null}

        {loading ? (
          <GridSkeleton />
        ) : artefacts.length === 0 ? (
          <NEmpty icon="images-outline" title="Nothing published yet" body="Researcher artefacts appear here as soon as they are published." />
        ) : (
          <>
            <FilterChips items={categories} value={category} onChange={setCategory} />
            {visible.length === 0 ? (
              <NEmpty icon="search-outline" title="No artefacts in this category" body="Try another material or browse the full collection." />
            ) : (
              <View style={styles.grid}>
                {visible.map((artefact) => (
                  <View key={artefact.id} style={styles.cell}>
                    <GalleryCard artefact={artefact} />
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.xl, marginTop: space.lg },
  cell: { width: "48%" },
  media: { aspectRatio: 0.86, borderRadius: 18, overflow: "hidden", backgroundColor: colors.museumLight },
  badges: { position: "absolute", left: 8, bottom: 8, flexDirection: "row", gap: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(15,11,11,0.78)",
  },
  badgeText: { fontFamily: fonts.semiBold, fontSize: 10, color: colors.text },
});
