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
  if (!arr.length) return 0;
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

function HBar({
  label,
  value,
  max,
  color,
  badge,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  badge?: string;
  unit?: string;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <View style={hBarStyles.container}>
      <View style={hBarStyles.header}>
        <Text style={[hBarStyles.label, { color: colors.text }]}>{label}</Text>
        {badge ? (
          <View style={[hBarStyles.badge, { backgroundColor: color + "20" }]}>
            <Text style={[hBarStyles.badgeText, { color }]}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={hBarStyles.barRow}>
        <View style={[hBarStyles.track, { backgroundColor: colors.lavender }]}>
          <View
            style={[
              hBarStyles.fill,
              { width: `${pct * 100}%` as any, backgroundColor: color },
            ]}
          />
        </View>
        <Text style={[hBarStyles.val, { color: colors.mutedForeground }]}>
          {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}
          {unit ?? ""}
        </Text>
      </View>
    </View>
  );
}

const hBarStyles = StyleSheet.create({
  container: { gap: 6 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  val: { fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 36, textAlign: "right" },
});

function SleepResonance({ checkIns }: { checkIns: CheckIn[] }) {
  const colors = useColors();
  const last7 = checkIns.slice(0, 7).reverse();

  if (last7.length === 0) return null;

  return (
    <View style={[sleepStyles.container, { backgroundColor: colors.card }]}>
      <View style={sleepStyles.header}>
        <Text style={[sleepStyles.title, { color: colors.foreground }]}>Sleep Resonance</Text>
        <Feather name="moon" size={16} color={colors.purple} />
      </View>
      <Text style={[sleepStyles.sub, { color: colors.mutedForeground }]}>
        Your nightly rest pattern over the past week
      </Text>
      <View style={sleepStyles.rows}>
        {last7.map((entry, i) => {
          const d = new Date(entry.date + "T12:00:00");
          const dayNum = d.getDate();
          const sleepH = entry.sleep;
          const maxSleep = 10;
          const pct = Math.min(1, sleepH / maxSleep);
          const quality =
            sleepH >= 7 ? colors.riskLow : sleepH >= 5 ? colors.primary : colors.riskModerate;
          const hrs = Math.floor(sleepH);
          const mins = Math.round((sleepH - hrs) * 60);
          const timeStr = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;

          return (
            <View key={entry.id} style={sleepStyles.row}>
              <Text style={[sleepStyles.day, { color: colors.mutedForeground }]}>
                {dayNum}
              </Text>
              <View style={[sleepStyles.barBg, { backgroundColor: colors.lavender }]}>
                <View
                  style={[
                    sleepStyles.barFill,
                    { width: `${pct * 100}%` as any, backgroundColor: quality },
                  ]}
                />
              </View>
              <Text style={[sleepStyles.duration, { color: colors.text }]}>{timeStr}</Text>
            </View>
          );
        })}
      </View>
      <View style={sleepStyles.legend}>
        {[
          { color: colors.riskLow, label: "7h+ (Good)" },
          { color: colors.primary, label: "5–7h (Fair)" },
          { color: colors.riskModerate, label: "<5h (Low)" },
        ].map((l) => (
          <View key={l.label} style={sleepStyles.legendItem}>
            <View style={[sleepStyles.legendDot, { backgroundColor: l.color }]} />
            <Text style={[sleepStyles.legendLabel, { color: colors.mutedForeground }]}>
              {l.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sleepStyles = StyleSheet.create({
  container: { borderRadius: 20, padding: 18, gap: 12 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -6 },
  rows: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  day: { fontSize: 13, fontFamily: "Inter_600SemiBold", width: 26, textAlign: "right" },
  barBg: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 5 },
  duration: { fontSize: 12, fontFamily: "Inter_600SemiBold", width: 46, textAlign: "right" },
  legend: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

const TIPS = [
  { emoji: "🌬️", tip: "Box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s." },
  { emoji: "🚶", tip: "A 10-minute walk outside can meaningfully reduce cortisol." },
  { emoji: "🤝", tip: "Say yes to help — it takes a village to raise a baby." },
  { emoji: "😴", tip: "Sleep when your baby sleeps, even 20-minute naps help." },
  { emoji: "💬", tip: "Naming your feelings out loud calms the nervous system." },
  { emoji: "📔", tip: "Journaling for 5 minutes before bed helps process the day." },
  { emoji: "🍵", tip: "Chamomile or oat straw tea can support postpartum calming." },
];

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns, weeklyRiskTrend, averageRiskScore, riskLevel } = useApp();

  const stats = useMemo(() => {
    if (!checkIns.length) return null;
    const last7 = checkIns.slice(0, 7);
    const wellness = Math.max(0, 100 - averageRiskScore);

    const moodHarmony = avg(last7.map((c) => c.mood)) / 5;
    const restfulEnergy = Math.min(1, avg(last7.map((c) => c.sleep)) / 8);
    const bondingScore = avg(last7.map((c) => c.bonding)) / 5;
    const anxietyResilience = 1 - (avg(last7.map((c) => c.anxiety)) - 1) / 4;
    const supportScore = avg(last7.map((c) => c.support)) / 5;
    const mindfulMinutes = Math.round(moodHarmony * 60);
    const avgSleep = avg(last7.map((c) => c.sleep));

    const trendDir =
      last7.length >= 2
        ? last7[0].riskScore < last7[last7.length - 1].riskScore
          ? "improving"
          : last7[0].riskScore > last7[last7.length - 1].riskScore
          ? "worsening"
          : "stable"
        : "stable";

    return {
      moodHarmony,
      restfulEnergy,
      bondingScore,
      anxietyResilience,
      supportScore,
      wellness,
      trendDir,
      mindfulMinutes,
      avgSleep,
      totalEntries: checkIns.length,
    };
  }, [checkIns, averageRiskScore]);

  const riskColor =
    riskLevel === "low"
      ? colors.riskLow
      : riskLevel === "moderate"
      ? colors.riskModerate
      : colors.riskHigh;

  const todayTip = useMemo(() => {
    return TIPS[new Date().getDate() % TIPS.length];
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
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>WEEKLY OVERVIEW</Text>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Your Gentle{"\n"}Reflection
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Based on your data from the past few days.
          </Text>
        </View>
        <View style={[styles.wellnessOrb, { backgroundColor: riskColor + "18", borderColor: riskColor + "50" }]}>
          <Text style={[styles.orbPct, { color: riskColor }]}>{stats?.wellness ?? 0}%</Text>
          <Text style={[styles.orbLabel, { color: colors.mutedForeground }]}>Wellness</Text>
        </View>
      </View>

      {stats && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Wellness Signals</Text>
          <View style={styles.barList}>
            <HBar
              label="Mood Harmony"
              value={stats.moodHarmony}
              max={1}
              color={colors.primary}
              badge={
                stats.moodHarmony >= 0.7 ? "STABLE!" : stats.moodHarmony >= 0.5 ? "Variable" : "Low"
              }
            />
            <HBar
              label="Restful Energy"
              value={stats.restfulEnergy}
              max={1}
              color={colors.teal}
              badge={
                stats.restfulEnergy >= 0.75 ? "Good" : stats.restfulEnergy >= 0.5 ? "Fair" : "Poor"
              }
            />
            <HBar
              label="Baby Bonding"
              value={stats.bondingScore}
              max={1}
              color={colors.purple}
              badge={stats.bondingScore >= 0.7 ? "Strong" : "Growing"}
            />
            <HBar
              label="Anxiety Resilience"
              value={stats.anxietyResilience}
              max={1}
              color={colors.warm}
              badge={stats.anxietyResilience >= 0.7 ? "Managed" : "Elevated"}
            />
            <HBar
              label="Social Support"
              value={stats.supportScore}
              max={1}
              color="#6B89D4"
              badge={stats.supportScore >= 0.7 ? "Felt" : "Seeking"}
            />
          </View>
        </View>
      )}

      {stats && (
        <View style={[styles.minutesCard, { backgroundColor: colors.primary }]}>
          <View style={styles.minutesRow}>
            <View>
              <Text style={styles.minutesLabel}>Mindful Minutes</Text>
              <Text style={styles.minutesNum}>{stats.mindfulMinutes}</Text>
              <Text style={styles.minutesSub}>minutes of wellness today</Text>
            </View>
            <Text style={{ fontSize: 44 }}>🧘</Text>
          </View>
        </View>
      )}

      <SleepResonance checkIns={checkIns} />

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
          <View style={styles.trendBars}>
            {weeklyRiskTrend.map((item) => {
              const level = getRiskLevel(item.score);
              const barColor =
                level === "low"
                  ? colors.riskLow
                  : level === "moderate"
                  ? colors.riskModerate
                  : colors.riskHigh;
              const d = new Date(item.date + "T12:00:00");
              const day = d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
              const barH = Math.max(6, (item.score / 100) * 56);
              return (
                <View key={item.date} style={styles.trendBarCol}>
                  <View style={[styles.trendBarBg, { height: 56 }]}>
                    <View style={[styles.trendBarFill, { height: barH, backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.trendBarDay, { color: colors.mutedForeground }]}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          PPD Risk Assessment
        </Text>
        <View
          style={[
            styles.riskAssessment,
            {
              backgroundColor: riskColor + "12",
              borderColor: riskColor + "30",
              borderWidth: 1.5,
            },
          ]}
        >
          <View style={styles.riskAssessmentHeader}>
            <Text style={[styles.riskAssessmentScore, { color: riskColor }]}>
              {averageRiskScore}/100
            </Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor }]}>
              <Text style={styles.riskBadgeText}>
                {riskLevel === "low" ? "Low Risk" : riskLevel === "moderate" ? "Moderate" : "High Risk"}
              </Text>
            </View>
          </View>
          <Text style={[styles.riskDesc, { color: colors.mutedForeground }]}>
            {riskLevel === "low"
              ? "Your 7-day indicators are within the low-risk range. Keep nurturing yourself."
              : riskLevel === "moderate"
              ? "Moderate postpartum stress detected. Sleep, connection, and support are key."
              : "Elevated risk — please speak with your healthcare provider as soon as possible."}
          </Text>
        </View>
        <Text style={[styles.totalEntries, { color: colors.mutedForeground }]}>
          Based on {stats?.totalEntries} check-ins
        </Text>
      </View>

      <View style={[styles.tipCard, { backgroundColor: colors.blush }]}>
        <View style={styles.tipHeader}>
          <Text style={[styles.tipEyebrow, { color: colors.purple }]}>GENTLE MORNINGS</Text>
          <Text style={{ fontSize: 26 }}>{todayTip.emoji}</Text>
        </View>
        <Text style={[styles.tipText, { color: colors.foreground }]}>{todayTip.tip}</Text>
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
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  barList: { gap: 14 },
  minutesCard: { borderRadius: 20, padding: 20 },
  minutesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  minutesLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  minutesNum: { color: "#fff", fontSize: 42, fontFamily: "Inter_700Bold" },
  minutesSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Inter_400Regular" },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  trendText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  trendBars: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  trendBarCol: { alignItems: "center", gap: 4 },
  trendBarBg: {
    width: 26,
    backgroundColor: "#E4E8F5",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  trendBarFill: { width: "100%", borderRadius: 6 },
  trendBarDay: { fontSize: 10, fontFamily: "Inter_500Medium" },
  riskAssessment: { borderRadius: 16, padding: 16, gap: 10 },
  riskAssessmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  riskAssessmentScore: { fontSize: 32, fontFamily: "Inter_700Bold" },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  riskBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  riskDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  totalEntries: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tipCard: { borderRadius: 16, padding: 16, gap: 8, marginBottom: 8 },
  tipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tipEyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tipText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
});
