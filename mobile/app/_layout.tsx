import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaListener, SafeAreaProvider } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";

import { AuthProvider } from "../src/auth";
import { colors } from "../src/theme";
import "../src/webAlert"; // web: make Alert.alert work in browsers

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash already dismissed */
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Keys must equal the registered family name (expo-font registers the
    // same key on native and as the @font-face family on web).
    Poppins_400Regular: Poppins_400Regular,
    Poppins_500Medium: Poppins_500Medium,
    Poppins_600SemiBold: Poppins_600SemiBold,
    Poppins_700Bold: Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaListener
      onChange={({ insets }) => {
        Uniwind.updateInsets(insets);
      }}
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <GluestackUIProvider mode="dark">
          <SafeAreaProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  headerTitleStyle: { fontWeight: "700" },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.background },
                  animation: "fade",
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                <Stack.Screen name="scan" options={{ headerShown: false }} />
                <Stack.Screen name="artefact-new" options={{ headerShown: false }} />
                <Stack.Screen name="artefact-record/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="artefact/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="viewer/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="capture/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="processing/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="ready/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="published/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="failed/[id]" options={{ headerShown: false }} />
              </Stack>
            </AuthProvider>
          </SafeAreaProvider>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}
