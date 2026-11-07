import { Alert , StyleSheet } from "react-native";
import { useCallback, useMemo, useState } from "react";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteArtefact, listArtefacts } from "../../../src/api";
import type { Artefact, ArtefactStatus } from "../../../src/api";
import { useAuth } from "../../../src/auth";
import {
  BrandHeader,
  Button,
  EmptyState,
  Loading,
  Screen,
  StatusBadge,
  clampLines,
} from "../../../src/components/ui";
import { colors, fonts, raisedShadow, lh } from "../../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function routeFor(artefact: Artefact) {
  if (artefact.status === "processing") return `/processing/${artefact.id}`;
  if (artefact.status === "failed") return `/failed/${artefact.id}`;
  if (artefact.status === "ready") return `/ready/${artefact.id}`;
  if (artefact.status === "published") return `/artefact/${artefact.id}`;
  return `/artefact-record/${artefact.id}`;
}

function ArtefactRow({ artefact, onDelete }: { artefact: Artefact; onDelete?: () => void }) {
  const thumb = artefact.cover_image_url || artefact.images?.[0]?.url;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(routeFor(artefact))}
      className="flex-row items-center gap-3 rounded-[16px] border border-border bg-card px-3 py-3"
    >
      <Box className="h-[58px] w-[58px] overflow-hidden rounded-[12px] bg-elevated">
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <Box className="h-full w-full items-center justify-center">
            <Image
              source={require("../../../assets/kit/props/prop-pot.png")}
              style={{ width: 46, height: 46 }}
              contentFit="contain"
            />
          </Box>
        )}
      </Box>
      <VStack className="flex-1 gap-0.5">
        <Text
          className="text-[14px] leading-[19px] font-semibold text-foreground"
          isTruncated
          numberOfLines={clampLines(1)}
        >
          {artefact.name}
        </Text>
        <Text className="text-[10.5px] leading-[15px] text-muted-foreground">
          {artefact.accession_number}
        </Text>
      </VStack>
      <StatusBadge
        status={artefact.status}
        label={artefact.status_label || artefact.status}
      />
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete artefact"
          onPress={onDelete}
          hitSlop={6}
          className="h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: colors.elevated }}
        >
          <Ionicons name="trash-outline" size={15} color={colors.brick} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export default function ArtefactListScreen() {
  const { user, loading: authLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const counters: Record<ArtefactStatus, number> = {
      draft: 0,
      processing: 0,
      ready: 0,
      published: 0,
      failed: 0,
    };
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

  if (authLoading) return <Loading />;

  if (!user) {
    return (
      <Screen contentStyle={{ paddingTop: 100 }}>
        <EmptyState
          icon="lock-closed-outline"
          title="Researcher access"
          body="Sign in to create records, add photographs and publish 3D artefacts."
          action={<Button label="Sign in" onPress={() => router.push("/(auth)/login")} />}
        />
      </Screen>
    );
  }

  return (
    <Box className="flex-1 bg-background">
      <Screen refreshing={refreshing} onRefresh={refresh} contentStyle={{ gap: 14 }}>
        <BrandHeader />

        <VStack className="mt-2 gap-1">
          <Text
            className="text-foreground"
            style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: lh(36), letterSpacing: -0.6 }}
          >
            My artefacts
          </Text>
          <Text className="text-[12.5px] leading-[18px] text-muted-foreground">
            Manage your collection
          </Text>
        </VStack>

        <HStack className="gap-2">
          {(
            [
              { label: "Draft", value: counts.draft, color: colors.muted },
              { label: "Processing", value: counts.processing, color: colors.amber },
              { label: "Ready", value: counts.ready, color: colors.teal },
            ] as const
          ).map((stat) => (
            <Box
              key={stat.label}
              className="flex-1 items-center gap-0.5 rounded-[12px] border border-border bg-card py-2.5"
            >
              <Text className="text-[17px] leading-[22px] font-semibold" style={{ color: stat.color }}>
                {stat.value}
              </Text>
              <Text className="text-[9.5px] leading-[13px] font-medium uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </Text>
            </Box>
          ))}
        </HStack>

        <HStack className="items-center justify-between pt-1">
          <Text className="text-[11px] font-medium text-muted-foreground">
            {artefacts.length} {artefacts.length === 1 ? "artefact" : "artefacts"}
          </Text>
          <Text className="text-[9px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">
            Status
          </Text>
        </HStack>

        {loading ? <Loading label="Loading records…" /> : null}
        {error ? <Text className="text-[12px] text-brick">{error}</Text> : null}

        {!loading && artefacts.length === 0 ? (
          <EmptyState
            icon="folder-open-outline"
            title="No artefacts yet"
            body="Start with a new artefact, scan its accession card and add four photographs."
            action={
              <Button
                label="New artefact"
                icon="add-circle-outline"
                onPress={() => router.push("/artefact-new")}
              />
            }
          />
        ) : (
          <VStack className="gap-[9px]">
            {artefacts.map((artefact) => (
              <ArtefactRow
                key={artefact.id}
                artefact={artefact}
                onDelete={
                  artefact.status === "processing"
                    ? undefined
                    : () =>
                        Alert.alert(
                          "Delete artefact?",
                          `${artefact.name} will lose its record, photos, model and narration.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                deleteArtefact(artefact.id)
                                  .then(load)
                                  .catch((err) =>
                                    Alert.alert(
                                      "Could not delete",
                                      err instanceof Error
                                        ? err.message
                                        : "Please try again.",
                                    ),
                                  );
                              },
                            },
                          ],
                        )
                }
              />
            ))}
          </VStack>
        )}
      </Screen>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a new artefact"
        onPress={() => router.push("/artefact-new")}
        className="absolute h-[52px] w-[52px] items-center justify-center rounded-full"
        style={StyleSheet.flatten([
          { right: 20, bottom: insets.bottom + 98, backgroundColor: colors.brick },
          raisedShadow,
        ])}
      >
        <Ionicons name="add" size={26} color={colors.white} />
      </Pressable>
    </Box>
  );
}
