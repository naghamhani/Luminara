import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { getLastSyncedAt } from "@/utils/syncAdapter";

/**
 * Small, honest sync-status pill. Luminara is local-first with no backend
 * wired up yet (see utils/syncAdapter.ts), so the default state must never
 * claim the data is "synced" anywhere — it reads the on-device mock
 * lastSyncedAt (if the no-op sync flow has ever run) and otherwise shows a
 * plain "saved on this device" message.
 */
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SyncStatusBadge() {
  const colors = useColors();
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getLastSyncedAt().then((value) => {
      if (mounted) setLastSyncedAt(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const synced = lastSyncedAt != null;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: colors.secondary },
      ]}
      accessibilityRole="text"
      accessibilityLabel={
        synced
          ? `Last synced ${formatRelativeTime(lastSyncedAt!)}`
          : "Local only, sync coming soon"
      }
    >
      <Feather
        name={synced ? "refresh-cw" : "cloud-off"}
        size={11}
        color={colors.mutedForeground}
      />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        {synced ? `Last synced ${formatRelativeTime(lastSyncedAt!)}` : "Local only · sync coming soon"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
