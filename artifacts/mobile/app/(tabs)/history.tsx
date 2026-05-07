import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, getRiskLevel, CheckIn } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string): string {
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
  return formatDate(dateStr);
}

function CheckInRow({ item }: { item: CheckIn }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const level = getRiskLevel(item.riskScore);
  const levelColor =
    level === "low" ? colors.riskLow : level === "moderate" ? colors.riskModerate : colors.riskHigh;
  const levelBg =
    level === "low" ? "#EDF7F1" : level === "moderate" ? "#FEF6E7" : "#FDECEC";
  const levelLabel = level === "low" ? "Low" : level === "moderate" ? "Moderate" : "High";

  const metrics = [
    { label: "Mood", value: item.mood, max: 5, invert: false },
    { label: "Sleep", value: item.sleep, max: 5, invert: false },
    { label: "Anxiety", value: item.anxiety, max: 5, invert: true },
    { label: "Appetite", value: item.appetite, max: 5, invert: false },
    { label: "Bonding", value: item.bonding, max: 5, invert: false },
    { label: "Support", value: item.support, max: 5, invert: false },
  ];

  return (
    <TouchableOpacity
      onPress={() => setExpanded((e) => !e)}
      style={[styles.row, { backgroundColor: colors.card }]}
      activeOpacity={0.85}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowLeft}>
          <View style={[styles.levelDot, { backgroundColor: levelColor }]} />
          <View>
            <Text style={[styles.rowDate, { color: colors.text }]}>
              {formatRelative(item.date)}
            </Text>
            <Text style={[styles.rowFull, { color: colors.mutedForeground }]}>
              {formatDate(item.date)}
            </Text>
          </View>
        </View>
        <View style={styles.rowRight}>
          <View style={[styles.scorePill, { backgroundColor: levelBg }]}>
            <Text style={[styles.scoreText, { color: levelColor }]}>{item.riskScore}</Text>
          </View>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.mutedForeground}
          />
        </View>
      </View>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.metricsGrid}>
            {metrics.map((m) => (
              <View key={m.label} style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>
                  {m.label}
                </Text>
                <View style={styles.metricDots}>
                  {[1, 2, 3, 4, 5].map((v) => (
                    <View
                      key={v}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            v <= m.value
                              ? m.invert && m.value >= 4
                                ? colors.riskHigh
                                : colors.primary
                              : colors.lavender,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.metricVal, { color: colors.text }]}>
                  {m.value}/5
                </Text>
              </View>
            ))}
          </View>
          {item.notes ? (
            <View style={[styles.notes, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.notesText, { color: colors.text }]}>{item.notes}</Text>
            </View>
          ) : null}
          <View style={[styles.riskRow, { backgroundColor: levelBg }]}>
            <Text style={[styles.riskTag, { color: levelColor }]}>
              Risk: {levelLabel}
            </Text>
            <Text style={[styles.riskScore, { color: levelColor }]}>
              Score {item.riskScore}/100
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns } = useApp();

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
        <Feather name="calendar" size={48} color={colors.lavender} />
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No entries yet</Text>
        <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
          Complete your first daily check-in to see your history here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={checkIns}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <CheckInRow item={item} />}
      contentContainerStyle={[
        styles.list,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100),
        },
      ]}
      style={{ backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={checkIns.length > 0}
      ListHeaderComponent={
        <Text style={[styles.listTitle, { color: colors.foreground }]}>
          Your History
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 10 },
  listTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  row: {
    borderRadius: 16,
    padding: 16,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowDate: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  rowFull: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  expandedContent: {
    gap: 12,
    marginTop: 12,
  },
  divider: {
    height: 1,
  },
  metricsGrid: {
    gap: 10,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    width: 68,
  },
  metricDots: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  metricVal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    width: 32,
    textAlign: "right",
  },
  notes: {
    borderRadius: 10,
    padding: 12,
  },
  notesText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  riskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 10,
  },
  riskTag: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  riskScore: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
});
