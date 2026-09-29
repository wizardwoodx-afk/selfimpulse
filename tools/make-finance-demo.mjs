#!/usr/bin/env node
/**
 * 11Handle — build the synthetic industrial finance demo artifacts into demo/.
 * Same esbuild-bundle-and-run discipline as the probe runner (no shell, no quoting).
 */
import { buildSync } from "esbuild";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "tools", ".demo-build.mjs");
buildSync({
  entryPoints: [path.join(root, "src", "vh19", "finance", "demoEntry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: out,
  logLevel: "silent",
});
try {
  execFileSync(process.execPath, [out], { cwd: root, stdio: "inherit" });
  const summary = JSON.parse(
    fs.readFileSync(path.join(root, "demo", "Synthetic-Industrial-FY26-SUMMARY.json"), "utf8"),
  );
  console.log(`[11Handle] synthetic industrial demo written to demo/ — rows=${summary.rows} mode=${summary.mode}`);
  console.log(`[11Handle] categories=${Object.keys(summary.summary.byCategory).join(", ")}`);
} finally {
  fs.rmSync(out, { force: true });
}
