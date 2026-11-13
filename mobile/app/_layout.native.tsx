/** Root layout, native app version. The web keeps app/_layout.tsx unchanged.
 *
 * Same providers, fonts and splash handling as the web layout. The difference is
 * navigation that behaves like a native app instead of cross-fading pages:
 * push from the side with swipe-back, forms and the camera slide up as modals,
 * plus the toast host used by native screens. */
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_500Medium_Italic,
  PlayfairDisplay_600SemiBold,
} from "@expo-google-fonts/playfair-display";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaListener, SafeAreaProvider } from "react-native-safe-area-context";
import { Uniwind } from "uniwind";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import "@/global.css";

import { AuthProvider } from "../src/auth";
import { ToastHost } from "../src/native/toast";
import { colors } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {
  /* splash already dismissed */
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular: Poppins_400Regular,
    Poppins_500Medium: Poppins_500Medium,
    Poppins_600SemiBold: Poppins_600SemiBold,
    Poppins_700Bold: Poppins_700Bold,
    // Editorial display serif, used only by native screens (src/native/kit serif).
    PlayfairDisplay_500Medium: PlayfairDisplay_500Medium,
    PlayfairDisplay_500Medium_Italic: PlayfairDisplay_500Medium_Italic,
    PlayfairDisplay_600SemiBold: PlayfairDisplay_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const modal = { presentation: "modal", animation: "slide_from_bottom", gestureEnabled: true } as const;
  // 3D screens keep the original navigation (fade, normal card, no full-screen
  // swipe-back) so every drag goes to the model, exactly as in the shipped app.
  const model3d = { animation: "fade", presentation: "card", fullScreenGestureEnabled: false, gestureEnabled: true } as const;
  const fullScreen = { presentation: "fullScreenModal", animation: "slide_from_bottom", gestureEnabled: false } as const;

  return (
    <SafeAreaListener onChange={({ insets }) => Uniwind.updateInsets(insets)}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <GluestackUIProvider mode="dark">
          <SafeAreaProvider>
            <AuthProvider>
              <ToastHost>
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                    // Native push with edge swipe-back (iOS) and the platform slide (Android).
                    animation: "slide_from_right",
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                    animationDuration: 280,
                  }}
                >
                  <Stack.Screen name="index" options={{ animation: "fade" }} />
                  <Stack.Screen name="explore" options={{ animation: "fade" }} />
                  <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
                  <Stack.Screen name="(auth)/login" options={{ animation: "slide_from_bottom" }} />
                  <Stack.Screen name="scan" options={fullScreen} />
                  <Stack.Screen name="artefact-new" options={modal} />
                  <Stack.Screen name="artefact-record/[id]" />
                  <Stack.Screen name="artefact/[id]" options={model3d} />
                  <Stack.Screen name="viewer/[id]" options={model3d} />
                  <Stack.Screen name="capture/[id]" options={fullScreen} />
                  <Stack.Screen name="processing/[id]" />
                  <Stack.Screen name="ready/[id]" />
                  <Stack.Screen name="published/[id]" options={{ animation: "fade", gestureEnabled: false }} />
                  <Stack.Screen name="failed/[id]" />
                </Stack>
              </ToastHost>
            </AuthProvider>
          </SafeAreaProvider>
        </GluestackUIProvider>
      </GestureHandlerRootView>
    </SafeAreaListener>
  );
}
