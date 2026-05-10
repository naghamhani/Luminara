import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getRiskLevel, CheckIn } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

function HorizontalBar({
  label,
  value,
  max,
  color,
  badge,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  badge?: string;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={barStyles.container}>
      <View style={barStyles.header}>
        <Text style={[barStyles.label, { color: colors.text }]}>{label}</Text>
        {badge && (
          <View style={[barStyles.badge, { backgroundColor: color + "20" }]}>
            <Text style={[barStyles.badgeText, { color }]}>{badge}</Text>
          </View>
        )}
      </View>
      <View style={[barStyles.track, { backgroundColor: colors.lavender }]}>
        <View style={[barStyles.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { gap: 6 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});

function TrendMiniChart({ data }: { data: { date: string; score: number }[] }) {
  const colors = useColors();
  if (data.length < 2) return null;

  const H = 60;
  const pad = 8;

  const points = data.map((d, i) => ({
    x: pad + (i / Math.max(data.length - 1, 1)) * (260 - pad * 2),
    y: H - pad - (d.score / 100) * (H - pad * 2),
    score: d.score,
    date: d.date,
  }));

  return (
    <View style={{ height: H, position: "relative" }}>
      {points.map((p, i) => {
        const level = getRiskLevel(p.score);
        const c =
          level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: p.x - 5,
              top: p.y - 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: c,
            }}
          />
        );
      })}
    </View>
  );
}

const COPING = [
  { emoji: "🌬️", tip: "Box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s" },
  { emoji: "🚶", tip: "A 10-min walk outside can reduce cortisol significantly" },
  { emoji: "🤝", tip: "Say 'yes' to help — it takes a village to raise a baby" },
  { emoji: "😴", tip: "Sleep when your baby sleeps, even 20-min naps help" },
  { emoji: "💬", tip: "Name your feelings out loud — it calms the nervous system" },
];

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns, weeklyRiskTrend, averageRiskScore, riskLevel, profile } = useApp();

  const stats = useMemo(() => {
    if (!checkIns.length) return null;
    const last7 = checkIns.slice(0, 7);
    const wellness = Math.max(0, 100 - averageRiskScore);
    const trendDir =
      last7.length >= 2
        ? last7[0].riskScore < last7[last7.length - 1].riskScore
          ? "improving"
          : last7[0].riskScore > last7[last7.length - 1].riskScore
          ? "worsening"
          : "stable"
        : "stable";

    return {
      moodHarmony: avg(last7.map((c) => c.mood)) / 5,
      restfulEnergy: Math.min(1, avg(last7.map((c) => c.sleep)) / 8),
      bondingScore: avg(last7.map((c) => c.bonding)) / 5,
      supportScore: avg(last7.map((c) => c.support)) / 5,
      anxietyResilience: 1 - (avg(last7.map((c) => c.anxiety)) - 1) / 4,
      wellness,
      trendDir,
      totalEntries: checkIns.length,
    };
  }, [checkIns, averageRiskScore]);

  const riskColor =
    riskLevel === "low" ? colors.riskLow : riskLevel === "moderate" ? colors.riskModerate : colors.riskHigh;

  const todayTip = useMemo(() => {
    const idx = new Date().getDate() % COPING.length;
    return COPING[idx];
  }, []);

  if (!checkIns.length) {
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
        <Text style={{ fontSize: 52 }}>🔭</Text>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No insights yet</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Complete a few daily check-ins to unlock personalized wellness insights.
        </Text>
      </View>
    );
  }

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
      <View style={styles.heroHeader}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>WEEKLY OVERVIEW</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Your Gentle{"\n"}Reflection</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Based on your data from the past 7 days.
          </Text>
        </View>
        <View
          style={[
            styles.wellnessOrb,
            {
              backgroundColor: riskColor + "18",
              borderColor: riskColor + "40",
            },
          ]}
        >
          <Text style={[styles.orbPct, { color: riskColor }]}>{stats?.wellness ?? 0}%</Text>
          <Text style={[styles.orbLabel, { color: colors.mutedForeground }]}>Wellness</Text>
        </View>
      </View>

      {stats && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Wellness Signals</Text>
          <View style={styles.barList}>
            <HorizontalBar
              label="Mood Harmony"
              value={stats.moodHarmony}
              max={1}
              color={colors.primary}
              badge={stats.moodHarmony >= 0.7 ? "Stable!" : stats.moodHarmony >= 0.5 ? "Variable" : "Low"}
            />
            <HorizontalBar
              label="Restful Energy"
              value={stats.restfulEnergy}
              max={1}
              color={colors.teal}
              badge={stats.restfulEnergy >= 0.75 ? "Good" : stats.restfulEnergy >= 0.5 ? "Fair" : "Poor"}
            />
            <HorizontalBar
              label="Baby Bonding"
              value={stats.bondingScore}
              max={1}
              color={colors.purple}
              badge={stats.bondingScore >= 0.75 ? "Strong" : "Growing"}
            />
            <HorizontalBar
              label="Anxiety Resilience"
              value={stats.anxietyResilience}
              max={1}
              color={colors.warm}
              badge={stats.anxietyResilience >= 0.7 ? "Managed" : "Elevated"}
            />
            <HorizontalBar
              label="Social Support"
              value={stats.supportScore}
              max={1}
              color="#6B89D4"
              badge={stats.supportScore >= 0.7 ? "Felt" : "Seeking"}
            />
          </View>
        </View>
      )}

      {weeklyRiskTrend.length >= 2 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Risk Trend</Text>
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    stats?.trendDir === "improving"
                      ? colors.softGreen
                      : stats?.trendDir === "worsening"
                      ? colors.softRed
                      : colors.muted,
                },
              ]}
            >
              <Feather
                name={
                  stats?.trendDir === "improving"
                    ? "trending-down"
                    : stats?.trendDir === "worsening"
                    ? "trending-up"
                    : "minus"
                }
                size={13}
                color={
                  stats?.trendDir === "improving"
                    ? colors.riskLow
                    : stats?.trendDir === "worsening"
                    ? colors.riskHigh
                    : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.trendText,
                  {
                    color:
                      stats?.trendDir === "improving"
                        ? colors.riskLow
                        : stats?.trendDir === "worsening"
                        ? colors.riskHigh
                        : colors.mutedForeground,
                  },
                ]}
              >
                {stats?.trendDir === "improving"
                  ? "Improving"
                  : stats?.trendDir === "worsening"
                  ? "Rising"
                  : "Stable"}
              </Text>
            </View>
          </View>
          <TrendMiniChart data={weeklyRiskTrend} />
          <View style={styles.legendRow}>
            {[
              { color: colors.riskLow, label: "Low" },
              { color: colors.riskModerate, label: "Moderate" },
              { color: colors.riskHigh, label: "High" },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.primary }]}>
        <Text style={styles.predTitle}>PPD Risk Assessment</Text>
        <Text style={styles.predSub}>
          {riskLevel === "low"
            ? "Based on your 7-day profile, your indicators are within low-risk range. Keep up your self-care practices."
            : riskLevel === "moderate"
            ? "Your data suggests moderate postpartum stress. Sleep, connection, and support are your best allies."
            : "Your risk score is elevated. Speaking with a healthcare provider is strongly encouraged."}
        </Text>
        <View style={styles.predRow}>
          <View style={[styles.predBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={styles.predBadgeText}>
              {riskLevel === "low" ? "🟢 Low Risk" : riskLevel === "moderate" ? "🟡 Moderate" : "🔴 High Risk"}
            </Text>
          </View>
          <Text style={styles.predEntries}>
            {stats?.totalEntries ?? 0} entries
          </Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>Today's Mindful Tip</Text>
        <View style={[styles.tipBox, { backgroundColor: colors.blush }]}>
          <Text style={{ fontSize: 28 }}>{todayTip.emoji}</Text>
          <Text style={[styles.tipText, { color: colors.foreground }]}>{todayTip.tip}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: "#FEF4E8" }]}>
        <View style={styles.cardHeaderRow}>
          <Feather name="phone-call" size={16} color="#C07020" />
          <Text style={[styles.cardTitle, { color: "#9A5010" }]}>Immediate Support</Text>
        </View>
        <Text style={[styles.helpLine, { color: "#B06020" }]}>
          PSI Helpline: 1-800-944-4773{"\n"}
          Crisis Text Line: Text "HELLO" to 741741{"\n"}
          Postpartum Support International: postpartum.net
        </Text>
      </View>
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
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  eyebrow: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 4 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", lineHeight: 32, marginBottom: 6 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  barList: { gap: 14 },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  trendText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  legendRow: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  predTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  predSub: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  predRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  predBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  predBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  predEntries: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular" },
  tipBox: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 14,
    padding: 14,
    alignItems: "flex-start",
  },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  helpLine: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
