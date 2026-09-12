# Arabic & RTL

Zero new dependencies. `pnpm` is currently broken in this workspace and the
repo installs through the `catalog:` protocol, so adding `expo-localization` or
`i18n-js` would have meant a lockfile change; everything here runs on what is
already installed.

## Using it

```tsx
import { useTranslation } from "@/i18n";

const { t, locale, isRTL } = useTranslation();
<Text>{t("nav.home")}</Text>
<Text>{t("checkin.streak", { days: 6 })}</Text>   // "{days} days in a row"
```

Add the key to **both** `en.ts` and `ar.ts`. A key missing from `ar.ts` falls
back to English at runtime, which looks like a translation nobody got round to
rather than the bug it is — `pnpm i18n:check` fails the build on that.

## Why a restart is required to change language

React Native reads the RTL flag once, natively, while building the view
hierarchy. `I18nManager.forceRTL()` persists the flag but does **not** re-lay-out
the running app. `expo-updates` isn't installed, and even with it Expo Go and
dev clients rarely reload cleanly through a native direction change — so the app
asks the user to restart rather than pretending the switch took effect.
`needsRestart` from `useTranslation()` stays true until then.

Everything downstream depends on this: because the direction can't change
mid-process, `utils/rtl.ts` can cache `I18nManager.isRTL` at module scope and
stay usable inside `StyleSheet.create`, and fonts can be chosen once at boot.

## Fonts

Inter carries no Arabic glyphs. Rather than touch 431 `fontFamily: "Inter_*"`
call sites, `fonts.ts` registers **IBM Plex Sans Arabic under the Inter family
names** when the locale is Arabic — `useFonts` treats the key as the family name
and the value as any font file, so every existing call site keeps working and
new code can't forget to use a locale-aware helper.

IBM Plex Sans Arabic ships Regular/Medium/SemiBold/Bold — an exact 400/500/600/700
match for the four Inter weights. Tajawal has no 600, so all 145 SemiBolds would
have collapsed into another weight and the hierarchy would flatten in Arabic only.
Licence: SIL OFL 1.1, `assets/fonts/OFL.txt`.

The locale is resolved in `app/_layout.tsx` **before** anything renders, because
it decides which fonts load and sets the native direction flag. First launch
falls back to the device language (`device.ts`, no native module needed).

## Writing RTL-safe styles

React Native flips `flexDirection: "row"` and the logical props automatically.
It does **not** flip the physical ones.

| Don't | Do |
|---|---|
| `marginLeft` / `marginRight` | `marginStart` / `marginEnd` |
| `paddingLeft` / `paddingRight` | `paddingStart` / `paddingEnd` |
| `borderLeftWidth` | `borderStartWidth` |
| `left: 12` / `right: 12` | `start: 12` / `end: 12` |
| `textAlign: "right"` | `textAlignEnd` from `utils/rtl` |
| `name="chevron-left"` | `name={directionalIcon("chevron-left")}` |

`textAlign` has no `start`/`end` value in React Native, which is why those two
helpers exist. Vertical arrows (`arrow-up`) are deliberately not in the flip
table — they carry no reading direction.

Don't use `flexDirection: "row-reverse"` to "fix" RTL: `row` already flips, so
reversing double-flips it back.

## Auditing

```bash
pnpm i18n:audit              # coverage summary
pnpm i18n:audit --strings    # every hardcoded literal, file:line
pnpm i18n:audit --rtl        # direction hazards with the fix for each
pnpm i18n:check              # CI — fails when catalogs drift apart
```

## State

**Fully extracted.** 482 keys, en/ar at parity, zero duplicates. Every screen and
component that shows text calls `t()` — `app/_layout.tsx` is the only file
without it, and it renders no user-visible strings. Zero RTL hazards.

Two hardcoded personal names were found and fixed along the way: the partner
dashboard greeted every user's partner with "Nagham" and told them "Nagham
hasn't logged enough check-ins yet", regardless of who was using the app. Both
now interpolate `profile.name`.

Verified by `tsc --noEmit`, `jest` (43 tests) and `i18n:audit`. **Not yet
verified on a device** — Arabic glyph rendering, the RTL flip itself, and the
restart flow all need a simulator pass, and the Arabic copy needs a native
speaker's review before launch. Machine-drafted medical phrasing is a starting
point, not a shippable translation.
