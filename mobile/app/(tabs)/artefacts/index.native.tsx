/** My artefacts, native app layout. The web version is artefacts/index.tsx.
 * Same data, routing per status and delete confirmation; actions open in a
 * bottom sheet (tap "⋯" or long-press a row). */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { deleteArtefact, listArtefacts } from "../../../src/api";
import type { Artefact, ArtefactStatus } from "../../../src/api";
import { useAuth } from "../../../src/auth";
import {
  CircleButton,
  GUTTER,
  NButton,
  NEmpty,
  NLoading,
  NStateScreen,
  Notice,
  Skeleton,
  StatusPill,
  TabScreen,
  Thumb,
  Touchable,
  line,
  space,
  type,
} from "../../../src/native/kit";
import { Sheet } from "../../../src/native/sheet";
import { useToast } from "../../../src/native/toast";
import { colors, fonts } from "../../../src/theme";

function routeFor(artefact: Artefact) {
  if (artefact.status === "processing") return `/processing/${artefact.id}`;
  if (artefact.status === "failed") return `/failed/${artefact.id}`;
  if (artefact.status === "ready") return `/ready/${artefact.id}`;
  if (artefact.status === "published") return `/artefact/${artefact.id}`;
  return `/artefact-record/${artefact.id}`;
}

function ArtefactRow({ artefact, onMore }: { artefact: Artefact; onMore?: () => void }) {
  return (
    <Touchable
      onPress={() => router.push(routeFor(artefact))}
      onLongPress={onMore}
      accessibilityLabel={`${artefact.name}, ${artefact.status_label || artefact.status}`}
      accessibilityHint={onMore ? "Long-press for more actions" : undefined}
      scale={1}
      style={styles.row}
    >
      <Thumb uri={artefact.cover_image_url || artefact.images?.[0]?.url} size={60} radius={16} />
      <View style={styles.rowBody}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text numberOfLines={1} style={[type.callout, { fontFamily: fonts.semiBold, fontSize: 15 }]}>
            {artefact.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <StatusPill status={artefact.status} label={artefact.status_label || undefined} />
            <Text numberOfLines={1} style={[type.caption, { flexShrink: 1 }]}>
              {artefact.accession_number}
            </Text>
          </View>
        </View>
        {onMore ? (
          <Touchable onPress={onMore} accessibilityLabel={`More actions for ${artefact.name}`} style={styles.more} scale={0.9}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
          </Touchable>
        ) : (
          <Ionicons name="chevron-forward" size={16} color={colors.mutedDeep} />
        )}
      </View>
    </Touchable>
  );
}

export default function ArtefactListScreen() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuFor, setMenuFor] = useState<Artefact | null>(null);
  const [confirmFor, setConfirmFor] = useState<Artefact | null>(null);

  const counts = useMemo(() => {
    const counters: Record<ArtefactStatus, number> = { draft: 0, processing: 0, ready: 0, published: 0, failed: 0 };
    for (const item of artefacts) counters[item.status] += 1;
    return counters;
  }, [artefacts]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      setArtefacts(await listArtefacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your artefacts.");
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  const remove = (artefact: Artefact) => {
    deleteArtefact(artefact.id)
      .then(() => {
        toast(`${artefact.name} deleted`);
        return load();
      })
      .catch((err) => toast(err instanceof Error ? err.message : "Could not delete. Please try again.", "error"));
  };

  if (authLoading) return <NLoading />;

  if (!user) {
    return (
      <NStateScreen
        icon="lock-closed-outline"
        title="Researcher access"
        body="Sign in to create records, add photographs and publish 3D artefacts."
        action={<NButton label="Sign in" onPress={() => router.push("/(auth)/login")} />}
      />
    );
  }

  const stats = [
    { label: "Draft", value: counts.draft, color: "#B3A392" },
    { label: "Processing", value: counts.processing, color: colors.amber },
    { label: "Ready", value: counts.ready, color: colors.teal },
    { label: "Published", value: counts.published, color: colors.text },
  ];

  return (
    <>
      <TabScreen
        title="My artefacts"
        subtitle={`${artefacts.length} ${artefacts.length === 1 ? "record" : "records"} in your workspace`}
        refreshing={refreshing}
        onRefresh={refresh}
        right={<CircleButton icon="add" label="Add a new artefact" tone="brick" onPress={() => router.push("/artefact-new")} />}
      >
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: stat.color }}>{stat.value}</Text>
              <Text style={[type.caption, { fontSize: 10.5 }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {error ? (
          <View style={{ paddingHorizontal: GUTTER, marginTop: space.lg }}>
            <Notice tone="error">{error}</Notice>
          </View>
        ) : null}

        <View style={{ marginTop: space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line.hair }}>
          {loading ? (
            [0, 1, 2, 3].map((key) => (
              <View key={key} style={styles.row}>
                <Skeleton width={60} height={60} radius={16} />
                <View style={[styles.rowBody, { gap: 8 }]}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Skeleton height={14} width="65%" radius={6} />
                    <Skeleton height={12} width="40%" radius={6} />
                  </View>
                </View>
              </View>
            ))
          ) : artefacts.length === 0 ? (
            <View style={{ paddingHorizontal: GUTTER }}>
              <NEmpty
                icon="folder-open-outline"
                title="No artefacts yet"
                body="Start with a new artefact, scan its accession card and add four photographs."
                action={<NButton label="New artefact" icon="add" onPress={() => router.push("/artefact-new")} />}
              />
            </View>
          ) : (
            artefacts.map((artefact) => (
              <ArtefactRow
                key={artefact.id}
                artefact={artefact}
                onMore={artefact.status === "processing" ? undefined : () => setMenuFor(artefact)}
              />
            ))
          )}
        </View>
      </TabScreen>

      <Sheet
        visible={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        title={menuFor?.name}
        message={menuFor?.accession_number}
        actions={
          menuFor
            ? [
                { label: "Open", icon: "open-outline", onPress: () => router.push(routeFor(menuFor)) },
                { label: "Edit record", icon: "create-outline", onPress: () => router.push(`/artefact-record/${menuFor.id}`) },
                { label: "Delete…", icon: "trash-outline", tone: "danger", onPress: () => setConfirmFor(menuFor) },
              ]
            : []
        }
      />

      <Sheet
        visible={Boolean(confirmFor)}
        onClose={() => setConfirmFor(null)}
        title="Delete artefact?"
        message={confirmFor ? `${confirmFor.name} will lose its record, photos, model and narration. This cannot be undone.` : undefined}
        actions={confirmFor ? [{ label: "Delete artefact", icon: "trash-outline", tone: "danger", onPress: () => remove(confirmFor) }] : []}
      />
    </>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", paddingHorizontal: GUTTER, gap: space.sm },
  stat: {
    flex: 1,
    alignItems: "center",
    gap: 1,
    paddingVertical: space.md,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: GUTTER, minHeight: 84 },
  rowBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    alignSelf: "stretch",
    paddingRight: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: line.hair,
  },
  more: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated },
});
