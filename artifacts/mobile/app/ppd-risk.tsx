import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { EPDS_INTRO, EPDS_ITEMS, interpretEpds } from "@/constants/epds";
import { detectPhase } from "@/utils/wellnessAlgorithm";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";
import {
  BackendNotConfiguredError,
  scorePpdRisk,
  type PpdFeatures,
  type PpdRiskResult,
} from "@/utils/backendClient";
import { isBackendConfigured } from "@/utils/apiConfig";
import { directionalIcon } from "@/utils/rtl";
import { useTranslation } from "@/i18n";

/** Feature keys that are simple yes/no toggles (everything except the EPDS
 *  and age inputs, which are derived separately). */
type BooleanFeatureKey = Exclude<
  keyof PpdFeatures,
  "epdsScore" | "epdsResponses" | "epdsIsPrenatal" | "ageYears"
>;

interface FactorDef {
  key: BooleanFeatureKey;
  label: string;
}

const HISTORY_FACTORS: FactorDef[] = [
  { key: "priorPostpartumDepression", label: "Postpartum depression after a previous birth" },
  { key: "historyOfDepression", label: "History of depression" },
  { key: "historyOfAnxiety", label: "History of anxiety" },
  { key: "historyOfBipolar", label: "History of bipolar disorder" },
  { key: "currentlyOnPsychiatricMedication", label: "Currently taking psychiatric medication" },
];

const LIFE_FACTORS: FactorDef[] = [
  { key: "lowSocialSupport", label: "Limited support from family or partner" },
  { key: "financialStrain", label: "Financial strain" },
  { key: "recentStressfulLifeEvent", label: "A recent stressful life event" },
  { key: "unintendedPregnancy", label: "This pregnancy was unplanned" },
  { key: "intimatePartnerViolence", label: "Feeling unsafe in a relationship" },
  { key: "severeSleepDeprivation", label: "Severe sleep deprivation" },
];

const BIRTH_FACTORS: FactorDef[] = [
  { key: "firstPregnancy", label: "This is my first baby" },
  { key: "pregnancyComplications", label: "Pregnancy complications (e.g. preeclampsia, gestational diabetes)" },
  { key: "cesareanDelivery", label: "Cesarean delivery" },
  { key: "pretermBirth", label: "Preterm birth" },
  { key: "multiplePregnancy", label: "Twins or more" },
  { key: "nicuAdmission", label: "Baby spent time in the NICU" },
  { key: "infantHealthProblems", label: "Baby has health concerns" },
  { key: "breastfeedingDifficulty", label: "Breastfeeding has been difficult" },
];

const TIER_COPY: Record<PpdRiskResult["tier"], { label: string; colorKey: "riskLow" | "riskModerate" | "riskHigh" }> = {
  low: { label: "Lower risk", colorKey: "riskLow" },
  moderate: { label: "Moderate risk", colorKey: "riskModerate" },
  high: { label: "Higher risk", colorKey: "riskHigh" },
};

export default function PpdRiskScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { cycleEntries, privacySettings } = useHealth();

  const [responses, setResponses] = useState<(number | null)[]>(Array(10).fill(null));
  const [factors, setFactors] = useState<Partial<Record<BooleanFeatureKey, boolean>>>({});
  const [contribute, setContribute] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PpdRiskResult | null>(null);

  const phase = useMemo(
    () => detectPhase({ birthDate: profile?.birthDate ?? null, cycleEntries }),
    [profile?.birthDate, cycleEntries]
  );
  const isPrenatal = phase === "pregnancy";

  const answeredCount = responses.filter((r) => r !== null).length;
  const allAnswered = answeredCount === 10;
  const epdsTotal = responses.reduce<number>((sum, r) => sum + (r ?? 0), 0);

  const researchConsented = privacySettings.research.participating;
  const pseudonym = privacySettings.research.pseudonym;

  function selectOption(itemIndex: number, score: number) {
    Haptics.selectionAsync();
    setResponses((prev) => {
      const next = [...prev];
      next[itemIndex] = score;
      return next;
    });
  }

  function toggleFactor(key: BooleanFeatureKey) {
    Haptics.selectionAsync();
    setFactors((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSubmit() {
    if (!allAnswered) {
      showAlert("A few more to go", "Please answer all 10 questions so the estimate is meaningful.");
      return;
    }
    if (!isBackendConfigured()) {
      showAlert(
        "Server not connected",
        "The risk model runs on the Luminara server. Set EXPO_PUBLIC_API_URL to your API server to enable it."
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setResult(null);
    try {
      const features: PpdFeatures = {
        ...factors,
        epdsResponses: responses.map((r) => r ?? 0),
        epdsIsPrenatal: isPrenatal,
      };
      const res = await scorePpdRisk({
        features,
        participantPseudonym: contribute ? pseudonym : undefined,
        store: contribute && researchConsented,
      });
      setResult(res);
      if (res.selfHarmFlag || res.tier === "high") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (err) {
      if (err instanceof BackendNotConfiguredError) {
        showAlert("Server not connected", "Set EXPO_PUBLIC_API_URL to your API server to enable this.");
      } else {
        showAlert("Couldn't calculate", (err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }

  const selfHarmSelected = (responses[9] ?? 0) > 0;
  const epdsBand = interpretEpds(epdsTotal);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 60,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => goBack("/(tabs)/resources")} hitSlop={10}>
            <Feather name={directionalIcon("chevron-left")} size={26} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t("ppdRisk.title")}</Text>
          <View style={{ width: 26 }} />
        </View>

        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          A private, evidence-informed screen for postpartum depression risk, inspired by clinical
          research showing that mood screening plus a few personal factors predicts risk well ahead
          of time. It is not a diagnosis.
        </Text>

        {/* EPDS */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("ppdRisk.moodPastWeek")}</Text>
        <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{EPDS_INTRO}</Text>

        {EPDS_ITEMS.map((item, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.qNum, { color: colors.primary }]}>{i + 1} of 10</Text>
            <Text style={[styles.qPrompt, { color: colors.foreground }]}>{item.prompt}</Text>
            {item.options.map((opt, oi) => {
              const selected = responses[i] === opt.score;
              return (
                <Pressable
                  key={oi}
                  onPress={() => selectOption(i, opt.score)}
                  style={[
                    styles.option,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + "18" : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selected ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.optionText, { color: colors.foreground }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {selfHarmSelected && (
          <View style={[styles.crisisNote, { backgroundColor: "#FDECEC" }]}>
            <Text style={[styles.crisisText, { color: "#9A1010" }]}>
              Thank you for your honesty. Thoughts of self-harm deserve care right now. You can call
              or text 988 (US) anytime — free, confidential, 24/7.
            </Text>
            <Pressable onPress={() => Linking.openURL("tel:988").catch(() => {})}>
              <Text style={[styles.crisisLink, { color: "#9A1010" }]}>{t("ppdRisk.call988")}</Text>
            </Pressable>
          </View>
        )}

        {/* Factors */}
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>{t("ppdRisk.yourHistory")}</Text>
        <FactorGroup factors={HISTORY_FACTORS} state={factors} onToggle={toggleFactor} colors={colors} />

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>{t("ppdRisk.lifeNow")}</Text>
        <FactorGroup factors={LIFE_FACTORS} state={factors} onToggle={toggleFactor} colors={colors} />

        <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 20 }]}>{t("ppdRisk.pregnancyBirth")}</Text>
        <FactorGroup factors={BIRTH_FACTORS} state={factors} onToggle={toggleFactor} colors={colors} />

        {/* Contribute toggle (only when research consent is on) */}
        {researchConsented && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
            <View style={styles.contributeRow}>
              <View style={{ flex: 1, paddingEnd: 12 }}>
                <Text style={[styles.contributeTitle, { color: colors.foreground }]}>
                  {t("ppdRisk.addToResearch")}
                </Text>
                <Text style={[styles.contributeSub, { color: colors.mutedForeground }]}>
                  Stores only your de-identified answers (no name, no free text) under your anonymous
                  research ID to help improve the model.
                </Text>
              </View>
              <Switch value={contribute} onValueChange={setContribute} />
            </View>
          </View>
        )}

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          style={[
            styles.submitBtn,
            { backgroundColor: allAnswered ? colors.primary : colors.muted, opacity: loading ? 0.7 : 1 },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.submitText, { color: allAnswered ? colors.primaryForeground : colors.mutedForeground }]}>
              {allAnswered ? "Get my risk estimate" : `Answer all questions (${answeredCount}/10)`}
            </Text>
          )}
        </Pressable>

        {/* Result */}
        {result && <ResultCard result={result} colors={colors} epdsBandLabel={epdsBand.label} />}
      </ScrollView>
    </View>
  );
}

function FactorGroup({
  factors,
  state,
  onToggle,
  colors,
}: {
  factors: FactorDef[];
  state: Partial<Record<BooleanFeatureKey, boolean>>;
  onToggle: (key: BooleanFeatureKey) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {factors.map((f, i) => (
        <Pressable
          key={f.key}
          onPress={() => onToggle(f.key)}
          style={[styles.factorRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
        >
          <Text style={[styles.factorLabel, { color: colors.foreground }]}>{f.label}</Text>
          <View
            style={[
              styles.check,
              {
                borderColor: state[f.key] ? colors.primary : colors.mutedForeground,
                backgroundColor: state[f.key] ? colors.primary : "transparent",
              },
            ]}
          >
            {state[f.key] && <Feather name="check" size={14} color={colors.primaryForeground} />}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ResultCard({
  result,
  colors,
  epdsBandLabel,
}: {
  result: PpdRiskResult;
  colors: ReturnType<typeof useColors>;
  epdsBandLabel: string;
}) {
  const { t } = useTranslation();
  const tier = TIER_COPY[result.tier];
  const tierColor = colors[tier.colorKey];
  return (
    <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: tierColor }]}>
      <View style={[styles.tierBadge, { backgroundColor: tierColor + "22" }]}>
        <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
        <Text style={[styles.tierLabel, { color: tierColor }]}>{tier.label}</Text>
      </View>

      <Text style={[styles.resultScore, { color: colors.foreground }]}>
        {Math.round(result.probability * 100)}%
        <Text style={[styles.resultScoreSub, { color: colors.mutedForeground }]}>
          {"  "}estimated · ~{result.relativeRisk}× base rate
        </Text>
      </Text>

      <Text style={[styles.resultEpds, { color: colors.mutedForeground }]}>
        EPDS score {result.epdsScore ?? "—"}/30 · {epdsBandLabel}
      </Text>

      <Text style={[styles.interpretation, { color: colors.foreground }]}>{result.interpretation}</Text>

      {result.topContributors.length > 0 && (
        <>
          <Text style={[styles.contribHeader, { color: colors.foreground }]}>{t("ppdRisk.whatsDriving")}</Text>
          {result.topContributors.map((c) => (
            <View key={c.key} style={styles.contribRow}>
              <Text style={[styles.contribLabel, { color: colors.foreground }]}>{c.label}</Text>
              <View style={[styles.contribBarBg, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.contribBarFill,
                    { backgroundColor: tierColor, width: `${Math.round(c.share * 100)}%` },
                  ]}
                />
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>{result.disclaimer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  intro: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  sectionSub: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular", marginBottom: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  qNum: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 6, letterSpacing: 0.4 },
  qPrompt: { fontSize: 15, fontFamily: "Inter_500Medium", marginBottom: 12, lineHeight: 21 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginEnd: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  optionText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  crisisNote: { borderRadius: 14, padding: 16, marginBottom: 12 },
  crisisText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium", marginBottom: 8 },
  crisisLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  factorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  factorLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingEnd: 12, lineHeight: 19 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  contributeRow: { flexDirection: "row", alignItems: "center" },
  contributeTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  contributeSub: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  submitBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  resultCard: { borderRadius: 18, borderWidth: 1.5, padding: 20, marginTop: 22 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4, marginEnd: 7 },
  tierLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  resultScore: { fontSize: 34, fontFamily: "Inter_700Bold" },
  resultScoreSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  resultEpds: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4, marginBottom: 14 },
  interpretation: { fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular", marginBottom: 16 },
  contribHeader: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  contribRow: { marginBottom: 10 },
  contribLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 5 },
  contribBarBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  contribBarFill: { height: 8, borderRadius: 4 },
  disclaimer: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    marginTop: 16,
    fontStyle: "italic",
  },
});
