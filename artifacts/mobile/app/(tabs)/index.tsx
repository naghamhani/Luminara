import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LuminaraLogo } from "@/components/LuminaraLogo";
import { Skeleton } from "@/components/Skeleton";
import { SyncStatusBadge } from "@/components/SyncStatusBadge";
import { useApp, getRiskLevel } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";
import { REPRODUCTIVE_PHASE_LABELS, daysBetween, toDateString } from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { detectPhase, predictCycle } from "@/utils/wellnessAlgorithm";

function getDaysSince(dateStr: string): number {
  return Math.max(0, daysBetween(dateStr, toDateString(new Date())));
}

function getMonthsWeeks(days: number, t: (key: string) => string): string {
  const months = Math.floor(days / 30);
  const weeks = Math.floor((days % 30) / 7);
  if (months > 0)
    return t("home.monthsWeeksOld")
      .replace("{months}", String(months))
      .replace("{weeks}", String(weeks));
  return t("home.weeksOld").replace("{weeks}", String(weeks));
}

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t("home.goodMorning");
  if (h < 18) return t("home.goodAfternoon");
  return t("home.goodEvening");
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring for the hero wellness score. The amber arc is the
 * one warm/attention colour in the palette, so the eye lands on the number
 * that matters. Falls back gracefully to an empty ring at 0%.
 *
 * Counts up from 0 on mount and whenever the score changes, so the ring
 * fills in step with the number — a calm, deliberate reveal rather than an
 * instant jump.
 */
function WellnessRing({ pct }: { pct: number }) {
  const { t } = useTranslation();
  const size = 84;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));

  const animatedPct = useSharedValue(0);
  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    animatedPct.value = withTiming(clamped, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped]);

  useAnimatedReaction(
    () => Math.round(animatedPct.value),
    (rounded, prev) => {
      if (rounded !== prev) {
        runOnJS(setDisplayPct)(rounded);
      }
    }
  );

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - animatedPct.value / 100),
  }));

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
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#F6A94C"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          animatedProps={animatedProps}
        />
      </Svg>
      <Text style={styles.wellnessPct}>{displayPct}%</Text>
      <Text style={styles.wellnessLabel}>{t("home.wellnessLabel")}</Text>
    </View>
  );
}

function useGuided() {
  const { t } = useTranslation();
  return [
    { icon: "📖", title: t("home.guidedUnderstandingTitle"), subtitle: t("home.guidedUnderstandingSub"), tint: "secondary" as const },
    { icon: "🧘", title: t("home.guidedCalmTitle"), subtitle: t("home.guidedCalmSub"), tint: "softGreen" as const },
    { icon: "💬", title: t("home.guidedPartnerTitle"), subtitle: t("home.guidedPartnerSub"), tint: "softOrange" as const },
    { icon: "🌙", title: t("home.guidedSleepTitle"), subtitle: t("home.guidedSleepSub"), tint: "blush" as const },
  ];
}

type HealthNavTint = "lavender" | "blush" | "softGreen" | "softOrange" | "secondary" | "softRed";

function useHealthNavItems(): {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  route: string;
  tint: HealthNavTint;
}[] {
  const { t } = useTranslation();
  return [
    {
      icon: "file-text",
      title: t("home.medicalRecordsTitle"),
      subtitle: t("home.medicalRecordsSub"),
      route: "/records",
      tint: "lavender",
    },
    {
      icon: "droplet",
      title: t("home.cycleTitle"),
      subtitle: t("home.cycleSub"),
      route: "/cycle",
      tint: "blush",
    },
    {
      icon: "package",
      title: t("home.medicationsTitle"),
      subtitle: t("home.medicationsSub"),
      route: "/medications",
      tint: "softGreen",
    },
    {
      icon: "users",
      title: t("home.partnerTitle"),
      subtitle: t("home.partnerSub"),
      route: "/partner",
      tint: "softOrange",
    },
    {
      icon: "award",
      title: t("home.researchTitle"),
      subtitle: t("home.researchSub"),
      route: "/research",
      tint: "secondary",
    },
    {
      icon: "shield",
      title: t("home.privacyTitle"),
      subtitle: t("home.privacySub"),
      route: "/privacy",
      tint: "softRed",
    },
  ];
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const GUIDED = useGuided();
  const HEALTH_NAV_ITEMS = useHealthNavItems();
  const {
    profile,
    hasCheckedInToday,
    todayCheckIn,
    averageRiskScore,
    weeklyRiskTrend,
    riskLevel,
    checkIns,
    isLoading: appLoading,
  } = useApp();
  const { cycleEntries, isLoading: healthLoading } = useHealth();
  const isLoading = appLoading || healthLoading;

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
      return { label: t("home.trendSteady"), color: "riskLow" as const };
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
    if (delta <= -threshold) return { label: t("home.trendImproving"), color: "riskLow" as const };
    if (delta >= threshold) return { label: t("home.trendNeedsAttention"), color: "riskHigh" as const };
    return { label: t("home.trendSteady"), color: "riskLow" as const };
  }, [weeklyRiskTrend, t]);

  const avgSleep = useMemo(() => {
    const last7 = checkIns.slice(0, 7);
    if (last7.length === 0) return 0;
    return parseFloat((last7.reduce((a, c) => a + c.sleep, 0) / last7.length).toFixed(1));
  }, [checkIns]);

  const wellnessPct = Math.max(0, 100 - averageRiskScore);

  const riskColor =
    riskLevel === "low" ? colors.riskLow : riskLevel === "moderate" ? colors.riskModerate : colors.riskHigh;

  const riskLabel =
    riskLevel === "low" ? t("home.riskLow") : riskLevel === "moderate" ? t("home.riskModerate") : t("home.riskHigh");

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
            {getGreeting(t)}
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {profile?.name ?? t("home.defaultName")} 🌸
          </Text>
          <View style={{ marginTop: 6 }}>
            <SyncStatusBadge />
          </View>
        </View>
        <Pressable
          onPress={() =>
            showAlert(
              t("home.notificationsTitle"),
              t("home.notificationsBody")
            )
          }
          style={[styles.notifBtn, { backgroundColor: colors.card }]}
          accessibilityRole="button"
          accessibilityLabel={t("home.notificationsTitle")}
          hitSlop={8}
        >
          <Feather name="bell" size={18} color={colors.text} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ gap: 16 }}>
          <Skeleton height={140} borderRadius={24} />
          <View style={styles.statsRow}>
            <Skeleton height={92} borderRadius={18} style={{ flex: 1 }} />
            <Skeleton height={92} borderRadius={18} style={{ flex: 1 }} />
            <Skeleton height={92} borderRadius={18} style={{ flex: 1 }} />
          </View>
          <Skeleton height={150} borderRadius={20} />
        </View>
      ) : (
        <>
          <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
            <View pointerEvents="none" style={styles.heroFlame}>
              <LuminaraLogo variant="mono" size={168} color="rgba(255,255,255,0.11)" />
            </View>
            <View style={styles.heroContent}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{t("home.heroTitle")}</Text>
                <Text style={styles.heroSub}>
                  {t("home.heroSub")}
                </Text>
                {profile?.babyName && profile.birthDate && (
                  <View style={[styles.babyBadge, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                    <Text style={styles.babyText}>
                      {profile.babyName} · {getMonthsWeeks(daysSince, t)}
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
                {t("home.avgSleep")}
              </Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card }]}>
              <View style={[styles.statIcon, { backgroundColor: colors.softGreen }]}>
                <Feather name="activity" size={16} color={colors.riskLow} />
              </View>
              <Text style={[styles.statVal, { color: colors.foreground }]}>{streak}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("home.dayStreak")}</Text>
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
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{t("home.ppdRisk")}</Text>
            </View>
          </View>

          <View style={[styles.checkinCard, { backgroundColor: colors.card }]}>
            <View style={styles.checkinHeader}>
              <Text style={[styles.checkinTitle, { color: colors.foreground }]}>
                {t("home.todaysCheckIn")}
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
                { label: t("home.moodCheckIn"), done: hasCheckedInToday },
                { label: t("home.sleepCheckIn"), done: hasCheckedInToday },
                { label: t("home.wellbeingLog"), done: hasCheckedInToday },
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
                <Text style={styles.checkinBtnText}>{t("home.startMyCheckIn")}</Text>
              </Pressable>
            )}
          </View>
        </>
      )}

      {!isLoading && weeklyRiskTrend.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t("home.riskTrendTitle")}
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
              {cyclePrediction.avgCycleLength
                ? t("home.cycleDayOf")
                    .replace("{day}", String(cyclePrediction.currentCycleDay))
                    .replace("{length}", String(Math.round(cyclePrediction.avgCycleLength)))
                : t("home.cycleDay").replace("{day}", String(cyclePrediction.currentCycleDay))}
            </Text>
          )}
          {cyclePrediction.confidence !== "none" && cyclePrediction.nextPeriodStart && (
            <Text style={[styles.phaseSub, { color: colors.mutedForeground }]}>
              {t("home.nextPeriodIn").replace(
                "{days}",
                String(
                  Math.max(
                    0,
                    Math.round(
                      (new Date(cyclePrediction.nextPeriodStart + "T12:00:00").getTime() -
                        new Date().setHours(12, 0, 0, 0)) /
                        86400000
                    )
                  )
                )
              )}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </Pressable>

      <View>
        <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 10 }]}>
          {t("home.yourHealth")}
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
        {t("home.guidedForYou")}
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
            {t("home.immediateSupport")}
          </Text>
          <Text style={[styles.resourceText, { color: colors.mutedForeground }]}>
            {t("home.supportLines")}
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
