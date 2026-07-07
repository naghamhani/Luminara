import { Feather } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PartnerScreenHeader } from "@/components/partner/PartnerScreenHeader";
import { PinInput } from "@/components/PinInput";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onChange(v);
        }}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
        accessibilityLabel={`${label}, currently ${value ? "on" : "off"}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

export default function PartnerSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { partnerSettings, partnerObservations, savePartnerSettings } = useHealth();

  const [partnerName, setPartnerName] = useState(partnerSettings.partnerName);
  const [userCanViewObservations, setUserCanViewObservations] = useState(
    partnerSettings.userCanViewObservations
  );
  const [partnerCanViewSummary, setPartnerCanViewSummary] = useState(
    partnerSettings.partnerCanViewSummary
  );

  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const observationCount = partnerObservations.length;

  const persistSettings = async (patch: Partial<typeof partnerSettings>) => {
    await savePartnerSettings({ ...partnerSettings, ...patch });
  };

  const handleUserCanView = async (v: boolean) => {
    setUserCanViewObservations(v);
    await persistSettings({ userCanViewObservations: v });
  };

  const handlePartnerCanView = async (v: boolean) => {
    setPartnerCanViewSummary(v);
    await persistSettings({ partnerCanViewSummary: v });
  };

  const handleRename = async () => {
    const trimmed = partnerName.trim();
    if (!trimmed) {
      showAlert("Name needed", "Please enter your partner's name.");
      return;
    }
    await persistSettings({ partnerName: trimmed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showAlert("Saved", "Partner name updated.");
  };

  const handleChangePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError("PIN must be 4-6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("PINs don't match.");
      return;
    }
    setSaving(true);
    setPinError(null);
    try {
      const pinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, newPin);
      await persistSettings({ pinHash });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewPin("");
      setConfirmPin("");
      setShowPinChange(false);
      showAlert("PIN updated", "Your partner's PIN has been changed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = () => {
    showAlert(
      "Disable partner space?",
      "Your partner will no longer be able to sign in or log new observations. Existing observations are kept and remain visible to you here — you can delete them anytime from Privacy & Data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: async () => {
            await savePartnerSettings({ ...partnerSettings, enabled: false });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            goBack("/partner");
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PartnerScreenHeader title="Partner settings" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Partner name</Text>
          <View style={styles.inlineRow}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border, flex: 1 },
              ]}
              value={partnerName}
              onChangeText={setPartnerName}
              maxLength={80}
              placeholder="Partner's name"
              placeholderTextColor={colors.mutedForeground}
            />
            <Pressable
              onPress={handleRename}
              style={[styles.smallBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.smallBtnText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sharing controls</Text>
          <ToggleRow
            label="Let me see their observations"
            description="Only entries your partner marks as shared will appear to you. Anything they keep private stays private."
            value={userCanViewObservations}
            onChange={handleUserCanView}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ToggleRow
            label="Let them see my weekly summary"
            description="Shares only a 7-day average wellness percentage and trend word — never your raw check-ins, notes, or details."
            value={partnerCanViewSummary}
            onChange={handlePartnerCanView}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.inlineRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, flex: 1 }]}>
              Partner PIN
            </Text>
            <Pressable onPress={() => setShowPinChange((s) => !s)}>
              <Text style={[styles.linkText, { color: colors.primary }]}>
                {showPinChange ? "Cancel" : "Change PIN"}
              </Text>
            </Pressable>
          </View>
          {showPinChange && (
            <View style={{ gap: 10 }}>
              <PinInput
                value={newPin}
                onChangeText={setNewPin}
                placeholder="New PIN"
              />
              <PinInput
                value={confirmPin}
                onChangeText={setConfirmPin}
                placeholder="Confirm new PIN"
              />
              {pinError && (
                <Text style={[styles.errorText, { color: colors.destructive }]}>{pinError}</Text>
              )}
              <Pressable
                onPress={handleChangePin}
                disabled={saving}
                style={[styles.smallBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              >
                <Text style={styles.smallBtnText}>Update PIN</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, flexDirection: "row", alignItems: "center", gap: 12 }]}>
          <View style={[styles.countIcon, { backgroundColor: colors.lavender }]}>
            <Feather name="file-text" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {observationCount} observation{observationCount === 1 ? "" : "s"} stored
            </Text>
            <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>
              Manage or delete these anytime from Privacy & Data.
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleDisable}
          style={[styles.disableBtn, { borderColor: colors.destructive }]}
        >
          <Feather name="power" size={16} color={colors.destructive} />
          <Text style={[styles.disableBtnText, { color: colors.destructive }]}>
            Disable partner space
          </Text>
        </Pressable>
        <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
          Private by design — your data stays on this device.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  inlineRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  smallBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  linkText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  toggleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toggleDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
  divider: { height: 1 },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  countIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  disableBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  disableBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  privacyNote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
