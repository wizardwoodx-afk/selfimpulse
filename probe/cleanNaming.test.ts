/**
 * probe · cleanNaming — the SHIPPED TREE carries clean SelfImpulse naming.
 *
 * Repo-wide gate (the review finding made permanent): current surfaces —
 * product code, legal, installer metadata, config, docs, probes, tools — carry
 * no retired predecessor spellings and no outside-product names.
 *
 * Named exceptions (each does real work and is documented):
 *   - docs/history/**            the historical ledger by design.
 *   - protocol/src/core/vh-crypto.js  HKDF info labels (pre-rename wire labels)
 *                                are baked into issued wrapped keys — renaming
 *                                would break issued data (docs/history/LEGACY-COMPAT.md).
 *   - probe/fixtures/**          signed wire fixtures — byte-stable by contract.
 *   - legacy wire/shim tokens    (proof-receipt formats, db filename, keychain
 *                                service names, control-mcp aliases, …) live by
 *                                the allowlist + docs contract of probe/legacyCompat.
 *   - verify/suites|specs        generated bundles (rebuilt from these sources).
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const root = process.env.IMPULSE_ROOT ? path.resolve(process.env.IMPULSE_ROOT as string) : process.cwd();

const SKIP_DIRS = new Set(["node_modules", ".git", "history", "suites", "specs", "fixtures", "dist", "target", "profiles", "screens", "vendor", "fonts"]);
const SKIP_FILES = new Set(["package-lock.json", "Cargo.lock", "BUILD-INFO.txt", "tauri.conf.json"]);
const SKIP_PATHS = new Set([
  path.join("protocol", "src", "core", "vh-crypto.js"),
  // The legacy ledger's whole job is to NAME the identifiers that still exist.
  // Scanning it for those names is the scan failing at its own purpose, so it is
  // exempt here and policed instead by probe/legacyCompat.test.ts, which checks
  // that every name in it is allowlisted and still in use.
  path.join("docs", "LEGACY-COMPAT.md"),
]);

/* retired predecessor spellings + outside-product names, assembled so the
 * literal spellings do not appear even here. */
const BANNED = new RegExp(
  [
    "Vo", "uch Harbor|Vel", "vet Hand|velvet", "hand|vo", "uchharbor|Vo", "uchHarbor|vo", "uch-harbor",
    "|mj-brow", "ser",
    "|open", "muse|open", "bot|open", "claw|ma", "stra|na", "ngo|copilot", "kit|lang", "fuse|llama",
    "index|lance", "db|cre", "wai|lang", "graph|zap", "ier",
    "|\\bVH_[A-Z]",
  ].join(""),
  "gi",
);

function* walkRel(dir: string): Generator<string> {
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

let scanned = 0;
const offenders: string[] = [];
for (const rel of walkRel(root)) {
  const base = path.basename(rel);
  if (SKIP_FILES.has(base)) continue;
  if (SKIP_PATHS.has(rel)) continue;
  if (/\.one-|\.log$|\.png$|\.jpe?g$|\.xlsx$|\.zip$|\.so$|\.dylib$|\.dll$|\.pdf$|\.wasm$|\.lock$/.test(rel)) continue;
  let text: string;
  try {
    const st = fs.statSync(path.join(root, rel));
    if (st.size > 2_000_000) continue;
    text = fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    continue;
  }
  if (text.includes("\u0000")) continue; // binary
  scanned += 1;
  const m = text.match(BANNED);
  if (m) offenders.push(`${rel}: ${[...new Set(m.map((h) => h.toLowerCase()))].join(", ")}`);
}
assert.ok(scanned > 80, `scan covered the tree (scanned ${scanned} files)`);
assert.deepEqual(offenders, [], `retired/outside names in current surfaces:\n${offenders.join("\n")}`);
console.log(`cleanNaming: PASS (${scanned} files scanned, zero retired or outside names)`);
