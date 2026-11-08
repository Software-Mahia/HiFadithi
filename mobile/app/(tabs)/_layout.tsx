import { StyleSheet } from "react-native";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";
import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";

type TabSpec = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

// Only Gallery and Profile are tabs. My artefacts is reached from Profile
// (and keeps the bottom bar visible via a hidden tab route).
const TABS: TabSpec[] = [
  { name: "gallery", label: "Gallery", icon: "images-outline", activeIcon: "images" },
  { name: "profile", label: "Profile", icon: "person-outline", activeIcon: "person" },
];

/** X-style flat bottom bar: icon-only, full-bleed, no pill or labels.
 * Slot order: Gallery · (+ researchers only) · Profile. */
function BottomTabBar({
  state,
  navigateToTab,
}: {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const current = (state.routes[state.index]?.name ?? "").split("/")[0];
  // The hidden My artefacts route belongs to the Profile side of the app.
  const profileFocused = current === "profile" || current === "artefacts";

  const routeFor = (name: string) =>
    state.routes.find((route) => route.name.split("/")[0] === name);

  const go = (name: string) => {
    const route = routeFor(name);
    if (route) navigateToTab(route.key);
  };

  const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

  const tabButton = (tab: TabSpec, focused: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : undefined}
      accessibilityLabel={tab.label}
      onPress={onPress}
      hitSlop={hitSlop}
      className="h-12 flex-1 items-center justify-center"
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
    >
      <Ionicons
        name={focused ? tab.activeIcon : tab.icon}
        size={24}
        color={focused ? colors.brick : colors.muted}
      />
    </Pressable>
  );

  return (
    // box-none: the full-width wrapper never eats taps — only its buttons do.
    <View pointerEvents="box-none" style={styles.barWrap}>
      <View
        style={[
          styles.bar,
          { height: 52 + insets.bottom, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.row}>
          {tabButton(TABS[0], current === "gallery", () => go("gallery"))}

          {user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a new artefact"
              onPress={() => router.push("/artefact-new")}
              hitSlop={hitSlop}
              className="h-12 flex-1 items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Box
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.brick }}
              >
                <Ionicons name="add" size={24} color={colors.white} />
              </Box>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {tabButton(TABS[1], profileFocused, () => go("profile"))}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => (
        <BottomTabBar state={props.state} navigateToTab={props.navigateToTab} />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.brick,
      }}
    >
      <Tabs.Screen name="gallery" />
      <Tabs.Screen name="artefacts" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    backgroundColor: "#0F0B0B",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.elevated,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 12,
  },
});
