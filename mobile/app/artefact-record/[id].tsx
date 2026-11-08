import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { getArtefact } from "../../src/api";
import type { Artefact, ArtifactDraft } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ArtefactForm } from "../../src/components/ArtefactForm";
import { Button, EmptyState, Loading, Screen } from "../../src/components/ui";

const FIELDS = [
  "accession_number",
  "name",
  "description",
  "material",
  "dimensions",
  "date_or_period",
  "provenance",
  "donor",
  "location",
] as const;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function EditArtefactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const params = useLocalSearchParams<Record<string, string>>();
  const { user } = useAuth();
  const [artefact, setArtefact] = useState<Artefact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
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

  const initial = useMemo(() => {
    const draft: Partial<ArtifactDraft> = {};
    for (const key of FIELDS) {
      const value = param(params[key]);
      if (value) draft[key] = value;
    }
    return draft;
  }, [params]);

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Sign in required"
          body="Researcher tools are only available after sign in."
          action={<Button label="Sign in" onPress={() => router.push("/(auth)/login")} />}
        />
      </Screen>
    );
  }

  if (loading) return <Loading label="Loading record…" />;

  if (!artefact) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Record unavailable"
          body={error || "This artefact could not be found."}
          action={<Button label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />}
        />
      </Screen>
    );
  }

  return <ArtefactForm artefact={artefact} initial={initial} />;
}
