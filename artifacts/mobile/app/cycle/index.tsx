import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BBTChart } from "@/components/cycle/BBTChart";
import { ConfidencePill } from "@/components/cycle/ConfidencePill";
import { CycleStrip } from "@/components/cycle/CycleStrip";
import { useApp } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import {
  REPRODUCTIVE_PHASE_LABELS,
  toDateString,
  type CervicalMucusType,
  type ReproductivePhase,
} from "@/types/health";
import { goBack } from "@/utils/navigation";
import { detectPhase, predictCycle } from "@/utils/wellnessAlgorithm";

const MUCUS_LABELS: Record<CervicalMucusType, string> = {
  dry: "Dry",
  sticky: "Sticky",
  creamy: "Creamy",
  watery: "Watery",
  eggwhite: "Egg-white",
};

const PHASE_ICONS: Record<ReproductivePhase, keyof typeof Feather.glyphMap> = {
  menstrual: "droplet",
  follicular: "trending-up",
  ovulation: "sun",
  luteal: "moon",
  pregnancy: "heart",
  postpartum: "heart",
  menopause: "sunrise",
  unknown: "help-circle",
};

const PHASE_EXPLAINERS: Record<ReproductivePhase, string> = {
  menstrual: "Your period is here — a good time for rest and gentle self-care.",
  follicular: "Hormones are rising as your body prepares for ovulation.",
  ovulation: "Your body's fertile window — estrogen peaks around this time.",
  luteal: "Progesterone rises after ovulation, which can affect mood and sleep.",
  pregnancy: "Cycle tracking pauses — we're showing pregnancy-related context instead.",
  postpartum: "Your cycle is likely still resetting after birth — this varies a lot person to person.",
  menopause: "Your logged data suggests a menopausal pattern, without regular periods.",
  unknown: "Log a few days of data so we can start recognizing your pattern.",
};

function phaseColor(phase: ReproductivePhase, colors: ReturnType<typeof useColors>): string {
  switch (phase) {
    case "menstrual":
      return colors.riskHigh;
    case "follicular":
      return colors.primary;
    case "ovulation":
      return colors.teal;
    case "luteal":
      return colors.purple;
    case "pregnancy":
    case "postpartum":
      return colors.warm;
    case "menopause":
      return colors.mutedForeground;
    default:
      return colors.mutedForeground;
  }
}

function formatDate(date?: string): string {
  if (!date) return "—";
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function flowDotColor(flow: string | undefined, colors: ReturnType<typeof useColors>): string | null {
  if (!flow || flow === "none") return null;
  if (flow === "spotting") return colors.riskModerate;
  return colors.riskHigh;
}

export default function CycleDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useApp();
  const { cycleEntries } = useHealth();

  const today = toDateString(new Date());

  const phase = useMemo(
    () => detectPhase({ birthDate: profile?.birthDate ?? null, cycleEntries, today }),
    [profile?.birthDate, cycleEntries, today]
  );

  const prediction = useMemo(() => predictCycle(cycleEntries, today), [cycleEntries, today]);

  const recentEntries = useMemo(() => cycleEntries.slice(0, 10), [cycleEntries]);

  const bbtCount = useMemo(() => cycleEntries.filter((e) => typeof e.bbt === "number").length, [cycleEntries]);

  const heroColor = phaseColor(phase, colors);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack("/(tabs)")} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cycle & Biomarkers</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: current phase */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.heroRow}>
            <View style={[styles.phaseIcon, { backgroundColor: heroColor + "1F" }]}>
              <Feather name={PHASE_ICONS[phase]} size={24} color={heroColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.phaseLabel, { color: colors.foreground }]}>
                {REPRODUCTIVE_PHASE_LABELS[phase]}
              </Text>
              {prediction.currentCycleDay !== undefined && prediction.avgCycleLength !== undefined ? (
                <Text style={[styles.cycleDay, { color: colors.mutedForeground }]}>
                  Day {prediction.currentCycleDay} of ~{Math.round(prediction.avgCycleLength)}
                </Text>
              ) : (
                <Text style={[styles.cycleDay, { color: colors.mutedForeground }]}>
                  Not enough data to estimate your cycle day yet
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.phaseExplainer, { color: colors.text }]}>
            {PHASE_EXPLAINERS[phase]}
          </Text>
        </View>

        {/* Predictions */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Predictions</Text>

          {prediction.confidence === "none" ? (
            <View style={[styles.emptyPredictionBox, { backgroundColor: colors.secondary }]}>
              <Feather name="calendar" size={18} color={colors.mutedForeground} />
              <Text style={[styles.emptyPredictionText, { color: colors.mutedForeground }]}>
                Log a few more days of flow to unlock predictions for your next period and fertile
                window.
              </Text>
            </View>
          ) : (
            <View style={styles.predictionList}>
              <PredictionRow
                icon="droplet"
                label="Next period"
                value={formatDate(prediction.nextPeriodStart)}
                confidence={prediction.confidence}
                colors={colors}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <PredictionRow
                icon="sun"
                label="Fertile window"
                value={
                  prediction.fertileWindowStart && prediction.fertileWindowEnd
                    ? `${formatDate(prediction.fertileWindowStart)} – ${formatDate(prediction.fertileWindowEnd)}`
                    : "—"
                }
                confidence={prediction.confidence}
                colors={colors}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <PredictionRow
                icon="star"
                label="Estimated ovulation"
                value={formatDate(prediction.ovulationDate)}
                confidence={prediction.confidence}
                colors={colors}
              />
            </View>
          )}

          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Estimates based on your logged data — not contraception guidance.
          </Text>
        </View>

        {/* 35-day strip */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Your calendar</Text>
          <CycleStrip entries={cycleEntries} prediction={prediction} today={today} />
        </View>

        {/* BBT mini chart */}
        {bbtCount >= 5 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Basal body temperature
            </Text>
            <BBTChart entries={cycleEntries} maxPoints={21} />
          </View>
        )}

        {/* Recent entries */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Recent entries</Text>
          {recentEntries.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No entries yet. Start logging to see your history here.
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {recentEntries.map((entry) => {
                const dot = flowDotColor(entry.flow, colors);
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => router.push(`/cycle/log?date=${entry.date}`)}
                    style={({ pressed }) => [
                      styles.entryRow,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={styles.entryDateCol}>
                      <Text style={[styles.entryDate, { color: colors.foreground }]}>
                        {formatDate(entry.date)}
                      </Text>
                      {dot && <View style={[styles.flowDot, { backgroundColor: dot }]} />}
                    </View>
                    <View style={styles.entryMetaCol}>
                      <Text style={[styles.entryMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {[
                          entry.bbt ? `${entry.bbt.toFixed(2)}°C` : null,
                          entry.cervicalMucus ? MUCUS_LABELS[entry.cervicalMucus] : null,
                          entry.ovulationTest && entry.ovulationTest !== "not_taken"
                            ? `Ov: ${entry.ovulationTest}`
                            : null,
                          entry.pregnancyTest && entry.pregnancyTest !== "not_taken"
                            ? `Preg: ${entry.pregnancyTest}`
                            : null,
                          entry.symptoms.length > 0 ? `${entry.symptoms.length} symptom${entry.symptoms.length > 1 ? "s" : ""}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No details logged"}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Pressable
          onPress={() => router.push("/cycle/log")}
          style={({ pressed }) => [
            styles.logBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="edit-3" size={17} color="#fff" />
          <Text style={styles.logBtnText}>Log today</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PredictionRow({
  icon,
  label,
  value,
  confidence,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  confidence: "none" | "low" | "medium" | "high";
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.predictionRow}>
      <View style={[styles.predictionIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.predictionValue, { color: colors.foreground }]}>{value}</Text>
      </View>
      <ConfidencePill confidence={confidence} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  phaseIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  phaseLabel: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
  },
  cycleDay: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  phaseExplainer: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  predictionList: {
    gap: 0,
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  predictionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  predictionLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  predictionValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 1,
  },
  divider: {
    height: 1,
  },
  emptyPredictionBox: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 14,
    padding: 14,
    alignItems: "flex-start",
  },
  emptyPredictionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  disclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    lineHeight: 16,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 12,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  entryDateCol: {
    width: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  entryDate: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  flowDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  entryMetaCol: {
    flex: 1,
  },
  entryMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  logBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  logBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
