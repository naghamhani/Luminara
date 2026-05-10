import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getRiskLevel, CheckIn } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { generateReportHtml } from "@/utils/generateReport";

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

function pct(val: number, max = 5, invert = false): number {
  const p = ((val - 1) / (max - 1)) * 100;
  return invert ? 100 - p : p;
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
}

function HBar({ value, color, bg }: { value: number; color: string; bg: string }) {
  return (
    <View style={[hBarStyles.track, { backgroundColor: bg }]}>
      <View style={[hBarStyles.fill, { width: `${value}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const hBarStyles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: "hidden", flex: 1 },
  fill: { height: "100%", borderRadius: 4 },
});

function SummarySection({ checkIns }: { checkIns: CheckIn[] }) {
  const colors = useColors();
  const last7 = checkIns.slice(0, 7);
  const last30 = checkIns.slice(0, 30);

  const avgScore = last7.length
    ? Math.round(last7.reduce((a, c) => a + c.riskScore, 0) / last7.length)
    : 0;
  const wellness = Math.max(0, 100 - avgScore);
  const level = getRiskLevel(avgScore);
  const levelColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;

  const avgSleep = avg(last7.map((c) => c.sleep));
  const avgMood = avg(last7.map((c) => c.mood));
  const avgAnxiety = avg(last7.map((c) => c.anxiety));
  const avgBonding = avg(last7.map((c) => c.bonding));
  const lowDays = last30.filter((c) => c.riskScore <= 35).length;
  const modDays = last30.filter((c) => c.riskScore > 35 && c.riskScore <= 65).length;
  const highDays = last30.filter((c) => c.riskScore > 65).length;

  const cognitiveLoad = Math.round((avgAnxiety / 5) * 100);
  const emotionalResilience = Math.round(((avgMood + avgBonding) / 10) * 100);
  const moodStability = Math.round((avgMood / 5) * 100);

  const firstDate = last30.length > 0 ? last30[last30.length - 1].date : "";
  const lastDate = last30.length > 0 ? last30[0].date : "";

  return (
    <View style={[summaryStyles.container, { backgroundColor: colors.card }]}>
      <View style={summaryStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[summaryStyles.reportLabel, { color: colors.mutedForeground }]}>
            CLINICAL WELLNESS REPORT
          </Text>
          <Text style={[summaryStyles.title, { color: colors.foreground }]}>
            Comprehensive Overview
          </Text>
          {firstDate && lastDate && (
            <Text style={[summaryStyles.period, { color: colors.mutedForeground }]}>
              {formatDateShort(firstDate)} – {formatDateShort(lastDate)}, {new Date(lastDate + "T12:00:00").getFullYear()}
            </Text>
          )}
        </View>
        <View style={[summaryStyles.scoreCircle, { borderColor: levelColor }]}>
          <Text style={[summaryStyles.scoreNum, { color: levelColor }]}>{wellness}</Text>
          <Text style={[summaryStyles.scoreLabel, { color: colors.mutedForeground }]}>Score</Text>
        </View>
      </View>

      <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />

      <View>
        <Text style={[summaryStyles.sectionLabel, { color: colors.foreground }]}>Mood Stability</Text>
        <Text style={[summaryStyles.sectionSub, { color: colors.mutedForeground }]}>
          Average over the last {last7.length} days
        </Text>
        <View style={summaryStyles.barRow}>
          <HBar value={moodStability} color={colors.primary} bg={colors.lavender} />
          <Text style={[summaryStyles.barVal, { color: colors.foreground }]}>{avgMood}/5</Text>
        </View>
      </View>

      <View style={summaryStyles.metricsRow}>
        {[
          {
            icon: "🌙",
            label: "Sleep Quality",
            value: `${avgSleep}h avg`,
            sub: avgSleep >= 7 ? "Restful" : avgSleep >= 5 ? "Fair" : "Poor",
            subColor: avgSleep >= 7 ? colors.riskLow : avgSleep >= 5 ? colors.riskModerate : colors.riskHigh,
            bg: colors.blush,
          },
          {
            icon: "💚",
            label: "Wellness Score",
            value: `${wellness}`,
            sub: level === "low" ? "Low Risk" : level === "moderate" ? "Moderate" : "High Risk",
            subColor: levelColor,
            bg: colors.softGreen,
          },
          {
            icon: "🤱",
            label: "Bonding",
            value: `${avgBonding}/5`,
            sub: avgBonding >= 4 ? "Strong" : "Growing",
            subColor: avgBonding >= 4 ? colors.riskLow : colors.riskModerate,
            bg: colors.lavender,
          },
        ].map((m) => (
          <View key={m.label} style={[summaryStyles.metricCard, { backgroundColor: m.bg }]}>
            <Text style={{ fontSize: 20 }}>{m.icon}</Text>
            <Text style={[summaryStyles.metricLabel, { color: colors.mutedForeground }]}>{m.label}</Text>
            <Text style={[summaryStyles.metricVal, { color: colors.foreground }]}>{m.value}</Text>
            <View style={[summaryStyles.statusPill, { backgroundColor: m.subColor + "22" }]}>
              <Text style={[summaryStyles.statusText, { color: m.subColor }]}>{m.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />

      <View style={{ gap: 14 }}>
        <Text style={[summaryStyles.sectionLabel, { color: colors.foreground }]}>
          Risk Indicators & Resilience
        </Text>

        <View style={{ gap: 8 }}>
          <View style={summaryStyles.indicatorHeader}>
            <Text style={[summaryStyles.indicatorTitle, { color: colors.text }]}>
              Cognitive Load & Stress
            </Text>
            <View
              style={[
                summaryStyles.indicatorBadge,
                {
                  backgroundColor:
                    cognitiveLoad <= 40
                      ? colors.softGreen
                      : cognitiveLoad <= 65
                      ? colors.softOrange
                      : colors.softRed,
                },
              ]}
            >
              <Text
                style={[
                  summaryStyles.indicatorBadgeText,
                  {
                    color:
                      cognitiveLoad <= 40
                        ? colors.riskLow
                        : cognitiveLoad <= 65
                        ? colors.riskModerate
                        : colors.riskHigh,
                  },
                ]}
              >
                {cognitiveLoad <= 40 ? "LOW" : cognitiveLoad <= 65 ? "MODERATE" : "ELEVATED"}
              </Text>
            </View>
          </View>
          <View style={summaryStyles.barRow}>
            <HBar
              value={cognitiveLoad}
              color={
                cognitiveLoad <= 40
                  ? colors.riskLow
                  : cognitiveLoad <= 65
                  ? colors.riskModerate
                  : colors.riskHigh
              }
              bg={colors.lavender}
            />
            <Text style={[summaryStyles.barVal, { color: colors.mutedForeground }]}>{cognitiveLoad}%</Text>
          </View>
          <Text style={[summaryStyles.indicatorDesc, { color: colors.mutedForeground }]}>
            {cognitiveLoad <= 40
              ? "Anxiety is well-managed. Your nervous system appears regulated."
              : cognitiveLoad <= 65
              ? "Moderate stress patterns detected. Rest and grounding exercises may help."
              : "Elevated stress indicators. Prioritise support and consider professional guidance."}
          </Text>
        </View>

        <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />

        <View style={{ gap: 8 }}>
          <View style={summaryStyles.indicatorHeader}>
            <Text style={[summaryStyles.indicatorTitle, { color: colors.text }]}>
              Emotional Resilience
            </Text>
            <View
              style={[
                summaryStyles.indicatorBadge,
                {
                  backgroundColor:
                    emotionalResilience >= 70
                      ? colors.softGreen
                      : emotionalResilience >= 50
                      ? colors.softOrange
                      : colors.softRed,
                },
              ]}
            >
              <Text
                style={[
                  summaryStyles.indicatorBadgeText,
                  {
                    color:
                      emotionalResilience >= 70
                        ? colors.riskLow
                        : emotionalResilience >= 50
                        ? colors.riskModerate
                        : colors.riskHigh,
                  },
                ]}
              >
                {emotionalResilience >= 70 ? "HIGH" : emotionalResilience >= 50 ? "MODERATE" : "LOW"}
              </Text>
            </View>
          </View>
          <View style={summaryStyles.barRow}>
            <HBar
              value={emotionalResilience}
              color={
                emotionalResilience >= 70
                  ? colors.riskLow
                  : emotionalResilience >= 50
                  ? colors.riskModerate
                  : colors.riskHigh
              }
              bg={colors.lavender}
            />
            <Text style={[summaryStyles.barVal, { color: colors.mutedForeground }]}>{emotionalResilience}%</Text>
          </View>
          <Text style={[summaryStyles.indicatorDesc, { color: colors.mutedForeground }]}>
            {emotionalResilience >= 70
              ? "High emotional resilience. Mood and bonding scores indicate strong self-regulation."
              : emotionalResilience >= 50
              ? "Moderate resilience. Building routine and social connection can strengthen this further."
              : "Lower resilience detected. Speaking with a counselor may be beneficial right now."}
          </Text>
        </View>
      </View>

      <View style={[summaryStyles.divider, { backgroundColor: colors.border }]} />

      <View style={{ gap: 10 }}>
        <Text style={[summaryStyles.sectionLabel, { color: colors.foreground }]}>
          30-Day Risk Summary
        </Text>
        {[
          { color: colors.riskLow, label: "Low risk days", count: lowDays },
          { color: colors.riskModerate, label: "Moderate risk days", count: modDays },
          { color: colors.riskHigh, label: "High risk days", count: highDays },
        ].map((r) => (
          <View key={r.label} style={summaryStyles.riskRow}>
            <View style={[summaryStyles.riskDot, { backgroundColor: r.color }]} />
            <Text style={[summaryStyles.riskLabel, { color: colors.text }]}>{r.label}</Text>
            <Text style={[summaryStyles.riskCount, { color: r.color }]}>{r.count}</Text>
          </View>
        ))}
      </View>

      <View style={[summaryStyles.disclaimer, { backgroundColor: colors.muted }]}>
        <Feather name="info" size={13} color={colors.primary} />
        <Text style={[summaryStyles.disclaimerText, { color: colors.mutedForeground }]}>
          This report is an expert tool for clinical awareness and should not be used for self-diagnosis. Always consult a licensed healthcare provider.
        </Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  container: { borderRadius: 20, padding: 18, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  reportLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  period: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  scoreCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  scoreLabel: { fontSize: 9, fontFamily: "Inter_500Medium" },
  divider: { height: 1 },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 8 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  barVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 36, textAlign: "right" },
  metricsRow: { flexDirection: "row", gap: 8 },
  metricCard: { flex: 1, borderRadius: 14, padding: 11, alignItems: "center", gap: 4 },
  metricLabel: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center" },
  metricVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  statusText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  indicatorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  indicatorTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  indicatorBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  indicatorBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  indicatorDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  riskLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  riskCount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    padding: 12,
    alignItems: "flex-start",
  },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
});

const MOOD_EMOJIS = ["", "😞", "😟", "😐", "🙂", "😊"];

function EntryRow({ item, isLast }: { item: CheckIn; isLast: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const level = getRiskLevel(item.riskScore);
  const levelColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;
  const levelLabel = level === "low" ? "Low" : level === "moderate" ? "Moderate" : "High Risk";

  return (
    <View>
      <View style={[entryStyles.timelineLine, { backgroundColor: colors.border }]} />
      <View style={[entryStyles.timelineDot, { backgroundColor: levelColor }]} />
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        style={[entryStyles.row, { backgroundColor: colors.card }]}
        activeOpacity={0.85}
      >
        <View style={entryStyles.rowTop}>
          <View style={entryStyles.rowLeft}>
            <Text style={{ fontSize: 22 }}>{MOOD_EMOJIS[item.mood] ?? "😐"}</Text>
            <View>
              <Text style={[entryStyles.relDate, { color: colors.text }]}>
                {formatRelative(item.date)}
              </Text>
              <Text style={[entryStyles.fullDate, { color: colors.mutedForeground }]}>
                {formatDateLong(item.date)}
              </Text>
            </View>
          </View>
          <View style={entryStyles.rowRight}>
            <View style={[entryStyles.scorePill, { backgroundColor: levelColor + "20" }]}>
              <Text style={[entryStyles.scoreText, { color: levelColor }]}>
                {item.riskScore} · {levelLabel}
              </Text>
            </View>
            <Feather
              name={expanded ? "chevron-up" : "chevron-down"}
              size={15}
              color={colors.mutedForeground}
            />
          </View>
        </View>

        {item.notes ? (
          <Text style={[entryStyles.notesPreview, { color: colors.mutedForeground }]} numberOfLines={expanded ? undefined : 1}>
            💬 {item.notes}
          </Text>
        ) : null}

        {expanded && (
          <View style={entryStyles.detail}>
            <View style={[entryStyles.divider, { backgroundColor: colors.border }]} />
            <View style={entryStyles.metricsGrid}>
              {[
                { label: "Mood", val: item.mood, max: 5, invert: false },
                { label: "Sleep", val: item.sleep + "h", raw: item.sleep, max: 12, invert: false, isStr: true },
                { label: "Anxiety", val: item.anxiety, max: 5, invert: true },
                { label: "Appetite", val: item.appetite, max: 5, invert: false },
                { label: "Bonding", val: item.bonding, max: 5, invert: false },
                { label: "Support", val: item.support, max: 5, invert: false },
              ].map((m) => (
                <View key={m.label} style={entryStyles.metricItem}>
                  <Text style={[entryStyles.metricLabel, { color: colors.mutedForeground }]}>
                    {m.label}
                  </Text>
                  <View style={[entryStyles.metricBarBg, { backgroundColor: colors.lavender }]}>
                    <View
                      style={[
                        entryStyles.metricBarFill,
                        {
                          width: `${m.isStr ? (Number(m.raw ?? 0) / m.max) * 100 : pct(Number(m.val), m.max, m.invert)}%` as any,
                          backgroundColor: m.invert
                            ? Number(m.val) >= 4 ? colors.riskHigh : Number(m.val) === 3 ? colors.riskModerate : colors.riskLow
                            : colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[entryStyles.metricVal, { color: colors.text }]}>
                    {m.isStr ? m.val : `${m.val}/5`}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const entryStyles = StyleSheet.create({
  timelineLine: {
    position: "absolute",
    left: 22,
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  timelineDot: {
    position: "absolute",
    left: 15,
    top: 20,
    width: 14,
    height: 14,
    borderRadius: 7,
    zIndex: 1,
  },
  row: {
    borderRadius: 16,
    padding: 14,
    marginLeft: 36,
    gap: 8,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  relDate: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fullDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  scorePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  scoreText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  notesPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  detail: { gap: 10 },
  divider: { height: 1 },
  metricsGrid: { gap: 8 },
  metricItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  metricLabel: { fontSize: 11, fontFamily: "Inter_400Regular", width: 58 },
  metricBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  metricBarFill: { height: "100%", borderRadius: 3 },
  metricVal: { fontSize: 11, fontFamily: "Inter_600SemiBold", width: 36, textAlign: "right" },
});

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns, profile } = useApp();
  const [sharing, setSharing] = useState(false);

  async function handleSharePdf() {
    if (!profile) return;
    if (Platform.OS === "web") {
      Alert.alert("Not supported", "PDF export is available on iOS and Android only.");
      return;
    }
    try {
      setSharing(true);
      const html = generateReportHtml(profile, checkIns);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share Clinical Wellness Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Sharing unavailable", "Your device does not support file sharing.");
      }
    } catch {
      Alert.alert("Error", "Could not generate the report. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <FlatList
      data={checkIns}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <EntryRow item={item} isLast={index === checkIns.length - 1} />
      )}
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
        <View style={{ gap: 14, marginBottom: 8 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Clinical Report</Text>
            {checkIns.length > 0 && (
              <Pressable
                onPress={handleSharePdf}
                disabled={sharing}
                style={[styles.shareBtn, { backgroundColor: colors.primary }]}
              >
                {sharing ? (
                  <ActivityIndicator size={14} color="#fff" />
                ) : (
                  <Feather name="share-2" size={14} color="#fff" />
                )}
                <Text style={styles.shareBtnText}>
                  {sharing ? "Generating…" : "Share PDF"}
                </Text>
              </Pressable>
            )}
          </View>
          {checkIns.length > 0 && <SummarySection checkIns={checkIns} />}
          <Text style={[styles.logTitle, { color: colors.foreground }]}>Timeline of Events</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ fontSize: 48 }}>📋</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No entries yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Complete your first check-in to see your clinical report here.
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareBtnText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  logTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginTop: 4 },
  empty: { paddingTop: 60, alignItems: "center", gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
