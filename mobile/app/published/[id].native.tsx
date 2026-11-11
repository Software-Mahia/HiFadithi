/** Published confirmation, native app layout. The web version is published/[id].tsx.
 * Same actions: view the published artefact, or add another. */
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getArtefact } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { NButton, NLoading, NScreen, NStateScreen, Thumb, line, space, type } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

export default function PublishedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (authLoading) return <NLoading label="Checking access…" />;
  if (!user) {
    return <NStateScreen icon="lock-closed-outline" title="Sign in required" body="Researcher tools are only available after sign in." />;
  }
  if (loading) return <NLoading label="Opening your published artefact…" />;
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

  return (
    <NScreen
      contentStyle={{ flexGrow: 1 }}
      footer={
        <>
          <NButton label="View published artefact" icon="eye-outline" onPress={() => router.replace(`/artefact/${artefact.id}`)} />
          <NButton label="Add another artefact" variant="outline" icon="add" onPress={() => router.replace("/artefact-new")} />
        </>
      }
    >
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: space.lg, paddingVertical: space.xxxl }}>
        <Image source={require("../../assets/kit/characters/amani-published.png")} style={{ width: 200, height: 200 }} contentFit="contain" />
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.teal} />
          <Text style={{ fontFamily: fonts.semiBold, fontSize: 12, color: colors.teal }}>Live in the gallery</Text>
        </View>
        <Text accessibilityRole="header" style={[type.display, { textAlign: "center" }]}>
          Published
        </Text>
        <Text style={[type.subhead, { textAlign: "center", maxWidth: 300 }]}>
          Signed-in NMK staff can now explore this artefact in 3D and listen to its story.
        </Text>

        <View style={styles.record}>
          <Thumb uri={artefact.cover_image_url || artefact.images?.[0]?.url} size={48} radius={12} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[type.callout, { fontFamily: fonts.semiBold }]}>
              {artefact.name}
            </Text>
            <Text style={type.caption}>{artefact.accession_number}</Text>
          </View>
        </View>
      </View>
    </NScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,180,194,0.12)",
  },
  record: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    alignSelf: "stretch",
    marginTop: space.lg,
    padding: space.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.soft,
  },
});
