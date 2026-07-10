import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

/**
 * Abstract sunburst / soft-radiating-light motif for the "How are you,
 * radiant mama?" mood check-in step. Warm and gentle by design — a glowing
 * core with loosely layered, uneven rays (never a literal sun-with-a-face)
 * so it reads as calm warmth rather than a cartoon icon. Colors are pulled
 * entirely from the active palette: amber for the warm glow, lavender/blush
 * for the soft background wash, no hardcoded hex values.
 */
interface MoodIllustrationProps {
  size?: number;
}

export function MoodIllustration({ size = 200 }: MoodIllustrationProps) {
  const colors = useColors();

  const rays = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const innerR = 34;
    const outerR = i % 2 === 0 ? 82 : 66;
    const spread = 0.16;
    const x1 = 100 + Math.cos(angle - spread) * innerR;
    const y1 = 100 + Math.sin(angle - spread) * innerR;
    const x2 = 100 + Math.cos(angle + spread) * innerR;
    const y2 = 100 + Math.sin(angle + spread) * innerR;
    const xTip = 100 + Math.cos(angle) * outerR;
    const yTip = 100 + Math.sin(angle) * outerR;
    return `M${x1},${y1} Q${xTip},${yTip} ${x2},${y2} Z`;
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="moodGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.warm} stopOpacity={0.9} />
          <Stop offset="100%" stopColor={colors.purple} stopOpacity={0.55} />
        </LinearGradient>
        <LinearGradient id="moodRay" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.warm} stopOpacity={0.5} />
          <Stop offset="100%" stopColor={colors.lavender} stopOpacity={0.35} />
        </LinearGradient>
      </Defs>

      <Circle cx="100" cy="100" r="94" fill={colors.blush} opacity={0.6} />

      {rays.map((d, i) => (
        <Path key={i} d={d} fill="url(#moodRay)" />
      ))}

      <Circle cx="100" cy="100" r="46" fill="url(#moodGlow)" />
      <Circle cx="100" cy="100" r="46" fill={colors.warm} opacity={0.15} />
      <Circle cx="86" cy="86" r="14" fill={colors.card} opacity={0.35} />
    </Svg>
  );
}
