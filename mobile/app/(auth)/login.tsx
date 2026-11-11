import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth";
import { Field } from "../../src/components/ui";
import {
  Container,
  Eyebrow,
  Footer,
  PrimaryAction,
  TopBar,
  TopBarLink,
  useLayout,
} from "../../src/components/public";
import { colors, fonts, lh } from "../../src/theme";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";

const ASSURANCES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: "shield-checkmark-outline", text: "Access is limited to authorised NMK staff." },
  { icon: "git-branch-outline", text: "Every record is verified by a researcher and approved before publication." },
  { icon: "lock-closed-outline", text: "Restricted artefacts stay visible only to people granted access." },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { wide, height } = useLayout();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await signIn(email.trim(), password);
      router.replace("/artefacts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const form = (
    <View style={[styles.formCard, { padding: wide ? 40 : 24 }]}>
      <View style={{ gap: 10 }}>
        <Eyebrow>Researcher sign in</Eyebrow>
        <Text accessibilityRole="header" style={styles.formTitle}>
          Karibu, researcher
        </Text>
        <Text style={styles.formBody}>
          Sign in with the organisation-issued account your museum administrator gave you.
        </Text>
      </View>

      <View style={{ gap: 18, marginTop: 28 }}>
        <Field
          label="Work email"
          placeholder="you@museums.or.ke"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          autoComplete="email"
        />
        <View>
          <Field
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            autoComplete="current-password"
            onSubmitEditing={submit}
            style={{ paddingRight: 38 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            onPress={() => setShowPassword((current) => !current)}
            className="absolute bottom-2 right-2 h-8 w-8 items-center justify-center"
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={19}
              color={colors.muted}
            />
          </Pressable>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.brick} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={{ marginTop: 6 }}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : (
            <PrimaryAction label="Sign in" onPress={submit} full trailing={null} />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/explore")}
          className="items-center py-2"
        >
          <Text style={styles.guest}>Continue as guest</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        minHeight: height,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        justifyContent: "space-between",
      }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <TopBar right={<TopBarLink label="Back to overview" onPress={() => router.replace("/explore")} />} />

      <Container style={{ paddingVertical: wide ? 56 : 20 }}>
        <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 72 : 0, alignItems: wide ? "center" : "stretch" }}>
          {wide ? (
            <View style={{ flex: 1, gap: 24 }}>
              <Eyebrow>HiFadithi research workspace</Eyebrow>
              <Text style={styles.sideTitle}>Verified 3D records of Kenya&apos;s heritage.</Text>
              <View style={{ gap: 16, marginTop: 8 }}>
                {ASSURANCES.map((item) => (
                  <View key={item.text} style={styles.assurance}>
                    <View style={styles.assuranceIcon}>
                      <Ionicons name={item.icon} size={16} color={colors.amber} />
                    </View>
                    <Text style={styles.assuranceText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View style={{ width: "100%", maxWidth: wide ? 460 : undefined, alignSelf: "center" }}>{form}</View>
        </View>
      </Container>

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(245,239,234,0.14)",
  },
  formTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 28, lineHeight: lh(36), letterSpacing: -0.6 },
  formBody: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: lh(21) },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(194,67,57,0.5)",
    backgroundColor: "rgba(125,35,30,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { flex: 1, color: colors.brick, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: lh(18) },
  busy: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brickDark,
  },
  guest: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: lh(18) },
  sideTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 44,
    lineHeight: lh(52),
    letterSpacing: -1.4,
    maxWidth: 520,
  },
  assurance: { flexDirection: "row", alignItems: "center", gap: 14 },
  assuranceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(234,160,0,0.10)",
  },
  assuranceText: {
    flex: 1,
    color: "rgba(245,239,234,0.78)",
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: lh(21),
  },
});
