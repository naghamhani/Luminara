import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { useApp } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { LOCALE_LABELS, useTranslation } from "@/i18n";
import { showAlert } from "@/utils/dialog";
import {
  cancelCyclePredictionReminders,
  cancelDailyCheckInReminder,
  cancelMedicationReminders,
  requestNotificationPermissions,
  scheduleCyclePredictionReminders,
  scheduleDailyCheckInReminder,
  scheduleMedicationReminders,
} from "@/utils/notifications";
import { predictCycle } from "@/utils/wellnessAlgorithm";
import { directionalIcon } from "@/utils/rtl";

// Fixed reminder time for now (8:00 PM local). Could be replaced with a time
// picker later if one gets added to the project — none exists today.
const DAILY_CHECKIN_HOUR = 20;
const DAILY_CHECKIN_MINUTE = 0;

const CHECKIN_REMINDER_ENABLED_KEY = "@luminara_settings_checkin_reminder";
const MEDICATION_REMINDER_ENABLED_KEY = "@luminara_settings_medication_reminder";
const CYCLE_REMINDER_ENABLED_KEY = "@luminara_settings_cycle_reminder";

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
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
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
        onPress ? <Feather name={directionalIcon("chevron-right")} size={16} color={colors.mutedForeground} /> : null
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

function StatusPill({ active, label }: { active: boolean; label?: string }) {
  const colors = useColors();
  const text = label ?? (active ? "Active" : "Off");
  return (
    <View
      style={[
        pillStyles.pill,
        { backgroundColor: active ? colors.softGreen : colors.secondary },
      ]}
    >
      <Text
        style={[
          pillStyles.text,
          { color: active ? colors.riskLow : colors.mutedForeground },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});

const dataSyncStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
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

function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  return `Member since ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, checkIns, resetProfile } = useApp();
  const { t, locale, setLocale, needsRestart } = useTranslation();
  const {
    privacySettings,
    partnerSettings,
    careProfile,
    medications,
    cycleEntries,
    resetAll: resetHealth,
  } = useHealth();

  const [resetting, setResetting] = useState(false);
  const [checkinReminderEnabled, setCheckinReminderEnabled] = useState(false);
  const [medicationReminderEnabled, setMedicationReminderEnabled] = useState(false);
  const [cycleReminderEnabled, setCycleReminderEnabled] = useState(false);

  const daysSince = profile?.birthDate ? getDaysSince(profile.birthDate) : 0;
  const memberSince = profile?.createdAt ? formatMemberSince(profile.createdAt) : null;

  const cyclePrediction = useMemo(() => predictCycle(cycleEntries), [cycleEntries]);

  useEffect(() => {
    (async () => {
      const [checkinRaw, medicationRaw, cycleRaw] = await Promise.all([
        AsyncStorage.getItem(CHECKIN_REMINDER_ENABLED_KEY),
        AsyncStorage.getItem(MEDICATION_REMINDER_ENABLED_KEY),
        AsyncStorage.getItem(CYCLE_REMINDER_ENABLED_KEY),
      ]);
      setCheckinReminderEnabled(checkinRaw === "true");
      setMedicationReminderEnabled(medicationRaw === "true");
      setCycleReminderEnabled(cycleRaw === "true");
    })();
  }, []);

  const handleToggleCheckinReminder = async (value: boolean) => {
    setCheckinReminderEnabled(value);
    await AsyncStorage.setItem(CHECKIN_REMINDER_ENABLED_KEY, value ? "true" : "false");
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setCheckinReminderEnabled(false);
        await AsyncStorage.setItem(CHECKIN_REMINDER_ENABLED_KEY, "false");
        showAlert(
          "Notifications disabled",
          "Enable notifications for Luminara Health in your device settings to receive check-in reminders."
        );
        return;
      }
      await scheduleDailyCheckInReminder(DAILY_CHECKIN_HOUR, DAILY_CHECKIN_MINUTE);
    } else {
      await cancelDailyCheckInReminder();
    }
  };

  const handleToggleMedicationReminder = async (value: boolean) => {
    setMedicationReminderEnabled(value);
    await AsyncStorage.setItem(MEDICATION_REMINDER_ENABLED_KEY, value ? "true" : "false");
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setMedicationReminderEnabled(false);
        await AsyncStorage.setItem(MEDICATION_REMINDER_ENABLED_KEY, "false");
        showAlert(
          "Notifications disabled",
          "Enable notifications for Luminara Health in your device settings to receive medication reminders."
        );
        return;
      }
      await scheduleMedicationReminders(medications);
    } else {
      await cancelMedicationReminders();
    }
  };

  const handleToggleCycleReminder = async (value: boolean) => {
    setCycleReminderEnabled(value);
    await AsyncStorage.setItem(CYCLE_REMINDER_ENABLED_KEY, value ? "true" : "false");
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        setCycleReminderEnabled(false);
        await AsyncStorage.setItem(CYCLE_REMINDER_ENABLED_KEY, "false");
        showAlert(
          "Notifications disabled",
          "Enable notifications for Luminara Health in your device settings to receive cycle reminders."
        );
        return;
      }
      await scheduleCyclePredictionReminders(cyclePrediction);
    } else {
      await cancelCyclePredictionReminders();
    }
  };

  const handleAboutData = () => {
    showAlert(
      "About your data",
      "Your medical records, cycle logs, medications, and partner observations are stored only on this device — private by design. Sensitive records can be encrypted at rest with a key held in secure device storage.\n\nNothing is sent anywhere unless you explicitly opt in to anonymous research sharing, which you can turn off at any time. Partner access requires your consent and a PIN you control.\n\nThis app is not a diagnosis — always review health information with your healthcare provider.",
      [{ text: "Got it" }]
    );
  };

  const handleAboutApp = () => {
    showAlert(
      "About Luminara Health",
      "Version 1.0.0\n\nA postpartum wellness check-in app with an optional reproductive-health toolkit — cycle tracking, medical records, medications, and a consent-based partner space. Everything is local-first and stays on this device unless you explicitly choose to share it."
    );
  };

  const handleLogout = () => {
    if (resetting) return;
    showAlert(
      "Reset App Data",
      "This will permanently clear all your data — check-ins, records, cycle logs, medications, and partner data — and return you to onboarding. This can't be undone. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setResetting(true);
            try {
              // profile becoming null makes the root layout redirect to
              // /onboarding on its own — no manual navigation needed.
              await Promise.all([resetProfile(), resetHealth()]);
            } finally {
              setResetting(false);
            }
          },
        },
      ]
    );
  };

  // While (tabs) is mounted the root layout guarantees a non-null,
  // setupComplete profile — except for one transitional render right after
  // a reset, when profile briefly becomes null before the redirect to
  // /onboarding takes over. Render nothing rather than flash a fallback
  // person's name/initial during that frame.
  if (!profile) return null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.profileCard, { backgroundColor: colors.primary }]}>
        <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.profileName}>{profile.name}</Text>
          {memberSince ? <Text style={styles.profileSub}>{memberSince}</Text> : null}
        </View>
        <View style={styles.profileStats}>
          <View style={styles.profileStat}>
            <Text style={styles.profileStatNum}>{checkIns.length}</Text>
            <Text style={styles.profileStatLabel}>Check-ins</Text>
          </View>
          <View style={[styles.profileStatDivider]} />
          <View style={styles.profileStat}>
            <Text style={styles.profileStatNum}>{daysSince}</Text>
            <Text style={styles.profileStatLabel}>Days of {profile.babyName}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.hipaaBadge, { backgroundColor: colors.softGreen, borderColor: colors.riskLow + "40", borderWidth: 1 }]}>
        <Feather name="lock" size={14} color={colors.riskLow} />
        <Text style={[styles.hipaaText, { color: colors.riskLow }]}>
          {t("profile.privateTagline")}
        </Text>
      </View>

      <SettingsSection title={t("profile.sectionAccount")}>
        <SettingRow
          icon="user"
          label={t("profile.personalDetails")}
          subtitle={`${profile.name} · Baby ${profile.babyName}`}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="globe"
          label={t("profile.language")}
          // Each language is named in its own script — a picker that reads
          // "Arabic" in English is useless to someone who only reads Arabic.
          subtitle={
            needsRestart
              ? t("profile.languageRestartPending")
              : LOCALE_LABELS[locale]
          }
          rightElement={
            <Switch
              value={locale === "ar"}
              onValueChange={(value) => setLocale(value ? "ar" : "en")}
              trackColor={{ false: colors.muted, true: colors.primary }}
              // The control is a two-state toggle, so it needs to say which
              // language it switches TO, not just report its own state.
              accessibilityLabel={LOCALE_LABELS[locale === "ar" ? "en" : "ar"]}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t("profile.sectionDataSync")}>
        <View style={dataSyncStyles.row}>
          <View style={[rowStyles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="hard-drive" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[rowStyles.label, { color: colors.text }]}>Storage</Text>
            <Text style={[rowStyles.sub, { color: colors.mutedForeground }]}>
              {t("profile.savedOnDevice")}
            </Text>
          </View>
          <SyncStatusBadge />
        </View>
      </SettingsSection>

      <SettingsSection title={t("profile.sectionPrivacy")}>
        <SettingRow
          icon="globe"
          label={t("profile.personalizedCare")}
          subtitle={t("profile.personalizedCareSub")}
          onPress={() => router.push("/care-profile")}
          rightElement={
            <StatusPill
              active={careProfile.backgrounds.length > 0 || careProfile.limitedSunExposure}
              label={
                careProfile.backgrounds.length > 0 || careProfile.limitedSunExposure
                  ? "Set"
                  : "Off"
              }
            />
          }
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="sliders"
          label={t("profile.privacyControls")}
          subtitle={t("profile.privacyControlsSub")}
          onPress={() => router.push("/privacy")}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="award"
          label={t("profile.research")}
          subtitle={t("profile.researchSub")}
          onPress={() => router.push("/research")}
          rightElement={<StatusPill active={privacySettings.research.participating} label={privacySettings.research.participating ? "Active" : "Off"} />}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="users"
          label={t("profile.partnerSettings")}
          subtitle={t("profile.partnerSettingsSub")}
          onPress={() => router.push("/partner/settings")}
          rightElement={<StatusPill active={partnerSettings.enabled} label={partnerSettings.enabled ? "Enabled" : "Off"} />}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="info"
          label={t("profile.aboutData")}
          subtitle={t("profile.aboutDataSub")}
          onPress={handleAboutData}
        />
      </SettingsSection>

      <SettingsSection title={t("profile.sectionReminders")}>
        <SettingRow
          icon="bell"
          label={t("profile.dailyReminder")}
          subtitle={t("profile.dailyReminderSub")}
          rightElement={
            <Switch
              value={checkinReminderEnabled}
              onValueChange={handleToggleCheckinReminder}
              trackColor={{ false: colors.muted, true: colors.primary }}
            />
          }
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="clipboard"
          label={t("profile.medReminder")}
          subtitle={t("profile.medReminderSub")}
          rightElement={
            <Switch
              value={medicationReminderEnabled}
              onValueChange={handleToggleMedicationReminder}
              trackColor={{ false: colors.muted, true: colors.primary }}
            />
          }
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="calendar"
          label={t("profile.cycleReminder")}
          subtitle={t("profile.cycleReminderSub")}
          rightElement={
            <Switch
              value={cycleReminderEnabled}
              onValueChange={handleToggleCycleReminder}
              trackColor={{ false: colors.muted, true: colors.primary }}
            />
          }
        />
      </SettingsSection>

      <SettingsSection title={t("profile.sectionApp")}>
        <SettingRow
          icon="sun"
          label="Theme"
          subtitle={t("profile.lightMode")}
        />
        <View style={[{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }]} />
        <SettingRow
          icon="info"
          label={t("profile.aboutApp")}
          subtitle={t("profile.version", { version: "1.0.0" })}
          onPress={handleAboutApp}
        />
      </SettingsSection>

      <Pressable
        onPress={handleLogout}
        disabled={resetting}
        accessibilityRole="button"
        accessibilityLabel={t("profile.resetData")}
        style={({ pressed }) => [
          styles.logoutBtn,
          { backgroundColor: colors.card, opacity: resetting ? 0.6 : pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="log-out" size={16} color={colors.riskHigh} />
        <Text style={[styles.logoutText, { color: colors.riskHigh }]}>
          {resetting ? "Resetting…" : "Reset App Data"}
        </Text>
      </Pressable>

      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
        {t("profile.medicalDisclaimer")}
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
