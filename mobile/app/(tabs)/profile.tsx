import { Alert } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/auth";
import { BrandHeader, Button, Card, Screen } from "../../src/components/ui";
import { colors, fonts, lh } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

function ProfileRow({
  icon,
  label,
  value,
  onPress,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: "default" | "brick";
}) {
  const color = tone === "brick" ? colors.brick : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border/70 py-3.5 last:border-b-0"
    >
      <Box className="h-8 w-8 items-center justify-center rounded-full bg-elevated">
        <Ionicons name={icon} size={16} color={tone === "brick" ? colors.brick : colors.muted} />
      </Box>
      <Text className="flex-1 text-[13.5px] font-medium" style={{ color }}>
        {label}
      </Text>
      {value ? <Text className="text-[12px] text-muted-foreground">{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const logout = () => {
    Alert.alert("Sign out?", "You can sign back in at any time.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(tabs)/gallery");
        },
      },
    ]);
  };

  const about = () => {
    Alert.alert(
      "About HiFadithi",
      "HiFadithi helps museum researchers record artefacts, build 3D models and share narrated stories with guests.",
    );
  };

  return (
    <Screen contentStyle={{ gap: 14 }}>
      <BrandHeader />

      <Text
        className="mt-2 text-foreground"
        style={{ fontFamily: fonts.bold, fontSize: 27, lineHeight: lh(34), letterSpacing: -0.5 }}
      >
        Profile
      </Text>

      {user ? (
        <>
          <Card className="gap-3">
            <HStack className="items-center gap-3.5">
              <Image
                source={require("../../assets/kit/extras/avatar-researcher-female.png")}
                style={{ width: 64, height: 64, borderRadius: 32 }}
                contentFit="cover"
              />
              <VStack className="flex-1 gap-0.5">
                <Text
                  className="text-foreground"
                  style={{ fontFamily: fonts.semiBold, fontSize: 17, lineHeight: lh(23) }}
                  numberOfLines={1}
                >
                  {user.display_name}
                </Text>
                <Text className="text-[12px] leading-[17px] text-muted-foreground">
                  {user.role === "admin" ? "Museum Administrator" : "Museum Researcher"}
                </Text>
                <Text className="text-[11.5px] leading-[16px] text-muted-foreground">
                  {user.email || user.username}
                </Text>
              </VStack>
            </HStack>
            <HStack className="items-center gap-1.5 border-t border-border/70 pt-2.5">
              <Ionicons name="checkmark-circle" size={14} color={colors.teal} />
              <Text className="text-[11px] font-medium text-teal">
                Signed in as {user.role === "admin" ? "administrator" : "researcher"}
              </Text>
            </HStack>
          </Card>

          <Card className="gap-0 py-1">
            <ProfileRow
              icon="folder-open-outline"
              label="My artefacts"
              onPress={() => router.push("/(tabs)/artefacts")}
            />
            <ProfileRow
              icon="language-outline"
              label="Language"
              value="English"
              onPress={() =>
                Alert.alert("Language", "The interface is English. Narrations can be written in English or Kiswahili.")
              }
            />
            <ProfileRow icon="information-circle-outline" label="About HiFadithi" onPress={about} />
          </Card>

          <Pressable
            accessibilityRole="button"
            onPress={logout}
            className="mt-1 flex-row items-center justify-center gap-2 rounded-[14px] border border-brick/60 py-3.5"
          >
            <Ionicons name="log-out-outline" size={18} color={colors.brick} />
            <Text className="text-[14px] font-semibold text-brick">Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Image
            source={require("../../assets/kit/characters/juma-explorer.png")}
            style={{ width: 168, height: 168, alignSelf: "center", marginTop: 4 }}
            contentFit="contain"
          />

          <Card className="gap-2.5">
            <Text
              className="text-foreground"
              style={{ fontFamily: fonts.semiBold, fontSize: 19, lineHeight: lh(25) }}
            >
              Are you a researcher?
            </Text>
            <Text className="text-[12.5px] leading-[19px] text-muted-foreground">
              Sign in to scan accession cards and manage artefacts.
            </Text>
            <Button
              label="Sign in"
              icon="log-in-outline"
              onPress={() => router.push("/(auth)/login")}
              style={{ marginTop: 4 }}
            />
          </Card>

          <Card className="gap-0 py-1">
            <ProfileRow
              icon="language-outline"
              label="Language"
              value="English"
              onPress={() =>
                Alert.alert("Language", "The interface is English. Narrations can be written in English or Kiswahili.")
              }
            />
            <ProfileRow icon="information-circle-outline" label="About HiFadithi" onPress={about} />
          </Card>
        </>
      )}
    </Screen>
  );
}
