import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export interface ConsentStepDef {
  key: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
}

interface ConsentStepperProps {
  steps: ConsentStepDef[];
  activeIndex: number;
}

/** Small 3-dot / labeled progress indicator for the consent flow. */
export function ConsentStepper({ steps, activeIndex }: ConsentStepperProps) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive || isDone ? colors.primary : colors.lavender,
                  },
                ]}
              >
                {isDone ? (
                  <Feather name="check" size={13} color="#fff" />
                ) : (
                  <Feather name={step.icon} size={13} color={isActive ? "#fff" : colors.mutedForeground} />
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.stepLabel,
                  { color: isActive ? colors.primary : colors.mutedForeground },
                ]}
              >
                {step.title}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: isDone ? colors.primary : colors.border },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  stepCol: { alignItems: "center", width: 76, gap: 6 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    lineHeight: 13,
  },
  connector: {
    height: 2,
    flex: 1,
    marginTop: 13,
    marginHorizontal: -4,
  },
});
