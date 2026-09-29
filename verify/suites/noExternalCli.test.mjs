import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// probe/noExternalCli.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
var ROOT = process.env.SI_ROOT ?? process.cwd();
var read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
var exists = (rel) => fs.existsSync(path.join(ROOT, rel));
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
function section(name) {
  console.log(`
== ${name}`);
}
var EXTERNAL_BINS = [
  "claude",
  "codex",
  "opencode",
  "openclaude",
  "copilot",
  "cursor-agent",
  "grok",
  "cline",
  "kilo",
  "qwen",
  "gemini",
  "aider",
  "goose",
  "amazonq",
  "kiro-cli",
  "amp",
  "crush",
  "openhands",
  "droid",
  "kimi",
  "auggie",
  "warp"
];
section("1. the native handlers that could spawn an external agent are gone");
{
  const rust = read("src-tauri/src/commands.rs");
  for (const sym of [
    "cli_invoke",
    "cli_providers_detect",
    "ALLOWED_CLI_BINS",
    "harness_argv",
    "custom_harness_load",
    "custom_harness_store",
    "custom_harness_validate",
    "CustomHarness",
    "acp_open",
    "acp_send",
    "acp_recv",
    "acp_close"
  ]) {
    ok(`commands.rs no longer defines ${sym}`, !new RegExp(`\\b${sym}\\b`).test(rust));
  }
  const lib = read("src-tauri/src/lib.rs");
  for (const c of [
    "cli_invoke",
    "cli_providers_detect",
    "custom_harness_list",
    "custom_harness_save",
    "custom_harness_delete",
    "acp_open",
    "acp_send",
    "acp_recv"
  ]) {
    ok(`lib.rs no longer registers ${c}`, !lib.includes(`commands::${c}`));
  }
  ok("acp.rs \u2014 the external agent wire \u2014 is deleted", !exists("src-tauri/src/acp.rs"));
}
section("2. no external agent binary is in any allowlist");
{
  const rust = read("src-tauri/src/commands.rs");
  const allow = rust.match(/SHELL_ALLOWED_PROGRAMS: &\[&str\] = &\[([\s\S]*?)\];/);
  ok("SHELL_ALLOWED_PROGRAMS still exists", !!allow);
  const list = allow ? allow[1] : "";
  for (const bin of EXTERNAL_BINS) {
    ok(`shell_exec does not allow ${bin}`, !new RegExp(`"${bin}"`).test(list), list.slice(0, 80));
  }
  ok("the dev-tool seat is kept (node/npm/cargo/git)", /"node"/.test(list) && /"git"/.test(list));
  ok(
    "shell_exec's refusal no longer mentions custom harnesses",
    !/custom harness/i.test(rust.slice(rust.indexOf("SHELL_ALLOWED_PROGRAMS"), rust.indexOf("SHELL_ALLOWED_PROGRAMS") + 1400))
  );
}
section("3. the TypeScript subsystem is gone from the tree");
{
  for (const f of ["src/mission/harnessPolicy.ts", "src/mission/acp.ts", "src/mission/acpTauri.ts"]) {
    ok(`${f} is deleted`, !exists(f));
  }
  const ipc = read("src/ipc/client.ts");
  for (const m of ["cliInvoke", "cliProvidersDetect", "customHarnessList", "customHarnessSave", "customHarnessDelete"]) {
    ok(`ipc.client no longer exposes ${m}`, !new RegExp(`\\b${m}:`).test(ipc));
  }
}
section("4. the registry offers only in-process engines");
{
  const dom = read("src/domain/harness.ts");
  const union = dom.match(/export type HarnessId =([^;]+);/)?.[1] ?? "";
  ok(
    "HarnessId admits only the native runtimes",
    /"hermes"/.test(union) && /"llm"/.test(union),
    union.trim()
  );
  for (const gone of ["claude", "codex", "gemini", "cursor", "cline", "grok", "opencode", "acp"]) {
    ok(`HarnessId no longer admits ${gone}`, !new RegExp(`"${gone}"`).test(union));
  }
  const catalog = dom.slice(dom.indexOf("export const HARNESSES"));
  for (const gone of EXTERNAL_BINS) {
    ok(`the HARNESSES catalog has no ${gone} spec`, !new RegExp(`id: "${gone}"`).test(catalog));
  }
  ok(
    "every retired id is still refused by name, so a saved graph fails in words",
    /isRetiredHarness/.test(dom) && /RETIRED_HARNESSES/.test(dom)
  );
  ok(
    "custom harnesses are refused rather than validated",
    /Custom harnesses are removed/.test(dom)
  );
  ok("isCustomHarness can never be true", /return false;/.test(dom.slice(dom.indexOf("export function isCustomHarness"))));
}
section("5. nothing spawns a third-party agent process");
{
  const adapters = read("src/mission/harnessAdapters.ts");
  ok("the CliHarness adapter class is gone", !/class CliHarness/.test(adapters));
  ok("the CustomCliHarness adapter class is gone", !/class CustomCliHarness/.test(adapters));
  ok("the ACP adapter is not registered", !/AcpHarness/.test(adapters));
  ok("the vendor PROFILES table is gone", !/PROFILES/.test(adapters));
  ok(
    "a seat naming a removed engine resolves to null, not to a stub",
    /return registry\.get\(id\) \?\? null/.test(adapters)
  );
  const deps = read("src/mission/hostDeps.ts");
  ok("hostRunnerDeps resolves no agent binary", /resolveBin: async \(_bin\) => null/.test(deps));
  ok(
    "hostRunnerDeps refuses to invoke an agent CLI in words",
    /external agent CLIs are removed/.test(deps)
  );
  const brain = read("src/selfimpulse/engine/brainSeam.ts");
  ok("the brain seam refuses to spawn a CLI process", /external agent CLIs are removed/.test(brain));
  ok("the brain seam no longer calls ipc.cliInvoke", !/ipc\.cliInvoke/.test(brain));
}
section("6. the product tells the truth about what it is");
{
  const readme = read("README.md");
  ok(
    "the README does not offer external coding agents",
    !/Claude Code, Codex, Gemini|governed tier, not a hidden one/.test(readme)
  );
  const story = exists("docs/STORY.md") ? read("docs/STORY.md") : "";
  ok("STORY.md no longer claims a roster of agent CLIs", !/25 agent CLIs/.test(story));
  const info = read("verify/BUILD-INFO.txt");
  ok(
    "the build record states the removal rather than promising the tier",
    /EXTERNAL CODING-AGENT CLIs .* REMOVED|REMOVED FROM THE TREE|are removed/i.test(info)
  );
  ok(
    "the build record does not advertise the tier as a feature",
    !/governed external-harness tier/.test(info)
  );
}
console.log(`
${passed} passed, ${failed} failed.`);
if (failed) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
