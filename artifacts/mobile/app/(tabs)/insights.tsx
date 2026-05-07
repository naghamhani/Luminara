import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getRiskLevel, CheckIn } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

function TrendLine({ data }: { data: { date: string; score: number }[] }) {
  const colors = useColors();
  if (data.length < 2) return null;

  const maxScore = Math.max(...data.map((d) => d.score), 1);
  const W = 280;
  const H = 80;
  const pad = 10;

  const points = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - pad - ((d.score / 100) * (H - pad * 2)),
    score: d.score,
    date: d.date,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");

  const latest = points[points.length - 1];
  const level = getRiskLevel(latest.score);
  const lineColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;

  return (
    <View style={trendStyles.container}>
      <View style={[trendStyles.chart, { width: W, height: H }]}>
        {[0, 35, 65, 100].map((threshold) => (
          <View
            key={threshold}
            style={[
              trendStyles.gridLine,
              {
                bottom: ((threshold / 100) * (H - pad * 2)) + pad - 0.5,
                backgroundColor:
                  threshold === 0
                    ? "transparent"
                    : threshold === 35
                    ? colors.riskLow + "40"
                    : threshold === 65
                    ? colors.riskModerate + "40"
                    : colors.riskHigh + "40",
              },
            ]}
          />
        ))}

        {points.map((p, i) => {
          const l = getRiskLevel(p.score);
          const c =
            l === "low" ? colors.riskLow : l === "moderate" ? colors.riskModerate : colors.riskHigh;
          return (
            <View
              key={i}
              style={[
                trendStyles.dot,
                { left: p.x - 4, bottom: H - p.y - 4, backgroundColor: c },
              ]}
            />
          );
        })}
      </View>

      <View style={trendStyles.dateRow}>
        <Text style={[trendStyles.dateLabel, { color: colors.mutedForeground }]}>
          {new Date(points[0].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
        <Text style={[trendStyles.dateLabel, { color: colors.mutedForeground }]}>
          {new Date(points[points.length - 1].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </Text>
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: { gap: 4 },
  chart: { position: "relative" },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dateLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});

function InsightCard({
  icon,
  title,
  value,
  color,
  bg,
}: {
  icon: string;
  title: string;
  value: string;
  color: string;
  bg: string;
}) {
  const colors = useColors();
  return (
    <View style={[cardStyles.card, { backgroundColor: colors.card }]}>
      <View style={[cardStyles.iconCircle, { backgroundColor: bg }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={[cardStyles.title, { color: colors.mutedForeground }]}>{title}</Text>
      <Text style={[cardStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  value: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
});

const TIPS = [
  "Rest whenever your baby sleeps, even briefly.",
  "Accept help from family and friends — it takes a village.",
  "Short walks outside can significantly lift your mood.",
  "Talk to someone you trust about how you're feeling.",
  "Eat nourishing meals; your body is still healing.",
  "Postpartum feelings are common — you are not alone.",
  "A 10-minute breathing exercise can reduce anxiety.",
  "Connect with other new moms; shared experiences help.",
];

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns, weeklyRiskTrend, averageRiskScore, riskLevel } = useApp();

  const stats = useMemo(() => {
    if (checkIns.length === 0) return null;
    const last7 = checkIns.slice(0, 7);
    const last30 = checkIns.slice(0, 30);
    return {
      avgMood: avg(last7.map((c) => c.mood)),
      avgSleep: parseFloat((last7.reduce((a, c) => a + c.sleep, 0) / last7.length).toFixed(1)),
      avgAnxiety: avg(last7.map((c) => c.anxiety)),
      avgBonding: avg(last7.map((c) => c.bonding)),
      avgSupport: avg(last7.map((c) => c.support)),
      totalEntries: checkIns.length,
      lowDays: last30.filter((c) => c.riskScore <= 35).length,
      highDays: last30.filter((c) => c.riskScore > 65).length,
      trend:
        last7.length >= 2
          ? last7[0].riskScore - last7[last7.length - 1].riskScore
          : 0,
    };
  }, [checkIns]);

  const tip = useMemo(() => {
    const idx = new Date().getDate() % TIPS.length;
    return TIPS[idx];
  }, []);

  const riskColor =
    riskLevel === "low"
      ? colors.riskLow
      : riskLevel === "moderate"
      ? colors.riskModerate
      : colors.riskHigh;

  if (checkIns.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          },
        ]}
      >
        <Feather name="bar-chart-2" size={48} color={colors.lavender} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
          No insights yet
        </Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Complete a few daily check-ins to unlock your personalized wellness insights and predictions.
        </Text>
      </View>
    );
  }

  const trendDir = stats ? (stats.trend > 5 ? "improving" : stats.trend < -5 ? "worsening" : "stable") : "stable";
  const trendColor =
    trendDir === "improving" ? colors.riskLow : trendDir === "worsening" ? colors.riskHigh : colors.riskModerate;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Insights</Text>

      <View style={[styles.predictionCard, { backgroundColor: riskColor + "18" }]}>
        <View style={styles.predictionTop}>
          <View>
            <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
              Current PPD Risk
            </Text>
            <Text style={[styles.predictionScore, { color: riskColor }]}>
              {averageRiskScore}/100
            </Text>
          </View>
          <View style={[styles.predictionBadge, { backgroundColor: riskColor }]}>
            <Text style={styles.predictionBadgeText}>
              {riskLevel === "low" ? "Low Risk" : riskLevel === "moderate" ? "Moderate" : "High Risk"}
            </Text>
          </View>
        </View>
        <Text style={[styles.predictionNote, { color: colors.mutedForeground }]}>
          {riskLevel === "low"
            ? "Based on your recent check-ins, you are managing well. Keep up your self-care practices."
            : riskLevel === "moderate"
            ? "Your scores suggest moderate stress. Prioritize sleep, support, and moments of rest."
            : "Your risk score is elevated. Please speak with your doctor or a mental health professional."}
        </Text>
        {stats && (
          <View style={[styles.trendBadge, { backgroundColor: trendColor + "20" }]}>
            <Feather
              name={trendDir === "improving" ? "trending-down" : trendDir === "worsening" ? "trending-up" : "minus"}
              size={14}
              color={trendColor}
            />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {trendDir === "improving"
                ? "Improving over the past week"
                : trendDir === "worsening"
                ? "Higher risk this week — please reach out for support"
                : "Stable over the past week"}
            </Text>
          </View>
        )}
      </View>

      {weeklyRiskTrend.length >= 2 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Risk Trend</Text>
          <TrendLine data={weeklyRiskTrend} />
          <View style={styles.legendRow}>
            {[
              { color: colors.riskLow, label: "Low (0–35)" },
              { color: colors.riskModerate, label: "Moderate (36–65)" },
              { color: colors.riskHigh, label: "High (66+)" },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {stats && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>7-Day Averages</Text>
          <View style={styles.statsGrid}>
            <InsightCard
              icon="sun"
              title="Avg Mood"
              value={`${stats.avgMood}/5`}
              color={colors.accent}
              bg={colors.blush}
            />
            <InsightCard
              icon="moon"
              title="Avg Sleep"
              value={`${stats.avgSleep}h`}
              color={colors.primary}
              bg={colors.lavender}
            />
          </View>
          <View style={styles.statsGrid}>
            <InsightCard
              icon="heart"
              title="Bonding"
              value={`${stats.avgBonding}/5`}
              color={colors.riskLow}
              bg="#EDF7F1"
            />
            <InsightCard
              icon="users"
              title="Support"
              value={`${stats.avgSupport}/5`}
              color="#6B89D4"
              bg="#EEF2FF"
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>30-Day Summary</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: colors.riskLow }]}>{stats.lowDays}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Low risk days</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: colors.foreground }]}>{stats.totalEntries}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total entries</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryNum, { color: colors.riskHigh }]}>{stats.highDays}</Text>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>High risk days</Text>
              </View>
            </View>
          </View>
        </>
      )}

      <View style={[styles.tipCard, { backgroundColor: colors.blush }]}>
        <Text style={[styles.tipLabel, { color: "#8B4460" }]}>Tip of the day</Text>
        <Text style={[styles.tipText, { color: "#6B2C3F" }]}>{tip}</Text>
      </View>

      <View style={[styles.helpCard, { backgroundColor: colors.lavender }]}>
        <Feather name="phone" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.helpTitle, { color: colors.primary }]}>
            Need immediate support?
          </Text>
          <Text style={[styles.helpText, { color: colors.secondaryForeground }]}>
            Postpartum Support International{"\n"}
            Call: 1-800-944-4773{"\n"}
            Text: "HELLO" to 741741
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  screenTitle: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  predictionCard: {
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  predictionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  predictionLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  predictionScore: { fontSize: 36, fontFamily: "Inter_700Bold" },
  predictionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  predictionBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  predictionNote: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  trendText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  statsGrid: { flexDirection: "row", gap: 10 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  summaryItem: { alignItems: "center", gap: 4 },
  summaryNum: { fontSize: 28, fontFamily: "Inter_700Bold" },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  summaryDivider: { width: 1, height: 40 },
  tipCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  tipLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  tipText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  helpCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  helpTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  helpText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
