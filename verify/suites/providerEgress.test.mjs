import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// src/security/guardrail.ts
var RateGate = class {
  constructor(limit, windowMs, now = () => Date.now()) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }
  hits = /* @__PURE__ */ new Map();
  /** Returns true when the action is within budget (and records it). */
  check(key) {
    const t = this.now();
    const arr = (this.hits.get(key) ?? []).filter((x) => t - x < this.windowMs);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(t);
    this.hits.set(key, arr);
    return true;
  }
};
var BLOCKED_HOST_SUFFIXES = [".internal", ".local", ".localhost"];
function checkEgressUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "not a parseable URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `scheme "${u.protocol}" refused \u2014 only http(s) egress is allowed` };
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "169.254.169.254" || host === "metadata.google.internal") {
    return { ok: false, reason: "cloud metadata endpoint refused (SSRF guard)" };
  }
  if (/^169\.254\./.test(host)) {
    return { ok: false, reason: "link-local address refused (SSRF guard)" };
  }
  if (host === "0.0.0.0" || host === "::") {
    return { ok: false, reason: "unspecified address refused" };
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return { ok: false, reason: "private network address refused (SSRF guard)" };
  }
  if (/^(fc|fd)[0-9a-f]{0,2}:/i.test(host) || /^fe80:/i.test(host)) {
    return { ok: false, reason: "IPv6 unique-local / link-local refused (SSRF guard)" };
  }
  for (const sfx of BLOCKED_HOST_SUFFIXES) {
    if (host.endsWith(sfx)) return { ok: false, reason: `host suffix "${sfx}" refused` };
  }
  return { ok: true, reason: "" };
}
var callRateGate = new RateGate(120, 6e4);

// probe/providerEgress.test.ts
import * as fs from "node:fs";
import * as path from "node:path";
var ROOT = process.env.HANDLE_ROOT ?? process.cwd();
var readSrc = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
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
section("1. the hosts a hostile base_url would aim at are refused");
var ATTACK = [
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
  ["gopher://127.0.0.1:11211/", "non-http scheme"]
];
for (const [url, why] of ATTACK) {
  ok(`refused \u2014 ${why} (${url})`, !checkEgressUrl(url).ok, checkEgressUrl(url).reason);
}
section("2. loopback stays ALLOWED \u2014 local models are documented product surface");
for (const url of [
  "http://127.0.0.1:11434",
  "http://localhost:11434",
  "http://127.0.0.1:8080/v1/chat/completions"
]) {
  ok(`allowed \u2014 ${url}`, checkEgressUrl(url).ok, checkEgressUrl(url).reason);
}
section("3. the normal provider surface is untouched");
for (const url of [
  "https://api.openai.com/v1/chat/completions",
  "https://api.anthropic.com/v1/messages",
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "https://api.groq.com/openai/v1/chat/completions",
  "https://openrouter.ai/api/v1/chat/completions",
  "https://my-corp-llm.example.com/v1"
]) {
  ok(`allowed \u2014 ${url}`, checkEgressUrl(url).ok, checkEgressUrl(url).reason);
}
section("4. the boundary itself refuses before any fetch");
{
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
console.log(`
${passed} passed, ${failed} failed.`);
if (failed) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
