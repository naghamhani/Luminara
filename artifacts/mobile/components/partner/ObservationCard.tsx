import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { PartnerObservation } from "@/types/health";

function formatDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function MiniRating({ label, value }: { label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={styles.miniRating}>
      <Text style={[styles.miniRatingLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.miniRatingValue, { color: colors.foreground }]}>{value}/5</Text>
    </View>
  );
}

interface ObservationCardProps {
  observation: PartnerObservation;
  onDelete: (id: string) => void;
}

export function ObservationCard({ observation, onDelete }: ObservationCardProps) {
  const colors = useColors();
  const chips = [...observation.stressFactors, ...observation.supportProvided];

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.date, { color: colors.foreground }]}>
          {formatDate(observation.date)}
        </Text>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: observation.sharedWithUser ? colors.softGreen : colors.secondary,
              },
            ]}
          >
            <Feather
              name={observation.sharedWithUser ? "eye" : "eye-off"}
              size={11}
              color={observation.sharedWithUser ? colors.riskLow : colors.mutedForeground}
            />
            <Text
              style={[
                styles.badgeText,
                { color: observation.sharedWithUser ? colors.riskLow : colors.mutedForeground },
              ]}
            >
              {observation.sharedWithUser ? "Shared" : "Private"}
            </Text>
          </View>
          <Pressable
            onPress={() => onDelete(observation.id)}
            hitSlop={8}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Delete observation"
            accessibilityHint={`Removes the observation logged on ${formatDate(observation.date)}`}
          >
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.ratingsRow}>
        <MiniRating label="Mood" value={observation.mood} />
        <MiniRating label="Energy" value={observation.energy} />
        <MiniRating label="Sleep" value={observation.sleepQuality} />
        <MiniRating label="Wellbeing" value={observation.overallWellbeing} />
      </View>

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map((chip, i) => (
            <View key={i} style={[styles.chip, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.chipText, { color: colors.secondaryForeground }]}>{chip}</Text>
            </View>
          ))}
        </View>
      )}

      {observation.concerns ? (
        <View style={[styles.concernRow, { backgroundColor: colors.softOrange }]}>
          <Feather name="alert-circle" size={14} color={colors.riskModerate} />
          <Text style={[styles.concernText, { color: "#9A5010" }]} numberOfLines={3}>
            {observation.concerns}
          </Text>
        </View>
      ) : null}

      {observation.contextNotes ? (
        <Text style={[styles.contextNotes, { color: colors.mutedForeground }]} numberOfLines={2}>
          {observation.contextNotes}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { padding: 2 },
  ratingsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  miniRating: { alignItems: "center", gap: 2 },
  miniRatingLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  miniRatingValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  concernRow: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  concernText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  contextNotes: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, fontStyle: "italic" },
});
