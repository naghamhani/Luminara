import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { DataTypeKey, DATA_TYPE_KEYS, DATA_TYPE_LABELS } from "@/types/health";

const DATA_TYPE_ICONS: Record<DataTypeKey, keyof typeof Feather.glyphMap> = {
  checkIns: "check-circle",
  cycle: "calendar",
  labs: "activity",
  records: "file-text",
  medications: "package",
  partnerObservations: "users",
};

/** Short, honest description of exactly what leaves the device for this type. */
const DATA_TYPE_HINTS: Record<DataTypeKey, string> = {
  checkIns: "Mood, sleep, anxiety & other scores — no notes",
  cycle: "Flow, BBT, symptoms — no notes",
  labs: "Marker name, value, unit & flag — no provider",
  records: "Not included in anonymized exports (too identifying)",
  medications: "Name, dosage type & duration — no provider",
  partnerObservations: "Ratings & counts only — no concerns text",
};

interface DataTypeToggleListProps {
  value: Record<DataTypeKey, boolean>;
  onChange: (next: Record<DataTypeKey, boolean>) => void;
  /** Data types with nothing to contribute get visually de-emphasized. */
  disabledKeys?: DataTypeKey[];
}

export function DataTypeToggleList({ value, onChange, disabledKeys = [] }: DataTypeToggleListProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      {DATA_TYPE_KEYS.map((key, idx) => {
        const isDisabled = disabledKeys.includes(key);
        return (
          <View key={key}>
            {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            <View style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
                <Feather name={DATA_TYPE_ICONS[key]} size={16} color={colors.primary} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.label, { color: colors.text }]}>{DATA_TYPE_LABELS[key]}</Text>
                <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                  {DATA_TYPE_HINTS[key]}
                </Text>
              </View>
              <Switch
                value={value[key]}
                onValueChange={(v) => onChange({ ...value, [key]: v })}
                trackColor={{ true: colors.primary, false: colors.lavender }}
                thumbColor="#fff"
                disabled={isDisabled}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1, gap: 2 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  divider: { height: 1 },
});
