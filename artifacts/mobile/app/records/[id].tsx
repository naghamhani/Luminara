import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Sharing from "expo-sharing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/records/ScreenHeader";
import { RECORD_TYPE_ICONS } from "@/components/records/recordIcons";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { MEDICAL_RECORD_TYPE_LABELS } from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";
import { useTranslation } from "@/i18n";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function RecordDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, deleteRecord } = useHealth();
  const [sharing, setSharing] = useState(false);

  const record = useMemo(() => records.find((r) => r.id === id), [records, id]);

  const isImageAttachment = record?.attachmentMime?.startsWith("image/");

  const handleDelete = () => {
    if (!record) return;
    showAlert(
      "Delete record?",
      "This will permanently remove this record from your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteRecord(record.id);
            goBack("/records");
          },
        },
      ]
    );
  };

  const handleShareAttachment = async () => {
    if (!record?.attachmentUri) return;
    try {
      setSharing(true);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(record.attachmentUri, {
          mimeType: record.attachmentMime,
        });
      } else {
        showAlert("Sharing unavailable", "Your device does not support file sharing.");
      }
    } catch {
      showAlert("Error", "Could not share this file.");
    } finally {
      setSharing(false);
    }
  };

  if (!record) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Record" fallbackHref="/records" />
        <View style={styles.notFound}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>
            {t("records.notFound")}
          </Text>
          <Text style={[styles.notFoundSub, { color: colors.mutedForeground }]}>
            {t("records.notFoundMsg")}
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
        title="Record"
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
          <Feather name={RECORD_TYPE_ICONS[record.type]} size={13} color={colors.primary} />
          <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
            {MEDICAL_RECORD_TYPE_LABELS[record.type]}
          </Text>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{record.title}</Text>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(record.date)}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.attributionRow}>
            <View style={[styles.attributionIcon, { backgroundColor: colors.softGreen }]}>
              <Feather name="user" size={16} color={colors.riskLow} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.attributionLabel, { color: colors.mutedForeground }]}>
                {t("records.provider2")}
              </Text>
              <Text style={[styles.attributionValue, { color: colors.text }]}>
                {record.provider}
              </Text>
            </View>
          </View>
          {record.facility ? (
            <View style={styles.attributionRow}>
              <View style={[styles.attributionIcon, { backgroundColor: colors.softOrange }]}>
                <Feather name="map-pin" size={16} color={colors.warm} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.attributionLabel, { color: colors.mutedForeground }]}>
                  {t("records.facility")}
                </Text>
                <Text style={[styles.attributionValue, { color: colors.text }]}>
                  {record.facility}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {record.content ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Notes</Text>
            <Text style={[styles.content, { color: colors.text }]}>{record.content}</Text>
          </View>
        ) : null}

        {record.attachmentUri ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Attachment</Text>
            {isImageAttachment ? (
              <Image
                source={{ uri: record.attachmentUri }}
                style={styles.image}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.fileCard, { backgroundColor: colors.secondary }]}>
                <View style={[styles.fileIcon, { backgroundColor: colors.card }]}>
                  <Feather name="file-text" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                    {t("records.pdfDocument")}
                  </Text>
                  <Text style={[styles.fileNote, { color: colors.mutedForeground }]}>
                    {t("records.noPreview")}
                  </Text>
                </View>
              </View>
            )}
            <Pressable
              onPress={handleShareAttachment}
              disabled={sharing}
              style={[styles.shareBtn, { backgroundColor: colors.primary, opacity: sharing ? 0.7 : 1 }]}
            >
              <Feather name="share-2" size={14} color="#fff" />
              <Text style={styles.shareBtnText}>{sharing ? "Opening…" : "Share attachment"}</Text>
            </Pressable>
          </View>
        ) : null}

        {record.tags.length > 0 && (
          <View style={styles.tagRow}>
            {record.tags.map((tag, i) => (
              <View key={i} style={[styles.tagPill, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.tagPillText, { color: colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
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
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  attributionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  attributionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  attributionLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  attributionValue: { fontSize: 14.5, fontFamily: "Inter_600SemiBold", marginTop: 1 },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  image: { width: "100%", height: 220, borderRadius: 12 },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fileNote: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 16 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  shareBtnText: { color: "#fff", fontSize: 13.5, fontFamily: "Inter_600SemiBold" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  tagPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 8,
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
