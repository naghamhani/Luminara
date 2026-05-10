import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { useApp, getRiskLevel } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function getDaysSince(dateStr: string): number {
  const birth = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
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
      <View style={[miniBarStyles.track, { height: 48 }]}>
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
    backgroundColor: "#E4E8F5",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  fill: { width: "100%", borderRadius: 6 },
  label: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

const GUIDED = [
  { icon: "📖", title: "Understanding Postpartum Changes", subtitle: "3 min read", color: "#EEF0FB" },
  { icon: "🧘", title: "Finding Your Calm Center", subtitle: "5 min meditation", color: "#E6F7F2" },
  { icon: "💬", title: "Talking to Your Partner", subtitle: "Conversation guide", color: "#FEF4E8" },
  { icon: "🌙", title: "Better Sleep with a Newborn", subtitle: "Sleep strategies", color: "#F2EEFF" },
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

  const daysSince = useMemo(
    () => (profile?.birthDate ? getDaysSince(profile.birthDate) : 0),
    [profile?.birthDate]
  );

  const streak = useMemo(() => {
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (checkIns.find((c) => c.date === key)) s++;
      else break;
    }
    return s;
  }, [checkIns]);

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
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 20),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
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
        <View style={[styles.notifBtn, { backgroundColor: colors.card }]}>
          <Feather name="bell" size={18} color={colors.text} />
        </View>
      </View>

      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.primary },
        ]}
      >
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
          <View style={[styles.wellnessCircle, { borderColor: "rgba(255,255,255,0.3)" }]}>
            <Text style={styles.wellnessPct}>{wellnessPct}%</Text>
            <Text style={styles.wellnessLabel}>Wellness</Text>
          </View>
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
            <View style={[styles.trendPill, { backgroundColor: colors.softGreen }]}>
              <Text style={[styles.trendPillText, { color: colors.riskLow }]}>
                Improving
              </Text>
            </View>
          </View>
          <View style={styles.barsRow}>
            {weeklyRiskTrend.map((item) => (
              <MiniBar key={item.date} date={item.date} score={item.score} />
            ))}
          </View>
        </View>
      )}

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
            style={[styles.guidedCard, { backgroundColor: item.color }]}
            onPress={() => {}}
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

      <View style={[styles.resourceCard, { backgroundColor: "#FEF4E8" }]}>
        <Feather name="phone" size={16} color="#C07020" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.resourceTitle, { color: "#9A5010" }]}>
            Immediate Support
          </Text>
          <Text style={[styles.resourceText, { color: "#B06020" }]}>
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
  wellnessCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: "rgba(255,255,255,0.12)",
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
});
