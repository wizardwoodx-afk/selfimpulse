#!/usr/bin/env node
/**
 * bump-version.mjs — move the tree from one release identity to the next.
 *
 *   node tools/bump-version.mjs --to 19.6.1 [--from 19.6.0] [--name Federation] [--check]
 *
 * Every edit is anchored: if a line this script expects is not present it
 * REFUSES and says which one, rather than guessing. It touches version surfaces
 * and the release-note surfaces the host's own drift gate pins — never a core
 * module's behaviour.
 *
 * Why this exists as a tool rather than a one-off: the version identity of this
 * product is spread across nine files and four documents, and a release that
 * moves eight of them is worse than one that moves none. `--check` prints what
 * it would do without writing.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const argv = process.argv.slice(2);
const dry = argv.includes("--check");
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};

const OLD = arg("--from", "19.5.6");
const NEW = arg("--to", null);
if (!NEW) {
  console.error("bump-version.mjs: --to <version> is required (e.g. --to 19.6.1)");
  process.exit(2);
}
const short = (v) => v.split(".").slice(0, 2).join(".");
const OLD_SHORT = short(OLD);
const NEW_SHORT = short(NEW);
const NAME = arg("--name", "Federation");

const problems = [];
let edits = 0;

const require_ = (text, needle, rel) => {
  if (!text.includes(needle)) {
    problems.push(`${rel}: anchor not found -> ${JSON.stringify(needle.slice(0, 80))}`);
    return false;
  }
  return true;
};

function editFile(rel, apply) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    problems.push(`${rel}: file missing`);
    return;
  }
  const before = fs.readFileSync(p, "utf8");
  const after = apply(before, rel);
  if (after === null) return;
  if (after === before) {
    problems.push(`${rel}: no change applied (anchor present but text identical?)`);
    return;
  }
  edits += 1;
  if (!dry) fs.writeFileSync(p, after);
  console.log(`  ${dry ? "would update" : "updated"} ${rel}`);
}

console.log(`bump ${OLD} -> ${NEW}${OLD_SHORT === NEW_SHORT ? ` (short stays ${NEW_SHORT})` : ` (${OLD_SHORT} -> ${NEW_SHORT})`}, codename ${NAME}${dry ? " — check only" : ""}`);

/* ── 1. the single source of truth ────────────────────────────────────────── */
editFile("src/version.ts", (t, rel) => {
  if (!require_(t, `export const ENGINE_VERSION = "${OLD}";`, rel)) return null;
  let out = t
    .replace(`export const ENGINE_VERSION = "${OLD}";`, `export const ENGINE_VERSION = "${NEW}";`)
    .replace(`export const ENGINE_SHORT = "${OLD_SHORT}";`, `export const ENGINE_SHORT = "${NEW_SHORT}";`);
  const codenameLine = new RegExp(`export const ENGINE_CODENAME = "([^"]+)";`);
  const found = t.match(codenameLine)?.[1];
  if (found && found !== NAME) out = out.replace(`export const ENGINE_CODENAME = "${found}";`, `export const ENGINE_CODENAME = "${NAME}";`);
  return out;
});

/* ── 2. every manifest ────────────────────────────────────────────────────── */
editFile("package.json", (t, rel) => {
  if (!require_(t, `"version": "${OLD}"`, rel)) return null;
  return t.replace(`"version": "${OLD}"`, `"version": "${NEW}"`);
});
editFile("package-lock.json", (t, rel) => {
  if (!require_(t, `"version": "${OLD}"`, rel)) return null;
  return t.replaceAll(`"version": "${OLD}"`, `"version": "${NEW}"`);
});
editFile("src-tauri/Cargo.toml", (t, rel) => {
  if (!require_(t, `version = "${OLD}"`, rel)) return null;
  return t.replace(`version = "${OLD}"`, `version = "${NEW}"`);
});
editFile("src-tauri/tauri.conf.json", (t, rel) => {
  if (!require_(t, `"version": "${OLD}"`, rel)) return null;
  return t.replace(`"version": "${OLD}"`, `"version": "${NEW}"`);
});

/* ── 3. the offline pack's provenance identity ────────────────────────────── */
editFile("verify/BUILD-INFO.txt", (t, rel) => {
  if (!require_(t, `SelfImpulse ${OLD}`, rel)) return null;
  const esc = (v) => v.replace(/\./g, "\\.");
  // 19.7.14: the codename lives in version.ts, but this record names the release too —
  // renaming one without the other left the pack opening as a retired codename.
  const out = t
    .replaceAll(`SelfImpulse ${OLD}`, `SelfImpulse ${NEW}`)
    .replace(`built: ${OLD}`, `built: ${NEW}`)
    .replace(new RegExp(`^(SelfImpulse ${esc(NEW)} )[^\\s(]+`), `$1${NAME}`)
    .replace(new RegExp(`^(built:\\s*${esc(NEW)} )[^\\s\\n]+`, "m"), `$1${NAME}`);
  if (!out.includes(`${NEW} ${NAME}`)) {
    problems.push(`${rel}: codename ${NAME} did not land in the record`);
    return null;
  }
  return out;
});

/* ── 4. the MCP server's own version constant and header ──────────────────── */
editFile("src/engine/reachMcp.ts", (t, rel) => {
  if (!require_(t, `export const REACH_MCP_VERSION = "${OLD}";`, rel)) return null;
  return t
    .replace(`export const REACH_MCP_VERSION = "${OLD}";`, `export const REACH_MCP_VERSION = "${NEW}";`)
    .replace(`AGENT REACH MCP — ${OLD}`, `AGENT REACH MCP — ${NEW}`);
});

/* ── 5. the operational documents whose titles the drift gate pins ────────── */
for (const rel of ["README.md", "BUILD-NATIVE.md", "DESKTOP-NATIVE.md", "INSTALL-ON-LAPTOP.md", "DEPLOY-VERCEL.md", "docs/PLATFORM-LIMITS.md"]) {
  editFile(rel, (t) => {
    const out = t.replaceAll(`SelfImpulse ${OLD}`, `SelfImpulse ${NEW}`).replaceAll(`SelfImpulse_${OLD}`, `SelfImpulse_${NEW}`);
    return out === t ? null : out;
  });
}

console.log(`\n${edits} file(s) ${dry ? "to change" : "changed"}`);
if (problems.length > 0) {
  console.error("\nrefusals:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
