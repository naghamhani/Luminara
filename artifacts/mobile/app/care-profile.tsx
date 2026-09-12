import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/records/ScreenHeader";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { goBack } from "@/utils/navigation";
import { showAlert } from "@/utils/dialog";
import { useTranslation } from "@/i18n";
import {
  CARE_BACKGROUND_LABELS,
  CARE_BACKGROUNDS,
  CareBackground,
  DEFAULT_CARE_PROFILE,
} from "@/types/health";

export default function CareProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { careProfile, saveCareProfile } = useHealth();

  const [backgrounds, setBackgrounds] = useState<CareBackground[]>(
    careProfile.backgrounds
  );
  const [limitedSunExposure, setLimitedSunExposure] = useState(
    careProfile.limitedSunExposure
  );
  const [saving, setSaving] = useState(false);

  const toggleBackground = (key: CareBackground) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBackgrounds((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCareProfile({ backgrounds, limitedSunExposure });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/(tabs)/profile");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    showAlert(
      "Clear your care profile?",
      "This removes your saved background selections and sun exposure setting from this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setBackgrounds([]);
            setLimitedSunExposure(false);
            await saveCareProfile(DEFAULT_CARE_PROFILE);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("careProfile.title")} fallbackHref="/(tabs)/profile" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.explainerCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.explainerIcon}>🌍</Text>
          <Text style={styles.explainerTitle}>{t("careProfile.explainerTitle")}</Text>
          <Text style={styles.explainerBody}>
            Health guidance isn't one-size-fits-all. Vitamin D needs, anemia screening, and
            pregnancy care can differ across communities. Sharing your background is completely
            optional — it only tailors the suggestions you see, right here on your device.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("careProfile.backgroundLabel")}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t("careProfile.optionalNote")}
          </Text>
          <View style={styles.chipWrap}>
            {CARE_BACKGROUNDS.map((key) => {
              const active = backgrounds.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => toggleBackground(key)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.secondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? "#fff" : colors.text },
                    ]}
                  >
                    {CARE_BACKGROUND_LABELS[key]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {t("careProfile.limitedSun")}
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Indoor lifestyle, covered clothing, or long winters — for any reason. Helps
                tailor vitamin D guidance.
              </Text>
            </View>
            <Switch
              value={limitedSunExposure}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLimitedSunExposure(v);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={[styles.privacyCard, { backgroundColor: colors.secondary }]}>
          <Feather name="lock" size={16} color={colors.mutedForeground} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            This stays on your device only. It is never included in research exports or shared
            reports, and you can clear it anytime. Suggestions based on it are population-level
            awareness, not a diagnosis.
          </Text>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: colors.primary, opacity: saving ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.primaryBtnText}>Save</Text>
        </Pressable>

        <Pressable onPress={handleClear} style={styles.clearBtn}>
          <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>
            {t("careProfile.clear")}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  explainerCard: { borderRadius: 20, padding: 20, gap: 8 },
  explainerIcon: { fontSize: 30 },
  explainerTitle: { color: "#fff", fontSize: 19, fontFamily: "Inter_700Bold" },
  explainerBody: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  toggleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  privacyCard: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 16,
    padding: 14,
    alignItems: "flex-start",
  },
  privacyText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  clearBtn: { alignItems: "center", paddingVertical: 4 },
  clearBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
