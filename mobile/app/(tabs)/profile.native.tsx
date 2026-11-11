/** Profile, native app layout. The web version is profile.tsx.
 * Same actions (My artefacts, language note, about, sign out), shown as
 * native bottom sheets instead of alert dialogs. */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../../src/auth";
import { GUTTER, ListGroup, ListRow, NButton, SectionHeader, TabScreen, space, type } from "../../src/native/kit";
import { Sheet } from "../../src/native/sheet";
import { colors } from "../../src/theme";

type Panel = null | "signout" | "about" | "language";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);

  const roleLabel = user?.role === "admin" ? "Museum Administrator" : "Museum Researcher";

  return (
    <>
      <TabScreen title="Profile">
        <View style={{ paddingHorizontal: GUTTER }}>
          {user ? (
            <>
              <View style={styles.identity}>
                <Image source={require("../../assets/kit/extras/avatar-researcher-female.png")} style={styles.avatar} contentFit="cover" />
                <Text numberOfLines={1} style={[type.title2, { textAlign: "center" }]}>
                  {user.display_name}
                </Text>
                <Text style={[type.subhead, { textAlign: "center" }]}>{user.email || user.username}</Text>
                <View style={styles.role}>
                  <Ionicons name="shield-checkmark" size={13} color={colors.teal} />
                  <Text style={[type.caption, { color: colors.teal }]}>
                    {roleLabel}
                    {user.department ? ` · ${user.department}` : ""}
                  </Text>
                </View>
              </View>

              <SectionHeader title="Workspace" />
              <ListGroup>
                <ListRow icon="folder-open-outline" label="My artefacts" onPress={() => router.push("/(tabs)/artefacts")} />
                <ListRow icon="add-circle-outline" label="New artefact" onPress={() => router.push("/artefact-new")} last />
              </ListGroup>

              <SectionHeader title="App" />
              <ListGroup>
                <ListRow icon="language-outline" label="Language" value="English" onPress={() => setPanel("language")} />
                <ListRow icon="information-circle-outline" label="About HiFadithi" onPress={() => setPanel("about")} last />
              </ListGroup>

              <ListGroup style={{ marginTop: space.xxl }}>
                <ListRow icon="log-out-outline" tone="danger" label="Sign out" onPress={() => setPanel("signout")} last />
              </ListGroup>
            </>
          ) : (
            <>
              <View style={[styles.identity, { gap: space.md }]}>
                <Text style={type.title2}>Are you a researcher?</Text>
                <Text style={[type.subhead, { textAlign: "center" }]}>Sign in to scan accession cards and manage artefacts.</Text>
                <NButton label="Sign in" icon="log-in-outline" onPress={() => router.push("/(auth)/login")} style={{ alignSelf: "stretch", marginTop: space.sm }} />
              </View>
              <SectionHeader title="App" />
              <ListGroup>
                <ListRow icon="language-outline" label="Language" value="English" onPress={() => setPanel("language")} />
                <ListRow icon="information-circle-outline" label="About HiFadithi" onPress={() => setPanel("about")} last />
              </ListGroup>
            </>
          )}
          <Text style={[type.caption, { textAlign: "center", marginTop: space.xxl }]}>HiFadithi · National Museums of Kenya</Text>
        </View>
      </TabScreen>

      <Sheet
        visible={panel === "signout"}
        onClose={close}
        title="Sign out?"
        message="You can sign back in at any time with your organisation-issued account."
        actions={[
          {
            label: "Sign out",
            icon: "log-out-outline",
            tone: "danger",
            onPress: async () => {
              await signOut();
              router.replace("/(tabs)/gallery");
            },
          },
        ]}
      />
      <Sheet
        visible={panel === "about"}
        onClose={close}
        title="About HiFadithi"
        message="HiFadithi helps National Museums of Kenya researchers record artefacts, build AI-assisted 3D models and preserve the stories behind them."
      />
      <Sheet
        visible={panel === "language"}
        onClose={close}
        title="Language"
        message="The interface is in English. Narrations can be written in English or Kiswahili."
      />
    </>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", gap: 4, paddingVertical: space.lg },
  avatar: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: "rgba(245,239,234,0.25)", marginBottom: space.md },
  role: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,180,194,0.10)",
  },
});
