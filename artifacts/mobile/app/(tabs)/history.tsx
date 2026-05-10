import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getRiskLevel, CheckIn } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { useState } from "react";

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatRelative(dateStr: string): string {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr === yStr) return "Yesterday";
  return formatDateShort(dateStr);
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

function SummarySection({ checkIns }: { checkIns: CheckIn[] }) {
  const colors = useColors();
  const last7 = checkIns.slice(0, 7);
  const last30 = checkIns.slice(0, 30);

  const avgScore = last7.length ? Math.round(last7.reduce((a, c) => a + c.riskScore, 0) / last7.length) : 0;
  const wellness = Math.max(0, 100 - avgScore);
  const level = getRiskLevel(avgScore);
  const levelColor = level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;
  const avgSleep = avg(last7.map((c) => c.sleep));
  const avgMood = avg(last7.map((c) => c.mood));
  const avgAnxiety = avg(last7.map((c) => c.anxiety));
  const lowDays = last30.filter((c) => c.riskScore <= 35).length;
  const highDays = last30.filter((c) => c.riskScore > 65).length;

  return (
    <View style={[summaryStyles.container, { backgroundColor: colors.card }]}>
      <View style={summaryStyles.header}>
        <View>
          <Text style={[summaryStyles.reportLabel, { color: colors.mutedForeground }]}>
            CLINICAL WELLNESS REPORT
          </Text>
          <Text style={[summaryStyles.title, { color: colors.foreground }]}>
            7-Day Summary
          </Text>
        </View>
        <View style={[summaryStyles.scoreCircle, { borderColor: levelColor }]}>
          <Text style={[summaryStyles.scoreNum, { color: levelColor }]}>{wellness}</Text>
          <Text style={[summaryStyles.scoreLabel, { color: colors.mutedForeground }]}>Score</Text>
        </View>
      </View>

      <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />

      <View style={summaryStyles.metricsGrid}>
        {[
          {
            icon: "🌙",
            label: "Sleep Quality",
            value: `${avgSleep}h avg`,
            sublabel: avgSleep >= 7 ? "Restful" : avgSleep >= 5 ? "Fair" : "Poor",
            subColor: avgSleep >= 7 ? colors.riskLow : avgSleep >= 5 ? colors.riskModerate : colors.riskHigh,
            bg: colors.blush,
          },
          {
            icon: "😊",
            label: "Mood Stability",
            value: `${avgMood}/5`,
            sublabel: avgMood >= 4 ? "Stable" : avgMood >= 3 ? "Variable" : "Low",
            subColor: avgMood >= 4 ? colors.riskLow : avgMood >= 3 ? colors.riskModerate : colors.riskHigh,
            bg: colors.softGreen,
          },
          {
            icon: "💭",
            label: "Anxiety Level",
            value: `${avgAnxiety}/5`,
            sublabel: avgAnxiety <= 2 ? "Managed" : avgAnxiety <= 3 ? "Moderate" : "Elevated",
            subColor: avgAnxiety <= 2 ? colors.riskLow : avgAnxiety <= 3 ? colors.riskModerate : colors.riskHigh,
            bg: colors.softOrange,
          },
        ].map((m) => (
          <View
            key={m.label}
            style={[summaryStyles.metricCard, { backgroundColor: m.bg }]}
          >
            <Text style={{ fontSize: 20 }}>{m.icon}</Text>
            <Text style={[summaryStyles.metricLabel, { color: colors.mutedForeground }]}>
              {m.label}
            </Text>
            <Text style={[summaryStyles.metricVal, { color: colors.foreground }]}>
              {m.value}
            </Text>
            <View style={[summaryStyles.statusPill, { backgroundColor: m.subColor + "22" }]}>
              <Text style={[summaryStyles.statusText, { color: m.subColor }]}>{m.sublabel}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />

      <Text style={[summaryStyles.sectionLabel, { color: colors.foreground }]}>
        30-Day Risk Indicators
      </Text>
      <View style={summaryStyles.indicators}>
        <View style={summaryStyles.indicatorRow}>
          <View style={[summaryStyles.indicatorDot, { backgroundColor: colors.riskLow }]} />
          <Text style={[summaryStyles.indicatorText, { color: colors.text }]}>
            Low risk days
          </Text>
          <Text style={[summaryStyles.indicatorVal, { color: colors.riskLow }]}>{lowDays}</Text>
        </View>
        <View style={summaryStyles.indicatorRow}>
          <View style={[summaryStyles.indicatorDot, { backgroundColor: colors.riskModerate }]} />
          <Text style={[summaryStyles.indicatorText, { color: colors.text }]}>
            Moderate risk days
          </Text>
          <Text style={[summaryStyles.indicatorVal, { color: colors.riskModerate }]}>
            {last30.length - lowDays - highDays}
          </Text>
        </View>
        <View style={summaryStyles.indicatorRow}>
          <View style={[summaryStyles.indicatorDot, { backgroundColor: colors.riskHigh }]} />
          <Text style={[summaryStyles.indicatorText, { color: colors.text }]}>
            High risk days
          </Text>
          <Text style={[summaryStyles.indicatorVal, { color: colors.riskHigh }]}>{highDays}</Text>
        </View>
      </View>

      <View style={[summaryStyles.insight, { backgroundColor: colors.muted }]}>
        <Feather name="info" size={14} color={colors.primary} />
        <Text style={[summaryStyles.insightText, { color: colors.mutedForeground }]}>
          {level === "low"
            ? "Your risk score is low. Your recovery is progressing well."
            : level === "moderate"
            ? "Moderate stress detected. Rest, social support, and routine can help."
            : "Elevated risk detected. Please speak with your healthcare provider."}
        </Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: { borderRadius: 20, padding: 18, gap: 14 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  reportLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: { fontSize: 19, fontFamily: "Inter_700Bold" },
  scoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: 20, fontFamily: "Inter_700Bold" },
  scoreLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  divider: { height: 1 },
  metricsGrid: { flexDirection: "row", gap: 8 },
  metricCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  metricLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  metricVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  indicators: { gap: 10 },
  indicatorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  indicatorDot: { width: 10, height: 10, borderRadius: 5 },
  indicatorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  indicatorVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  insight: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  insightText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

function EntryRow({ item }: { item: CheckIn }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const level = getRiskLevel(item.riskScore);
  const levelColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;

  const moodEmojis = ["", "😞", "😟", "😐", "🙂", "😊"];

  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      style={[entryStyles.row, { backgroundColor: colors.card }]}
      activeOpacity={0.85}
    >
      <View style={entryStyles.top}>
        <View style={entryStyles.left}>
          <View style={[entryStyles.dot, { backgroundColor: levelColor }]} />
          <View>
            <Text style={[entryStyles.relDate, { color: colors.text }]}>
              {formatRelative(item.date)}
            </Text>
            <Text style={[entryStyles.fullDate, { color: colors.mutedForeground }]}>
              {formatDateLong(item.date)}
            </Text>
          </View>
        </View>
        <View style={entryStyles.right}>
          <Text style={{ fontSize: 20 }}>{moodEmojis[item.mood] ?? "😐"}</Text>
          <View style={[entryStyles.scorePill, { backgroundColor: levelColor + "20" }]}>
            <Text style={[entryStyles.scoreText, { color: levelColor }]}>{item.riskScore}</Text>
          </View>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </View>

      {expanded && (
        <View style={entryStyles.detail}>
          <View style={[entryStyles.divider, { backgroundColor: colors.border }]} />
          <View style={entryStyles.metricsRow}>
            {[
              { label: "Mood", val: item.mood },
              { label: "Sleep", val: item.sleep + "h" },
              { label: "Anxiety", val: item.anxiety },
              { label: "Appetite", val: item.appetite },
              { label: "Bonding", val: item.bonding },
              { label: "Support", val: item.support },
            ].map((m) => (
              <View key={m.label} style={entryStyles.metricChip}>
                <Text style={[entryStyles.metricLabel, { color: colors.mutedForeground }]}>
                  {m.label}
                </Text>
                <Text style={[entryStyles.metricVal, { color: colors.text }]}>{m.val}</Text>
              </View>
            ))}
          </View>
          {item.notes ? (
            <View style={[entryStyles.notes, { backgroundColor: colors.muted }]}>
              <Text style={[entryStyles.notesText, { color: colors.text }]}>{item.notes}</Text>
            </View>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const entryStyles = StyleSheet.create({
  row: { borderRadius: 16, padding: 14 },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  relDate: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fullDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
  scorePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scoreText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  detail: { gap: 10, marginTop: 10 },
  divider: { height: 1 },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricChip: {
    alignItems: "center",
    gap: 2,
    minWidth: 60,
  },
  metricLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  metricVal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notes: { borderRadius: 10, padding: 10 },
  notesText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns } = useApp();

  return (
    <FlatList
      data={checkIns}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <EntryRow item={item} />}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.list,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>
            Clinical Report
          </Text>
          {checkIns.length > 0 && <SummarySection checkIns={checkIns} />}
          <Text style={[styles.logTitle, { color: colors.foreground }]}>
            Timeline of Events
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ fontSize: 44 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No entries yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Complete your first check-in to see your clinical report here.
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 12 },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  logTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
  empty: {
    paddingTop: 60,
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
