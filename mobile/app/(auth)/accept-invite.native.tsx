/** Accept-invite (set first password), native app layout. Web: accept-invite.tsx.
 * Logic is identical: preview the invite, set the password, then go to sign-in. */
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { acceptInvite, invitePreview } from "../../src/api";
import { BrandChip, NButton, NField, NLoading, NScreen, Notice, Touchable, space, type } from "../../src/native/kit";
import { colors } from "../../src/theme";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default function AcceptInviteScreen() {
  const params = useLocalSearchParams<{ uid?: string | string[]; token?: string | string[] }>();
  const uid = firstParam(params.uid);
  const token = firstParam(params.token);

  const [checking, setChecking] = useState(true);
  const [invitee, setInvitee] = useState<{ email: string; full_name: string } | null>(null);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!uid || !token) {
        if (active) {
          setLinkError("This invite link is incomplete. Ask your admin to send it again.");
          setChecking(false);
        }
        return;
      }
      try {
        const preview = await invitePreview(uid, token);
        if (active) setInvitee(preview);
      } catch (err) {
        if (active) setLinkError(err instanceof Error ? err.message : "This invite link is invalid or has expired.");
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [uid, token]);

  const submit = async () => {
    if (!password || !confirm) {
      setError("Enter and confirm your new password.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await acceptInvite(uid, token, password);
      router.replace("/(auth)/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set your password.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <NLoading label="Checking your invite…" />;

  const eye = (
    <Touchable
      onPress={() => setShowPassword((current) => !current)}
      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
      style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", marginRight: -8 }}
    >
      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={19} color={colors.muted} />
    </Touchable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <NScreen
        keyboard
        footer={
          linkError ? (
            <NButton label="Go to sign in" onPress={() => router.replace("/(auth)/login")} />
          ) : (
            <NButton label="Set password and continue" onPress={submit} loading={busy} />
          )
        }
      >
        <View style={{ minHeight: 44, justifyContent: "center" }}>
          <BrandChip height={26} />
        </View>

        <View style={{ marginTop: space.huge, gap: space.sm }}>
          <Text style={type.overline}>Set up your account</Text>
          <Text accessibilityRole="header" style={type.title1}>
            {linkError ? "Invite link problem" : `Karibu${invitee?.full_name ? `, ${invitee.full_name}` : ""}`}
          </Text>
          {linkError ? null : (
            <Text style={type.subhead}>
              Choose a password for {invitee?.email || "your account"}. You will sign in with your email and this
              password.
            </Text>
          )}
        </View>

        {linkError ? (
          <View style={{ marginTop: space.xxl }}>
            <Notice tone="error">{linkError}</Notice>
          </View>
        ) : (
          <View style={{ marginTop: space.xxxl, gap: space.lg }}>
            <NField
              label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              trailing={eye}
            />
            <NField
              label="Confirm password"
              placeholder="Repeat the password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {error ? <Notice tone="error">{error}</Notice> : null}
          </View>
        )}
      </NScreen>
    </KeyboardAvoidingView>
  );
}
