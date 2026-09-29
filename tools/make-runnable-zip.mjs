#!/usr/bin/env node
/**
 * make-runnable-zip.mjs — the same full tree as pack-release.mjs, PLUS dist/.
 *
 * pack-release.mjs excludes dist/ by design: the canonical artifact is the
 * source tree a reviewer verifies from scratch (sh VERIFY.sh, no install). This
 * one exists for the other reader — someone who wants to open the product now,
 * without a node toolchain. Same sources, same gates; the only addition is the
 * already-built production bundle.
 *
 *   node tools/make-runnable-zip.mjs [--out <dir>]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const i = process.argv.indexOf("--out");
const outDir = i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "/home/user";
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const outFile = path.join(outDir, `elevenhandle-${pkg.version}-runnable.zip`);

const EXCLUDE = new Set(["node_modules", ".git", "target", "__pycache__", ".vite", ".cache"]);
const SCRATCH = new Set(["montage.cjs", "fleet-check.mjs", "shot.mjs", "dist.mjs", "run1.mjs", "run2.mjs"]);

function walk(dir, base = "", out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (EXCLUDE.has(e.name)) continue;
    const rel = base ? `${base}/${e.name}` : e.name;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, rel, out);
    else if (e.isFile() && !SCRATCH.has(e.name)) out.push(rel);
  }
  return out;
}

const files = walk(root);
if (!files.some((f) => f.startsWith("dist/"))) {
  console.error("REFUSING: dist/ is not present — run `npm run build` first; this artifact exists to be runnable.");
  process.exit(1);
}
if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
const list = `/tmp/runnable.list.txt`;
fs.writeFileSync(list, files.join("\n"));
execFileSync("zip", ["-q", "-X", "-9", outFile, "-@"], { input: fs.readFileSync(list), cwd: root });
const mb = (fs.statSync(outFile).size / 1024 / 1024).toFixed(1);
console.log(`${outFile}  —  ${files.length} files, ${mb} MB (dist/ included: the app runs from the unzip)`);
