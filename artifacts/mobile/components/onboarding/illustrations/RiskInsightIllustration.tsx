import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

/**
 * Abstract protective / gentle-insight motif for "Early Risk Insights".
 * Layered, softly rounded arcs cradle a calm core — reads as watchful and
 * reassuring rather than a literal padlock/shield icon or anything alarming.
 * Deliberately purple/lavender only, no red anywhere, in line with
 * constants/colors.ts's guidance to never signal risk with alarm colors in
 * a mental-health context.
 */
interface RiskInsightIllustrationProps {
  size?: number;
}

export function RiskInsightIllustration({ size = 200 }: RiskInsightIllustrationProps) {
  const colors = useColors();

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="riskOuter" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.purple} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={colors.lavender} stopOpacity={0.5} />
        </LinearGradient>
        <LinearGradient id="riskCore" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.purple} stopOpacity={0.95} />
          <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.7} />
        </LinearGradient>
      </Defs>

      <Path
        d="M100,18 C142,30 170,42 170,42 C170,110 142,158 100,182 C58,158 30,110 30,42 C30,42 58,30 100,18 Z"
        fill={colors.blush}
        opacity={0.7}
      />

      <Path
        d="M100,34 C134,44 156,54 156,54 C156,110 134,148 100,168 C66,148 44,110 44,54 C44,54 66,44 100,34 Z"
        fill="url(#riskOuter)"
      />

      <Path
        d="M100,52 C124,60 140,67 140,67 C140,108 124,136 100,152 C76,136 60,108 60,67 C60,67 76,60 100,52 Z"
        fill="url(#riskCore)"
        opacity={0.85}
      />

      <Circle cx="100" cy="98" r="20" fill={colors.card} opacity={0.9} />
      <Circle cx="100" cy="98" r="20" fill={colors.purple} opacity={0.18} />
      <Path
        d="M91,98 L98,106 L112,88"
        stroke={colors.purple}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
