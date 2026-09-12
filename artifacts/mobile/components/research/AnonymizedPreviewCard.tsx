import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useTranslation } from "@/i18n";

interface PreviewPair {
  label: string;
  before: unknown;
  after: unknown;
}

interface AnonymizedPreviewCardProps {
  pairs: PreviewPair[];
}

function JsonBlock({ value, tint }: { value: unknown; tint: string }) {
  const colors = useColors();
  const text = value === undefined ? "// no data yet" : JSON.stringify(value, null, 2);
  return (
    <View style={[styles.jsonBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.jsonText, { color: tint }]}>{text}</Text>
    </View>
  );
}

/** Renders a real before -> after JSON comparison so the effect of
 *  anonymization is concrete rather than abstract. */
export function AnonymizedPreviewCard({ pairs }: AnonymizedPreviewCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {pairs.map((pair, idx) => (
        <View key={pair.label} style={idx > 0 ? { marginTop: 18 } : undefined}>
          <Text style={[styles.pairLabel, { color: colors.text }]}>{pair.label}</Text>
          <View style={styles.columns}>
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Feather name="eye" size={12} color={colors.mutedForeground} />
                <Text style={[styles.columnTitle, { color: colors.mutedForeground }]}>
                  {t("research.beforeOnDevice")}
                </Text>
              </View>
              <JsonBlock value={pair.before} tint={colors.mutedForeground} />
            </View>
            <View style={styles.column}>
              <View style={styles.columnHeader}>
                <Feather name="shield" size={12} color={colors.accent} />
                <Text style={[styles.columnTitle, { color: colors.accent }]}>
                  {t("research.afterExported")}
                </Text>
              </View>
              <JsonBlock value={pair.after} tint={colors.accent} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  pairLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  columns: { flexDirection: "row", gap: 10 },
  column: { flex: 1, gap: 6 },
  columnHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  columnTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
  jsonBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    minHeight: 120,
  },
  jsonText: { fontSize: 9.5, fontFamily: "Inter_400Regular", lineHeight: 14 },
});
