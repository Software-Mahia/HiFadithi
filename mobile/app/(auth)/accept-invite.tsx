import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { acceptInvite, invitePreview } from "../../src/api";
import { Button, Field, Screen } from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

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

  return (
    <Screen bottomPad={28} contentStyle={{ gap: 0 }} keyboardAdjust>
      <VStack className="items-center gap-1 pt-1" style={{ marginTop: 56 }}>
        <Text
          className="text-foreground"
          style={{ fontFamily: fonts.bold, fontSize: 27, lineHeight: lh(34), letterSpacing: -0.5 }}
        >
          HiFadithi
        </Text>
        <Text className="text-[10.5px] leading-[15px] text-muted-foreground">
          Set up your account
        </Text>
      </VStack>

      {checking ? (
        <Text className="mt-[48px] text-center text-[13px] text-muted-foreground">
          Checking your invite…
        </Text>
      ) : linkError ? (
        <VStack className="mt-[40px] gap-4">
          <HStack className="items-center gap-2 rounded-[12px] border border-deepred/60 bg-deepred/20 px-3 py-2">
            <Ionicons name="alert-circle-outline" size={16} color={colors.brick} />
            <Text className="flex-1 text-[12px] leading-[18px] text-brick">{linkError}</Text>
          </HStack>
          <Button label="Go to sign in" onPress={() => router.replace("/(auth)/login")} height={48} />
        </VStack>
      ) : (
        <>
          <Text
            className="mt-[28px] text-foreground"
            style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: lh(34), letterSpacing: -0.5 }}
          >
            Karibu{invitee?.full_name ? `, ${invitee.full_name}` : ""}
          </Text>
          <Text className="mt-[16px] max-w-[330px] text-[13px] leading-[20px] text-muted-foreground">
            Choose a password for {invitee?.email || "your account"}. You will sign in with your
            email and this password.
          </Text>

          <VStack className="mt-[32px] gap-4">
            <VStack>
              <Field
                label="New password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                style={{ paddingRight: 38 }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                onPress={() => setShowPassword((current) => !current)}
                className="absolute bottom-3 right-3 h-8 w-8 items-center justify-center"
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={19}
                  color={colors.muted}
                />
              </Pressable>
            </VStack>
            <Field
              label="Confirm password"
              placeholder="••••••••"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              onSubmitEditing={submit}
            />

            {error ? (
              <HStack className="items-center gap-2 rounded-[12px] border border-deepred/60 bg-deepred/20 px-3 py-2">
                <Ionicons name="alert-circle-outline" size={16} color={colors.brick} />
                <Text className="flex-1 text-[12px] leading-[18px] text-brick">{error}</Text>
              </HStack>
            ) : null}

            <Button
              label="Set password & continue"
              onPress={submit}
              loading={busy}
              style={{ marginTop: 16 }}
              height={48}
            />
          </VStack>
        </>
      )}
    </Screen>
  );
}
