import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { DataTypeKey, DATA_TYPE_KEYS, DATA_TYPE_LABELS } from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";

const DATA_TYPE_ICONS: Record<DataTypeKey, keyof typeof Feather.glyphMap> = {
  checkIns: "check-circle",
  cycle: "calendar",
  labs: "activity",
  records: "file-text",
  medications: "package",
  partnerObservations: "users",
};

const RETENTION_OPTIONS: { label: string; months: number | null }[] = [
  { label: "Keep forever", months: null },
  { label: "24 months", months: 24 },
  { label: "12 months", months: 12 },
  { label: "6 months", months: 6 },
  { label: "3 months", months: 3 },
];

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns } = useApp();
  const {
    records,
    labResults,
    cycleEntries,
    medications,
    partnerObservations,
    privacySettings,
    savePrivacySettings,
    clearHealthDataType,
    clearAllHealthData,
  } = useHealth();

  const [busyKey, setBusyKey] = useState<DataTypeKey | "all" | null>(null);

  const counts: Record<DataTypeKey, number> = {
    checkIns: checkIns.length,
    cycle: cycleEntries.length,
    labs: labResults.length,
    records: records.length,
    medications: medications.length,
    partnerObservations: partnerObservations.length,
  };

  async function handleToggleEncryption(value: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await savePrivacySettings({ ...privacySettings, encryptSensitiveAtRest: value });
  }

  async function handleSetRetention(months: number | null) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await savePrivacySettings({ ...privacySettings, retentionMonths: months });
  }

  function handleDeleteType(key: DataTypeKey) {
    if (key === "checkIns") {
      showAlert(
        "Managed by check-ins",
        "Daily check-ins are part of the original app experience and are not deleted from this dashboard. You can remove individual entries from the History tab."
      );
      return;
    }
    showAlert(
      `Delete all ${DATA_TYPE_LABELS[key].toLowerCase()}?`,
      "This permanently removes this data from your device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyKey(key);
            try {
              await clearHealthDataType(key);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } finally {
              setBusyKey(null);
            }
          },
        },
      ]
    );
  }

  function handleDeleteAll() {
    showAlert(
      "Delete all health data?",
      "This permanently deletes medical records, lab results, cycle logs, medications, and partner observations from this device. Daily check-ins are not affected. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            showAlert(
              "Are you absolutely sure?",
              "There is no way to recover this data once it's deleted.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete everything",
                  style: "destructive",
                  onPress: async () => {
                    setBusyKey("all");
                    try {
                      await clearAllHealthData();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } finally {
                      setBusyKey(null);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack("/(tabs)/profile")} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy & Data</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIcon, { backgroundColor: colors.softGreen }]}>
              <Feather name="shield" size={18} color={colors.riskLow} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                All data stays on this device
              </Text>
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                Private by design — nothing leaves your phone unless you export and share it
                yourself.
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { color: colors.text }]}>
                Encrypt sensitive data at rest
              </Text>
              <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>
                {Platform.OS === "web"
                  ? "Medical records & lab results are encrypted in this browser when enabled. On web, your encryption key is stored in local storage rather than a hardware-backed keychain — it protects against casual snooping, but not the same guarantee as on iOS/Android."
                  : "Medical records & lab results are encrypted on this device when enabled, with the key held in your device's secure keychain."}
              </Text>
            </View>
            <Switch
              value={privacySettings.encryptSensitiveAtRest}
              onValueChange={handleToggleEncryption}
              trackColor={{ true: colors.primary, false: colors.lavender }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Data inventory */}
        <Section title="Your data on this device">
          {DATA_TYPE_KEYS.map((key, idx) => (
            <View key={key}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.inventoryRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
                  <Feather name={DATA_TYPE_ICONS[key]} size={15} color={colors.primary} />
                </View>
                <Text style={[styles.inventoryLabel, { color: colors.text }]}>
                  {DATA_TYPE_LABELS[key]}
                </Text>
                <Text style={[styles.inventoryCount, { color: colors.mutedForeground }]}>
                  {counts[key]}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        {/* Retention */}
        <Section title="Data retention">
          <Text style={[styles.toggleHint, { color: colors.mutedForeground, marginBottom: 12 }]}>
            Entries older than this are deleted automatically on app start.
          </Text>
          <View style={styles.retentionGrid}>
            {RETENTION_OPTIONS.map((opt) => {
              const active = privacySettings.retentionMonths === opt.months;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => handleSetRetention(opt.months)}
                  style={[
                    styles.retentionChip,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.retentionChipText,
                      { color: active ? "#fff" : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Granular deletion */}
        <Section title="Delete specific data">
          {DATA_TYPE_KEYS.map((key, idx) => (
            <View key={key}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.deleteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>
                    Delete all {DATA_TYPE_LABELS[key].toLowerCase()}
                  </Text>
                  {key === "checkIns" && (
                    <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>
                      Managed by the original app data — not deleted here.
                    </Text>
                  )}
                </View>
                <Pressable
                  onPress={() => handleDeleteType(key)}
                  disabled={busyKey === key}
                  style={[
                    styles.deleteBtn,
                    {
                      borderColor: key === "checkIns" ? colors.border : colors.riskHigh,
                      opacity: key === "checkIns" ? 0.5 : 1,
                    },
                  ]}
                >
                  <Feather
                    name="trash-2"
                    size={14}
                    color={key === "checkIns" ? colors.mutedForeground : colors.riskHigh}
                  />
                </Pressable>
              </View>
            </View>
          ))}
        </Section>

        {/* Destructive: delete all */}
        <Pressable
          onPress={handleDeleteAll}
          disabled={busyKey === "all"}
          style={[styles.deleteAllBtn, { backgroundColor: colors.riskHigh }]}
        >
          <Feather name="alert-triangle" size={16} color="#fff" />
          <Text style={styles.deleteAllText}>Delete all health data</Text>
        </Pressable>

        {/* Research shortcut */}
        <Pressable
          onPress={() => router.push("/research")}
          style={[styles.researchRow, { backgroundColor: colors.card }]}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
            <Feather name="git-pull-request" size={16} color={colors.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Research participation</Text>
            <Text style={[styles.toggleHint, { color: colors.mutedForeground }]}>
              Contribute anonymized data to postpartum research
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  card: {
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 4 },
  statusSub: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18 },
  divider: { height: 1, marginVertical: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleHint: { fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 12 },
  inventoryRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryLabel: { flex: 1, fontSize: 13.5, fontFamily: "Inter_500Medium" },
  inventoryCount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  retentionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  retentionChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  retentionChipText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  deleteRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAllBtn: {
    flexDirection: "row",
    gap: 8,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAllText: { color: "#fff", fontSize: 14.5, fontFamily: "Inter_700Bold" },
  researchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
