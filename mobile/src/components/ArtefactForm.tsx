import { useMemo, useState } from "react";
import { Alert, Modal, Pressable as RNPressable, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import {
  createArtefact,
  deleteArtefact,
  generate3D,
  saveNarration,
  updateArtefact,
  uploadPhoto,
} from "../api";
import type { Artefact, ArtefactImage, ArtifactDraft, PhotoFile } from "../api";
import { photoFromAsset } from "../photos";
import {
  Button,
  Field,
  PhotoSlot,
  Screen,
  SectionTitle,
  StackHeader,
} from "./ui";
import { colors, fonts, lh } from "../theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

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

export function ArtefactForm({
  artefact,
  initial,
}: {
  artefact?: Artefact | null;
  initial?: Partial<ArtifactDraft>;
}) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [story, setStory] = useState(artefact?.narration?.story_text || "");
  const [language, setLanguage] = useState<"en" | "sw">(
    artefact?.narration?.language === "sw" ? "sw" : "en",
  );
  const [photos, setPhotos] = useState<Record<string, ArtefactImage>>(() => {
    const map: Record<string, ArtefactImage> = {};
    for (const image of artefact?.images || []) map[image.slot] = image;
    return map;
  });
  const [pending, setPending] = useState<Partial<Record<Slot, PhotoFile>>>({});
  const [heightMm, setHeightMm] = useState<string>(artefact?.height_mm || "");
  const [heightOpen, setHeightOpen] = useState(false);
  const [heightDraft, setHeightDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const isNew = !artefact;

  const photoCount = useMemo(() => {
    const keys = new Set([...Object.keys(photos), ...Object.keys(pending)]);
    return keys.size;
  }, [photos, pending]);

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

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
      Alert.alert("Missing details", "Accession number and object name are required.");
      return false;
    }
    return true;
  };

  const persist = async (height: string | null) => {
    const saved = isNew
      ? await createArtefact(payload(height))
      : await updateArtefact(artefact!.id, payload(height));

    for (const slot of SLOTS) {
      const file = pending[slot.key];
      if (file) await uploadPhoto(saved.id, slot.key, file);
    }
    if (Object.keys(pending).length) setPending({});

    if (story.trim()) {
      await saveNarration(saved.id, story.trim(), language);
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
        Alert.alert("Saved", "Artefact details updated.");
      }
    } catch (err) {
      Alert.alert("Could not save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const generate = async (height: string) => {
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
    const height = heightMm.trim() || artefact?.height_mm || "";
    if (!height) {
      setHeightDraft("");
      setHeightOpen(true);
      return;
    }
    generate(height);
  };

  const pickPhoto = async (slot: Slot) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo access to add artefact images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const file = photoFromAsset(result.assets[0]);

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

  const remove = () => {
    if (!artefact) return;
    Alert.alert("Delete artefact?", "This removes the record, photos, model and narration.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteArtefact(artefact.id);
            router.replace("/(tabs)/artefacts");
          } catch (err) {
            Alert.alert("Could not delete", err instanceof Error ? err.message : "Please try again.");
          }
        },
      },
    ]);
  };

  const scan = () => {
    router.push({
      pathname: "/scan",
      params: {
        returnTo: artefact ? `/artefact-record/${artefact.id}` : "/artefact-new",
      },
    });
  };

  return (
    <Screen safe={false} contentStyle={{ gap: 14, paddingTop: 0 }}>
      <StackHeader
        title={isNew ? "New artefact" : "Edit artefact"}
        right={
          <Pressable onPress={saveDraft} accessibilityRole="button" className="px-1 py-1">
            <Text className="text-[12.5px] font-semibold text-muted-foreground">
              {busy === "draft" ? "Saving…" : isNew ? "Save draft" : "Save"}
            </Text>
          </Pressable>
        }
      />

      {/* OCR entry card */}
      <Pressable
        accessibilityRole="button"
        onPress={scan}
        className="flex-row items-center gap-3 rounded-[16px] border border-border bg-card p-3.5"
        style={{ borderStyle: "dashed" }}
      >
        <Box className="h-11 w-11 items-center justify-center rounded-full bg-teal/15">
          <Ionicons name="scan-outline" size={21} color={colors.teal} />
        </Box>
        <VStack className="flex-1 gap-0.5">
          <HStack className="items-center gap-1.5">
            <Text className="text-[14px] font-semibold text-foreground">Scan accession card</Text>
            <Box className="rounded-full bg-elevated px-1.5 py-0.5">
              <Text className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">
                OCR
              </Text>
            </Box>
          </HStack>
          <Text className="text-[11px] leading-[16px] text-muted-foreground">
            Auto-fill details, then verify them.
          </Text>
        </VStack>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>

      {/* Photos */}
      <VStack className="gap-2">
        <HStack className="items-center justify-between">
          <Text className="text-[14px] font-semibold text-foreground">Photos</Text>
          <Text className="text-[10.5px] text-muted-foreground">{photoCount} of 4 photos</Text>
        </HStack>
        <HStack className="gap-2">
          {SLOTS.map((slot) => (
            <PhotoSlot
              key={slot.key}
              label={slot.label}
              uri={photos[slot.key]?.url || pending[slot.key]?.uri}
              busy={busy === `photo:${slot.key}`}
              onPress={() => pickPhoto(slot.key)}
              style={{ flex: 1 }}
            />
          ))}
        </HStack>
        {photoCount < 4 ? (
          <HStack className="items-center gap-1.5">
            <Ionicons name="information-circle-outline" size={13} color={colors.amber} />
            <Text className="text-[10.5px] leading-[15px] text-amber">
              4 photos required to generate 3D model.
            </Text>
          </HStack>
        ) : null}
      </VStack>

      <SectionTitle>Extracted details</SectionTitle>

      <HStack className="gap-3">
        <Box className="flex-1">
          <Field
            label="Accession number"
            placeholder="e.g. HF-00045"
            value={form.accession_number}
            onChangeText={set("accession_number")}
            autoCapitalize="characters"
          />
        </Box>
        <Box className="flex-1">
          <Field
            label="Name"
            placeholder="Artefact name"
            value={form.name}
            onChangeText={set("name")}
          />
        </Box>
      </HStack>

      <HStack className="gap-3">
        <Box className="flex-1">
          <Field
            label="Material"
            placeholder="e.g. Clay"
            value={form.material}
            onChangeText={set("material")}
          />
        </Box>
        <Box className="flex-1">
          <Field
            label="Date or period"
            placeholder="e.g. 19th century"
            value={form.date_or_period}
            onChangeText={set("date_or_period")}
          />
        </Box>
      </HStack>

      <HStack className="gap-3">
        <Box className="flex-1">
          <Field
            label="Provenance"
            placeholder="Place of origin"
            value={form.provenance}
            onChangeText={set("provenance")}
          />
        </Box>
        <Box className="flex-1">
          <Field
            label="Donor"
            placeholder="Donor name"
            value={form.donor}
            onChangeText={set("donor")}
          />
        </Box>
      </HStack>

      <Field
        label="Location"
        placeholder="Museum gallery or storage"
        value={form.location}
        onChangeText={set("location")}
      />

      <Field
        label="Description"
        placeholder="Describe the artefact"
        value={form.description}
        onChangeText={set("description")}
        multiline
      />

      <SectionTitle>Story & narration</SectionTitle>

      <Field
        label="Story to be narrated"
        placeholder="Tell visitors what this object held, who made it and how it was used…"
        value={story}
        onChangeText={setStory}
        multiline
        maxLength={3000}
      />

      <RNPressable
        accessibilityRole="button"
        onPress={() => setLanguage((current) => (current === "en" ? "sw" : "en"))}
        className="flex-row items-center gap-3 rounded-[12px] border border-border bg-elevated px-3 py-3"
      >
        <Ionicons name="language-outline" size={18} color={colors.teal} />
        <Text className="flex-1 text-[13px] text-foreground">Narration language</Text>
        <Text className="text-[12.5px] font-medium text-muted-foreground">
          {language === "sw" ? "Kiswahili" : "English"}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </RNPressable>

      <Button
        label="Generate 3D"
        icon="sparkles-outline"
        onPress={startGenerate}
        loading={busy === "generate"}
        style={{ marginTop: 2 }}
      />

      {!isNew ? (
        <Pressable accessibilityRole="button" onPress={remove} className="items-center py-2">
          <Text className="text-[12px] font-medium text-brick">Delete artefact</Text>
        </Pressable>
      ) : null}

      {/* Height prompt — required by the 3D service but not drawn in the
          mockup, so it only appears when a model is requested. */}
      <Modal
        visible={heightOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHeightOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.65)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 18,
              gap: 12,
            }}
          >
            <HStack className="items-center gap-2">
              <Image
                source={require("../../assets/kit/characters/amani-camera.png")}
                style={{ width: 44, height: 44 }}
                contentFit="contain"
              />
              <VStack className="flex-1">
                <Text
                  className="text-foreground"
                  style={{ fontFamily: fonts.semiBold, fontSize: 17, lineHeight: lh(23) }}
                >
                  Artefact height
                </Text>
                <Text className="text-[11px] leading-[16px] text-muted-foreground">
                  The 3D engine needs a real height in millimetres.
                </Text>
              </VStack>
            </HStack>
            <Field
              label="Height (mm)"
              placeholder="320"
              value={heightDraft}
              onChangeText={setHeightDraft}
              keyboardType="numeric"
              autoFocus
            />
            <HStack className="gap-2">
              <Box className="flex-1">
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => setHeightOpen(false)}
                />
              </Box>
              <Box className="flex-1">
                <Button
                  label="Continue"
                  onPress={() => {
                    const value = heightDraft.trim();
                    if (!value || Number(value) <= 0) {
                      Alert.alert("Height needed", "Enter a positive height in millimetres.");
                      return;
                    }
                    setHeightMm(value);
                    setHeightOpen(false);
                    generate(value);
                  }}
                />
              </Box>
            </HStack>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
