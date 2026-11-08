import { useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";

import type { ArtifactDraft } from "../src/api";
import { useAuth } from "../src/auth";
import { ArtefactForm } from "../src/components/ArtefactForm";
import { Button, EmptyState, Loading, Screen } from "../src/components/ui";

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

export default function NewArtefactScreen() {
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<Record<string, string>>();

  const initial = useMemo(() => {
    const draft: Partial<ArtifactDraft> = {};
    for (const key of FIELDS) {
      const value = param(params[key]);
      if (value) draft[key] = value;
    }
    return draft;
  }, [params]);

  if (loading) return <Loading label="Checking access…" />;

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Sign in required"
          body="Only signed-in researchers can create artefact records."
          action={<Button label="Sign in" onPress={() => router.push("/(auth)/login")} />}
        />
      </Screen>
    );
  }

  return <ArtefactForm initial={initial} />;
}
