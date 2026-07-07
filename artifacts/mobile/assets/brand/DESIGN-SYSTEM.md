# Luminara Design System

The system exists to make the app feel **calm, trustworthy, and legible for
everyone** — including a sleep-deprived new parent reading at 3am. Every choice
below is either grounded in colour/perception research or measured against
WCAG 2.2.

## 1. Why these colours (the evidence)

| Choice | Rationale |
|---|---|
| **Indigo as the base** | Blue-family hues are the most consistently rated for *trust, calm and competence* across colour-emotion research (e.g. work by Elliot & Maier on colour-in-context; Palmer & Schloss ecological valence). For a privacy-first health app that framing is the whole point. |
| **Not pink/red-led** | Red raises physiological arousal and is cognitively tied to warning/error; pink is the femtech default and reads as gendered/juvenile. Leading science-first apps (Clue) deliberately abandoned pink. We reserve rose for the menstrual phase only. |
| **One rationed warm accent (amber)** | The **60-30-10** balance: ~60% calm neutral/indigo, ~30% supporting surfaces, ~10% amber. Because amber is the *only* warm note, attention snaps to it (von Restorff isolation effect) — so it can safely mean "act here / warmth". |
| **Calm risk signalling** | In a mental-health context, alarm-red for a "moderate" score can spike anxiety. Moderate = accessible amber, High = *softened* red. Enough to flag, not to alarm. |
| **A real dark theme** | Postpartum users check phones during night feeds. Lower screen luminance is gentler on dark-adapted vision and less disruptive to sleep. Dark ships ready (see §5). |

## 2. Palette — light (default)

| Token | Hex | Role |
|---|---|---|
| `background` | `#F5F7FD` | App canvas |
| `card` | `#FFFFFF` | Raised surface |
| `text` / `foreground` | `#171A2B` | Primary text (16–17:1) |
| `mutedForeground` | `#565D85` | Secondary text |
| `primary` / `tint` | `#4A5DAE` | Indigo — brand, buttons, links |
| `secondary` | `#E7EAF8` | Indigo chips |
| `warm` | `#F6A94C` | **Signature amber** — highlights, the flame |
| `accent` / `teal` | `#2FA37E` | Positive / success |
| `riskLow` | `#1F7A5E` | Good |
| `riskModerate` | `#A0610F` | Watch |
| `riskHigh` / `destructive` | `#C0413C` / `#C13B37` | Concern / delete |
| `purple` `lavender` `blush` | `#8C7BD0` `#DDE3F8` `#F1ECFB` | Cycle phases / decoration |

## 3. Measured contrast (WCAG 2.2 AA — all PASS)

| Pair | Ratio |
|---|---|
| text `#171A2B` on canvas | **16.1:1** |
| mutedForeground on canvas | **5.9:1** |
| white on primary (button) | **6.1:1** |
| primary as text on card | **6.1:1** |
| ink on amber (button) | **8.8:1** |
| riskLow / Moderate / High as text on card | **5.3 / 5.0 / 5.2 :1** |
| white on destructive | **5.3:1** |

Dark theme pairs all clear AA too (text 15.5:1, muted 7.9:1, dark label on primary 7.0:1, etc.). Re-run any time: `node scripts/contrast-check.mjs` (see repo scratch).

## 4. Type, space & elevation

- **Type scale (1.25 "major third"):** 12 · 14 · 16 (body) · 20 · 25 · 31 · 39. Display in a warm serif (Fraunces) for headings, Inter/Manrope for UI/body — humanist, high legibility.
- **Spacing (4pt grid):** 4 · 8 · 12 · 16 · 24 · 32 · 48. Screen gutters 20–24.
- **Radius:** `radius: 16` everywhere (pills use 999). One rounded family — flame, card, chip — no sharp corners (§ brand: "no hard edges on a tender day").
- **Elevation:** soft, low-spread, cool-tinted shadows only — e.g. `rgba(28,34,54,0.06)` at small blur. No harsh black drop-shadows.

## 5. Enabling dark mode

The `dark` palette is complete and AA-verified but **dormant**: `app.json` sets
`userInterfaceStyle: "light"`, so `useColorScheme()` always returns light.
To turn it on after a device QA pass:

1. `app.json` → `"userInterfaceStyle": "automatic"`.
2. Smoke-test each screen in dark for any hardcoded `#fff` / black that bypasses
   the tokens; route them through `useColors()`.

`hooks/useColors` already picks `dark` automatically once the OS reports it.
