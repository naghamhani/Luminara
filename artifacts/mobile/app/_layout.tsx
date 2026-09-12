import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import { HealthProvider } from "@/context/HealthContext";
import {
  applyLayoutDirection,
  fontMapForLocale,
  I18nProvider,
  loadInitialLocale,
  type Locale,
} from "@/i18n";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { profile, isLoading } = useApp();

  if (isLoading) return null;

  if (!profile?.setupComplete) {
    return (
      <>
        <Redirect href="/onboarding" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding" />
        </Stack>
      </>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}

/**
 * The locale has to be known before anything renders: it decides which font
 * files load (Latin vs Arabic) and it sets the native RTL flag, which React
 * Native reads once while building the view hierarchy. Resolving it inside the
 * tree would mean a visible flash of the wrong script and a layout that never
 * flips until the next launch.
 */
export default function RootLayout() {
  const [locale, setLocale] = useState<Locale | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await loadInitialLocale();
      // Align the native direction flag with the stored choice on every launch.
      // This is what makes an Arabic restart actually come back up in RTL.
      applyLayoutDirection(resolved);
      if (!cancelled) setLocale(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Splash is still up, so this renders nothing rather than a flash of English.
  if (locale === null) return null;

  return <LocalizedApp locale={locale} />;
}

function LocalizedApp({ locale }: { locale: Locale }) {
  // Stable for this process: changing language requires a restart anyway.
  const [fontsLoaded, fontError] = useFonts(fontMapForLocale(locale));

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <I18nProvider initialLocale={locale}>
                <AppProvider>
                  <HealthProvider>
                    <RootLayoutNav />
                  </HealthProvider>
                </AppProvider>
              </I18nProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
