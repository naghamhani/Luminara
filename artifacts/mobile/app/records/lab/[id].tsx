import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/records/ScreenHeader";
import { LAB_CATEGORY_ICONS } from "@/components/records/recordIcons";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { LAB_CATEGORY_LABELS, LabFlag, LabMarker } from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";
import { useTranslation } from "@/i18n";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function flagLabel(flag: LabFlag): string {
  if (flag === "high") return "High";
  if (flag === "low") return "Low";
  return "Normal";
}

function RangeBar({ marker, color }: { marker: LabMarker; color: string }) {
  const colors = useColors();
  const { value, refLow, refHigh } = marker;

  // Single shared scale: maps a value from the domain (refLow - margin, refHigh + margin)
  // to a 0-100 percentage of the bar width. Both the marker dot and the normal-zone
  // boundaries are derived from this same function so they always agree visually.
  let scale: ((v: number) => number) | null = null;
  let position = 0.5;

  if (refLow !== undefined && refHigh !== undefined && refHigh > refLow) {
    const span = refHigh - refLow;
    const margin = span * 0.25;
    const domainLow = refLow - margin;
    const domainHigh = refHigh + margin;
    scale = (v: number) => ((v - domainLow) / (domainHigh - domainLow)) * 100;
    position = scale(value) / 100;
  } else if (refHigh !== undefined) {
    position = value / (refHigh * 2 || 1);
  } else if (refLow !== undefined) {
    position = value < refLow ? 0.1 : 0.9;
  }
  const clamped = Math.max(0, Math.min(1, position));

  const normalZoneLeft = scale ? Math.max(0, Math.min(100, scale(refLow as number))) : undefined;
  const normalZoneRight = scale ? Math.max(0, Math.min(100, scale(refHigh as number))) : undefined;

  return (
    <View style={rangeStyles.wrap}>
      <View style={[rangeStyles.track, { backgroundColor: colors.lavender }]}>
        {normalZoneLeft !== undefined && normalZoneRight !== undefined && (
          <View
            style={[
              rangeStyles.normalZone,
              {
                backgroundColor: colors.softGreen,
                left: `${normalZoneLeft}%` as any,
                right: `${100 - normalZoneRight}%` as any,
              },
            ]}
          />
        )}
        <View
          style={[
            rangeStyles.marker,
            { left: `${clamped * 100}%` as any, backgroundColor: color },
          ]}
        />
      </View>
      <View style={rangeStyles.labelsRow}>
        <Text style={[rangeStyles.rangeLabel, { color: colors.mutedForeground }]}>
          {refLow !== undefined ? refLow : "—"}
        </Text>
        <Text style={[rangeStyles.rangeLabel, { color: colors.mutedForeground }]}>
          {refHigh !== undefined ? refHigh : "—"}
        </Text>
      </View>
    </View>
  );
}

const rangeStyles = StyleSheet.create({
  wrap: { gap: 4, marginTop: 6 },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "visible",
    position: "relative",
    justifyContent: "center",
  },
  normalZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    borderRadius: 4,
  },
  marker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginStart: -7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  labelsRow: { flexDirection: "row", justifyContent: "space-between" },
  rangeLabel: { fontSize: 10.5, fontFamily: "Inter_400Regular" },
});

function MarkerRow({ marker }: { marker: LabMarker }) {
  const colors = useColors();
  const { t } = useTranslation();
  const color =
    marker.flag === "high" ? colors.riskHigh : marker.flag === "low" ? colors.riskModerate : colors.riskLow;

  return (
    <View style={[markerStyles.card, { backgroundColor: colors.card }]}>
      <View style={markerStyles.top}>
        <Text style={[markerStyles.name, { color: colors.foreground }]}>{marker.name}</Text>
        <View style={[markerStyles.pill, { backgroundColor: color + "20" }]}>
          <View style={[markerStyles.dot, { backgroundColor: color }]} />
          <Text style={[markerStyles.pillText, { color }]}>{flagLabel(marker.flag)}</Text>
        </View>
      </View>
      <Text style={[markerStyles.value, { color: colors.text }]}>
        {marker.value} <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{marker.unit}</Text>
      </Text>
      {(marker.refLow !== undefined || marker.refHigh !== undefined) && (
        <Text style={[markerStyles.refText, { color: colors.mutedForeground }]}>
          Reference: {marker.refLow ?? "—"} – {marker.refHigh ?? "—"} {marker.unit}
        </Text>
      )}
      <RangeBar marker={marker} color={color} />
      {marker.flag !== "normal" && (
        <View style={[markerStyles.callout, { backgroundColor: color + "14" }]}>
          <Feather name="alert-circle" size={13} color={color} />
          <Text style={[markerStyles.calloutText, { color }]}>
            {t("records.outOfRange")}
          </Text>
        </View>
      )}
    </View>
  );
}

const markerStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  value: { fontSize: 20, fontFamily: "Inter_700Bold" },
  refText: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  calloutText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
});

export default function LabDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { labResults, deleteLabResult } = useHealth();

  const lab = useMemo(() => labResults.find((l) => l.id === id), [labResults, id]);

  const flaggedCount = lab?.markers.filter((m) => m.flag !== "normal").length ?? 0;

  const handleDelete = () => {
    if (!lab) return;
    showAlert(
      "Delete lab result?",
      "This will permanently remove this lab result from your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteLabResult(lab.id);
            goBack("/records");
          },
        },
      ]
    );
  };

  if (!lab) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={t("records.labResult")} fallbackHref="/records" />
        <View style={styles.notFound}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>
            {t("records.labNotFound")}
          </Text>
          <Text style={[styles.notFoundSub, { color: colors.mutedForeground }]}>
            {t("records.labNotFoundMsg")}
          </Text>
          <Pressable
            onPress={() => router.replace("/records")}
            style={[styles.backHomeBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.backHomeBtnText}>{t("records.backToRecords")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t("records.labResult")}
        fallbackHref="/records"
        right={
          <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteBtn}>
            <Feather name="trash-2" size={19} color={colors.destructive} />
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.typeBadge, { backgroundColor: colors.secondary }]}>
          <Feather name={LAB_CATEGORY_ICONS[lab.category]} size={13} color={colors.teal} />
          <Text style={[styles.typeBadgeText, { color: colors.teal }]}>
            {LAB_CATEGORY_LABELS[lab.category]}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{lab.testName}</Text>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(lab.date)}
          {lab.provider ? ` · ${lab.provider}` : ""}
        </Text>

        {flaggedCount > 0 && (
          <View style={[styles.summaryCallout, { backgroundColor: colors.softRed }]}>
            <Feather name="alert-triangle" size={15} color={colors.riskHigh} />
            <Text style={[styles.summaryCalloutText, { color: colors.riskHigh }]}>
              {flaggedCount} marker{flaggedCount === 1 ? "" : "s"} out of reference range — review
              with your healthcare provider.
            </Text>
          </View>
        )}

        <View style={{ gap: 12 }}>
          {lab.markers.map((m, i) => (
            <MarkerRow key={i} marker={m} />
          ))}
        </View>

        {lab.notes ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Notes</Text>
            <Text style={[styles.content, { color: colors.text }]}>{lab.notes}</Text>
          </View>
        ) : null}

        <View style={styles.disclaimerRow}>
          <Feather name="info" size={12} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            {t("common.notADiagnosisProvider")}
          </Text>
        </View>

        <View style={styles.footerNote}>
          <Feather name="lock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerNoteText, { color: colors.mutedForeground }]}>
            {t("common.encryptedOnDevice")}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },
  deleteBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  typeBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  date: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
  summaryCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    padding: 12,
  },
  summaryCalloutText: { flex: 1, fontSize: 12.5, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  disclaimerRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, paddingHorizontal: 4 },
  disclaimerText: { flex: 1, fontSize: 11.5, fontFamily: "Inter_400Regular", lineHeight: 16 },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  footerNoteText: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  notFoundTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  notFoundSub: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  backHomeBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backHomeBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
