/** Researcher sign-in, native app layout. The web version is login.tsx.
 * Same logic: signIn() then /artefacts; "Continue as guest" goes to /explore. */
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/auth";
import { BrandChip, NButton, NField, NScreen, Notice, Touchable, space, type } from "../../src/native/kit";
import { colors } from "../../src/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <NScreen
        keyboard
        footer={
          <>
            <NButton label="Sign in" onPress={submit} loading={busy} />
            <Touchable onPress={() => router.replace("/explore")} accessibilityLabel="Continue as guest" style={{ alignItems: "center", paddingVertical: space.sm }}>
              <Text style={[type.callout, { color: colors.muted }]}>Continue as guest</Text>
            </Touchable>
          </>
        }
      >
        <View style={{ minHeight: 44, justifyContent: "center" }}>
          <BrandChip height={26} />
        </View>

        <View style={{ marginTop: space.huge, gap: space.sm }}>
          <Text style={type.overline}>Researcher sign in</Text>
          <Text accessibilityRole="header" style={type.title1}>
            Karibu, researcher
          </Text>
          <Text style={type.subhead}>
            Sign in with the organisation-issued account your museum administrator gave you.
          </Text>
        </View>

        <View style={{ marginTop: space.xxxl, gap: space.lg }}>
          <NField
            label="Work email"
            placeholder="you@museums.or.ke"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
          />
          <NField
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submit}
            trailing={
              <Touchable
                onPress={() => setShowPassword((current) => !current)}
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginRight: -8 }}
              >
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={19} color={colors.muted} />
              </Touchable>
            }
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
        </View>

        <View style={{ marginTop: space.xxl, gap: space.md }}>
          {[
            { icon: "shield-checkmark-outline" as const, text: "Access is limited to authorised NMK staff." },
            { icon: "lock-closed-outline" as const, text: "Restricted artefacts stay visible only to people granted access." },
          ].map((item) => (
            <View key={item.text} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Ionicons name={item.icon} size={15} color={colors.muted} />
              <Text style={[type.footnote, { flex: 1 }]}>{item.text}</Text>
            </View>
          ))}
        </View>
      </NScreen>
    </KeyboardAvoidingView>
  );
}
