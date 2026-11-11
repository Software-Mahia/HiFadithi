/** Native shell for artefact-record/[id].tsx (same logic); the form itself resolves to
 * src/components/ArtefactForm.native.tsx on Android/iOS. */
import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { getArtefact } from "../../src/api";
import type { Artefact, ArtifactDraft } from "../../src/api";
import { useAuth } from "../../src/auth";
import { ArtefactForm } from "../../src/components/ArtefactForm";
import { NButton, NLoading, NStateScreen } from "../../src/native/kit";

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
      <NStateScreen
        icon="lock-closed-outline"
        title="Sign in required"
        body="Researcher tools are only available after sign in."
        action={<NButton label="Sign in" onPress={() => router.push("/(auth)/login")} />}
      />
    );
  }

  if (loading) return <NLoading label="Loading record…" />;

  if (!artefact) {
    return (
      <NStateScreen
        icon="alert-circle-outline"
        title="Record unavailable"
        body={error || "This artefact could not be found."}
        action={<NButton label="Back to my artefacts" onPress={() => router.replace("/(tabs)/artefacts")} />}
      />
    );
  }

  return <ArtefactForm artefact={artefact} initial={initial} />;
}
