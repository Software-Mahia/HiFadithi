import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/auth";
import { listPreviewArtefacts } from "../src/api";
import type { ArtefactPreview } from "../src/api";
import {
  Container,
  Eyebrow,
  Footer,
  PrimaryAction,
  TopBar,
  TopBarLink,
  useLayout,
} from "../src/components/public";
import { colors, fonts, lh } from "../src/theme";
import { Text } from "@/components/ui/text";

const CAPABILITIES: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: "camera-outline", title: "Capture artefacts", body: "Four guided photographs of each object, taken in the collection." },
  { icon: "cube-outline", title: "Generate AI-assisted 3D models", body: "A 3D draft is produced from the photographs, ready for review." },
  { icon: "checkmark-done-outline", title: "Verify the models", body: "Researchers compare every model with the real object before it moves on." },
  { icon: "mic-outline", title: "Preserve stories and narration", body: "Community knowledge is recorded alongside the object, with consent." },
  { icon: "ribbon-outline", title: "Submit for approval", body: "Each record is approved before it joins the digital collection." },
];

const WORKFLOW = ["Capture", "AI-assisted 3D model", "Researcher verification", "Final approval"];

function PreviewCard({ artefact }: { artefact: ArtefactPreview }) {
  return (
    <View style={styles.card}>
      <View style={styles.stage}>
        {artefact.cover_image_url ? (
          <Image
            source={{ uri: artefact.cover_image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={250}
            accessibilityLabel={`Photograph of ${artefact.name}`}
          />
        ) : (
          <>
            <View style={styles.plinth} />
            <Image
              source={require("../assets/kit/props/prop-pot.png")}
              style={{ width: 112, height: 112 }}
              contentFit="contain"
              accessibilityLabel="Artefact illustration"
            />
          </>
        )}
        <View style={styles.stageTag}>
          <Text style={styles.stageTagText}>NMK</Text>
        </View>
      </View>
      <View style={{ padding: 18, gap: 6 }}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {artefact.name}
        </Text>
        <Text numberOfLines={1} style={styles.cardMeta}>
          {artefact.material || "Museum artefact"}
        </Text>
        <View style={styles.cardFoot}>
          <View style={styles.dot} />
          <Text style={styles.cardFootText}>
            {artefact.has_model3d ? "Approved preview · 3D model" : "Approved preview"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PreviewPlaceholder() {
  return (
    <View style={[styles.card, { padding: 22, gap: 8, justifyContent: "center", minHeight: 180 }]}>
      <Ionicons name="images-outline" size={22} color={colors.amber} />
      <Text style={styles.cardTitle}>Curated previews</Text>
      <Text style={styles.cardMeta}>
        Approved artefacts appear here as the collection grows.
      </Text>
    </View>
  );
}

export default function ExploreScreen() {
  const { user, loading: authLoading } = useAuth();
  const { wide, medium, height } = useLayout();
  const insets = useSafeAreaInsets();
  const [previews, setPreviews] = useState<ArtefactPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // Capped server-side: the preview endpoint never returns more than two.
    listPreviewArtefacts()
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

  // Never route while the saved session is still being restored.
  const go = () => {
    if (authLoading) return;
    router.replace(user ? "/artefacts" : "/(auth)/login");
  };
  const ctaLabel = authLoading
    ? "Checking access…"
    : user
      ? "Open research workspace"
      : "Discover the workspace";

  const titleSize = wide ? 56 : medium ? 46 : 34;
  const sectionGap = wide ? 96 : 64;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ minHeight: height, paddingTop: insets.top, paddingBottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <TopBar
        right={
          <TopBarLink
            label={authLoading ? "Checking…" : user ? "Workspace" : "Researcher sign in"}
            disabled={authLoading}
            onPress={go}
          />
        }
      />

      {/* Hero: statement on the left, the two approved previews on the right */}
      <Container style={{ paddingTop: wide ? 56 : 28 }}>
        <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 64 : 40 }}>
          <View style={{ flex: wide ? 1.05 : undefined, gap: 22, justifyContent: "center" }}>
            <Eyebrow>The NMK digital collection</Eyebrow>
            <Text
              accessibilityRole="header"
              style={{
                color: colors.text,
                fontFamily: fonts.bold,
                fontSize: titleSize,
                lineHeight: lh(Math.round(titleSize * 1.1)),
                letterSpacing: wide ? -1.8 : -1,
              }}
            >
              From a photograph to a living 3D story.
            </Text>
            <Text style={StyleSheet.flatten([styles.lede, { fontSize: wide ? 17 : 15, lineHeight: lh(wide ? 28 : 24) }])}>
              HiFadithi helps National Museums of Kenya researchers capture artefacts, generate
              AI-assisted 3D models, verify them, preserve their stories and submit them for
              approval.
            </Text>
            <View style={{ gap: 14, paddingTop: 6 }}>
              <PrimaryAction label={ctaLabel} onPress={go} disabled={authLoading} />
              <View style={styles.note}>
                <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
                <Text style={styles.noteText}>
                  NMK researchers sign in with their organisation-issued account.
                </Text>
              </View>
            </View>
          </View>

          <View style={{ flex: wide ? 1 : undefined, gap: 14 }}>
            <Text style={styles.kicker}>A glimpse inside · two approved previews</Text>
            <View style={{ flexDirection: medium ? "row" : "column", gap: 16 }}>
              {loading ? (
                <>
                  <View style={[styles.card, styles.skeleton, medium ? { flex: 1 } : null]} />
                  <View style={[styles.card, styles.skeleton, medium ? { flex: 1 } : null]} />
                </>
              ) : previews.length ? (
                previews.map((artefact) => (
                  <View key={artefact.id} style={medium ? { flex: 1 } : null}>
                    <PreviewCard artefact={artefact} />
                  </View>
                ))
              ) : (
                <View style={medium ? { flex: 1 } : null}>
                  <PreviewPlaceholder />
                </View>
              )}
            </View>
          </View>
        </View>
      </Container>

      {/* Workflow */}
      <Container style={{ paddingTop: sectionGap }}>
        <View style={{ gap: 26 }}>
          <View style={{ gap: 10 }}>
            <Eyebrow color={colors.muted}>How a record is made</Eyebrow>
            <Text style={styles.h2}>Four steps, every one accountable.</Text>
          </View>
          <View style={{ flexDirection: medium ? "row" : "column", gap: 0 }}>
            {WORKFLOW.map((step, index) => (
              <View
                key={step}
                style={[
                  styles.step,
                  medium
                    ? { flex: 1, borderLeftWidth: index === 0 ? 0 : StyleSheet.hairlineWidth, paddingLeft: index === 0 ? 0 : 22 }
                    : { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "baseline", gap: 16 },
                ]}
              >
                <Text style={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={styles.stepTitle}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      </Container>

      {/* Capabilities */}
      <Container style={{ paddingTop: sectionGap }}>
        <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 64 : 28 }}>
          <View style={{ flex: wide ? 0.8 : undefined, gap: 10 }}>
            <Eyebrow color={colors.muted}>What HiFadithi does</Eyebrow>
            <Text style={styles.h2}>Built around the work of museum research.</Text>
          </View>
          <View style={{ flex: wide ? 1.2 : undefined }}>
            {CAPABILITIES.map((item, index) => (
              <View
                key={item.title}
                style={[styles.capability, index === 0 ? { borderTopWidth: StyleSheet.hairlineWidth } : null]}
              >
                <View style={styles.capIcon}>
                  <Ionicons name={item.icon} size={18} color={colors.amber} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.capTitle}>{item.title}</Text>
                  <Text style={styles.capBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Container>

      {/* Ownership */}
      <Container style={{ paddingTop: sectionGap, paddingBottom: sectionGap }}>
        <View style={[styles.band, { flexDirection: wide ? "row" : "column", padding: wide ? 44 : 26 }]}>
          <View style={{ flex: 1, gap: 12 }}>
            <Eyebrow>Ownership</Eyebrow>
            <Text style={StyleSheet.flatten([styles.h2, { fontSize: wide ? 30 : 24, lineHeight: lh(wide ? 38 : 31) }])}>
              Owned by the National Museums of Kenya.
            </Text>
            <Text style={styles.bandBody}>
              Built for authorised NMK researchers and collection teams. Collection
              records, uploads and processing tools are available only after sign-in.
            </Text>
          </View>
          <View style={{ justifyContent: "flex-end", alignItems: wide ? "flex-end" : "flex-start" }}>
            <PrimaryAction label={ctaLabel} onPress={go} disabled={authLoading} />
          </View>
        </View>
      </Container>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lede: { color: "rgba(245,239,234,0.78)", fontFamily: fonts.regular, maxWidth: 560 },
  note: { flexDirection: "row", alignItems: "center", gap: 8 },
  noteText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: lh(18), flexShrink: 1 },
  kicker: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: lh(18), letterSpacing: 0.3 },
  h2: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 28,
    lineHeight: lh(36),
    letterSpacing: -0.6,
    maxWidth: 520,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(245,239,234,0.12)",
    overflow: "hidden",
  },
  skeleton: { height: 300, backgroundColor: colors.elevated, opacity: 0.6 },
  // Light museum stage, matching the 3D viewer's gallery surfaces.
  stage: {
    height: 210,
    backgroundColor: colors.museumLight,
    alignItems: "center",
    justifyContent: "center",
  },
  plinth: {
    position: "absolute",
    bottom: 34,
    width: 150,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.museumFloor,
  },
  stageTag: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(51,44,40,0.9)",
  },
  stageTagText: { color: colors.museumLight, fontFamily: fonts.semiBold, fontSize: 9.5, letterSpacing: 1.4 },
  cardTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 16, lineHeight: lh(22) },
  cardMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: lh(18) },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.amber },
  cardFootText: { color: colors.amber, fontFamily: fonts.medium, fontSize: 11, lineHeight: lh(16), letterSpacing: 0.2 },
  step: { gap: 8, paddingVertical: 14, borderColor: "rgba(245,239,234,0.14)" },
  stepIndex: { color: colors.amber, fontFamily: fonts.semiBold, fontSize: 12, letterSpacing: 1.4 },
  stepTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 17, lineHeight: lh(24), paddingRight: 16 },
  capability: {
    flexDirection: "row",
    gap: 16,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(245,239,234,0.12)",
  },
  capIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(234,160,0,0.10)",
  },
  capTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 15, lineHeight: lh(21) },
  capBody: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: lh(20) },
  band: {
    gap: 24,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(234,160,0,0.28)",
  },
  bandBody: { color: "rgba(245,239,234,0.74)", fontFamily: fonts.regular, fontSize: 14, lineHeight: lh(22), maxWidth: 560 },
});
