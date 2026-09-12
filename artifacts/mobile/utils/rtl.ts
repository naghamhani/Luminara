import { I18nManager } from "react-native";

/**
 * RTL helpers for the cases React Native does not flip on its own.
 *
 * What RN *does* flip automatically when `I18nManager.isRTL` is true:
 *   - `flexDirection: "row"` (children run right-to-left)
 *   - the logical style props: marginStart/End, paddingStart/End, start/end,
 *     borderStartWidth, etc.
 *
 * What it does NOT flip, and therefore what this file exists for:
 *   - the physical props: marginLeft, paddingRight, left, right — prefer the
 *     logical spelling in new code and these helpers never come up
 *   - `textAlign`, which has no "start"/"end" value in React Native (only
 *     auto | left | right | center | justify), so end-alignment has to be
 *     computed
 *   - directional icons, which must mirror or they point the wrong way
 *
 * `isRTL` is read at module scope on purpose: the flag cannot change within a
 * process (see i18n/index.tsx — a direction change requires a restart), so
 * caching it keeps these usable inside StyleSheet.create, which runs once.
 */
export const isRTL = I18nManager.isRTL;

/**
 * Aligns text to the READING END of the line — right in English, left in
 * Arabic. Use for numeric values in a column, where the digits should hug the
 * far edge regardless of script.
 */
export const textAlignEnd = (isRTL ? "left" : "right") as "left" | "right";

/**
 * Aligns text to the READING START — left in English, right in Arabic.
 * Equivalent to `textAlign: "auto"` in most cases; prefer this when the intent
 * should be explicit to the next reader.
 */
export const textAlignStart = (isRTL ? "right" : "left") as "left" | "right";

/**
 * Mirrors a directional icon name. A chevron that means "forward" points right
 * in English and left in Arabic; an unflipped chevron in RTL reads as "back",
 * which is actively misleading rather than merely untidy.
 *
 * Vertical arrows (arrow-up, arrow-down) are deliberately absent from the
 * table below — they carry no reading direction and must never be mirrored.
 *
 *   <Feather name={directionalIcon("chevron-left")} />
 */
export function directionalIcon<T extends string>(name: T): T {
  if (!isRTL) return name;
  const flipped: Record<string, string> = {
    // Feather — what this app uses throughout.
    "chevron-left": "chevron-right",
    "chevron-right": "chevron-left",
    "chevrons-left": "chevrons-right",
    "chevrons-right": "chevrons-left",
    "arrow-left": "arrow-right",
    "arrow-right": "arrow-left",
    "arrow-left-circle": "arrow-right-circle",
    "arrow-right-circle": "arrow-left-circle",
    "corner-up-left": "corner-up-right",
    "corner-up-right": "corner-up-left",
    // Ionicons naming, in case it is introduced later.
    "chevron-forward": "chevron-back",
    "chevron-back": "chevron-forward",
    "chevron-forward-outline": "chevron-back-outline",
    "chevron-back-outline": "chevron-forward-outline",
    "arrow-forward": "arrow-back",
    "arrow-back": "arrow-forward",
    "arrow-forward-outline": "arrow-back-outline",
    "arrow-back-outline": "arrow-forward-outline",
    "arrow-redo": "arrow-undo",
    "arrow-undo": "arrow-redo",
    "caret-forward": "caret-back",
    "caret-back": "caret-forward",
  };
  return (flipped[name] ?? name) as T;
}

/**
 * Horizontal scale transform for mirroring an arbitrary directional graphic —
 * an inline SVG arrow, a progress chevron — that has no mirrored counterpart
 * to swap to.
 *
 *   <View style={mirrorIfRTL} />
 */
export const mirrorIfRTL = isRTL ? { transform: [{ scaleX: -1 }] } : {};
