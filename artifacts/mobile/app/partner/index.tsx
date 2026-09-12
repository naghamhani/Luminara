import { Feather } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { clearPartnerVerification, markPartnerVerified } from "@/utils/partnerSession";
import { directionalIcon } from "@/utils/rtl";
import { useTranslation } from "@/i18n";

const COOLDOWN_MS = 30000;
const MAX_ATTEMPTS = 3;

function ConsentToggle({
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
    <View style={[toggleStyles.row, { borderColor: colors.border }]}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[toggleStyles.label, { color: colors.foreground }]}>{label}</Text>
        <Text style={[toggleStyles.desc, { color: colors.mutedForeground }]}>{description}</Text>
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

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 2 },
});

function SetupFlow() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { savePartnerSettings } = useHealth();

  const [partnerName, setPartnerName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [userCanViewObservations, setUserCanViewObservations] = useState(true);
  const [partnerCanViewSummary, setPartnerCanViewSummary] = useState(false);
  const [saving, setSaving] = useState(false);

  const pinValid = /^\d{4,6}$/.test(pin);
  const canSubmit = partnerName.trim().length > 0 && pinValid && pin === confirmPin;

  const handleEnable = async () => {
    if (!partnerName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showAlert("Name needed", "Please enter your support person's name.");
      return;
    }
    if (!pinValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showAlert("PIN needed", "Choose a 4-6 digit PIN for your partner to use.");
      return;
    }
    if (pin !== confirmPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showAlert("PINs don't match", "Please re-enter the same PIN in both fields.");
      return;
    }

    setSaving(true);
    try {
      const pinHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
      await savePartnerSettings({
        enabled: true,
        partnerName: partnerName.trim(),
        pinHash,
        userCanViewObservations,
        partnerCanViewSummary,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack("/(tabs)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PartnerScreenHeader title={t("partner.space")} fallbackHref="/(tabs)" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.explainerCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.explainerIcon}>🤝</Text>
          <Text style={styles.explainerTitle}>{t("partner.spaceSub")}</Text>
          <Text style={styles.explainerBody}>
            The partner space lets a designated support person — a partner, family member, or
            close friend — log their own perspective on how you're doing. It complements your
            own tracking; it never replaces it, and it never shows them your private check-ins,
            notes, or records.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {t("partner.whoIsSupport")}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Partner's name"
            placeholderTextColor={colors.mutedForeground}
            value={partnerName}
            onChangeText={setPartnerName}
            maxLength={80}
          />

          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 8 }]}>
            {t("partner.setPin")}
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            A 4-6 digit PIN keeps this space just for the two of you. Tap the eye to double-check
            it as you type. Share it with your partner directly — only a scrambled version is
            ever stored.
          </Text>
          <PinInput
            placeholder={t("partner.choosePin")}
            value={pin}
            onChangeText={setPin}
          />
          <PinInput
            placeholder={t("partner.confirmPin")}
            value={confirmPin}
            onChangeText={setConfirmPin}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("partner.privacyChoices")}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {t("partner.inControl")}
          </Text>
          <ConsentToggle
            label={t("partner.seeObservations")}
            description={t("partner.seeObservationsSub")}
            value={userCanViewObservations}
            onChange={setUserCanViewObservations}
          />
          <ConsentToggle
            label={t("partner.shareSummary")}
            description={t("partner.shareSummarySub")}
            value={partnerCanViewSummary}
            onChange={setPartnerCanViewSummary}
          />
        </View>

        <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
          {t("common.privateByDesign")}
        </Text>

        <Pressable
          onPress={handleEnable}
          disabled={saving || !canSubmit}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: colors.primary,
              opacity: saving || !canSubmit ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.primaryBtnText}>{t("partner.enable")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EnabledGateway() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { partnerSettings } = useHealth();

  const [showPinEntry, setShowPinEntry] = useState(false);
  const [pin, setPin] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const inCooldown = cooldownUntil !== null && cooldownLeft > 0;

  // Tick down once per second while locked out, then unlock automatically.
  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownLeft(left);
      if (left === 0) {
        setCooldownUntil(null);
        setAttempts(0);
        setError(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const handleCheckPin = async () => {
    if (inCooldown) return;
    if (!pin) return;
    setChecking(true);
    setError(null);
    try {
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
      if (hash === partnerSettings.pinHash) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPin("");
        setAttempts(0);
        setShowPinEntry(false);
        markPartnerVerified();
        router.push("/partner/dashboard");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const nextAttempts = attempts + 1;
        setAttempts(nextAttempts);
        setPin("");
        if (nextAttempts >= MAX_ATTEMPTS) {
          setCooldownUntil(Date.now() + COOLDOWN_MS);
        } else {
          setError(`Incorrect PIN. ${MAX_ATTEMPTS - nextAttempts} attempt(s) left.`);
        }
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PartnerScreenHeader
        title={t("partner.space")}
        onBack={showPinEntry ? () => setShowPinEntry(false) : undefined}
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {!showPinEntry ? (
          <>
            <Pressable
              onPress={() => {
                setError(null);
                setShowPinEntry(true);
              }}
              style={[styles.gatewayCard, { backgroundColor: colors.card }]}
            >
              <View style={[styles.gatewayIcon, { backgroundColor: colors.blush }]}>
                <Feather name="heart" size={22} color={colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gatewayTitle, { color: colors.foreground }]}>
                  I'm the partner{partnerSettings.partnerName ? ` (${partnerSettings.partnerName})` : ""}
                </Text>
                <Text style={[styles.gatewaySub, { color: colors.mutedForeground }]}>
                  {t("partner.enterPinSub")}
                </Text>
              </View>
              <Feather name={directionalIcon("chevron-right")} size={18} color={colors.mutedForeground} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/partner/settings")}
              style={[styles.gatewayCard, { backgroundColor: colors.card }]}
            >
              <View style={[styles.gatewayIcon, { backgroundColor: colors.softGreen }]}>
                <Feather name="settings" size={20} color={colors.riskLow} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.gatewayTitle, { color: colors.foreground }]}>
                  {t("partner.settings")}
                </Text>
                <Text style={[styles.gatewaySub, { color: colors.mutedForeground }]}>
                  {t("partner.manageSub")}
                </Text>
              </View>
              <Feather name={directionalIcon("chevron-right")} size={18} color={colors.mutedForeground} />
            </Pressable>

            <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
              {t("common.privateByDesign")}
            </Text>
          </>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, alignItems: "center", gap: 16 }]}>
            <View style={[styles.gatewayIcon, { backgroundColor: colors.blush }]}>
              <Feather name="lock" size={22} color={colors.purple} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("partner.enterPin")}</Text>
            <PinInput
              centered
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              editable={!inCooldown}
              autoFocus
              accessibilityLabel={t("partner.pinLabel")}
            />
            {inCooldown ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                Too many incorrect attempts. Try again in {cooldownLeft}s.
              </Text>
            ) : error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            ) : null}
            <Pressable
              onPress={handleCheckPin}
              disabled={checking || inCooldown || !pin}
              style={({ pressed }) => [
                styles.primaryBtn,
                {
                  backgroundColor: colors.primary,
                  width: "100%",
                  opacity: checking || inCooldown || !pin ? 0.5 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export default function PartnerGatewayScreen() {
  const { partnerSettings, isLoading } = useHealth();

  // Fresh arrival at the top-level partner gateway means any earlier PIN
  // verification this session no longer applies — require it again before
  // /partner/dashboard will render. This only clears on mount, so pushing
  // forward to dashboard/log/settings from here (which doesn't unmount this
  // screen) keeps the session unlocked; leaving the partner stack and coming
  // back later does not.
  useEffect(() => {
    clearPartnerVerification();
  }, []);

  if (isLoading) return null;

  return partnerSettings.enabled ? <EnabledGateway /> : <SetupFlow />;
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
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: -4 },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  privacyNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  gatewayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  gatewayIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  gatewayTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  gatewaySub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
