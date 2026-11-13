/** Artefact record form, native app layout. Metro picks this file on Android/iOS;
 * the web keeps ArtefactForm.tsx. The save / upload / narration / generate logic
 * is copied verbatim from ArtefactForm.tsx: keep the two in sync. Only the
 * web-only file-input branch of pickPhoto is omitted (it cannot run natively). */
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { createArtefact, generate3D, getNarration, saveNarration, updateArtefact, uploadPhoto } from "../api";
import type { Artefact, ArtefactImage, ArtifactDraft, PhotoFile } from "../api";
import { photoFromAsset } from "../photos";
import { NButton, NField, NScreen, NavHeader, Notice, SectionHeader, Segmented, Surface, Touchable, line, space, type } from "../native/kit";
import { Sheet } from "../native/sheet";
import { useToast } from "../native/toast";
import { colors, fonts } from "../theme";

const SLOTS = [
  { key: "front", label: "Front" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "back", label: "Back" },
] as const;

type Slot = (typeof SLOTS)[number]["key"];

const EMPTY = {
  accession_number: "",
  name: "",
  description: "",
  material: "",
  dimensions: "",
  date_or_period: "",
  provenance: "",
  donor: "",
  location: "",
};

function PhotoTile({
  label,
  uri,
  busy,
  onPress,
}: {
  label: string;
  uri?: string | null;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable onPress={onPress} accessibilityLabel={`${label} photo${uri ? ", replace" : ", add"}`} style={[styles.tile, uri ? null : styles.tileEmpty]}>
      {uri ? (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.tileLabel}>
            <Ionicons name="checkmark-circle" size={12} color={colors.teal} />
            <Text style={styles.tileLabelText}>{label}</Text>
          </View>
        </>
      ) : (
        <View style={{ alignItems: "center", gap: 6 }}>
          <View style={styles.tileIcon}>
            <Ionicons name="camera-outline" size={20} color={colors.text} />
          </View>
          <Text style={[type.callout, { fontFamily: fonts.semiBold }]}>{label}</Text>
          <Text style={type.caption}>Tap to add</Text>
        </View>
      )}
      {busy ? (
        <View style={styles.tileBusy}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : null}
    </Touchable>
  );
}

export function ArtefactForm({
  artefact,
  initial,
}: {
  artefact?: Artefact | null;
  initial?: Partial<ArtifactDraft>;
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [story, setStory] = useState(artefact?.narration?.story_text || "");
  const [language, setLanguage] = useState<"en" | "sw">(artefact?.narration?.language === "sw" ? "sw" : "en");
  const [photos, setPhotos] = useState<Record<string, ArtefactImage>>(() => {
    const map: Record<string, ArtefactImage> = {};
    for (const image of artefact?.images || []) map[image.slot] = image;
    return map;
  });
  const [pending, setPending] = useState<Partial<Record<Slot, PhotoFile>>>({});
  const [heightMm, setHeightMm] = useState<string>(artefact?.height_mm || "");
  const [narrationStatus, setNarrationStatus] = useState<string | null>(artefact?.narration?.status ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [photoSlot, setPhotoSlot] = useState<Slot | null>(null);
  const toast = useToast();

  const isNew = !artefact;

  const photoCount = useMemo(() => {
    const keys = new Set([...Object.keys(photos), ...Object.keys(pending)]);
    return keys.size;
  }, [photos, pending]);

  const set = (key: keyof typeof EMPTY) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const payload = (height: string | null): ArtifactDraft => ({
    accession_number: form.accession_number.trim(),
    name: form.name.trim(),
    description: form.description,
    material: form.material,
    dimensions: form.dimensions,
    height_mm: height,
    width_mm: artefact?.width_mm ?? null,
    depth_mm: artefact?.depth_mm ?? null,
    date_or_period: form.date_or_period,
    provenance: form.provenance,
    donor: form.donor,
    location: form.location,
  });

  const validate = () => {
    if (!form.accession_number.trim() || !form.name.trim()) {
      toast("Add the accession number and object name first.", "error");
      return false;
    }
    return true;
  };

  /** Narration synthesis is async (Piper runs in the queue worker). Poll the
   * status and surface it inline; transient poll errors just retry. */
  const pollNarration = (artefactId: string) => {
    const stepMs = 2500;
    const maxMs = 90_000;
    const started = Date.now();
    const tick = async () => {
      try {
        const narration = await getNarration(artefactId);
        setNarrationStatus(narration.status);
        if (narration.status === "ready") {
          toast("Story audio is ready");
          return;
        }
        if (narration.status === "failed") {
          Alert.alert("Narration failed", narration.error || "The story could not be synthesised.");
          return;
        }
      } catch {
        // transient poll failure; retry within the window
      }
      if (Date.now() - started < maxMs) setTimeout(tick, stepMs);
    };
    setTimeout(tick, stepMs);
  };

  const persist = async (height: string | null) => {
    const saved = isNew ? await createArtefact(payload(height)) : await updateArtefact(artefact!.id, payload(height));

    await Promise.all(
      SLOTS.map((slot) => {
        const file = pending[slot.key];
        return file ? uploadPhoto(saved.id, slot.key, file) : Promise.resolve();
      }),
    );
    if (Object.keys(pending).length) setPending({});

    if (story.trim()) {
      const narration = await saveNarration(saved.id, story.trim(), language);
      setNarrationStatus(narration.status);
      if (narration.status === "generating") pollNarration(saved.id);
    }
    return saved;
  };

  const saveDraft = async () => {
    if (!validate()) return;
    setBusy("draft");
    try {
      const saved = await persist(heightMm.trim() || artefact?.height_mm || null);
      if (isNew) {
        router.replace(`/artefact-record/${saved.id}`);
      } else {
        setPhotos((current) => {
          const next = { ...current };
          for (const image of saved.images || []) next[image.slot] = image;
          return next;
        });
        toast("Artefact details saved");
      }
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const generate = async (height: string | null) => {
    setBusy("generate");
    try {
      const saved = await persist(height);
      if (photoCount < 4) {
        router.replace({
          pathname: `/capture/${saved.id}`,
          params: { next: "processing", back: isNew ? "edit" : "edit" },
        });
        return;
      }
      await generate3D(saved.id);
      router.replace(`/processing/${saved.id}`);
    } catch (err) {
      Alert.alert("Could not generate", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const startGenerate = () => {
    if (!validate()) return;
    const height = heightMm.trim() || artefact?.height_mm || null;
    generate(height);
  };

  const pickPhoto = (slot: Slot) => {
    // Native action sheet: the researcher can take a fresh photo or pick one.
    const library = async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access to add artefact images.");
        return;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (!picked.canceled && picked.assets[0]) acceptPhoto(slot, photoFromAsset(picked.assets[0]));
    };

    const camera = async () => {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Camera access needed", "Allow camera access to photograph artefacts.");
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
      if (!shot.canceled && shot.assets[0]) acceptPhoto(slot, photoFromAsset(shot.assets[0]));
    };

    return { camera, library };
  };

  const choosePhoto = (slot: Slot) => setPhotoSlot(slot);

  const acceptPhoto = async (slot: Slot, file: PhotoFile) => {
    if (isNew) {
      setPending((current) => ({ ...current, [slot]: file }));
      return;
    }

    setBusy(`photo:${slot}`);
    try {
      const image = await uploadPhoto(artefact!.id, slot, file);
      setPhotos((current) => ({ ...current, [slot]: image }));
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const scan = () => {
    router.push({
      pathname: "/scan",
      params: { returnTo: artefact ? `/artefact-record/${artefact.id}` : "/artefact-new" },
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <NScreen
        keyboard
        footer={
          <>
            <NButton
              label={photoCount < 4 ? "Continue to photos" : "Generate 3D model"}
              icon={photoCount < 4 ? "camera-outline" : "sparkles-outline"}
              onPress={startGenerate}
              loading={busy === "generate"}
            />
            <Text style={[type.caption, { textAlign: "center" }]}>
              {photoCount} of 4 photos · accession number and name are required
            </Text>
          </>
        }
      >
        <NavHeader
          title={isNew ? "New artefact" : "Edit artefact"}
          subtitle={artefact?.accession_number}
          right={
            <Touchable onPress={saveDraft} accessibilityLabel={isNew ? "Save draft" : "Save"} style={{ paddingVertical: 8 }}>
              <Text style={{ fontFamily: fonts.semiBold, fontSize: 14, color: colors.text }}>
                {busy === "draft" ? "Saving…" : isNew ? "Save draft" : "Save"}
              </Text>
            </Touchable>
          }
        />

        {/* OCR entry */}
        <Touchable onPress={scan} accessibilityLabel="Scan accession card" style={styles.scan}>
          <View style={styles.scanIcon}>
            <Ionicons name="scan-outline" size={22} color={colors.teal} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.callout, { fontFamily: fonts.semiBold }]}>Scan accession card</Text>
            <Text style={type.footnote}>Auto-fill the details, then verify them.</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.mutedDeep} />
        </Touchable>

        <SectionHeader title="Photographs" action={<Text style={type.caption}>{photoCount} of 4</Text>} />
        <View style={styles.grid}>
          {SLOTS.map((slot) => (
            <View key={slot.key} style={styles.cell}>
              <PhotoTile
                label={slot.label}
                uri={photos[slot.key]?.url || pending[slot.key]?.uri}
                busy={busy === `photo:${slot.key}`}
                onPress={() => choosePhoto(slot.key)}
              />
            </View>
          ))}
        </View>
        {photoCount < 4 ? (
          <View style={{ marginTop: space.md }}>
            <Notice tone="warn">Four photos (front, left, right, back) are required to generate the 3D model.</Notice>
          </View>
        ) : null}

        <SectionHeader title="Record details" />
        <View style={{ gap: space.lg }}>
          <NField label="Accession number *" placeholder="e.g. HF-00045" value={form.accession_number} onChangeText={set("accession_number")} autoCapitalize="characters" />
          <NField label="Object name *" placeholder="Artefact name" value={form.name} onChangeText={set("name")} />
          <NField label="Material" placeholder="e.g. Clay" value={form.material} onChangeText={set("material")} />
          <NField label="Date or period" placeholder="e.g. 19th century" value={form.date_or_period} onChangeText={set("date_or_period")} />
          <NField label="Provenance" placeholder="Place of origin" value={form.provenance} onChangeText={set("provenance")} />
          <NField label="Donor" placeholder="Donor name" value={form.donor} onChangeText={set("donor")} />
          <NField label="Location" placeholder="Museum gallery or storage" value={form.location} onChangeText={set("location")} />
          <NField
            label="Height (mm)"
            hint="Used to scale the 3D model. Needed before generating."
            placeholder="e.g. 320"
            value={heightMm}
            onChangeText={setHeightMm}
            keyboardType="numeric"
          />
          <NField label="Description" placeholder="Describe the artefact" value={form.description} onChangeText={set("description")} multiline />
        </View>

        <SectionHeader title="Story and narration" />
        <Surface style={{ gap: space.lg }}>
          <NField
            label="Story to be narrated"
            placeholder="Tell visitors what this object held, who made it and how it was used…"
            value={story}
            onChangeText={setStory}
            multiline
            maxLength={3000}
          />
          <View style={{ gap: 6 }}>
            <Text style={[type.caption, { letterSpacing: 0.3 }]}>Narration language</Text>
            <Segmented
              options={[
                { label: "English", value: "en" },
                { label: "Kiswahili", value: "sw" },
              ]}
              value={language}
              onChange={setLanguage}
            />
          </View>
          {narrationStatus === "generating" ? (
            <Notice tone="warn" icon="volume-high-outline">
              Synthesising narration — hang on a few seconds…
            </Notice>
          ) : narrationStatus === "ready" ? (
            <Notice tone="success">Story audio is ready and saved with the record.</Notice>
          ) : narrationStatus === "failed" ? (
            <Notice tone="error">Narration failed — edit the story and save again.</Notice>
          ) : null}
        </Surface>
      </NScreen>

      <Sheet
        visible={Boolean(photoSlot)}
        onClose={() => setPhotoSlot(null)}
        title={photoSlot ? `${SLOTS.find((slot) => slot.key === photoSlot)?.label} photo` : undefined}
        message="Photograph the whole object, level with it, on a plain background."
        actions={
          photoSlot
            ? [
                { label: "Take photo", icon: "camera-outline", onPress: () => pickPhoto(photoSlot).camera() },
                { label: "Choose from library", icon: "images-outline", onPress: () => pickPhoto(photoSlot).library() },
              ]
            : []
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scan: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(0,180,194,0.45)",
  },
  scanIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,180,194,0.12)" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.md },
  cell: { width: "48.5%" },
  tile: {
    aspectRatio: 1,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  tileEmpty: { borderWidth: 1, borderStyle: "dashed", borderColor: line.strong },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.elevated },
  tileLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(15,11,11,0.75)",
  },
  tileLabelText: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.text },
  tileBusy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,8,8,0.65)" },
});
