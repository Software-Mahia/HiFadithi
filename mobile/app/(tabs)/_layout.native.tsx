/** Tab layout, native app version. The web version is (tabs)/_layout.tsx.
 * Same routes and order (Gallery · New · Profile, My artefacts hidden under
 * Profile); the bar gains text labels and a raised "New" action for one-handed use. */
import { StyleSheet, Text, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth";
import { TAB_BAR_HEIGHT, Touchable, line } from "../../src/native/kit";
import type { IconName } from "../../src/native/kit";
import { colors, fonts } from "../../src/theme";

function TabItem({
  label,
  icon,
  activeIcon,
  focused,
  onPress,
}: {
  label: string;
  icon: IconName;
  activeIcon: IconName;
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      onPress={onPress}
      haptic={focused ? undefined : "select"}
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      scale={0.94}
      style={styles.item}
    >
      <Ionicons name={focused ? activeIcon : icon} size={23} color={focused ? colors.text : colors.mutedDeep} />
      <Text style={[styles.label, { color: focused ? colors.text : colors.mutedDeep }]}>{label}</Text>
      <View style={[styles.indicator, { opacity: focused ? 1 : 0 }]} />
    </Touchable>
  );
}

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
  const profileFocused = current === "profile" || current === "artefacts";
  const go = (name: string) => {
    const route = state.routes.find((item) => item.name.split("/")[0] === name);
    if (route) navigateToTab(route.key);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={[styles.bar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}>
        <TabItem label="Gallery" icon="images-outline" activeIcon="images" focused={current === "gallery"} onPress={() => go("gallery")} />
        {user ? (
          <Touchable
            onPress={() => router.push("/artefact-new")}
            haptic="tap"
            accessibilityLabel="Add a new artefact"
            scale={0.92}
            style={styles.item}
          >
            <View style={styles.add}>
              <Ionicons name="add" size={26} color={colors.white} />
            </View>
            <Text style={[styles.label, { color: colors.mutedDeep }]}>New</Text>
          </Touchable>
        ) : (
          <View style={styles.item} />
        )}
        <TabItem label="Profile" icon="person-outline" activeIcon="person" focused={profileFocused} onPress={() => go("profile")} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar state={props.state} navigateToTab={props.navigateToTab} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="gallery" />
      <Tabs.Screen name="artefacts" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 8,
    backgroundColor: "rgba(15,11,11,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: line.strong,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "flex-start", gap: 3, minHeight: 48 },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
  indicator: { width: 18, height: 2, borderRadius: 1, backgroundColor: colors.text, marginTop: 1 },
  add: {
    width: 40,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brick,
    marginBottom: -1,
  },
});
