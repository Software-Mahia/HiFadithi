import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { getArtefact, getPublicArtefact, publicModelUrl } from "../../src/api";
import type { Artefact } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ModelViewer } from "../../src/components/ModelViewer";
import { Button, EmptyState, Loading, Screen, StackHeader } from "../../src/components/ui";
import { VStack } from "@/components/ui/vstack";

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

  if (loading) return <Loading label="Preparing 3D model…" />;

  if (!artefact?.model3d) {
    return (
      <Screen>
        <EmptyState
          icon="cube-outline"
          title="No model available"
          body={error || "This artefact does not have a 3D model yet."}
          action={
            <Button
              label="Back to gallery"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)/gallery")
              }
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen safe={false} scroll={false} contentStyle={{ paddingTop: 0, gap: 12 }}>
      <StackHeader title={artefact.name} subtitle={artefact.accession_number} />
      <VStack className="flex-1 pb-2">
        <ModelViewer
          glbUrl={
            artefact.status === "published"
              ? publicModelUrl(artefact.id)
              : artefact.model3d.glb_url
          }
          style={{ flex: 1, height: undefined }}
        />
      </VStack>
    </Screen>
  );
}
