#!/usr/bin/env node
/**
 * pack-release.mjs — build the two artifacts a release needs, and say what each
 * one is for.
 *
 *   node tools/pack-release.mjs [--out <dir>]
 *
 * WHY TWO. The first 19.6 archive was an overlay: modules, probes and rebuilt
 * bundles, with no `tsconfig.json` and no `verify/run.mjs`. A reviewer who
 * unzipped it could not run the commands its own release note named. The
 * overlay is still the right thing for a maintainer who has the host checkout
 * and wants the delta; it is the WRONG thing to hand someone who wants to
 * verify the claim. So both ship, named for what they are:
 *
 *   · VH-<v>-<Name>-full.zip      the complete tree. `tsc`, `npm test` and
 *                                 `sh VERIFY.sh` all run from a clean unzip.
 *   · VH-<v>-<Name>-overlay.zip   only what changed, to drop over 19.5.6.
 *
 * Both exclude node_modules, .git and the scratch files a working tree gathers.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outDir = (() => {
  const i = process.argv.indexOf("--out");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "/home/user";
})();
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const codename = (fs.readFileSync(path.join(root, "src/version.ts"), "utf8").match(/ENGINE_CODENAME = "([^"]+)"/) ?? [, "Release"])[1];
const stem = `VH-${version}-${codename}`;

const ALWAYS_EXCLUDE = [
  "node_modules", ".git", "dist", "target", "__pycache__", ".vite", ".cache",
  "sigil-sheet.html", "sheet.html", "scratch-agentic-result.json",
];
const SCRATCH_FILES = new Set([
  "montage.cjs", "fleet-check.mjs", "shot.mjs", "dist.mjs", "run1.mjs", "run2.mjs",
]);

function walk(dir, base = "", out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ALWAYS_EXCLUDE.includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(abs, rel, out);
    else if (entry.isFile()) out.push(rel);
    else if (entry.isSymbolicLink()) out.push(rel);
  }
  return out;
}

/** Files the 19.6 line added or changed, relative to the 19.5.6 host. */
function overlayList() {
  const modified = execFileSync("git", ["diff", "--name-only"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })
    .split("\n").filter((l) => l.startsWith("?? ")).map((l) => l.slice(3));
  const files = new Set();
  for (const rel of [...modified, ...untracked]) {
    if (SCRATCH_FILES.has(rel)) continue;
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) walk(abs, rel).forEach((f) => files.add(f));
    else files.add(rel);
  }
  return [...files].sort();
}

function makeZip(name, rels) {
  const listPath = `/tmp/${stem}-${name}.list.txt`;
  fs.writeFileSync(listPath, rels.join("\n"));
  const outFile = path.join(outDir, `${stem}-${name}.zip`);
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
  execFileSync("zip", ["-q", "-X", "-9", outFile, "-@"], { input: fs.readFileSync(listPath) });
  const size = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
  console.log(`${name.padEnd(8)} ${outFile}  —  ${rels.length} files, ${size} MB`);
  return outFile;
}

/* ── the full tree ────────────────────────────────────────────────────────── */
const full = walk(root).filter((rel) => !SCRATCH_FILES.has(rel.split("/").pop()));
makeZip("full", full);

/* ── the overlay over 19.5.6 ─────────────────────────────────────────────── */
let overlay = [];
try {
  overlay = overlayList();
} catch {
  console.log("overlay  skipped — git is not available to diff against the host");
}
if (overlay.length > 0) makeZip("overlay", overlay);

/* ── the self-check that would have caught the first archive's gap ───────── */
/* 19.7.10: the upgrade-doc entry used to be hardcoded to VH-19.6-UPGRADE.md,
   so the "is this artifact independently verifiable" check was validating a
   stale filename from three series ago. It now follows the release identity
   the same way versionDrift does. */
const ENGINE_SHORT = (fs.readFileSync(path.join(root, "src/version.ts"), "utf8").match(/ENGINE_SHORT = "([^"]+)"/) ?? [, "19.7"])[1];
const REQUIRED_IN_FULL = ["tsconfig.json", "package.json", "verify/run.mjs", "VERIFY.sh", "src/version.ts", "README.md", `VH-${ENGINE_SHORT}-UPGRADE.md`, "FEATURES.md"];
/**
 * accept the archived home too. The product rebrand moved the versioned record
 * (changelog, upgrade guides, design notes) under docs/history/ BY ROLE — which
 * is correct, and which left this check looking for the upgrade guide at the
 * root it no longer occupies. The result was the worst kind of gate: the zips
 * were written and then the tool exited 1, so a release job would fail on a
 * documentation move while the artifact it produced was perfectly fine.
 * The file is still REQUIRED; only where it is allowed to live has widened.
 */
const inFull = (rel) => full.includes(rel) || full.includes(`docs/history/${rel}`);
const missing = REQUIRED_IN_FULL.filter((rel) => !inFull(rel));
if (missing.length > 0) {
  console.error(`\nREFUSING: the full tree is missing ${missing.join(", ")} — it would not be independently verifiable.`);
  process.exit(1);
}
console.log(`\nfull tree self-check: ${REQUIRED_IN_FULL.length}/${REQUIRED_IN_FULL.length} required files present`);
console.log("verify the full artifact with: unzip it, then  sh VERIFY.sh  (zero install)  ·  npm ci && npm test  (with deps)");
