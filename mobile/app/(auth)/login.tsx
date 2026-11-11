import { useState } from "react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/auth";
import { Button, Field, Screen } from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
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
    <Screen bottomPad={28} contentStyle={{ gap: 0 }} keyboardAdjust>
      {/* Brand lock-up — kept compact so inputs stay above the keyboard */}
      <VStack className="items-center gap-1 pt-1" style={{ marginTop: 48 }}>
        <HStack className="items-center justify-center gap-2">
          <Image
            source={require("../../assets/kit/brand/logo-drum.png")}
            style={{ width: 30, height: 30 }}
            contentFit="contain"
          />
          <Text
            className="text-foreground"
            style={{ fontFamily: fonts.bold, fontSize: 27, lineHeight: lh(34), letterSpacing: -0.5 }}
          >
            HiFadithi
          </Text>
        </HStack>
        <Text className="text-[10.5px] leading-[15px] text-muted-foreground">
          Stories behind every artefact
        </Text>
      </VStack>

      {/* Amani with the accession card */}
      <Image
        source={require("../../assets/kit/characters/amani-scan-card.png")}
        style={{ width: 128, height: 128, alignSelf: "center", marginTop: 24 }}
        contentFit="contain"
      />

      <Text
        className="mt-[14px] text-foreground"
        style={{ fontFamily: fonts.bold, fontSize: 28, lineHeight: lh(36), letterSpacing: -0.5 }}
      >
        Karibu, researcher
      </Text>
      <Text className="mt-[16px] max-w-[330px] text-[13px] leading-[20px] text-muted-foreground">
        Sign in with the account your museum gave you.
      </Text>

      <VStack className="mt-[36px] gap-4">
        <Field
          label="Email"
          placeholder="you@museum.or.ke"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
        />
        <VStack>
          <Field
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            onSubmitEditing={submit}
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

        {error ? (
          <HStack className="items-center gap-2 rounded-[12px] border border-deepred/60 bg-deepred/20 px-3 py-2">
            <Ionicons name="alert-circle-outline" size={16} color={colors.brick} />
            <Text className="flex-1 text-[12px] leading-[18px] text-brick">{error}</Text>
          </HStack>
        ) : null}

        <Button label="Sign in" onPress={submit} loading={busy} style={{ marginTop: 16 }} height={48} />
      </VStack>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/explore")}
        className="mt-[8px] items-center py-2"
      >
        <Text className="text-[13px] font-medium text-muted-foreground">Continue as guest</Text>
      </Pressable>
    </Screen>
  );
}
