/**
 * WCAG 2.2 contrast checker for the Luminara palette.
 *   node scripts/contrast-check.mjs
 * Exits non-zero if any pairing fails, so it can gate CI.
 */
const hex = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = (h) => { const [r, g, b] = hex(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const l1 = L(a), l2 = L(b), hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); };

// [label, foreground, background, minRatio]
const pairs = [
  // light
  ["L text / canvas", "#171A2B", "#F5F7FD", 4.5],
  ["L muted / canvas", "#565D85", "#F5F7FD", 4.5],
  ["L muted / card", "#565D85", "#FFFFFF", 4.5],
  ["L white / primary", "#FFFFFF", "#4A5DAE", 4.5],
  ["L primary / card", "#4A5DAE", "#FFFFFF", 4.5],
  ["L secondaryFg / secondary", "#3A4A9E", "#E7EAF8", 4.5],
  ["L ink / amber", "#171A2B", "#F6A94C", 4.5],
  ["L riskLow / card", "#1F7A5E", "#FFFFFF", 4.5],
  ["L riskModerate / card", "#A0610F", "#FFFFFF", 4.5],
  ["L riskHigh / card", "#C0413C", "#FFFFFF", 4.5],
  ["L white / destructive", "#FFFFFF", "#C13B37", 4.5],
  // dark
  ["D text / bg", "#EDEFF9", "#14172A", 4.5],
  ["D muted / bg", "#A7ACC7", "#14172A", 4.5],
  ["D muted / card", "#A7ACC7", "#1E2238", 4.5],
  ["D darkLabel / primary", "#14172A", "#8EA0E8", 4.5],
  ["D primary / card", "#8EA0E8", "#1E2238", 4.5],
  ["D amber / card", "#F6A94C", "#1E2238", 3.0],
  ["D riskHigh / card", "#F0736D", "#1E2238", 4.5],
];

let fails = 0;
for (const [label, fg, bg, need] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= need;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label.padEnd(28)} ${r.toFixed(2)}:1  (need ${need})`);
}
console.log(fails ? `\n${fails} failure(s)` : "\nAll pairings pass WCAG 2.2 AA.");
process.exit(fails ? 1 : 0);
