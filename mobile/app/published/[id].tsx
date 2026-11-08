import { useCallback, useState } from "react";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getArtefact } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { BrandHeader, Button, EmptyState, Loading, Screen } from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

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

  if (loading) return <Loading label="Opening your published artefact…" />;

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

  return (
    <Screen contentStyle={{ gap: 0 }} bottomPad={78}>
      <BrandHeader />

      <Image
        source={require("../../assets/kit/characters/amani-published.png")}
        style={{ width: 300, height: 300, alignSelf: "center", marginTop: 18 }}
        contentFit="contain"
      />

      <Text
        className="mt-[44px] text-center text-foreground"
        style={{ fontFamily: fonts.bold, fontSize: 34, lineHeight: lh(42), letterSpacing: -0.8 }}
      >
        Published!
      </Text>

      <HStack className="mt-1 items-center gap-1.5 self-center rounded-full bg-teal/15 px-3 py-1.5">
        <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
        <Text className="text-[11px] font-semibold text-teal">Live in the public gallery</Text>
      </HStack>

      <Text className="mx-auto mt-[27px] max-w-[290px] text-center text-[13px] leading-[20px] text-muted-foreground">
        Guests can now explore this artefact in 3D and listen to its story.
      </Text>

      <VStack className="mt-[46px] w-[298px] self-center gap-[13px]">
        <Button
          label="View published artefact"
          icon="eye-outline"
          onPress={() => router.replace(`/artefact/${artefact.id}`)}
          height={49}
        />
        <Button
          label="Add another artefact"
          variant="outline"
          icon="add-circle-outline"
          onPress={() => router.replace("/artefact-new")}
          height={47}
        />
      </VStack>
    </Screen>
  );
}
