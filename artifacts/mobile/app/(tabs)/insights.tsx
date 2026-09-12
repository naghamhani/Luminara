import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ContributionBars from "@/components/charts/ContributionBars";
import BBTChart from "@/components/charts/BBTChart";
import PhaseRibbon from "@/components/charts/PhaseRibbon";
import SelfVsPartnerBars from "@/components/charts/SelfVsPartnerBars";
import { useApp, type CheckIn } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import {
  REPRODUCTIVE_PHASE_LABELS,
  daysBetween,
  type LabMarker,
  type Recommendation,
} from "@/types/health";
import { computeSleepAnxietyCorrelation } from "@/utils/correlations";
import { useTranslation } from "@/i18n";
import {
  calculateWellnessScore,
  correlateWithPartner,
  detectPhase,
  getRecommendations,
  predictCycle,
  predictRiskWindows,
} from "@/utils/wellnessAlgorithm";

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const CATEGORY_ICONS: Record<Recommendation["category"], keyof typeof Feather.glyphMap> = {
  nutrition: "coffee",
  exercise: "activity",
  mindfulness: "wind",
  medical: "heart",
  sleep: "moon",
  support: "users",
};

const PRIORITY_LABELS: Record<1 | 2 | 3, string> = {
  1: "Priority",
  2: "Worth trying",
  3: "Gentle ideas",
};

// ---------------------------------------------------------------------------
// Small shared pieces
// ---------------------------------------------------------------------------

function SectionHeader({ title, icon }: { title: string; icon?: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeaderRow}>
      {icon ? <Feather name={icon} size={15} color={colors.mutedForeground} /> : null}
      <Text style={[styles.sectionHeader, { color: colors.foreground }]}>{title}</Text>
    </View>
  );
}

function TrendMiniBars({
  checkIns,
  selectField,
  max,
  color,
}: {
  checkIns: CheckIn[];
  selectField: (c: CheckIn) => number;
  max: number;
  color: string;
}) {
  const colors = useColors();
  const last14 = useMemo(() => [...checkIns].slice(0, 14).reverse(), [checkIns]);

  return (
    <View style={trendStyles.row}>
      {last14.map((c) => {
        const v = selectField(c);
        const pct = Math.max(0.06, Math.min(1, v / max));
        const d = new Date(c.date + "T12:00:00");
        return (
          <View key={c.id} style={trendStyles.col}>
            <View style={[trendStyles.track, { height: 40 }]}>
              <View
                style={[
                  trendStyles.fill,
                  { height: `${pct * 100}%` as any, backgroundColor: color },
                ]}
              />
            </View>
            <Text style={[trendStyles.dayLabel, { color: colors.mutedForeground }]}>
              {d.getDate()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const trendStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 3 },
  col: { flex: 1, alignItems: "center", gap: 4 },
  track: {
    width: "100%",
    maxWidth: 14,
    backgroundColor: "#E4E8F5",
    borderRadius: 4,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: "100%", borderRadius: 4 },
  dayLabel: { fontSize: 8, fontFamily: "Inter_500Medium" },
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function InsightsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { checkIns, profile } = useApp();
  const {
    cycleEntries,
    labResults,
    medications,
    partnerObservations,
    partnerSettings,
    careProfile,
  } = useHealth();

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }, []);

  const phase = useMemo(
    () =>
      detectPhase({
        birthDate: profile?.birthDate ?? null,
        cycleEntries,
        today,
      }),
    [profile?.birthDate, cycleEntries, today]
  );

  const cyclePrediction = useMemo(() => predictCycle(cycleEntries, today), [cycleEntries, today]);

  const latestCheckIn = checkIns[0] ?? null;

  // Partner visibility gate: shared observations from last 7 days, only when
  // both userCanViewObservations is on AND the entries were shared.
  const partnerVisible = partnerSettings.userCanViewObservations;

  const recentPartnerObservations = useMemo(() => {
    if (!partnerVisible) return [];
    return partnerObservations.filter(
      (o) => o.sharedWithUser && daysBetween(o.date, today) <= 7 && daysBetween(o.date, today) >= 0
    );
  }, [partnerObservations, partnerVisible, today]);

  const recentLabMarkers: LabMarker[] = useMemo(() => {
    const cutoffLabs = labResults.filter((l) => daysBetween(l.date, today) <= 90 && daysBetween(l.date, today) >= 0);
    return cutoffLabs.flatMap((l) => l.markers);
  }, [labResults, today]);

  const activeMedications = useMemo(() => medications.filter((m) => m.active), [medications]);

  const recentSymptoms = useMemo(() => {
    const recentEntries = cycleEntries.filter(
      (e) => daysBetween(e.date, today) <= 14 && daysBetween(e.date, today) >= 0
    );
    return recentEntries.flatMap((e) => e.symptoms);
  }, [cycleEntries, today]);

  const recentHeavyFlowDays = useMemo(
    () =>
      cycleEntries.filter(
        (e) =>
          (e.flow === "heavy" || e.flow === "medium") &&
          daysBetween(e.date, today) <= 60 &&
          daysBetween(e.date, today) >= 0
      ).length,
    [cycleEntries, today]
  );

  const wellnessInput = useMemo(
    () => ({
      factors: latestCheckIn
        ? {
            mood: latestCheckIn.mood,
            sleep: latestCheckIn.sleep,
            anxiety: latestCheckIn.anxiety,
            appetite: latestCheckIn.appetite,
            bonding: latestCheckIn.bonding,
            support: latestCheckIn.support,
          }
        : undefined,
      phase,
      labMarkers: recentLabMarkers,
      activeMedications,
      partnerObservations: recentPartnerObservations,
      recentSymptoms,
      careProfile,
      recentHeavyFlowDays,
    }),
    [latestCheckIn, phase, recentLabMarkers, activeMedications, recentPartnerObservations, recentSymptoms, careProfile, recentHeavyFlowDays]
  );

  const wellnessResult = useMemo(() => calculateWellnessScore(wellnessInput), [wellnessInput]);

  const wellnessPct = Math.max(0, 100 - wellnessResult.score);
  const levelColor =
    wellnessResult.level === "low"
      ? colors.riskLow
      : wellnessResult.level === "moderate"
      ? colors.riskModerate
      : colors.riskHigh;

  // --- BBT & biomarker stats -------------------------------------------------
  const bbtStats = useMemo(() => {
    const withBbt = cycleEntries.filter((e) => typeof e.bbt === "number");
    if (withBbt.length === 0) return null;

    // Split into follicular vs luteal using the current prediction's
    // ovulation date when available (entries before it = follicular, on/after
    // = luteal). This is a coarse approximation across whatever cycles are
    // logged, not a per-cycle classification.
    let follicular: number[] = [];
    let luteal: number[] = [];
    if (cyclePrediction.ovulationDate) {
      const ovulationDate = cyclePrediction.ovulationDate;
      follicular = withBbt.filter((e) => e.date < ovulationDate).map((e) => e.bbt!);
      luteal = withBbt.filter((e) => e.date >= ovulationDate).map((e) => e.bbt!);
    }

    const mucusPeakDays = cycleEntries.filter((e) => e.cervicalMucus === "eggwhite").length;
    const positiveOvulationTests = cycleEntries.filter((e) => e.ovulationTest === "positive").length;
    const positivePregnancyTests = cycleEntries.filter((e) => e.pregnancyTest === "positive").length;

    return {
      avgFollicular: follicular.length ? avg(follicular) : null,
      avgLuteal: luteal.length ? avg(luteal) : null,
      mucusPeakDays,
      positiveOvulationTests,
      positivePregnancyTests,
    };
  }, [cycleEntries, cyclePrediction]);

  // --- Lab flags (last 180 days) ---------------------------------------------
  const flaggedLabs = useMemo(() => {
    const cutoff = labResults.filter(
      (l) => daysBetween(l.date, today) <= 180 && daysBetween(l.date, today) >= 0
    );
    const flagged: { marker: LabMarker; testName: string; date: string }[] = [];
    for (const l of cutoff) {
      for (const m of l.markers) {
        if (m.flag !== "normal") flagged.push({ marker: m, testName: l.testName, date: l.date });
      }
    }
    return flagged;
  }, [labResults, today]);

  // --- Risk windows -----------------------------------------------------------
  const riskWindows = useMemo(
    () => predictRiskWindows(checkIns, cycleEntries, today),
    [checkIns, cycleEntries, today]
  );

  // --- Recommendations ---------------------------------------------------------
  const recommendations = useMemo(
    () => getRecommendations({ ...wellnessInput, result: wellnessResult }),
    [wellnessInput, wellnessResult]
  );

  const groupedRecommendations = useMemo(() => {
    const groups: Record<1 | 2 | 3, Recommendation[]> = { 1: [], 2: [], 3: [] };
    for (const r of recommendations) groups[r.priority].push(r);
    return groups;
  }, [recommendations]);

  // --- Self vs partner correlation ---------------------------------------------
  const partnerCorrelations = useMemo(
    () => correlateWithPartner(checkIns, partnerObservations),
    [checkIns, partnerObservations]
  );

  const hasComparableCorrelation = partnerCorrelations.some(
    (c) => c.agreement !== "insufficient_data"
  );

  const showPartnerSection = partnerVisible && hasComparableCorrelation;
  const showPartnerOffNotice =
    partnerSettings.enabled && !partnerSettings.userCanViewObservations;

  // --- Sleep vs. anxiety signal correlation ------------------------------------
  const sleepAnxietyInsight = useMemo(
    () => computeSleepAnxietyCorrelation(checkIns),
    [checkIns]
  );

  if (!checkIns.length && cycleEntries.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: colors.background, paddingTop: insets.top + 20 },
        ]}
      >
        <Text style={{ fontSize: 52 }}>🔭</Text>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t("insights.empty")}</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Complete a few daily check-ins or log a cycle entry to unlock personalized wellness
          insights.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{t("insights.eyebrow")}</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Whole-Picture{"\n"}Wellness
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            {t("insights.sub")}
          </Text>
        </View>
        <View
          style={[styles.wellnessOrb, { backgroundColor: levelColor + "18", borderColor: levelColor + "50" }]}
        >
          <Text style={[styles.orbPct, { color: levelColor }]}>{wellnessPct}%</Text>
          <Text style={[styles.orbLabel, { color: colors.mutedForeground }]}>Wellness</Text>
        </View>
      </View>

      {/* 1. Wellness overview */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <SectionHeader title={t("insights.wellnessOverview")} icon="activity" />
        <View
          style={[
            styles.wellnessSummary,
            { backgroundColor: levelColor + "12", borderColor: levelColor + "30" },
          ]}
        >
          <Text style={[styles.wellnessScore, { color: levelColor }]}>{wellnessPct}%</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.wellnessLevelText, { color: colors.foreground }]}>
              {wellnessResult.level === "low"
                ? "Looking steady"
                : wellnessResult.level === "moderate"
                ? "Some signals to watch"
                : "Elevated signals"}
            </Text>
            <Text style={[styles.wellnessLevelSub, { color: colors.mutedForeground }]}>
              Blended from check-ins, phase, labs, medications, partner input, and cycle
              symptoms.
            </Text>
          </View>
        </View>
        <ContributionBars contributions={wellnessResult.contributions} />
        {!latestCheckIn && (
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            {t("insights.wellnessHint")}
          </Text>
        )}
      </View>

      {/* 2. Phase & cycle */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <SectionHeader title={t("insights.phaseCycle")} icon="calendar" />
        <View style={styles.phaseChipRow}>
          <View style={[styles.phaseChip, { backgroundColor: colors.blush }]}>
            <Text style={[styles.phaseChipText, { color: colors.purple }]}>
              {REPRODUCTIVE_PHASE_LABELS[phase]}
            </Text>
          </View>
          {cyclePrediction.currentCycleDay ? (
            <Text style={[styles.cycleDayText, { color: colors.mutedForeground }]}>
              Cycle day {cyclePrediction.currentCycleDay}
            </Text>
          ) : null}
        </View>

        <PhaseRibbon
          phase={phase}
          currentCycleDay={cyclePrediction.currentCycleDay}
          avgCycleLength={cyclePrediction.avgCycleLength}
        />

        {cyclePrediction.confidence !== "none" ? (
          <View style={styles.predictionGrid}>
            <View style={styles.predictionItem}>
              <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                {t("insights.nextPeriod")}
              </Text>
              <Text style={[styles.predictionValue, { color: colors.foreground }]}>
                {cyclePrediction.nextPeriodStart ? formatDate(cyclePrediction.nextPeriodStart) : "—"}
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                {t("insights.fertileWindow")}
              </Text>
              <Text style={[styles.predictionValue, { color: colors.foreground }]}>
                {cyclePrediction.fertileWindowStart && cyclePrediction.fertileWindowEnd
                  ? `${formatDate(cyclePrediction.fertileWindowStart)} – ${formatDate(
                      cyclePrediction.fertileWindowEnd
                    )}`
                  : "—"}
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                {t("insights.avgCycleLength")}
              </Text>
              <Text style={[styles.predictionValue, { color: colors.foreground }]}>
                {cyclePrediction.avgCycleLength ? `${cyclePrediction.avgCycleLength}d` : "—"}
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                {t("insights.confidence")}
              </Text>
              <Text style={[styles.predictionValue, { color: colors.foreground }]}>
                {cyclePrediction.confidence.charAt(0).toUpperCase() + cyclePrediction.confidence.slice(1)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            {t("insights.cycleHint")}
          </Text>
        )}
      </View>

      {/* 3. BBT & biomarkers */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <SectionHeader title={t("insights.bbtBiomarkers")} icon="thermometer" />
        <BBTChart
          cycleEntries={cycleEntries}
          fertileWindowStart={cyclePrediction.fertileWindowStart}
          fertileWindowEnd={cyclePrediction.fertileWindowEnd}
        />
        {bbtStats && (
          <View style={styles.statChipsRow}>
            <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>
                {t("insights.follicularAvg")}
              </Text>
              <Text style={[styles.statChipValue, { color: colors.foreground }]}>
                {bbtStats.avgFollicular !== null ? `${bbtStats.avgFollicular}°C` : "—"}
              </Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>
                {t("insights.lutealAvg")}
              </Text>
              <Text style={[styles.statChipValue, { color: colors.foreground }]}>
                {bbtStats.avgLuteal !== null ? `${bbtStats.avgLuteal}°C` : "—"}
              </Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>
                {t("insights.mucusPeak")}
              </Text>
              <Text style={[styles.statChipValue, { color: colors.foreground }]}>
                {bbtStats.mucusPeakDays}
              </Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>
                {t("insights.positiveOpks")}
              </Text>
              <Text style={[styles.statChipValue, { color: colors.foreground }]}>
                {bbtStats.positiveOvulationTests}
              </Text>
            </View>
            {bbtStats.positivePregnancyTests > 0 && (
              <View style={[styles.statChip, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.statChipLabel, { color: colors.mutedForeground }]}>
                  {t("insights.positivePregTests")}
                </Text>
                <Text style={[styles.statChipValue, { color: colors.foreground }]}>
                  {bbtStats.positivePregnancyTests}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* 4. Factor trends */}
      {checkIns.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <SectionHeader title={t("insights.factorTrends")} icon="trending-up" />
          <Text style={[styles.trendGroupLabel, { color: colors.text }]}>{t("insights.moodLast14")}</Text>
          <TrendMiniBars checkIns={checkIns} selectField={(c) => c.mood} max={5} color={colors.primary} />
          <Text style={[styles.trendGroupLabel, { color: colors.text }]}>{t("insights.sleepHours")}</Text>
          <TrendMiniBars checkIns={checkIns} selectField={(c) => c.sleep} max={10} color={colors.teal} />
          <Text style={[styles.trendGroupLabel, { color: colors.text }]}>Anxiety</Text>
          <TrendMiniBars checkIns={checkIns} selectField={(c) => c.anxiety} max={5} color={colors.warm} />
        </View>
      )}

      {/* 4b. Sleep vs. anxiety signal correlation */}
      {sleepAnxietyInsight && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <SectionHeader title={t("insights.sleepAnxiety")} icon="moon" />
          <View
            style={[
              styles.wellnessSummary,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.correlationRatio, { color: colors.primary }]}>
              {Number.isFinite(sleepAnxietyInsight.ratio) ? `${sleepAnxietyInsight.ratio}x` : "—"}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.wellnessLevelText, { color: colors.foreground }]}>
                {sleepAnxietyInsight.headline}
              </Text>
              <Text style={[styles.wellnessLevelSub, { color: colors.mutedForeground }]}>
                {sleepAnxietyInsight.detail}
              </Text>
            </View>
          </View>
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Computed from your own logged sleep and anxiety over the last 30 days — a pattern to
            notice, not a diagnosis.
          </Text>
        </View>
      )}

      {/* 5. Self vs Partner */}
      {showPartnerSection && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <SectionHeader title={t("insights.selfVsPartner")} icon="users" />
          <SelfVsPartnerBars correlations={partnerCorrelations} />
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Differences here are conversation starters, not verdicts — everyone experiences days
            differently.
          </Text>
        </View>
      )}
      {!showPartnerSection && showPartnerOffNotice && (
        <View style={[styles.quietNoticeCard, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.quietNoticeText, { color: colors.mutedForeground }]}>
            {t("insights.partnerOff")}
          </Text>
        </View>
      )}

      {/* 6. Lab flags */}
      {flaggedLabs.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.softRed }]}>
          <SectionHeader title={t("insights.labFlags")} icon="flag" />
          <View style={styles.flagList}>
            {flaggedLabs.map((f, i) => (
              <View key={`${f.testName}-${f.marker.name}-${i}`} style={styles.flagRow}>
                <View style={[styles.flagDot, { backgroundColor: colors.riskHigh }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.flagName, { color: colors.foreground }]}>
                    {f.marker.name} — {f.marker.value} {f.marker.unit}
                  </Text>
                  <Text style={[styles.flagMeta, { color: colors.mutedForeground }]}>
                    {f.marker.flag === "high" ? "Above" : "Below"} reference range ·{" "}
                    {formatDate(f.date)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={[styles.disclaimer, { color: "#9A5010" }]}>
            {t("insights.labsDisclaimer")}
          </Text>
        </View>
      )}

      {/* 7. Risk windows ahead */}
      {riskWindows.length > 0 && (
        <View style={styles.riskWindowsSection}>
          <SectionHeader title={t("insights.riskWindows")} icon="alert-circle" />
          {riskWindows.map((w, i) => {
            const tint = w.severity === "elevated" ? colors.riskModerate : colors.primary;
            return (
              <View
                key={i}
                style={[
                  styles.riskWindowCard,
                  { backgroundColor: colors.card, borderStartColor: tint, borderStartWidth: 4 },
                ]}
              >
                <View style={styles.riskWindowHeader}>
                  <Text style={[styles.riskWindowDate, { color: colors.foreground }]}>
                    {w.start === w.end ? formatDate(w.start) : `${formatDate(w.start)} – ${formatDate(w.end)}`}
                  </Text>
                  <View style={[styles.riskWindowBadge, { backgroundColor: tint + "1A" }]}>
                    <Text style={[styles.riskWindowBadgeText, { color: tint }]}>
                      {w.severity === "elevated" ? "Gentle heads-up" : "Worth noticing"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.riskWindowReason, { color: colors.mutedForeground }]}>
                  {w.reason}
                </Text>
                <Text style={[styles.riskWindowSuggestion, { color: colors.mutedForeground }]}>
                  {t("insights.riskHint")}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* 8. Suggestions for you */}
      {recommendations.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <SectionHeader title={t("insights.suggestions")} icon="sun" />
          {([1, 2, 3] as const).map((priority) =>
            groupedRecommendations[priority].length > 0 ? (
              <View key={priority} style={styles.recGroup}>
                <Text style={[styles.recGroupLabel, { color: colors.mutedForeground }]}>
                  {PRIORITY_LABELS[priority].toUpperCase()}
                </Text>
                {groupedRecommendations[priority].map((r) => (
                  <View key={r.id} style={styles.recRow}>
                    <View style={[styles.recIcon, { backgroundColor: colors.secondary }]}>
                      <Feather name={CATEGORY_ICONS[r.category]} size={15} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recTitle, { color: colors.foreground }]}>{r.title}</Text>
                      <Text style={[styles.recBody, { color: colors.mutedForeground }]}>{r.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          )}
          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            {t("insights.suggestionsNote")}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 32, marginBottom: 6 },
  heroSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  wellnessOrb: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  orbPct: { fontSize: 20, fontFamily: "Inter_700Bold" },
  orbLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeader: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wellnessSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  wellnessScore: { fontSize: 30, fontFamily: "Inter_700Bold" },
  correlationRatio: { fontSize: 26, fontFamily: "Inter_700Bold" },
  wellnessLevelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  wellnessLevelSub: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  phaseChipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  phaseChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  phaseChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cycleDayText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  predictionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  predictionItem: { width: "47%", gap: 2 },
  predictionLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  predictionValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statChip: { flexGrow: 1, minWidth: "23%", borderRadius: 12, padding: 10, gap: 2 },
  statChipLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  statChipValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  trendGroupLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  quietNoticeCard: { borderRadius: 16, padding: 14 },
  quietNoticeText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  flagList: { gap: 10 },
  flagRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  flagDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  flagName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  flagMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  riskWindowsSection: { gap: 10 },
  riskWindowCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  riskWindowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  riskWindowDate: { fontSize: 13, fontFamily: "Inter_700Bold" },
  riskWindowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  riskWindowBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  riskWindowReason: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  riskWindowSuggestion: { fontSize: 11, fontFamily: "Inter_500Medium", fontStyle: "italic" },
  recGroup: { gap: 10 },
  recGroupLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  recRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  recTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  recBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
