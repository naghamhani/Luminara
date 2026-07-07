import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

/**
 * The app's configured appearance. This mirrors `userInterfaceStyle` in
 * app.json. Luminara currently ships **light-only**: the dark palette exists
 * (see constants/colors.ts) but is intentionally dormant until the product
 * decides to offer a real theme toggle. Set this to "system" to follow the OS.
 */
const APPEARANCE: "light" | "dark" | "system" = "light";

/**
 * Returns the design tokens for the active palette.
 *
 * The returned object contains all color tokens for the active palette plus
 * scheme-independent values like `radius`.
 *
 * IMPORTANT: on Expo web, `userInterfaceStyle` in app.json is NOT applied, so
 * `useColorScheme()` follows the browser's `prefers-color-scheme`. Honoring
 * that unconditionally meant a light-only app rendered its (cold navy) dark
 * palette for anyone browsing in dark mode. We therefore resolve the scheme
 * from the app's own APPEARANCE setting, only deferring to the OS when it is
 * explicitly set to "system".
 */
export function useColors() {
  const osScheme = useColorScheme();
  const scheme = APPEARANCE === "system" ? osScheme : APPEARANCE;
  const palette = scheme === "dark" && "dark" in colors ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
