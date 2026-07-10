import React from "react";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

/**
 * Abstract wave / rhythm-line motif for "Understand Your Rhythms". Three
 * layered sine-like ribbons in dark-teal tones suggest mood, sleep, and
 * energy moving in gentle cycles — deliberately not a literal chart or
 * heartbeat-monitor icon. Colors come only from the active palette (teal,
 * accent, softGreen) with opacity used for layering/depth.
 */
interface RhythmsIllustrationProps {
  size?: number;
}

export function RhythmsIllustration({ size = 200 }: RhythmsIllustrationProps) {
  const colors = useColors();

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="rhythmBack" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.softGreen} stopOpacity={0.9} />
          <Stop offset="100%" stopColor={colors.teal} stopOpacity={0.12} />
        </LinearGradient>
        <LinearGradient id="rhythmMid" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors.teal} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity={0.75} />
        </LinearGradient>
        <LinearGradient id="rhythmFront" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity={0.9} />
          <Stop offset="100%" stopColor={colors.teal} stopOpacity={1} />
        </LinearGradient>
      </Defs>

      <Path
        d="M0,140 C30,150 60,120 100,130 C140,140 160,110 200,120 L200,200 L0,200 Z"
        fill="url(#rhythmBack)"
      />

      <Path
        d="M0,110 C25,80 45,140 70,115 C95,90 115,140 140,112 C160,92 180,118 200,100"
        stroke="url(#rhythmMid)"
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
        opacity={0.65}
      />

      <Path
        d="M0,96 C22,60 40,128 66,98 C90,70 112,132 138,100 C158,76 180,104 200,84"
        stroke="url(#rhythmFront)"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />

      <Path
        d="M10,150 C40,158 60,142 90,150 C120,158 150,138 190,148"
        stroke={colors.teal}
        strokeOpacity={0.3}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
