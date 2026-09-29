import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/cleanNaming.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
var root = process.env.IMPULSE_ROOT ? path.resolve(process.env.IMPULSE_ROOT) : process.cwd();
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "history", "suites", "specs", "fixtures", "dist", "target", "profiles", "screens", "vendor", "fonts"]);
var SKIP_FILES = /* @__PURE__ */ new Set(["package-lock.json", "Cargo.lock", "BUILD-INFO.txt", "tauri.conf.json"]);
var SKIP_PATHS = /* @__PURE__ */ new Set([
  path.join("protocol", "src", "core", "vh-crypto.js"),
  // The legacy ledger's whole job is to NAME the identifiers that still exist.
  // Scanning it for those names is the scan failing at its own purpose, so it is
  // exempt here and policed instead by probe/legacyCompat.test.ts, which checks
  // that every name in it is allowlisted and still in use.
  path.join("docs", "LEGACY-COMPAT.md")
]);
var BANNED = new RegExp(
  [
    "Vo",
    "uch Harbor|Vel",
    "vet Hand|velvet",
    "hand|vo",
    "uchharbor|Vo",
    "uchHarbor|vo",
    "uch-harbor",
    "|mj-brow",
    "ser",
    "|open",
    "muse|open",
    "bot|open",
    "claw|ma",
    "stra|na",
    "ngo|copilot",
    "kit|lang",
    "fuse|llama",
    "index|lance",
    "db|cre",
    "wai|lang",
    "graph|zap",
    "ier",
    "|\\bVH_[A-Z]"
  ].join(""),
  "gi"
);
function* walkRel(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walkRel(abs);
    } else {
      yield path.relative(root, abs);
    }
  }
}
var scanned = 0;
var offenders = [];
for (const rel of walkRel(root)) {
  const base = path.basename(rel);
  if (SKIP_FILES.has(base)) continue;
  if (SKIP_PATHS.has(rel)) continue;
  if (/\.one-|\.log$|\.png$|\.jpe?g$|\.xlsx$|\.zip$|\.so$|\.dylib$|\.dll$|\.pdf$|\.wasm$|\.lock$/.test(rel)) continue;
  let text;
  try {
    const st = fs.statSync(path.join(root, rel));
    if (st.size > 2e6) continue;
    text = fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    continue;
  }
  if (text.includes("\0")) continue;
  scanned += 1;
  const m = text.match(BANNED);
  if (m) offenders.push(`${rel}: ${[...new Set(m.map((h) => h.toLowerCase()))].join(", ")}`);
}
assert.ok(scanned > 80, `scan covered the tree (scanned ${scanned} files)`);
assert.deepEqual(offenders, [], `retired/outside names in current surfaces:
${offenders.join("\n")}`);
console.log(`cleanNaming: PASS (${scanned} files scanned, zero retired or outside names)`);
