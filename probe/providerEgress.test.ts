/**
 * Provider egress probe — the llmChat boundary.
 *
 * The gap this pins: `checkEgressUrl` was applied at eleven engine call sites,
 * but NOT at `ipc.llmChat` — the one function every provider call funnels
 * through on the way to Rust `llm_chat`. The Hermes autonomous loop
 * (engine/hermesRuntime.ts) calls `ipc.llmChat` with a caller-supplied
 * `base_url` and never passed through vh19/providers.ts, so two things rode an
 * unguarded path:
 *
 *   1. SSRF — a hostile base_url aimed at link-local, RFC1918 or the cloud
 *      metadata endpoint, from an app whose whole pitch is "nothing leaves your
 *      machine without a signed authority".
 *   2. Key exfiltration — the provider key is attached as a header to whatever
 *      base_url says, so an attacker-chosen host received the user's API key.
 *
 * The refusal must be in words, before any fetch, and must not leak the key
 * into the error text. This probe pins the TS boundary; probe/egressAlign and
 * the Rust `egress_guard` mirror carry the same policy natively.
 */
import { checkEgressUrl } from "../src/security/guardrail";
import * as fs from "node:fs";
import * as path from "node:path";

// Source-tree root, resolved the way every other disk-reading probe does it
// (docIdentity / legacyCompat / shellAffordances / versionDrift) so this file
// still works when it is bundled into verify/suites/ for the zero-install pack —
// where import.meta.url points at verify/, not the repo.
const ROOT: string = process.env.HANDLE_ROOT ?? process.cwd();
const readSrc = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), "utf8");

let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(label: string, cond: boolean, detail = ""): void {
  if (cond) { passed += 1; console.log(`  ok   ${label}`); }
  else { failed += 1; failures.push(`${label}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
function section(name: string): void { console.log(`\n== ${name}`); }

section("1. the hosts a hostile base_url would aim at are refused");
const ATTACK = [
  ["169.254.169.254", "cloud metadata (AWS/Azure IMDS)"],
  ["http://169.254.169.254/latest/meta-data/iam/security-credentials/", "cloud metadata with a path"],
  ["metadata.google.internal", "cloud metadata (GCP)"],
  ["http://10.0.0.5/admin", "RFC1918 10/8"],
  ["http://192.168.1.1/router", "RFC1918 192.168/16"],
  ["http://172.16.0.1/internal", "RFC1918 172.16/12"],
  ["http://169.254.10.1", "link-local"],
  ["http://[fd00::1]/admin", "IPv6 unique-local"],
  ["http://[fe80::1]/admin", "IPv6 link-local"],
  ["http://0.0.0.0:8080", "unspecified address"],
  ["http://redis.internal:6379", "internal suffix"],
  ["http://db.local:5432", "local suffix"],
  ["file:///etc/passwd", "non-http scheme"],
  ["gopher://127.0.0.1:11211/", "non-http scheme"],
];
for (const [url, why] of ATTACK) {
  ok(`refused — ${why} (${url})`, !checkEgressUrl(url).ok, checkEgressUrl(url).reason);
}

section("2. loopback stays ALLOWED — local models are documented product surface");
for (const url of [
  "http://127.0.0.1:11434",
  "http://localhost:11434",
  "http://127.0.0.1:8080/v1/chat/completions",
]) {
  ok(`allowed — ${url}`, checkEgressUrl(url).ok, checkEgressUrl(url).reason);
}

section("3. the normal provider surface is untouched");
for (const url of [
  "https://api.openai.com/v1/chat/completions",
  "https://api.anthropic.com/v1/messages",
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "https://api.groq.com/openai/v1/chat/completions",
  "https://openrouter.ai/api/v1/chat/completions",
  "https://my-corp-llm.example.com/v1",
]) {
  ok(`allowed — ${url}`, checkEgressUrl(url).ok, checkEgressUrl(url).reason);
}

section("4. the boundary itself refuses before any fetch");
{
  // The contract the fix relies on: llmChat throws on a refused base_url rather
  // than reaching fetch. Source-level pin, because exercising the real boundary
  // needs a Tauri host and a secret store.
  const src = readSrc("src/ipc/client.ts");
  const body = src.slice(src.indexOf("llmChat: async"), src.indexOf("fsRead: async"));
  ok("ipc.llmChat applies the egress guard", /checkEgressUrl\(/.test(body));
  ok("the guard runs BEFORE the tauri invoke", body.indexOf("checkEgressUrl(") < body.indexOf('tauriInvoke("llm_chat"'));
  ok("a refusal throws instead of returning a result", /throw new Error/.test(body));
  ok("the refusal says no key left the machine", /no key left this machine/.test(body));
  ok("the guarded (trimmed) base_url is what reaches the native handler", /base_url: target/.test(body));
}

section("5. the native handler enforces the same policy");
{
  const rs = readSrc("src-tauri/src/commands.rs");
  ok("llm_chat calls egress_guard", /egress_guard\(/.test(rs));
  ok("the ollama path is guarded", /ollama base URL refused/.test(rs));
  ok("the cloud path is guarded", /base URL refused by the egress guard/.test(rs));
  const guard = rs.slice(rs.indexOf("fn egress_guard"), rs.indexOf("#[tauri::command]\npub async fn llm_chat"));
  for (const needle of ["169.254.169.254", "metadata.google.internal", "192.168.", ".internal", ".local", ".localhost"]) {
    ok(`native guard refuses ${needle}`, guard.includes(needle));
  }
  ok("native guard allows loopback (no blanket 127. refusal)", !/127\.0\.0\.1/.test(guard));
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
