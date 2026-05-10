import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function getDaysSince(dateStr: string): number {
  const birth = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
}

function SettingRow({
  icon,
  label,
  subtitle,
  onPress,
  rightElement,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        { backgroundColor: pressed && onPress ? colors.muted : "transparent" },
      ]}
    >
      <View style={[rowStyles.iconWrap, { backgroundColor: colors.secondary }]}>
        <Feather name={icon as any} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, { color: colors.text }]}>{label}</Text>
        {subtitle ? (
          <Text style={[rowStyles.sub, { color: colors.mutedForeground }]}>{subtitle}</Text>
        ) : null}
      </View>
      {rightElement ?? (
        onPress ? <Feather name="chevron-right" size={16} color={colors.mutedForeground} /> : null
      )}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
});

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[sectionStyles.container, { backgroundColor: colors.card }]}>
      <Text style={[sectionStyles.title, { color: colors.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: { borderRadius: 20, padding: 8, gap: 2 },
  title: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
});

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, checkIns } = useApp();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);
  const [reminderTime, setReminderTime] = useState(true);

  const daysSince = profile?.birthDate ? getDaysSince(profile.birthDate) : 0;
  const memberSince = "Member since May 2026";

  const handleLogout = () => {
    Alert.alert(
      "Reset App Data",
      "This will clear all your data and return to onboarding. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace("/onboarding");
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Text style={styles.avatarText}>
            {profile?.name?.charAt(0)?.toUpperCase() ?? "N"}
          </Text>
        </View>
        <View>
          <Text style={styles.profileName}>{profile?.name ?? "Nagham"}</Text>
          <Text style={styles.profileSub}>{memberSince}</Text>
        </View>
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatNum}>{checkIns.length}</Text>
            <Text style={styles.profileStatLabel}>Check-ins</Text>
          </View>
          <View style={[styles.profileStatDivider]} />
          <View style={styles.profileStat}>
            <Text style={styles.profileStatNum}>{daysSince}</Text>
            <Text style={styles.profileStatLabel}>Days of {profile?.babyName ?? "Laila"}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.hipaaBadge, { backgroundColor: colors.softGreen, borderColor: colors.riskLow + "40", borderWidth: 1 }]}>
        <Feather name="shield" size={14} color={colors.riskLow} />
        <Text style={[styles.hipaaText, { color: colors.riskLow }]}>
          100% HIPAA Compliant · Your data is private and secure
        </Text>
      </View>

      <SettingsSection title="Account Settings">
        <SettingRow
          icon="user"
          label="Personal Details"
          subtitle={`${profile?.name ?? "Nagham"} · Baby ${profile?.babyName ?? "Laila"}`}
          onPress={() => {}}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="globe"
          label="Language"
          subtitle="English (US)"
          onPress={() => {}}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="bell"
          label="Notification Settings"
          subtitle="Daily check-in reminders"
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ true: colors.primary, false: colors.lavender }}
              thumbColor="#fff"
            />
          }
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="clock"
          label="Check-in Reminder"
          subtitle={reminderTime ? "9:00 AM daily" : "Off"}
          rightElement={
            <Switch
              value={reminderTime}
              onValueChange={setReminderTime}
              trackColor={{ true: colors.primary, false: colors.lavender }}
              thumbColor="#fff"
            />
          }
        />
      </SettingsSection>

      <SettingsSection title="Privacy & Security">
        <SettingRow
          icon="lock"
          label="Privacy Policy"
          onPress={() => {}}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="activity"
          label="Anonymous Data Sharing"
          subtitle="Help improve maternal mental health research"
          rightElement={
            <Switch
              value={dataSharing}
              onValueChange={setDataSharing}
              trackColor={{ true: colors.primary, false: colors.lavender }}
              thumbColor="#fff"
            />
          }
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="shield"
          label="HIPAA Compliance"
          subtitle="Strictly anonymous, consent-based data"
          onPress={() => {}}
        />
      </SettingsSection>

      <SettingsSection title="App Settings">
        <SettingRow
          icon="sun"
          label="Theme"
          subtitle="Light mode"
          onPress={() => {}}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="info"
          label="About Bloom"
          subtitle="Version 1.0.0"
          onPress={() => {}}
        />
      </SettingsSection>

      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutBtn,
          { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="log-out" size={16} color={colors.riskHigh} />
        <Text style={[styles.logoutText, { color: colors.riskHigh }]}>
          Reset App Data
        </Text>
      </Pressable>

      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
        Bloom is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your healthcare provider.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  profileCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  profileName: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  profileSub: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 2,
  },
  profileStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
  },
  profileStat: { alignItems: "center", gap: 2 },
  profileStatNum: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  profileStatLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  profileStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  hipaaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hipaaText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 16,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 8,
  },
});
