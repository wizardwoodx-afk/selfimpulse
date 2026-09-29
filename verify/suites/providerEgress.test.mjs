import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);

// src/security/egressNet.ts
function expandIpv6(input) {
  let s = input;
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone);
  if (!s.includes(":")) return null;
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${(v4[0] << 8 | v4[1]).toString(16)}:${(v4[2] << 8 | v4[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 ? halves[1] ? halves[1].split(":") : [] : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1) {
    if (head.length !== 8) return null;
  } else if (missing < 0) {
    return null;
  }
  const groups = [];
  for (const g of head) groups.push(parseInt(g, 16));
  for (let i = 0; i < missing; i += 1) groups.push(0);
  for (const g of rest) groups.push(parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 65535)) return null;
  return groups;
}
function parseIpv4(input) {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  const octets = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}
function isObfuscatedIpv4Literal(host) {
  if (/^\d{1,3}(\.\d{1,3}){0,2}$/.test(host)) return true;
  if (/^0[xX][0-9a-fA-F]{1,8}$/.test(host)) return true;
  return false;
}
function normalizeHost(rawHost) {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return { kind: "unknown", ip: "" };
  const v4 = parseIpv4(host);
  if (v4) return { kind: "ipv4", ip: v4.join("."), octets: v4 };
  if (host.includes(":")) {
    const groups = expandIpv6(host);
    if (groups) {
      const isMapped = groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 65535 || groups[5] === 0);
      if (isMapped) {
        const octets = [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255];
        return { kind: "ipv4", ip: octets.join("."), octets };
      }
      return { kind: "ipv6", ip: groups.map((g) => g.toString(16).padStart(4, "0")).join(":"), groups };
    }
  }
  if (isObfuscatedIpv4Literal(host)) return { kind: "unknown", ip: "" };
  return { kind: "unknown", ip: "" };
}
function classifyV4(o, allowLoopback) {
  const [a, b] = o;
  const inCidr = (base, bits) => {
    let acc = 0;
    for (let i = 0; i < 4; i += 1) {
      const rem = bits - i * 8;
      const mask = rem <= 0 ? 0 : rem >= 8 ? 255 : 255 << 8 - rem & 255;
      if ((o[i] & mask) !== (base[i] & mask)) return false;
      acc += 1;
      if (acc > 4) break;
    }
    return true;
  };
  const C = (scope, reason) => ({ ok: false, reason, scope });
  if (a === 127) return allowLoopback ? { ok: true, reason: "", scope: "loopback" } : C("loopback", "loopback address refused (SSRF guard)");
  if (a === 169 && b === 254) {
    if (a === 169 && b === 254 && o[2] === 169 && o[3] === 254) return C("metadata", "cloud metadata endpoint refused (SSRF guard)");
    return C("link-local", "link-local address refused (SSRF guard)");
  }
  if (inCidr([0, 0, 0, 0], 8)) return C("reserved", "this-network address refused (SSRF guard)");
  if (inCidr([10, 0, 0, 0], 8)) return C("private", "private network address refused (SSRF guard)");
  if (inCidr([100, 64, 0, 0], 10)) return C("special", "carrier-grade NAT address refused (SSRF guard)");
  if (inCidr([172, 16, 0, 0], 12)) return C("private", "private network address refused (SSRF guard)");
  if (inCidr([192, 0, 0, 0], 24)) return C("special", "IETF protocol assignment refused (SSRF guard)");
  if (inCidr([192, 0, 2, 0], 24)) return C("special", "documentation range refused (SSRF guard)");
  if (inCidr([192, 88, 99, 0], 24)) return C("special", "6to4 relay anycast refused (SSRF guard)");
  if (inCidr([192, 168, 0, 0], 16)) return C("private", "private network address refused (SSRF guard)");
  if (inCidr([198, 18, 0, 0], 15)) return C("special", "benchmarking range refused (SSRF guard)");
  if (inCidr([198, 51, 100, 0], 24)) return C("special", "documentation range refused (SSRF guard)");
  if (inCidr([203, 0, 113, 0], 24)) return C("special", "documentation range refused (SSRF guard)");
  if (a >= 224 && a <= 239) return C("multicast", "multicast address refused (SSRF guard)");
  if (a >= 240) return C("reserved", "reserved address refused (SSRF guard)");
  return { ok: true, reason: "", scope: "public" };
}
function classifyV6(g, allowLoopback) {
  const hex = g.map((x) => x.toString(16).padStart(4, "0")).join(":");
  const C = (scope, reason) => ({ ok: false, reason, scope });
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) {
    return allowLoopback ? { ok: true, reason: "", scope: "loopback" } : C("loopback", "IPv6 loopback refused (SSRF guard)");
  }
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 0) return C("reserved", "unspecified address refused (SSRF guard)");
  if ((g[0] & 65024) === 64512) return C("private", "IPv6 unique-local refused (SSRF guard)");
  if ((g[0] & 65472) === 65152) return C("link-local", "IPv6 link-local refused (SSRF guard)");
  if ((g[0] & 65280) === 65280) return C("multicast", "IPv6 multicast refused (SSRF guard)");
  if (g[0] === 8193 && g[1] === 3512) return C("special", "IPv6 documentation range refused (SSRF guard)");
  if (g[0] === 100 && g[1] === 65435) {
    const octets = [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255];
    const inner = classifyV4(octets, allowLoopback);
    return inner.ok ? inner : C(inner.scope, `NAT64-embedded address refused (SSRF guard): ${inner.reason}`);
  }
  if (g[0] === 8194) return C("special", `6to4 address refused (SSRF guard): ${hex}`);
  if (g[0] === 8193 && g[1] === 0) return C("special", `Teredo address refused (SSRF guard): ${hex}`);
  return { ok: true, reason: "", scope: "public" };
}
function classifyIp(n, allowLoopback) {
  if (n.kind === "ipv4" && n.octets) return classifyV4(n.octets, allowLoopback);
  if (n.kind === "ipv6" && n.groups) return classifyV6(n.groups, allowLoopback);
  return { ok: false, reason: "address could not be classified", scope: "unknown" };
}

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
  const literal = normalizeHost(host);
  if (literal.kind !== "unknown") {
    const cls = classifyIp(literal, true);
    if (!cls.ok) return { ok: false, reason: `${literal.ip} \u2014 ${cls.reason}` };
    return { ok: true, reason: "" };
  }
  if (isObfuscatedIpv4Literal(host)) {
    return { ok: false, reason: `obfuscated IP literal "${host}" refused \u2014 write the address in dotted-quad form (SSRF guard)` };
  }
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
var ROOT = process.env.SI_ROOT ?? process.cwd();
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
