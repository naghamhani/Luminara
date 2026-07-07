import React from "react";
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * Luminara — the "Kept Flame" mark.
 *
 * A single flat flame cupped by two hands: warmth for the hard hours,
 * clarity from scattered data, and — the hands — "held / protected / yours".
 * Deliberately no clouds (they read as cloud-storage and fight the
 * on-device privacy promise) and no candle stick (a lit candle can read as
 * a vigil). One shape, one owned accent colour (candle amber).
 *
 * This component is the single in-app source of truth for the brand mark —
 * crisp at any size, no raster assets required. The matching vector masters
 * live in `assets/brand/`, and `scripts/` regenerates the store PNGs.
 */

// Shared geometry (viewBox 0 0 100 100) — keep in sync with assets/brand/*.svg
const FLAME =
  "M50,16 C57,32 68,41 68,55 C68,69 60,77 50,77 C40,77 32,69 32,55 C32,41 43,32 50,16 Z";
const SPARK =
  "M50,38 C54,48 60,53 60,62 C60,70 56,75 50,75 C44,75 40,70 40,62 C40,53 46,48 50,38 Z";
const CRADLE = "M24,72 C34,90 66,90 76,72";

// Brand tokens (mirror constants/colors.ts + the amber-forward refresh)
const AMBER = "#F6A94C";
const SPARK_LIGHT = "#FFE7BE";
const INDIGO = "#5168B4";
const CREAM = "#F4F6FD";
const INK = "#1C2236";

export type LuminaraLogoVariant = "mark" | "badge" | "mono";

export interface LuminaraLogoProps {
  /** Rendered width & height in px (the mark is always square). */
  size?: number;
  /**
   * "mark"  — flame + cradle on a transparent background (place on any surface)
   * "badge" — the app-icon look: flame + cream cradle on an indigo squircle
   * "mono"  — single-colour flame + cradle (press / watermark / disabled states)
   */
  variant?: LuminaraLogoVariant;
  /** Override the flame colour (defaults to candle amber). */
  flame?: string;
  /** Override the cradle colour. Sensible per-variant defaults otherwise. */
  cradle?: string;
  /** Badge background colour (badge variant only). */
  background?: string;
  /** Mono ink colour (mono variant only). */
  color?: string;
  /** Soft warm glow behind the flame. On by default for mark/badge. */
  glow?: boolean;
  /** Corner radius for the badge squircle, in the 0–100 viewBox scale. */
  badgeRadius?: number;
}

export function LuminaraLogo({
  size = 96,
  variant = "mark",
  flame = AMBER,
  cradle,
  background = INDIGO,
  color = INK,
  glow,
  badgeRadius = 24,
}: LuminaraLogoProps) {
  const isBadge = variant === "badge";
  const isMono = variant === "mono";
  const showGlow = glow ?? !isMono;

  const flameFill = isMono ? color : flame;
  const cradleColor =
    cradle ?? (isMono ? color : isBadge ? CREAM : INDIGO);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {showGlow && (
        <Defs>
          <RadialGradient id="lumGlow" cx="50%" cy="46%" r="52%">
            <Stop offset="0" stopColor={flameFill} stopOpacity={0.45} />
            <Stop offset="1" stopColor={flameFill} stopOpacity={0} />
          </RadialGradient>
        </Defs>
      )}

      {isBadge && (
        <Rect x={0} y={0} width={100} height={100} rx={badgeRadius} fill={background} />
      )}

      {showGlow && <Circle cx={50} cy={48} r={34} fill="url(#lumGlow)" />}

      <Path d={FLAME} fill={flameFill} />
      {!isMono && <Path d={SPARK} fill={SPARK_LIGHT} opacity={0.92} />}
      <Path
        d={CRADLE}
        fill="none"
        stroke={cradleColor}
        strokeWidth={5.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default LuminaraLogo;
