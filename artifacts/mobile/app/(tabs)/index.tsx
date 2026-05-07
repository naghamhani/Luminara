import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getRiskLevel } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function getDaysSince(dateStr: string): number {
  const birth = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function WeekBar({ date, score, max }: { date: string; score: number; max: number }) {
  const colors = useColors();
  const level = getRiskLevel(score);
  const barColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;
  const day = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
  const barH = max > 0 ? Math.max(6, (score / 100) * 56) : 6;

  return (
    <View style={barStyles.col}>
      <View style={[barStyles.barBg, { height: 56 }]}>
        <View style={[barStyles.bar, { height: barH, backgroundColor: barColor }]} />
      </View>
      <Text style={[barStyles.day, { color: colors.mutedForeground }]}>{day}</Text>
    </View>
  );
}

const barStyles = StyleSheet.create({
  col: { alignItems: "center", gap: 4 },
  barBg: {
    width: 26,
    borderRadius: 6,
    backgroundColor: "#EBE0EF",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  bar: { width: "100%", borderRadius: 6 },
  day: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    profile,
    hasCheckedInToday,
    todayCheckIn,
    latestRiskScore,
    weeklyRiskTrend,
    averageRiskScore,
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
      if (checkIns.find((c) => c.date === key)) {
        s++;
      } else {
        break;
      }
    }
    return s;
  }, [checkIns]);

  const riskColor =
    riskLevel === "low"
      ? colors.riskLow
      : riskLevel === "moderate"
      ? colors.riskModerate
      : colors.riskHigh;

  const riskBg =
    riskLevel === "low"
      ? "#EDF7F1"
      : riskLevel === "moderate"
      ? "#FEF6E7"
      : "#FDECEC";

  const displayScore = todayCheckIn?.riskScore ?? averageRiskScore ?? 0;

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
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {profile?.name ?? "Mama"}
          </Text>
        </View>
        {profile?.birthDate ? (
          <View style={[styles.daysBadge, { backgroundColor: colors.lavender }]}>
            <Text style={[styles.daysNum, { color: colors.primary }]}>{daysSince}</Text>
            <Text style={[styles.daysLabel, { color: colors.primary }]}>days</Text>
          </View>
        ) : null}
      </View>

      {!hasCheckedInToday ? (
        <Pressable
          onPress={() => router.push("/(tabs)/checkin")}
          style={({ pressed }) => [
            styles.checkinCard,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.checkinInner}>
            <View>
              <Text style={[styles.checkinTitle, { color: "#fff" }]}>
                Daily Check-In
              </Text>
              <Text style={[styles.checkinSub, { color: "rgba(255,255,255,0.75)" }]}>
                How are you feeling today?
              </Text>
            </View>
            <View style={[styles.checkinIcon, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <Feather name="heart" size={22} color="#fff" />
            </View>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.checkedCard, { backgroundColor: "#EDF7F1" }]}>
          <Feather name="check-circle" size={20} color={colors.riskLow} />
          <Text style={[styles.checkedText, { color: colors.riskLow }]}>
            Checked in today
          </Text>
        </View>
      )}

      {(displayScore > 0 || hasCheckedInToday) && (
        <View style={[styles.card, { backgroundColor: riskBg }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Wellness Score
            </Text>
            <View style={[styles.riskPill, { backgroundColor: riskColor }]}>
              <Text style={styles.riskPillText}>
                {riskLevel === "low" ? "Low Risk" : riskLevel === "moderate" ? "Moderate" : "High Risk"}
              </Text>
            </View>
          </View>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { color: riskColor }]}>{displayScore}</Text>
            <Text style={[styles.scoreMax, { color: colors.mutedForeground }]}>/100</Text>
          </View>
          <View style={[styles.scoreBarBg, { backgroundColor: colors.lavender }]}>
            <View
              style={[
                styles.scoreBarFill,
                { width: `${displayScore}%` as any, backgroundColor: riskColor },
              ]}
            />
          </View>
          <Text style={[styles.riskNote, { color: colors.mutedForeground }]}>
            {riskLevel === "low"
              ? "You're managing well. Keep nurturing yourself."
              : riskLevel === "moderate"
              ? "Prioritize rest and connection. You're not alone."
              : "Please consider reaching out to your healthcare provider."}
          </Text>
        </View>
      )}

      {weeklyRiskTrend.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>7-Day Trend</Text>
          <View style={styles.barsRow}>
            {weeklyRiskTrend.map((item) => (
              <WeekBar key={item.date} date={item.date} score={item.score} max={100} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Feather name="zap" size={18} color={colors.accent} />
          <Text style={[styles.statNum, { color: colors.foreground }]}>{streak}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Day streak</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Feather name="clipboard" size={18} color={colors.primary} />
          <Text style={[styles.statNum, { color: colors.foreground }]}>{checkIns.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total logs</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Feather name="calendar" size={18} color={colors.riskLow} />
          <Text style={[styles.statNum, { color: colors.foreground }]}>{daysSince}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Days old</Text>
        </View>
      </View>

      <View style={[styles.resourceCard, { backgroundColor: colors.blush }]}>
        <Text style={[styles.resourceTitle, { color: "#6B2C3F" }]}>
          Postpartum Support
        </Text>
        <Text style={[styles.resourceText, { color: "#8B4460" }]}>
          PSI Helpline: 1-800-944-4773{"\n"}
          Text "HELLO" to 741741 (Crisis Text Line)
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  name: { fontSize: 24, fontFamily: "Inter_700Bold" },
  daysBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  daysNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  daysLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  checkinCard: {
    borderRadius: 20,
    padding: 20,
  },
  checkinInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkinTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  checkinSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  checkinIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  checkedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  checkedText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  card: {
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  riskPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  riskPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  scoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  scoreNum: { fontSize: 48, fontFamily: "Inter_700Bold", lineHeight: 52 },
  scoreMax: { fontSize: 18, fontFamily: "Inter_400Regular", marginBottom: 6 },
  scoreBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  riskNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 4,
  },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  resourceCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
    marginBottom: 8,
  },
  resourceTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resourceText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 19 },
});
