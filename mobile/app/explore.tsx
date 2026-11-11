import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../src/auth";
import { listPublicArtefacts } from "../src/api";
import type { Artefact } from "../src/api";
import { Button, Loading, Screen } from "../src/components/ui";
import { colors, fonts, lh } from "../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function PreviewCard({ artefact }: { artefact: Artefact }) {
  const cover = artefact.cover_image_url || artefact.images?.[0]?.url;

  return (
    <Box className="overflow-hidden rounded-[20px] border border-border bg-card">
      <Box className="h-[150px]">
        {cover ? (
          <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <Box className="h-full items-center justify-center bg-elevated">
            <Ionicons name="cube-outline" size={32} color={colors.amber} />
          </Box>
        )}
      </Box>
      <VStack className="gap-1.5 p-4">
        <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
          {artefact.name}
        </Text>
        <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
          {artefact.material || "Museum artefact"}
        </Text>
        <HStack className="mt-1 items-center gap-1.5">
          <Ionicons name="lock-closed-outline" size={11} color={colors.amber} />
          <Text className="text-[10px] text-amber">Approved preview</Text>
        </HStack>
      </VStack>
    </Box>
  );
}

export default function ExploreScreen() {
  const { user, loading: authLoading } = useAuth();
  const [previews, setPreviews] = useState<Artefact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listPublicArtefacts()
      .then((items) => {
        if (active) setPreviews(items.slice(0, 2));
      })
      .catch(() => {
        if (active) setPreviews([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <Loading label="Preparing the museum overview…" />;

  return (
    <Screen contentStyle={{ gap: 22 }}>
      <VStack className="gap-3 pt-2">
        <Text
          style={{
            color: colors.amber,
            fontFamily: fonts.semiBold,
            fontSize: 11,
            letterSpacing: 2,
          }}
        >
          THE NMK DIGITAL COLLECTION
        </Text>
        <Text
          className="text-foreground"
          style={{ fontFamily: fonts.bold, fontSize: 34, lineHeight: lh(40), letterSpacing: -0.8 }}
        >
          From a photograph to a living 3D story.
        </Text>
        <Text className="text-[14px] leading-[22px] text-muted-foreground">
          HiFadithi helps National Museums of Kenya researchers capture artefacts,
          build AI-assisted 3D models, and preserve the stories behind each object.
        </Text>
      </VStack>

      <VStack className="gap-3 rounded-[20px] border border-amber/40 bg-elevated p-5">
        <HStack className="items-center gap-3">
          <Box className="h-10 w-10 items-center justify-center rounded-full bg-brick">
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.white} />
          </Box>
          <VStack className="flex-1 gap-0.5">
            <Text className="text-[15px] font-semibold text-foreground">A controlled research workspace</Text>
            <Text className="text-[12px] leading-[18px] text-muted-foreground">
              Owned by National Museums of Kenya and built for authorised museum teams.
            </Text>
          </VStack>
        </HStack>
        <Text className="text-[12px] leading-[19px] text-muted-foreground">
          Capture → AI-assisted 3D model → researcher verification → curator approval.
          Full collection tools and records are available only after sign-in.
        </Text>
      </VStack>

      <VStack className="gap-3">
        <VStack className="gap-1">
          <Text className="text-[22px] font-bold text-foreground">A glimpse inside</Text>
          <Text className="text-[12px] leading-[18px] text-muted-foreground">
            Two approved previews show what the collection experience can become.
          </Text>
        </VStack>
        {previews.length ? (
          <VStack className="gap-3">
            {previews.map((artefact) => <PreviewCard key={artefact.id} artefact={artefact} />)}
          </VStack>
        ) : (
          <Box className="rounded-[20px] border border-border bg-card p-5">
            <Text className="text-[12px] leading-[18px] text-muted-foreground">
              Curated previews will appear here as approved artefacts are published.
            </Text>
          </Box>
        )}
      </VStack>

      <VStack className="gap-2 pb-2">
        <Button
          label={authLoading ? "Checking access…" : user ? "Open research workspace" : "Discover the workspace"}
          icon={user ? "arrow-forward" : "lock-closed-outline"}
          disabled={authLoading}
          onPress={() => router.replace(user ? "/artefacts" : "/(auth)/login")}
          height={50}
        />
        <Text className="text-center text-[11px] leading-[17px] text-muted-foreground">
          NMK staff sign in with the account issued by their museum administrator.
        </Text>
      </VStack>
    </Screen>
  );
}
