import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ObservationCard } from "@/components/partner/ObservationCard";
import { PartnerScreenHeader } from "@/components/partner/PartnerScreenHeader";
import { useApp } from "@/context/AppContext";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { showAlert } from "@/utils/dialog";
import { isPartnerVerified } from "@/utils/partnerSession";

const WATCH_ITEMS = [
  { icon: "user-minus" as const, label: "Withdrawing from you or others" },
  { icon: "coffee" as const, label: "Noticeable changes in appetite" },
  { icon: "moon" as const, label: "Sleep disruption beyond the usual newborn stretch" },
  { icon: "message-circle" as const, label: "Talk of hopelessness or not being a good parent" },
];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default function PartnerDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkIns } = useApp();
  const { partnerSettings, partnerObservations, deletePartnerObservation } = useHealth();

  // SECURITY: this route must never render without a PIN check this session.
  // Two guards: (1) the partner space isn't even set up, so there's nothing
  // to show; (2) reachable via direct navigation (deep link, typed URL, a
  // stray router.push) that skips handleCheckPin in app/partner/index.tsx —
  // isPartnerVerified() (utils/partnerSession.ts) is only set true inside
  // that success branch, is never persisted, and resets whenever the
  // top-level partner gateway mounts fresh, so a bypass attempt bounces back
  // to the PIN gate instead of rendering partner observations/summary.
  useEffect(() => {
    if (!partnerSettings.enabled || !isPartnerVerified()) {
      router.replace("/partner");
    }
  }, [partnerSettings.enabled]);

  // Observations are matched by the CURRENT partnerSettings.partnerName rather than
  // a stable identifier. Filtering by that live, renameable value would silently
  // hide all previously-logged observations the moment the partner is renamed. This
  // is a single-partner space (one PIN gate, one partner at a time), so display all
  // stored observations regardless of what the partner is named right now.
  const myObservations = partnerObservations;

  // 7-day average wellness (100 - averageRiskScore) vs the prior 7 days, using
  // only the aggregate — never raw check-in entries or notes.
  const summary = useMemo(() => {
    const sorted = [...checkIns].sort((a, b) => b.date.localeCompare(a.date));
    const last7 = sorted.slice(0, 7);
    const prior7 = sorted.slice(7, 14);
    if (last7.length === 0) return null;

    const last7Avg = average(last7.map((c) => c.riskScore));
    const wellnessPct = Math.round(100 - last7Avg);

    let trend: "up" | "down" | "flat" | "new" = "new";
    if (prior7.length > 0) {
      const prior7Avg = average(prior7.map((c) => c.riskScore));
      const priorWellness = 100 - prior7Avg;
      const delta = wellnessPct - priorWellness;
      trend = delta > 3 ? "up" : delta < -3 ? "down" : "flat";
    }

    return { wellnessPct, trend };
  }, [checkIns]);

  const trendWord =
    summary?.trend === "up"
      ? "Improving"
      : summary?.trend === "down"
      ? "Declining"
      : summary?.trend === "flat"
      ? "Steady"
      : "New";

  const trendColor =
    summary?.trend === "up"
      ? colors.riskLow
      : summary?.trend === "down"
      ? colors.riskHigh
      : colors.mutedForeground;

  const trendIcon =
    summary?.trend === "up" ? "trending-up" : summary?.trend === "down" ? "trending-down" : "minus";

  const handleDelete = (id: string) => {
    showAlert(
      "Delete this observation?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deletePartnerObservation(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  if (!partnerSettings.enabled || !isPartnerVerified()) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PartnerScreenHeader title={`Hi, ${partnerSettings.partnerName || "there"}`} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          Thank you for showing up for Nagham. Here's your support space.
        </Text>

        {partnerSettings.partnerCanViewSummary ? (
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <Text style={styles.summaryLabel}>Nagham's 7-day wellness</Text>
            {summary ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryPct}>{summary.wellnessPct}%</Text>
                  <View style={[styles.trendPill, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                    <Feather name={trendIcon} size={13} color="#fff" />
                    <Text style={styles.trendPillText}>{trendWord}</Text>
                  </View>
                </View>
                <Text style={styles.summaryFootnote}>
                  A general sense of the week — not raw entries or notes. Not a diagnosis.
                </Text>
              </>
            ) : (
              <Text style={styles.summaryFootnote}>
                Nagham hasn't logged enough check-ins yet for a weekly summary.
              </Text>
            )}
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Feather name="lock" size={18} color={colors.mutedForeground} />
            <Text style={[styles.privateTitle, { color: colors.foreground }]}>
              Summary kept private
            </Text>
            <Text style={[styles.privateBody, { color: colors.mutedForeground }]}>
              Nagham has chosen to keep her wellness summary private for now — and that's
              completely okay. You can still log your own observations below.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => router.push("/partner/log")}
          style={({ pressed }) => [
            styles.logBtn,
            { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="edit-3" size={17} color="#fff" />
          <Text style={styles.logBtnText}>Log an observation</Text>
        </Pressable>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your past observations</Text>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>
            {myObservations.length}
          </Text>
        </View>

        {myObservations.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Text style={{ fontSize: 28 }}>📝</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              You haven't logged any observations yet.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {myObservations.map((obs) => (
              <ObservationCard key={obs.id} observation={obs} onDelete={handleDelete} />
            ))}
          </View>
        )}

        <View style={[styles.guidanceCard, { backgroundColor: colors.softOrange }]}>
          <Text style={[styles.guidanceTitle, { color: "#9A5010" }]}>What to watch for</Text>
          <Text style={[styles.guidanceSub, { color: "#B06020" }]}>
            Gentle signs that it may help to check in more closely, or to encourage professional
            support:
          </Text>
          <View style={{ gap: 8 }}>
            {WATCH_ITEMS.map((item) => (
              <View key={item.label} style={styles.watchRow}>
                <Feather name={item.icon} size={14} color="#B06020" />
                <Text style={[styles.watchLabel, { color: "#9A5010" }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.guidanceFootnote, { color: "#B06020" }]}>
            If you're worried, encourage Nagham to talk with her healthcare provider — this isn't
            a diagnosis, just a nudge to get more support. In a crisis, the Support tab has
            immediate crisis-line resources.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: -8 },
  summaryCard: { borderRadius: 20, padding: 20, gap: 6 },
  summaryLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  summaryPct: { color: "#fff", fontSize: 34, fontFamily: "Inter_700Bold" },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  trendPillText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  summaryFootnote: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 4,
  },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  privateTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  privateBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  logBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
  },
  logBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  countText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyState: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  guidanceCard: { borderRadius: 20, padding: 18, gap: 10 },
  guidanceTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  guidanceSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  watchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  watchLabel: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  guidanceFootnote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginTop: 4,
  },
});
