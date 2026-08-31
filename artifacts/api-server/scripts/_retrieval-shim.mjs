/**
 * Loads src/lib/retrieval.ts for the verification script by bundling it on the
 * fly with the esbuild that is already a devDependency. Avoids adding a
 * TypeScript runtime (tsx/ts-node) just to run one check.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(mkdtempSync(path.join(tmpdir(), "lum-")), "retrieval.mjs");

await build({
  entryPoints: [path.resolve(here, "..", "src", "lib", "retrieval.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: out,
  logLevel: "silent",
  // Swap the pino logger for a silent stub. Bundling real pino here would drag
  // in its worker-thread transports for no benefit — the check cares about
  // search results, not log output.
  plugins: [{
    name: "stub-logger",
    setup(b) {
      b.onResolve({ filter: /(^|\/)logger$/ }, () => ({ path: "logger-stub", namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "const noop = () => {};\nexport const logger = { info: noop, warn: noop, error: noop, debug: noop };",
        loader: "js",
      }));
    },
  }],
  banner: {
    js: `import { createRequire as __cr } from 'node:module';
globalThis.require = __cr(import.meta.url);
globalThis.__dirname = ${JSON.stringify(path.resolve(here, "..", "dist"))};`,
  },
});

export const { search, corpusStats } = await import(pathToFileURL(out).href);
