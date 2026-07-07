import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LuminaraLogo } from "@/components/LuminaraLogo";
import { useApp, getRiskLevel } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { REPRODUCTIVE_PHASE_LABELS, daysBetween, toDateString } from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { detectPhase, predictCycle } from "@/utils/wellnessAlgorithm";

function getDaysSince(dateStr: string): number {
  return Math.max(0, daysBetween(dateStr, toDateString(new Date())));
}

function getMonthsWeeks(days: number): string {
  const months = Math.floor(days / 30);
  const weeks = Math.floor((days % 30) / 7);
  if (months > 0) return `${months}mo ${weeks}w old`;
  return `${weeks} weeks old`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function MiniBar({ date, score }: { date: string; score: number }) {
  const colors = useColors();
  const level = getRiskLevel(score);
  const barColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;
  const day = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
  const barH = Math.max(6, (score / 100) * 48);

  return (
    <View style={miniBarStyles.col}>
      <View style={[miniBarStyles.track, { height: 48, backgroundColor: colors.lavender }]}>
        <View style={[miniBarStyles.fill, { height: barH, backgroundColor: barColor }]} />
      </View>
      <Text style={[miniBarStyles.label, { color: colors.mutedForeground }]}>{day}</Text>
    </View>
  );
}

const miniBarStyles = StyleSheet.create({
  col: { alignItems: "center", gap: 4 },
  track: {
    width: 22,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: "100%", borderRadius: 6 },
  label: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

/**
 * Circular progress ring for the hero wellness score. The amber arc is the
 * one warm/attention colour in the palette, so the eye lands on the number
 * that matters. Falls back gracefully to an empty ring at 0%.
 */
function WellnessRing({ pct }: { pct: number }) {
  const size = 84;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const offset = circ * (1 - clamped / 100);
  return (
    <View
      style={styles.ringWrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Wellness ${clamped} percent`}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#F6A94C"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.wellnessPct}>{clamped}%</Text>
      <Text style={styles.wellnessLabel}>Wellness</Text>
    </View>
  );
}

const GUIDED: {
  icon: string;
  title: string;
  subtitle: string;
  tint: "secondary" | "softGreen" | "softOrange" | "blush";
}[] = [
  { icon: "📖", title: "Understanding Postpartum Changes", subtitle: "3 min read", tint: "secondary" },
  { icon: "🧘", title: "Finding Your Calm Center", subtitle: "5 min meditation", tint: "softGreen" },
  { icon: "💬", title: "Talking to Your Partner", subtitle: "Conversation guide", tint: "softOrange" },
  { icon: "🌙", title: "Better Sleep with a Newborn", subtitle: "Sleep strategies", tint: "blush" },
];

type HealthNavTint = "lavender" | "blush" | "softGreen" | "softOrange" | "secondary" | "softRed";

const HEALTH_NAV_ITEMS: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  route: string;
  tint: HealthNavTint;
}[] = [
  {
    icon: "file-text",
    title: "Medical Records",
    subtitle: "Notes & documents",
    route: "/records",
    tint: "lavender",
  },
  {
    icon: "droplet",
    title: "Cycle & Biomarkers",
    subtitle: "Track & predict",
    route: "/cycle",
    tint: "blush",
  },
  {
    icon: "package",
    title: "Medications",
    subtitle: "Meds & supplements",
    route: "/medications",
    tint: "softGreen",
  },
  {
    icon: "users",
    title: "Partner Space",
    subtitle: "Consent-based sharing",
    route: "/partner",
    tint: "softOrange",
  },
  {
    icon: "award",
    title: "Research",
    subtitle: "Opt-in contribution",
    route: "/research",
    tint: "secondary",
  },
  {
    icon: "shield",
    title: "Privacy & Data",
    subtitle: "Your data, your control",
    route: "/privacy",
    tint: "softRed",
  },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    profile,
    hasCheckedInToday,
    todayCheckIn,
    averageRiskScore,
    weeklyRiskTrend,
    riskLevel,
    checkIns,
  } = useApp();
  const { cycleEntries } = useHealth();

  const phase = useMemo(
    () =>
      detectPhase({
        birthDate: profile?.birthDate ?? null,
        cycleEntries,
      }),
    [profile?.birthDate, cycleEntries]
  );

  const cyclePrediction = useMemo(() => predictCycle(cycleEntries), [cycleEntries]);

  const daysSince = useMemo(
    () => (profile?.birthDate ? getDaysSince(profile.birthDate) : 0),
    [profile?.birthDate]
  );

  const streak = useMemo(() => {
    const today = new Date();
    const todayKey = toDateString(today);
    const hasToday = checkIns.some((c) => c.date === todayKey);
    // Start counting from today if it's already logged, otherwise from
    // yesterday, so an unbroken run doesn't reset to 0 each morning before
    // today's check-in is logged.
    let s = 0;
    const startOffset = hasToday ? 0 : 1;
    for (let i = startOffset; i < 30 + startOffset; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = toDateString(d);
      if (checkIns.find((c) => c.date === key)) s++;
      else break;
    }
    return s;
  }, [checkIns]);

  const riskTrendInfo = useMemo(() => {
    const points = weeklyRiskTrend;
    if (points.length < 2) {
      return { label: "Steady", color: "riskLow" as const };
    }
    // weeklyRiskTrend is chronological (oldest -> newest). Compare the
    // average of the first half vs the second half of the week; since a
    // LOWER risk score is better, a drop from first half to second half
    // means the trend is improving.
    const mid = Math.ceil(points.length / 2);
    const firstHalf = points.slice(0, mid);
    const secondHalf = points.slice(mid);
    const avg = (arr: typeof points) => arr.reduce((a, p) => a + p.score, 0) / arr.length;
    const firstAvg = avg(firstHalf);
    const secondAvg = secondHalf.length > 0 ? avg(secondHalf) : firstAvg;
    const delta = secondAvg - firstAvg;
    const threshold = 3; // points, to avoid noise from tiny fluctuations
    if (delta <= -threshold) return { label: "Improving", color: "riskLow" as const };
    if (delta >= threshold) return { label: "Needs attention", color: "riskHigh" as const };
    return { label: "Steady", color: "riskLow" as const };
  }, [weeklyRiskTrend]);

  const avgSleep = useMemo(() => {
    const last7 = checkIns.slice(0, 7);
    if (last7.length === 0) return 0;
    return parseFloat((last7.reduce((a, c) => a + c.sleep, 0) / last7.length).toFixed(1));
  }, [checkIns]);

  const wellnessPct = Math.max(0, 100 - averageRiskScore);

  const riskColor =
    riskLevel === "low" ? colors.riskLow : riskLevel === "moderate" ? colors.riskModerate : colors.riskHigh;

  const riskLabel = riskLevel === "low" ? "Low Risk" : riskLevel === "moderate" ? "Moderate" : "High Risk";

  const checkedCount = hasCheckedInToday ? 3 : 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {profile?.name ?? "Mama"} 🌸
          </Text>
        </View>
        <Pressable
          onPress={() =>
            showAlert(
              "Notifications",
              "You're all caught up — no new notifications. Daily check-in reminders aren't available yet in this build."
            )
          }
          style={[styles.notifBtn, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
        >
          <Feather name="bell" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
        <View pointerEvents="none" style={styles.heroFlame}>
          <LuminaraLogo variant="mono" size={168} color="rgba(255,255,255,0.11)" />
        </View>
        <View style={styles.heroContent}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Take a breath.</Text>
            <Text style={styles.heroSub}>
              This is your space for healing and reflection.
            </Text>
            {profile?.babyName && profile.birthDate && (
              <View style={[styles.babyBadge, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                <Text style={styles.babyText}>
                  {profile.babyName} · {getMonthsWeeks(daysSince)}
                </Text>
              </View>
            )}
          </View>
          <WellnessRing pct={wellnessPct} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.blush }]}>
            <Feather name="moon" size={16} color={colors.purple} />
          </View>
          <Text style={[styles.statVal, { color: colors.foreground }]}>
            {avgSleep > 0 ? `${avgSleep}h` : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Avg Sleep
          </Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <View style={[styles.statIcon, { backgroundColor: colors.softGreen }]}>
            <Feather name="activity" size={16} color={colors.riskLow} />
          </View>
          <Text style={[styles.statVal, { color: colors.foreground }]}>{streak}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Day Streak</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <View
            style={[
              styles.statIcon,
              {
                backgroundColor:
                  riskLevel === "low"
                    ? colors.softGreen
                    : riskLevel === "moderate"
                    ? colors.softOrange
                    : colors.softRed,
              },
            ]}
          >
            <Feather name="shield" size={16} color={riskColor} />
          </View>
          <Text style={[styles.statVal, { color: riskColor }]}>{riskLabel}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>PPD Risk</Text>
        </View>
      </View>

      <View style={[styles.checkinCard, { backgroundColor: colors.card }]}>
        <View style={styles.checkinHeader}>
          <Text style={[styles.checkinTitle, { color: colors.foreground }]}>
            Today's Check-In
          </Text>
          <Text style={[styles.checkinCount, { color: colors.primary }]}>
            {checkedCount}/3
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.lavender }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(checkedCount / 3) * 100}%` as any,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
        <View style={styles.checkinItems}>
          {[
            { label: "Mood check-in", done: hasCheckedInToday },
            { label: "Sleep check-in", done: hasCheckedInToday },
            { label: "Wellbeing log", done: hasCheckedInToday },
          ].map((item, i) => (
            <View key={i} style={styles.checkinItem}>
              <View
                style={[
                  styles.checkDot,
                  {
                    backgroundColor: item.done ? colors.teal : colors.lavender,
                  },
                ]}
              >
                {item.done && <Feather name="check" size={10} color="#fff" />}
              </View>
              <Text
                style={[
                  styles.checkinItemText,
                  { color: item.done ? colors.mutedForeground : colors.text },
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
        {!hasCheckedInToday && (
          <Pressable
            onPress={() => router.push("/(tabs)/checkin")}
            style={({ pressed }) => [
              styles.checkinBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={styles.checkinBtnText}>Start My Check-In →</Text>
          </Pressable>
        )}
      </View>

      {weeklyRiskTrend.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              7-Day Risk Trend
            </Text>
            <View
              style={[
                styles.trendPill,
                {
                  backgroundColor:
                    riskTrendInfo.color === "riskLow" ? colors.softGreen : colors.softRed,
                },
              ]}
            >
              <Text style={[styles.trendPillText, { color: colors[riskTrendInfo.color] }]}>
                {riskTrendInfo.label}
              </Text>
            </View>
          </View>
          <View
            style={styles.barsRow}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`7-day risk trend chart, currently ${riskTrendInfo.label.toLowerCase()}, latest score ${
              weeklyRiskTrend[weeklyRiskTrend.length - 1].score
            } out of 100`}
          >
            {weeklyRiskTrend.map((item) => (
              <MiniBar key={item.date} date={item.date} score={item.score} />
            ))}
          </View>
        </View>
      )}

      <Pressable
        onPress={() => router.push("/cycle")}
        style={({ pressed }) => [
          styles.phaseStrip,
          { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <View style={[styles.phaseChip, { backgroundColor: colors.blush }]}>
          <Feather name="droplet" size={14} color={colors.purple} />
          <Text style={[styles.phaseChipText, { color: colors.purple }]}>
            {REPRODUCTIVE_PHASE_LABELS[phase]}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          {cyclePrediction.currentCycleDay != null && (
            <Text style={[styles.phaseText, { color: colors.foreground }]}>
              Day {cyclePrediction.currentCycleDay}
              {cyclePrediction.avgCycleLength
                ? ` of ~${Math.round(cyclePrediction.avgCycleLength)}`
                : ""}
            </Text>
          )}
          {cyclePrediction.confidence !== "none" && cyclePrediction.nextPeriodStart && (
            <Text style={[styles.phaseSub, { color: colors.mutedForeground }]}>
              Next period in{" "}
              {Math.max(
                0,
                Math.round(
                  (new Date(cyclePrediction.nextPeriodStart + "T12:00:00").getTime() -
                    new Date().setHours(12, 0, 0, 0)) /
                    86400000
                )
              )}{" "}
              days
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>

      <View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 10 }]}>
          Your Health
        </Text>
        <View style={styles.healthGrid}>
          {HEALTH_NAV_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route as any)}
              style={({ pressed }) => [
                styles.healthCard,
                { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <View style={[styles.healthIconWrap, { backgroundColor: colors[item.tint] }]}>
                <Feather name={item.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.healthCardTitle, { color: colors.foreground }]}>
                {item.title}
              </Text>
              <Text style={[styles.healthCardSub, { color: colors.mutedForeground }]}>
                {item.subtitle}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Guided for you
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.guidedScroll}
      >
        {GUIDED.map((item, i) => (
          <Pressable
            key={i}
            style={[styles.guidedCard, { backgroundColor: colors[item.tint] }]}
            onPress={() => router.push("/(tabs)/resources")}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.subtitle}`}
          >
            <Text style={styles.guidedIcon}>{item.icon}</Text>
            <Text style={[styles.guidedTitle, { color: colors.foreground }]}>
              {item.title}
            </Text>
            <Text style={[styles.guidedSub, { color: colors.mutedForeground }]}>
              {item.subtitle}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.resourceCard, { backgroundColor: colors.softOrange }]}>
        <Feather name="phone" size={16} color={colors.riskModerate} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.resourceTitle, { color: colors.text }]}>
            Immediate Support
          </Text>
          <Text style={[styles.resourceText, { color: colors.mutedForeground }]}>
            PSI Helpline: 1-800-944-4773{"\n"}
            Crisis Text Line: Text "HELLO" to 741741
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  name: { fontSize: 26, fontFamily: "Inter_700Bold" },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    overflow: "hidden",
    position: "relative",
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  heroSub: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 12,
  },
  babyBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  babyText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  heroFlame: {
    position: "absolute",
    right: -24,
    bottom: -48,
  },
  ringWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  wellnessPct: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  wellnessLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: { fontSize: 17, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  checkinCard: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  checkinHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkinTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  checkinCount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  checkinItems: { gap: 8 },
  checkinItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkinItemText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  checkinBtn: {
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  checkinBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  trendPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginBottom: -4,
  },
  guidedScroll: { gap: 12, paddingBottom: 4 },
  guidedCard: {
    width: 160,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  guidedIcon: { fontSize: 26 },
  guidedTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  guidedSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  resourceCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  resourceTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  resourceText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  phaseStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  phaseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  phaseChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  phaseText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  phaseSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  healthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  healthCard: {
    width: "47%",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  healthIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  healthCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  healthCardSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
