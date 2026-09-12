#!/usr/bin/env node
/**
 * i18n / RTL audit.
 *
 * Reports what is still untranslated and what will break in right-to-left, so
 * the remaining work is a list to grind through rather than a hunt.
 *
 *   node scripts/i18n-audit.mjs            # summary
 *   node scripts/i18n-audit.mjs --strings  # every literal, with file:line
 *   node scripts/i18n-audit.mjs --rtl      # only the RTL hazards
 *   node scripts/i18n-audit.mjs --ci       # exit 1 if catalogs are out of sync
 *
 * The catalog-parity check is the one worth wiring into CI: a key present in
 * en.ts but missing from ar.ts silently falls back to English at runtime, which
 * looks like a translation nobody got round to rather than the bug it is.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["app", "components"];

const argv = new Set(process.argv.slice(2));
const SHOW_STRINGS = argv.has("--strings");
const SHOW_RTL = argv.has("--rtl");
const CI = argv.has("--ci");
const SHOW_ALL = !SHOW_STRINGS && !SHOW_RTL;

/* ------------------------------------------------------------------ files */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
const rel = (f) => path.relative(ROOT, f);

/* -------------------------------------------------------- catalog parity */

function catalogKeys(file) {
  const src = readFileSync(file, "utf8");
  const keys = [];
  // Tracked separately from the returned Set: a duplicate key is legal
  // TypeScript-adjacent JSON-ish syntax to write but the later one silently
  // wins, so a Set alone reports a catalog as healthy while one of the two
  // values is dead. tsc catches it too, but only once the file is imported.
  const dupes = [];
  const stack = [];
  for (const raw of src.split("\n")) {
    const line = raw.trim();
    const open = line.match(/^([A-Za-z_]\w*):\s*\{/);
    if (open) {
      stack.push(open[1]);
      continue;
    }
    if (line.startsWith("}")) {
      stack.pop();
      continue;
    }
    const leaf = line.match(/^([A-Za-z_]\w*):\s*["'`]/);
    if (leaf) {
      const full = [...stack, leaf[1]].join(".");
      if (keys.includes(full)) dupes.push(full);
      keys.push(full);
    }
  }
  const set = new Set(keys);
  set.duplicates = dupes;
  return set;
}

const enKeys = catalogKeys(path.join(ROOT, "i18n/en.ts"));
const arKeys = catalogKeys(path.join(ROOT, "i18n/ar.ts"));
const missingInAr = [...enKeys].filter((k) => !arKeys.has(k)).sort();
const missingInEn = [...arKeys].filter((k) => !enKeys.has(k)).sort();

/* --------------------------------------------------- user-visible strings */

// Props whose value a user reads on screen. `testID`, `name` (icon names),
// `key` and friends are deliberately absent.
const TEXT_PROPS =
  /\b(label|title|subtitle|placeholder|heading|message|description|accessibilityLabel|accessibilityHint|confirmLabel|cancelLabel|emptyText|helperText)\s*=\s*["']([^"']{2,})["']/g;

// Text between JSX tags: <Text>Something readable</Text>
const JSX_TEXT = />\s*([A-Z][^<>{}\n]{2,})\s*</g;

// Ignore strings that are obviously not prose.
const NOT_PROSE =
  /^(https?:|#[0-9a-f]{3,8}$|[0-9\s.,:%+-]+$|[a-z-]+$|[A-Z_]+$|\{|\}|&\w+;)/i;

function scanStrings(src) {
  const hits = [];
  const lines = src.split("\n");

  // JSX text on its own line, e.g.
  //     <Text style={...}>
  //       This screen doesn't exist.
  //     </Text>
  // The per-line `>text<` pattern below cannot see these, which is how two
  // whole screens read as fully translated while showing English.
  lines.forEach((line, i) => {
    const prev = lines[i - 1] ?? "";
    const next = lines[i + 1] ?? "";
    const bare = line.trim();
    if (!/^[A-Z][^<>{}]{2,}$/.test(bare)) return;
    if (!prev.trimEnd().endsWith(">")) return;
    if (!next.trimStart().startsWith("<")) return;
    hits.push({ line: i + 1, value: bare });
  });

  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments
    if (/\bt\(/.test(line)) return; // already translated on this line
    for (const re of [TEXT_PROPS, JSX_TEXT]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const value = (m[2] ?? m[1]).trim();
        if (!value || NOT_PROSE.test(value)) continue;
        if (!/[a-zA-Z]{3,}/.test(value)) continue;
        hits.push({ line: i + 1, value });
      }
    }
  });
  return hits;
}

/* ------------------------------------------------------------ RTL hazards */

const RTL_RULES = [
  [/\bmargin(Left|Right)\s*:/, "use marginStart / marginEnd"],
  [/\bpadding(Left|Right)\s*:/, "use paddingStart / paddingEnd"],
  [/\bborder(Left|Right)(Width|Color|Radius)?\s*:/, "use the Start / End form"],
  [/^\s*(left|right)\s*:\s*-?\d/, "use start / end for absolute offsets"],
  [/textAlign\s*:\s*["'](left|right)["']/, "use textAlignStart / textAlignEnd from utils/rtl"],
  [/name=["'](chevron|arrow)-(left|right)["']/, "wrap in directionalIcon() from utils/rtl"],
  [/flexDirection\s*:\s*["']row-reverse["']/, "row already flips in RTL — row-reverse double-flips"],
];

function scanRTL(src, file) {
  // SVG chart geometry uses paddingLeft/paddingRight as plain local variables,
  // not style props — flagging those would be noise.
  const isChart = /components\/(charts|cycle)\//.test(file);
  const hits = [];
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (isChart && /^\s*(const|let)\s+padding(Left|Right)\b/.test(line)) return;
    for (const [re, fix] of RTL_RULES) {
      if (re.test(line)) hits.push({ line: i + 1, code: line.trim().slice(0, 78), fix });
    }
  });
  return hits;
}

/* ---------------------------------------------------------------- report */

const report = files
  .map((f) => {
    const src = readFileSync(f, "utf8");
    return {
      file: rel(f),
      translated: /useTranslation\s*\(/.test(src),
      strings: scanStrings(src),
      rtl: scanRTL(src, f),
    };
  })
  .filter((r) => r.strings.length || r.rtl.length || r.file.endsWith(".tsx"));

const bar = (n, total, width = 26) => {
  const filled = total ? Math.round((n / total) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
};

if (SHOW_ALL || CI) {
  const screens = report.filter((r) => r.file.startsWith("app/") && r.file.endsWith(".tsx"));
  const done = screens.filter((r) => r.translated);
  const totalStrings = report.reduce((n, r) => n + r.strings.length, 0);
  const totalRTL = report.reduce((n, r) => n + r.rtl.length, 0);

  console.log("\n  LUMINARA i18n / RTL AUDIT\n");
  console.log(`  catalogs      en ${enKeys.size} keys · ar ${arKeys.size} keys`);
  const dupes = [...enKeys.duplicates.map((k) => `en ${k}`), ...arKeys.duplicates.map((k) => `ar ${k}`)];
  if (dupes.length) {
    console.log(`                ✗ ${dupes.length} DUPLICATE key(s) — the later value silently wins`);
    for (const d of dupes.slice(0, 12)) console.log(`                  ${d}`);
  }
  if (missingInAr.length || missingInEn.length) {
    console.log(`                ✗ OUT OF SYNC — ${missingInAr.length} missing in ar, ${missingInEn.length} missing in en`);
    for (const k of missingInAr.slice(0, 12)) console.log(`                  ar missing: ${k}`);
    for (const k of missingInEn.slice(0, 12)) console.log(`                  en missing: ${k}`);
  } else {
    console.log("                ✓ in sync");
  }
  console.log(`\n  screens       ${bar(done.length, screens.length)}  ${done.length}/${screens.length} use useTranslation()`);
  console.log(`  strings       ${totalStrings} hardcoded literals still on screen`);
  console.log(`  rtl hazards   ${totalRTL} physical-direction usages\n`);

  const worst = report
    .filter((r) => r.strings.length)
    .sort((a, b) => b.strings.length - a.strings.length)
    .slice(0, 15);
  if (worst.length) {
    console.log("  most untranslated files\n");
    for (const r of worst) {
      const flag = r.translated ? " " : "·";
      console.log(`   ${flag} ${String(r.strings.length).padStart(4)}  ${r.file}`);
    }
    console.log("\n   · = file does not call useTranslation() at all\n");
  }
  if (totalRTL) {
    console.log("  run with --rtl to list direction hazards, --strings for every literal\n");
  }
}

if (SHOW_STRINGS) {
  for (const r of report.filter((x) => x.strings.length)) {
    console.log(`\n${r.file}${r.translated ? "" : "   (no useTranslation)"}`);
    for (const s of r.strings) console.log(`  ${String(s.line).padStart(5)}  ${s.value}`);
  }
  console.log();
}

if (SHOW_RTL) {
  const withRTL = report.filter((x) => x.rtl.length);
  if (!withRTL.length) console.log("\n  no RTL hazards found\n");
  for (const r of withRTL) {
    console.log(`\n${r.file}`);
    for (const h of r.rtl) {
      console.log(`  ${String(h.line).padStart(5)}  ${h.code}`);
      console.log(`         → ${h.fix}`);
    }
  }
  console.log();
}

if (CI && (missingInAr.length || missingInEn.length || enKeys.duplicates.length || arKeys.duplicates.length)) {
  console.error("  catalogs out of sync — failing\n");
  process.exit(1);
}
