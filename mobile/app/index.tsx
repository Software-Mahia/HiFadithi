import { Image } from "expo-image";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Container, Eyebrow, PrimaryAction, TopBar, useLayout } from "../src/components/public";
import { colors, fonts, lh } from "../src/theme";
import { Text } from "@/components/ui/text";

const STEPS: [string, string][] = [
  ["Capture", "Four guided photographs"],
  ["Model", "AI-assisted 3D draft"],
  ["Verify", "Checked against the object"],
  ["Approve", "Released to the collection"],
];

/** Museum welcome screen. Navigation is intentional: the visitor chooses when
 * to leave the welcome experience instead of being redirected after a timer.
 * The page is a single fixed screen (no scrolling): type and spacing scale with
 * the window height so everything fits on short phones and laptop screens. */
export default function Index() {
  const { wide, medium, height } = useLayout();
  const insets = useSafeAreaInsets();

  const enterMuseum = () => {
    router.replace("/explore");
  };

  // Height bands: short (< 700, e.g. iPhone SE / small laptops), regular, tall.
  const short = height < 700;
  const tall = height >= 860;
  const base = wide ? 64 : medium ? 50 : 36;
  const titleSize = short ? Math.round(base * 0.78) : tall ? base : Math.round(base * 0.9);
  const ledeSize = wide ? (short ? 16 : 18) : short ? 14 : 15;
  const blockGap = short ? 14 : wide ? 26 : 20;
  // Two-column step grid on phones takes height; on short phones show titles only.
  const showStepDetail = medium || !short;

  return (
    <View style={styles.root}>
      <Image
        source={require("../assets/nairobi-national-museum.jpg")}
        contentFit="cover"
        transition={300}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Nairobi National Museum entrance"
      />

      {/* Keep one uniform overlay across the full photo. A second partial-height
          overlay creates a visible horizontal opacity boundary on web. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(15, 11, 11, 0.58)" }]} />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        <TopBar light />

        <Container style={{ flexShrink: 1, justifyContent: "center" }}>
          <View style={{ maxWidth: 760, gap: blockGap }}>
            <View style={{ gap: short ? 10 : 14 }}>
              <Eyebrow>Nairobi · Museum Hill</Eyebrow>
              <View style={styles.rule} />
            </View>

            <Text
              accessibilityRole="header"
              style={{
                color: colors.text,
                fontFamily: fonts.bold,
                fontSize: titleSize,
                lineHeight: lh(Math.round(titleSize * 1.08)),
                letterSpacing: wide ? -2 : -1.1,
              }}
            >
              Welcome to the National Museums of Kenya
            </Text>

            <Text
              style={{
                color: "rgba(245,239,234,0.86)",
                fontFamily: fonts.regular,
                fontSize: ledeSize,
                lineHeight: lh(Math.round(ledeSize * 1.62)),
                maxWidth: 580,
              }}
            >
              HiFadithi is the research workspace where NMK researchers and collection teams
              document artefacts as verified, AI-assisted 3D records, together with the stories
              that give them meaning.
            </Text>

            <View style={{ paddingTop: short ? 2 : 6 }}>
              <PrimaryAction
                label="Explore the collection"
                accessibilityLabel="Explore the museum collection"
                onPress={enterMuseum}
              />
            </View>
          </View>
        </Container>

        <Container>
          <View style={[styles.bottomRow, { paddingVertical: short ? 12 : 18 }]}>
            {STEPS.map(([title, body], index) => (
              <View key={title} style={[styles.bottomItem, medium ? { flexBasis: "22%" } : null]}>
                <Text style={styles.bottomIndex}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.bottomTitle}>{title}</Text>
                  {showStepDetail ? <Text style={styles.bottomBody}>{body}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </Container>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.splash },
  rule: { width: 48, height: 1, backgroundColor: colors.amber },
  bottomRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(245,239,234,0.22)",
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    columnGap: 20,
  },
  bottomItem: { flexDirection: "row", gap: 12, flexBasis: "45%", flexGrow: 1 },
  bottomIndex: {
    color: colors.amber,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: lh(18),
    letterSpacing: 1.2,
  },
  bottomTitle: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 13, lineHeight: lh(18) },
  bottomBody: {
    color: "rgba(245,239,234,0.66)",
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: lh(17),
  },
});
