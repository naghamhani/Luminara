import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { ScreenHeader } from "@/components/records/ScreenHeader";
import { Skeleton } from "@/components/Skeleton";
import { LAB_CATEGORY_ICONS, RECORD_TYPE_ICONS } from "@/components/records/recordIcons";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";
import {
  LAB_CATEGORY_LABELS,
  LabResult,
  MEDICAL_RECORD_TYPE_LABELS,
  MEDICAL_RECORD_TYPES,
  MedicalRecord,
} from "@/types/health";

type Segment = "documents" | "labs";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function RecordCard({ record }: { record: MedicalRecord }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push(`/records/${record.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.typeBadge, { backgroundColor: colors.secondary }]}>
          <Feather name={RECORD_TYPE_ICONS[record.type]} size={12} color={colors.primary} />
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
            {MEDICAL_RECORD_TYPE_LABELS[record.type]}
          </Text>
        </View>
        {record.attachmentUri ? (
          <Feather name="paperclip" size={14} color={colors.mutedForeground} />
        ) : null}
      </View>

      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
        {record.title}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
        {record.provider}
        {record.facility ? ` · ${record.facility}` : ""}
      </Text>
      <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
        {formatDate(record.date)}
      </Text>
      {record.content ? (
        <Text style={[styles.cardPreview, { color: colors.text }]} numberOfLines={2}>
          {record.content}
        </Text>
      ) : null}
    </Pressable>
  );
}

function LabCard({ lab }: { lab: LabResult }) {
  const colors = useColors();
  const flaggedCount = lab.markers.filter((m) => m.flag !== "normal").length;

  return (
    <Pressable
      onPress={() => router.push(`/records/lab/${lab.id}`)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.typeBadge, { backgroundColor: colors.secondary }]}>
          <Feather name={LAB_CATEGORY_ICONS[lab.category]} size={12} color={colors.teal} />
          <Text style={[styles.typeBadgeText, { color: colors.teal }]}>
            {LAB_CATEGORY_LABELS[lab.category]}
          </Text>
        </View>
        {flaggedCount > 0 && (
          <View style={styles.flagRow}>
            {lab.markers
              .filter((m) => m.flag !== "normal")
              .slice(0, 5)
              .map((m, i) => (
                <View
                  key={i}
                  style={[
                    styles.flagDot,
                    { backgroundColor: m.flag === "high" ? colors.riskHigh : colors.riskModerate },
                  ]}
                />
              ))}
          </View>
        )}
      </View>

      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
        {lab.testName}
      </Text>
      <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
        {lab.provider ? lab.provider : "No provider listed"}
      </Text>
      <Text style={[styles.cardDate, { color: colors.mutedForeground }]}>
        {formatDate(lab.date)}
      </Text>
      <Text style={[styles.cardPreview, { color: colors.text }]}>
        {lab.markers.length} marker{lab.markers.length === 1 ? "" : "s"}
        {flaggedCount > 0
          ? ` · ${flaggedCount} out of range`
          : " · all within range"}
      </Text>
    </Pressable>
  );
}

export default function RecordsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { records, labResults, isLoading } = useHealth();
  const [segment, setSegment] = useState<Segment>("documents");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filteredRecords = useMemo(() => {
    if (!typeFilter) return records;
    return records.filter((r) => r.type === typeFilter);
  }, [records, typeFilter]);

  const presentTypes = useMemo(() => {
    const set = new Set(records.map((r) => r.type));
    return MEDICAL_RECORD_TYPES.filter((t) => set.has(t));
  }, [records]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t("records.title")}
        right={
          <Pressable
            onPress={() =>
              router.push(segment === "documents" ? "/records/add" : "/records/add-lab")
            }
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            hitSlop={4}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        }
      />

      <View style={styles.segmentWrap}>
        <View style={[styles.segment, { backgroundColor: colors.secondary }]}>
          {(["documents", "labs"] as Segment[]).map((s) => {
            const active = segment === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSegment(s)}
                style={[
                  styles.segmentBtn,
                  active && { backgroundColor: colors.card, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.primary : colors.mutedForeground },
                  ]}
                >
                  {s === "documents" ? "Documents" : "Lab Results"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {segment === "documents" && presentTypes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              onPress={() => setTypeFilter(null)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: typeFilter === null ? colors.primary : colors.card,
                  borderColor: typeFilter === null ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: typeFilter === null ? "#fff" : colors.text },
                ]}
              >
                {t("common.all")}
              </Text>
            </Pressable>
            {presentTypes.map((t) => {
              const active = typeFilter === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTypeFilter(active ? null : t)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: active ? "#fff" : colors.text },
                    ]}
                  >
                    {MEDICAL_RECORD_TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {isLoading ? (
          <View style={styles.list}>
            <Skeleton height={92} borderRadius={16} />
            <Skeleton height={92} borderRadius={16} />
            <Skeleton height={92} borderRadius={16} />
          </View>
        ) : segment === "documents" ? (
          filteredRecords.length > 0 ? (
            <View style={styles.list}>
              {filteredRecords.map((r) => (
                <RecordCard key={r.id} record={r} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="file-text"
              title={t("records.emptyTitle")}
              message={t("records.emptyMsg")}
              actionLabel="Add your first record"
              onAction={() => router.push("/records/add")}
            />
          )
        ) : labResults.length > 0 ? (
          <View style={styles.list}>
            {labResults.map((l) => (
              <LabCard key={l.id} lab={l} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="activity"
            title={t("records.labEmptyTitle")}
            message={t("records.labEmptyMsg")}
            actionLabel="Add your first lab result"
            onAction={() => router.push("/records/add-lab")}
          />
        )}

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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentWrap: { paddingHorizontal: 20, marginBottom: 4 },
  segment: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  segmentText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  filterRow: { gap: 8, paddingBottom: 2 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterChipText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
  list: { gap: 12 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  typeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  flagRow: { flexDirection: "row", gap: 4 },
  flagDot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 12.5, fontFamily: "Inter_400Regular" },
  cardDate: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
  cardPreview: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginTop: 4,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
    paddingBottom: 4,
  },
  footerNoteText: { fontSize: 11.5, fontFamily: "Inter_400Regular" },
});
