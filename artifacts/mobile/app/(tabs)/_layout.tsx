import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";

function NativeTabLayout() {
  const { t } = useTranslation();

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>{t("nav.home")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="checkin">
        <Icon sf={{ default: "heart", selected: "heart.fill" }} />
        <Label>{t("nav.checkin")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>{t("nav.report")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="resources">
        <Icon sf={{ default: "hands.and.sparkles", selected: "hands.and.sparkles.fill" }} />
        <Label>{t("nav.support")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="insights">
        <Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} />
        <Label>{t("nav.insights")}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person", selected: "person.fill" }} />
        <Label>{t("nav.me")}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const { t } = useTranslation();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          ...(Platform.OS === "web" ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house.fill" tintColor={color} size={21} />
            ) : (
              <Feather name="home" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: t("nav.checkin"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="heart.fill" tintColor={color} size={21} />
            ) : (
              <Feather name="heart" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t("nav.report"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="doc.text.fill" tintColor={color} size={21} />
            ) : (
              <Feather name="file-text" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          title: t("nav.support"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="heart.circle.fill" tintColor={color} size={21} />
            ) : (
              <Feather name="life-buoy" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t("nav.insights"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={21} />
            ) : (
              <Feather name="trending-up" size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.me"),
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.fill" tintColor={color} size={21} />
            ) : (
              <Feather name="user" size={21} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
