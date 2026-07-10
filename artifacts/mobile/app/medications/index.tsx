import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useHealth } from "@/context/HealthContext";
import { useColors } from "@/hooks/useColors";
import { toDateString, type Medication, type MedicationKind } from "@/types/health";
import { showAlert } from "@/utils/dialog";
import { goBack } from "@/utils/navigation";

const KIND_ICONS: Record<MedicationKind, keyof typeof Feather.glyphMap> = {
  medication: "circle",
  supplement: "feather",
  vitamin: "sun",
};

const KIND_LABELS: Record<MedicationKind, string> = {
  medication: "Medication",
  supplement: "Supplement",
  vitamin: "Vitamin",
};

function formatDate(date?: string): string {
  if (!date) return "—";
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isPast(med: Medication, today: string): boolean {
  if (!med.active) return true;
  if (med.endDate && med.endDate < today) return true;
  return false;
}

export default function MedicationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { medications, isLoading, updateMedication, deleteMedication } = useHealth();

  const today = toDateString(new Date());

  const { active, past } = useMemo(() => {
    const activeList: Medication[] = [];
    const pastList: Medication[] = [];
    for (const med of medications) {
      if (isPast(med, today)) pastList.push(med);
      else activeList.push(med);
    }
    return { active: activeList, past: pastList };
  }, [medications, today]);

  const handleToggleActive = async (med: Medication) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateMedication(med.id, { active: !med.active });
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handleDelete = (med: Medication) => {
    showAlert(
      "Delete entry?",
      `This will permanently remove "${med.name}" from your records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await deleteMedication(med.id);
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => goBack("/(tabs)")} style={styles.backBtn} hitSlop={10}>
          <Feather name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Medications & Supplements
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.push("/medications/add")}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add medication or supplement</Text>
        </Pressable>

        {isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={88} borderRadius={16} />
            <Skeleton height={88} borderRadius={16} />
            <Skeleton height={88} borderRadius={16} />
          </View>
        ) : medications.length === 0 ? (
          <EmptyState
            icon="package"
            title="No medications yet"
            message="Add your medications and supplements to keep track of what you're taking and why."
            actionLabel="Add your first medication"
            onAction={() => router.push("/medications/add")}
          />
        ) : (
          <>
            <Section title="Active" count={active.length}>
              {active.length === 0 ? (
                <InlineEmptyNote text="Nothing marked active right now." colors={colors} />
              ) : (
                active.map((med) => (
                  <MedicationCard
                    key={med.id}
                    med={med}
                    colors={colors}
                    onToggleActive={() => handleToggleActive(med)}
                    onDelete={() => handleDelete(med)}
                    onPress={() => router.push(`/medications/add?id=${med.id}`)}
                  />
                ))
              )}
            </Section>

            <Section title="Past" count={past.length}>
              {past.length === 0 ? (
                <InlineEmptyNote text="No past medications logged yet." colors={colors} />
              ) : (
                past.map((med) => (
                  <MedicationCard
                    key={med.id}
                    med={med}
                    colors={colors}
                    onToggleActive={() => handleToggleActive(med)}
                    onDelete={() => handleDelete(med)}
                    onPress={() => router.push(`/medications/add?id=${med.id}`)}
                  />
                ))
              )}
            </Section>
          </>
        )}

        <Text style={[styles.footerDisclaimer, { color: colors.mutedForeground }]}>
          Always confirm changes with your prescriber.
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{count}</Text>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function InlineEmptyNote({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.emptyBox, { backgroundColor: colors.card }]}>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

function MedicationCard({
  med,
  colors,
  onToggleActive,
  onDelete,
  onPress,
}: {
  med: Medication;
  colors: ReturnType<typeof useColors>;
  onToggleActive: () => void;
  onDelete: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.medCard,
        { backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.medRow}>
        <View style={[styles.kindIcon, { backgroundColor: colors.secondary }]}>
          <Feather name={KIND_ICONS[med.kind]} size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.medName, { color: colors.foreground }]}>
            {med.name} {med.dosage ? `· ${med.dosage}` : ""}
          </Text>
          <Text style={[styles.medMeta, { color: colors.mutedForeground }]}>
            {KIND_LABELS[med.kind]} · {med.frequency}
          </Text>
          {med.prescribedBy && (
            <Text style={[styles.medMeta, { color: colors.mutedForeground }]}>
              Prescribed by {med.prescribedBy}
            </Text>
          )}
          {med.providerNotes && (
            <Text style={[styles.medNotes, { color: colors.text }]} numberOfLines={2}>
              {med.providerNotes}
            </Text>
          )}
          <Text style={[styles.medDates, { color: colors.mutedForeground }]}>
            Started {formatDate(med.startDate)}
            {med.endDate ? ` · Ended ${formatDate(med.endDate)}` : ""}
          </Text>
        </View>
      </View>

      <View style={[styles.medActions, { borderTopColor: colors.border }]}>
        <Pressable onPress={onToggleActive} style={styles.actionBtn} hitSlop={6}>
          <Feather
            name={med.active ? "pause-circle" : "play-circle"}
            size={15}
            color={colors.primary}
          />
          <Text style={[styles.actionText, { color: colors.primary }]}>
            {med.active ? "Mark inactive" : "Mark active"}
          </Text>
        </Pressable>
        <Pressable onPress={onDelete} style={styles.actionBtn} hitSlop={6}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
          <Text style={[styles.actionText, { color: colors.destructive }]}>Delete</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    paddingHorizontal: 20,
    gap: 20,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 16,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  sectionCount: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  emptyBox: {
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  medCard: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  medRow: {
    flexDirection: "row",
    gap: 12,
  },
  kindIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  medName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  medMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  medNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 6,
  },
  medDates: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
  },
  medActions: {
    flexDirection: "row",
    gap: 20,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  footerDisclaimer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },
});
