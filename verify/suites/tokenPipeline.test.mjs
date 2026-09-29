import { createRequire as __mjCreateRequire } from "node:module"; const require = __mjCreateRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/engine/tokenOptim.ts
var tokenOptim_exports = {};
__export(tokenOptim_exports, {
  PROMPT_BUDGET: () => PROMPT_BUDGET,
  WIRE_BUDGET: () => WIRE_BUDGET,
  clearTokenLedger: () => clearTokenLedger,
  collapseRepeatedLines: () => collapseRepeatedLines,
  estimateTokens: () => estimateTokens,
  fitToBudget: () => fitToBudget,
  fnv1a: () => fnv1a,
  normalizeWhitespace: () => normalizeWhitespace,
  optimDelta: () => optimDelta,
  optimizeComposedPrompt: () => optimizeComposedPrompt,
  optimizeWirePair: () => optimizeWirePair,
  recordUsage: () => recordUsage,
  resetWireCacheState: () => resetWireCacheState,
  usageReport: () => usageReport,
  wireEventSeq: () => wireEventSeq
});
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}
function fnv1a(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let h2 = 2166136261 ^ 2654435769;
  for (let i = text.length - 1; i >= 0; i--) {
    h2 ^= text.charCodeAt(i);
    h2 = Math.imul(h2, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
function fitToBudget(text, budgetTokens) {
  const total = estimateTokens(text);
  if (total <= budgetTokens) return { text, trimmed: false, savedTokens: 0 };
  const keepChars = Math.max(400, budgetTokens * 4 - 120);
  const headLen = Math.floor(keepChars * 0.6);
  const tailLen = keepChars - headLen;
  const cut = total - budgetTokens;
  const out = `${text.slice(0, headLen)}
[\u2026 ${cut} tokens trimmed by the VH token optimizer \u2014 full playbook preserved in the skill library \u2026]
${text.slice(text.length - tailLen)}`;
  return { text: out, trimmed: true, savedTokens: Math.max(0, total - estimateTokens(out)) };
}
function normalizeWhitespace(text) {
  const out = text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\n +/g, "\n ").trimEnd();
  return { text: out, removedChars: Math.max(0, text.length - out.length) };
}
function collapseRepeatedLines(text, tolerance = 2) {
  if (tolerance < 1) tolerance = 1;
  const lines = text.split("\n");
  const totals = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const t = line.trim();
    if (t.length >= 8 && !/^#|^[-*+] |^```|^\d+\. /.test(t)) totals.set(t, (totals.get(t) ?? 0) + 1);
  }
  const counts = /* @__PURE__ */ new Map();
  const kept = [];
  let collapsed = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 8 || /^#|^[-*+] |^```|^\d+\. /.test(t)) {
      kept.push(line);
      continue;
    }
    const n2 = counts.get(t) ?? 0;
    counts.set(t, n2 + 1);
    if (n2 < tolerance) {
      kept.push(line);
    } else if (n2 === tolerance) {
      collapsed += 1;
      const rest = Math.max(0, (totals.get(t) ?? 0) - tolerance);
      kept.push(`${line}  [\u2026 this exact line repeats ${rest} more time${rest === 1 ? "" : "s"} below \u2014 repeats elided by the token optimizer \u2026]`);
    } else {
      collapsed += 1;
    }
  }
  return { text: kept.join("\n"), collapsed };
}
function recordEvent(e) {
  wireEvents.push(e);
  if (wireEvents.length > EVENT_CAP) wireEvents.splice(0, wireEvents.length - EVENT_CAP);
}
function optimizeWirePair(system, user, ctx = { model: "unknown" }) {
  try {
    const beforeTokens = estimateTokens(system) + estimateTokens(user);
    const nSys = normalizeWhitespace(system);
    const nUsr = normalizeWhitespace(user);
    const cSys = collapseRepeatedLines(nSys.text);
    const cUsr = collapseRepeatedLines(nUsr.text);
    const prefixHash = fnv1a(cSys.text);
    const cacheAligned = lastPrefix !== null && lastPrefix.model === ctx.model && lastPrefix.hash === prefixHash;
    lastPrefix = { model: ctx.model, hash: prefixHash };
    let outSys = cSys.text;
    let outUsr = cUsr.text;
    let budgetTrimmed = false;
    const pair = `${outSys}
${outUsr}`;
    if (estimateTokens(pair) > WIRE_BUDGET) {
      const f = fitToBudget(pair, WIRE_BUDGET);
      if (f.trimmed) {
        const at = f.text.indexOf("\u2026 tokens trimmed by the VH token optimizer");
        const sysPart = at >= 0 ? f.text.slice(0, at) : f.text;
        const usrPart = at >= 0 ? f.text.slice(at) : "";
        outSys = sysPart.replace(/\n$/, "");
        outUsr = usrPart && usrPart.length > 40 ? usrPart : outUsr;
        budgetTrimmed = true;
      }
    }
    const afterTokens = estimateTokens(outSys) + estimateTokens(outUsr);
    const savedTokens = Math.max(0, beforeTokens - afterTokens);
    const report = {
      beforeTokens,
      afterTokens,
      savedTokens,
      savedPct: beforeTokens === 0 ? 0 : Math.round(savedTokens / beforeTokens * 100),
      normalizedChars: nSys.removedChars + nUsr.removedChars,
      collapsedLines: cSys.collapsed + cUsr.collapsed,
      cacheAligned,
      prefixTokens: estimateTokens(outSys),
      budgetTrimmed,
      est: true
    };
    wireSeq += 1;
    recordEvent({ ...report, seq: wireSeq, at: (/* @__PURE__ */ new Date()).toISOString(), model: ctx.model, kind: ctx.kind ?? "provider-call" });
    return { system: outSys, user: outUsr, report };
  } catch {
    const beforeTokens = estimateTokens(system) + estimateTokens(user);
    wireSeq += 1;
    recordEvent({
      seq: wireSeq,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      model: ctx.model,
      kind: ctx.kind ?? "provider-call",
      beforeTokens,
      afterTokens: beforeTokens,
      savedTokens: 0,
      savedPct: 0,
      normalizedChars: 0,
      collapsedLines: 0,
      cacheAligned: false,
      prefixTokens: estimateTokens(system),
      budgetTrimmed: false,
      est: true
    });
    return { system, user, report: { beforeTokens, afterTokens: beforeTokens, savedTokens: 0, savedPct: 0, normalizedChars: 0, collapsedLines: 0, cacheAligned: false, prefixTokens: estimateTokens(system), budgetTrimmed: false, est: true } };
  }
}
function wireEventSeq() {
  return wireSeq;
}
function optimDelta(sinceSeq) {
  const evs = wireEvents.filter((e) => e.seq > sinceSeq);
  return evs.reduce(
    (acc, e) => ({
      calls: acc.calls + 1,
      beforeTokens: acc.beforeTokens + e.beforeTokens,
      afterTokens: acc.afterTokens + e.afterTokens,
      savedTokens: acc.savedTokens + e.savedTokens,
      savedPct: acc.savedPct + e.savedPct,
      normalizedChars: acc.normalizedChars + e.normalizedChars,
      collapsedLines: acc.collapsedLines + e.collapsedLines,
      cacheAligned: acc.cacheAligned || e.cacheAligned,
      prefixTokens: acc.prefixTokens + e.prefixTokens,
      budgetTrimmed: acc.budgetTrimmed || e.budgetTrimmed,
      est: true
    }),
    {
      calls: 0,
      beforeTokens: 0,
      afterTokens: 0,
      savedTokens: 0,
      savedPct: 0,
      normalizedChars: 0,
      collapsedLines: 0,
      cacheAligned: false,
      prefixTokens: 0,
      budgetTrimmed: false,
      est: true
    }
  );
}
function resetWireCacheState() {
  lastPrefix = null;
}
function optimizeComposedPrompt(composed2, budgetTokens = PROMPT_BUDGET) {
  const normalized = normalizeWhitespace(composed2).text;
  const before = estimateTokens(normalized);
  if (before <= budgetTokens) return { prompt: normalized, optimized: false, savedTokens: 0, estimatedTokens: before };
  const MARKER = "## Bound skills";
  const at = normalized.indexOf(MARKER);
  if (at === -1) {
    const f2 = fitToBudget(normalized, budgetTokens);
    return { prompt: f2.text, optimized: f2.trimmed, savedTokens: f2.savedTokens, estimatedTokens: estimateTokens(f2.text) };
  }
  const base = normalized.slice(0, at);
  const skills = normalized.slice(at);
  const condensed = skills.split("\n").filter((line) => /^### Skill:/.test(line) || /^(Procedure:|Checklist:|Quality checklist)/.test(line) || /^\d+\./.test(line.trim()) || line.trim() === "").join("\n").replace(/\n{3,}/g, "\n\n");
  let prompt = base + condensed;
  let est = estimateTokens(prompt);
  if (est <= budgetTokens) {
    return { prompt, optimized: true, savedTokens: before - est, estimatedTokens: est };
  }
  const f = fitToBudget(prompt, budgetTokens);
  est = estimateTokens(f.text);
  return { prompt: f.text, optimized: true, savedTokens: before - est, estimatedTokens: est };
}
function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
function recordUsage(entry, now = () => /* @__PURE__ */ new Date()) {
  const raw = storage()?.getItem(LEDGER_KEY);
  let list = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
  }
  list.push({ ...entry, at: now().toISOString() });
  storage()?.setItem(LEDGER_KEY, JSON.stringify(list.slice(-LEDGER_CAP)));
}
function usageReport() {
  const raw = storage()?.getItem(LEDGER_KEY);
  let list = [];
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
  }
  return list.reduce(
    (acc, e) => ({
      calls: acc.calls + 1,
      promptTokens: acc.promptTokens + e.promptTokens,
      replyTokens: acc.replyTokens + e.replyTokens,
      optimizedCalls: acc.optimizedCalls + (e.optimized ? 1 : 0),
      savedTokens: acc.savedTokens + e.savedTokens
    }),
    { calls: 0, promptTokens: 0, replyTokens: 0, optimizedCalls: 0, savedTokens: 0 }
  );
}
function clearTokenLedger() {
  storage()?.removeItem(LEDGER_KEY);
}
var LEDGER_KEY, LEDGER_CAP, PROMPT_BUDGET, WIRE_BUDGET, EVENT_CAP, wireEvents, wireSeq, lastPrefix;
var init_tokenOptim = __esm({
  "src/engine/tokenOptim.ts"() {
    "use strict";
    LEDGER_KEY = "engine.tokens.v1";
    LEDGER_CAP = 500;
    PROMPT_BUDGET = 6e3;
    WIRE_BUDGET = 24e3;
    EVENT_CAP = 400;
    wireEvents = [];
    wireSeq = 0;
    lastPrefix = null;
  }
});

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
    const n2 = Number(p);
    if (n2 > 255) return null;
    octets.push(n2);
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
function classifyIp(n2, allowLoopback) {
  if (n2.kind === "ipv4" && n2.octets) return classifyV4(n2.octets, allowLoopback);
  if (n2.kind === "ipv6" && n2.groups) return classifyV6(n2.groups, allowLoopback);
  return { ok: false, reason: "address could not be classified", scope: "unknown" };
}
var init_egressNet = __esm({
  "src/security/egressNet.ts"() {
    "use strict";
    init_guardrail();
  }
});

// src/security/guardrail.ts
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
var RateGate, BLOCKED_HOST_SUFFIXES, callRateGate;
var init_guardrail = __esm({
  "src/security/guardrail.ts"() {
    "use strict";
    init_egressNet();
    RateGate = class {
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
    BLOCKED_HOST_SUFFIXES = [".internal", ".local", ".localhost"];
    callRateGate = new RateGate(120, 6e4);
  }
});

// src/engine/providers.ts
var providers_exports = {};
__export(providers_exports, {
  DEFAULT_TIMEOUT_MS: () => DEFAULT_TIMEOUT_MS,
  PROVIDER_DEFAULTS: () => PROVIDER_DEFAULTS,
  complete: () => complete,
  providerFromEnv: () => providerFromEnv,
  redactSecrets: () => redactSecrets
});
function providerFromEnv(env) {
  for (const src of ENV_SOURCES) {
    const apiKey = src.keyVars.map((v) => env[v]).find((v) => typeof v === "string" && v.trim().length > 0);
    if (!apiKey) continue;
    return {
      kind: src.kind,
      baseUrl: (env[src.baseVar] ?? PROVIDER_DEFAULTS[src.kind]).replace(/\/+$/, ""),
      apiKey: apiKey.trim(),
      model: env[src.modelVar] ?? src.defaultModel
    };
  }
  return null;
}
function redactSecrets(text, known = []) {
  let out = text;
  for (const k of known) {
    if (k && k.length >= 8) out = out.split(k).join(`${k.slice(0, 4)}\u2026REDACTED`);
  }
  out = out.replace(/\b(sk-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, "$1\u2026REDACTED");
  out = out.replace(/\b(sk-ant-[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, "$1\u2026REDACTED");
  out = out.replace(/\b(AIza[A-Za-z0-9_-]{6})[A-Za-z0-9_-]+/g, "$1\u2026REDACTED");
  return out;
}
function buildRequest(cfg2, system, user) {
  switch (cfg2.kind) {
    case "openai-compatible":
      return {
        url: `${cfg2.baseUrl}/chat/completions`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${cfg2.apiKey}` },
          body: JSON.stringify({ model: cfg2.model, messages: [{ role: "system", content: system }, { role: "user", content: user }] })
        }
      };
    case "anthropic":
      return {
        url: `${cfg2.baseUrl}/v1/messages`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": cfg2.apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: cfg2.model, max_tokens: 2048, system, messages: [{ role: "user", content: user }] })
        }
      };
    case "gemini":
      return {
        url: `${cfg2.baseUrl}/models/${encodeURIComponent(cfg2.model)}:generateContent`,
        init: {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": cfg2.apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            // Thinking models spend part of the budget on thoughts — give room.
            generationConfig: { maxOutputTokens: 4096 }
          })
        }
      };
  }
}
function extractText(cfg2, body) {
  try {
    if (cfg2.kind === "openai-compatible") {
      const b2 = body;
      return b2.choices?.[0]?.message?.content ?? null;
    }
    if (cfg2.kind === "anthropic") {
      const b2 = body;
      const parts2 = (b2.content ?? []).filter((c2) => c2.type === "text").map((c2) => c2.text ?? "");
      return parts2.length ? parts2.join("") : null;
    }
    const b = body;
    const parts = (b.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "");
    return parts.length ? parts.join("") : null;
  } catch {
    return null;
  }
}
async function complete(cfg2, system, user, opts = {}) {
  if (!cfg2) return { ok: false, kind: "no-key", error: "no provider configured \u2014 supply an API key (env or the Providers door); nothing was executed" };
  if (!cfg2.apiKey || !cfg2.apiKey.trim()) return { ok: false, kind: "no-key", error: "provider key is empty \u2014 nothing was executed" };
  const egress = checkEgressUrl(cfg2.baseUrl);
  if (!egress.ok) return { ok: false, kind: "egress-blocked", error: redactSecrets(`base URL refused by the egress guard: ${egress.reason}`, [cfg2.apiKey]) };
  const wire = optimizeWirePair(system, user, { model: cfg2.model, kind: "provider-call" });
  const { url, init } = buildRequest(cfg2, wire.system, wire.user);
  const doFetch = opts.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!doFetch) return { ok: false, kind: "network", error: "no fetch available in this runtime \u2014 nothing was executed" };
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await doFetch(url, { ...init, signal: controller.signal });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return { ok: false, kind: "http-error", error: redactSecrets(`provider returned HTTP ${res.status}${bodyText ? `: ${bodyText.slice(0, 300)}` : ""}`, [cfg2.apiKey]) };
    }
    const body = await res.json().catch(() => null);
    const text = body == null ? null : extractText(cfg2, body);
    if (text == null || text.length === 0) {
      return { ok: false, kind: "bad-response", error: "provider response carried no usable text \u2014 nothing was executed" };
    }
    return { ok: true, text, model: cfg2.model, latencyMs };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      kind: aborted ? "timeout" : "network",
      error: redactSecrets(aborted ? `provider timed out after ${timeoutMs}ms` : `network failure: ${err instanceof Error ? err.message : String(err)}`, [cfg2.apiKey])
    };
  } finally {
    clearTimeout(timer);
  }
}
var PROVIDER_DEFAULTS, DEFAULT_TIMEOUT_MS, ENV_SOURCES;
var init_providers = __esm({
  "src/engine/providers.ts"() {
    "use strict";
    init_guardrail();
    init_tokenOptim();
    PROVIDER_DEFAULTS = {
      "openai-compatible": "https://api.openai.com/v1",
      anthropic: "https://api.anthropic.com",
      gemini: "https://generativelanguage.googleapis.com/v1"
      // 18.5.0: stable v1 line (review note); the OpenAI-compat path stays v1beta/openai/
    };
    DEFAULT_TIMEOUT_MS = 3e4;
    ENV_SOURCES = [
      { kind: "openai-compatible", keyVars: ["HANDLE_OPENAI_API_KEY", "OPENAI_API_KEY"], baseVar: "HANDLE_OPENAI_BASE_URL", modelVar: "HANDLE_OPENAI_MODEL", defaultModel: "gpt-4.1" },
      { kind: "anthropic", keyVars: ["HANDLE_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY"], baseVar: "HANDLE_ANTHROPIC_BASE_URL", modelVar: "HANDLE_ANTHROPIC_MODEL", defaultModel: "claude-sonnet-4-20250514" },
      { kind: "gemini", keyVars: ["HANDLE_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"], baseVar: "HANDLE_GEMINI_BASE_URL", modelVar: "HANDLE_GEMINI_MODEL", defaultModel: "gemini-2.5-flash" }
    ];
  }
});

// probe/tokenPipeline.test.ts
var passed = 0;
var failed = 0;
var failures = [];
function ok(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    failures.push(`${label}${detail ? ` \u2014 ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}
var {
  estimateTokens: estimateTokens2,
  fitToBudget: fitToBudget2,
  optimizeComposedPrompt: optimizeComposedPrompt2,
  optimizeWirePair: optimizeWirePair2,
  normalizeWhitespace: normalizeWhitespace2,
  collapseRepeatedLines: collapseRepeatedLines2,
  fnv1a: fnv1a2,
  wireEventSeq: wireEventSeq2,
  optimDelta: optimDelta2,
  resetWireCacheState: resetWireCacheState2,
  WIRE_BUDGET: WIRE_BUDGET2
} = await Promise.resolve().then(() => (init_tokenOptim(), tokenOptim_exports));
var { complete: complete2 } = await Promise.resolve().then(() => (init_providers(), providers_exports));
console.log("== estimates and the fitter ==");
ok("estimateTokens is the honest ~4 chars/token", estimateTokens2("12345678") === 2);
ok("fitToBudget leaves short text alone", !fitToBudget2("hello world", 100).trimmed);
var big = "x".repeat(3e3) + "\n" + "keep this tail line".repeat(20);
var fit = fitToBudget2(big, 400);
ok("fitToBudget trims only when over, and MARKS the cut", fit.trimmed && fit.text.includes("trimmed by the VH token optimizer"));
ok("fitToBudget keeps the tail (the checklist)", fit.text.endsWith("keep this tail line".repeat(20).slice(-40)) || fit.text.includes("keep this tail line"));
console.log("== stage 1: normalization ==");
var n = normalizeWhitespace2("a\n\n\n\nb   \nc");
ok("3+ newlines collapse, trailing spaces go, meaning stays", n.text === "a\n\nb\nc" && n.removedChars > 0);
console.log("== stage 2: repeated-line collapse ==");
var rep = ["alpha beta gamma delta", "alpha beta gamma delta", "alpha beta gamma delta", "something else entirely long here"].join("\n");
var c = collapseRepeatedLines2(rep);
ok("a line seen >2\xD7 collapses to the first two + a marker", c.collapsed === 1 && c.text.includes("repeats 1 more time") && c.text.includes("repeats elided by the token optimizer"));
ok("structural lines never collapse", collapseRepeatedLines2("# Header\n# Header").collapsed === 0);
console.log("== fnv1a determinism ==");
ok(
  "same text, same hash; different text, different hash",
  fnv1a2("mission alpha") === fnv1a2("mission alpha") && fnv1a2("mission alpha") !== fnv1a2("mission beta")
);
console.log("== the wire pipeline ==");
resetWireCacheState2();
var seq0 = wireEventSeq2();
var sys = "You are SelfImpulse.\n\n\n\nStay honest.   \nStay honest.";
var usr = "plan a mission";
var w1 = optimizeWirePair2(sys, usr, { model: "m1", kind: "probe" });
ok("pipeline returns usable texts", w1.system.includes("You are SelfImpulse.") && w1.user === "plan a mission");
ok("pipeline report is labelled an estimate", w1.report.est === true);
ok("first call is NOT cache-aligned (no prefix history)", w1.report.cacheAligned === false);
var w2 = optimizeWirePair2(sys, usr, { model: "m1", kind: "probe" });
ok("identical system bytes on the same model ARE cache-aligned", w2.report.cacheAligned === true);
var w3 = optimizeWirePair2(sys, usr, { model: "m2", kind: "probe" });
ok("a different model is NOT cache-aligned", w3.report.cacheAligned === false);
var delta = optimDelta2(seq0);
ok("optimDelta scopes to the run: 3 calls, honest sums", delta.calls === 3 && delta.savedTokens >= 0 && delta.est === true);
ok("the pipeline never turns text into a fabrication", w1.system.includes("Stay honest"));
var hugeSys = Array.from({ length: 4e3 }, (_, i) => `Unique filler line ${i} carrying plenty of padding text so dedup cannot save it here.`).join("\n");
var w4 = optimizeWirePair2(hugeSys, "short task", { model: "m3", kind: "probe" });
ok("the emergency budget guard fires only on egregious overshoot", w4.report.budgetTrimmed === true && estimateTokens2(w4.system + "\n" + w4.user) <= WIRE_BUDGET2 + 900);
console.log("== complete() rides the pipeline ==");
var seq1 = wireEventSeq2();
var cfg = { kind: "openai-compatible", baseUrl: "https://provider.example/v1", apiKey: "sk-test-abcdef123456", model: "probe-1" };
var seenBody = "";
var fakeFetch = (async (_url, init) => {
  seenBody = init?.body ?? "";
  return new Response(JSON.stringify({ choices: [{ message: { content: "the answer" } }] }), { status: 200, headers: { "content-type": "application/json" } });
});
var r = await complete2(cfg, "You are SelfImpulse, the SelfImpulse generalist.", "hello", { fetchImpl: fakeFetch });
ok("complete() succeeds through the pipeline", r.ok === true && r.text === "the answer");
ok("the wire body still carries the system + user roles", seenBody.includes("You are SelfImpulse") && seenBody.includes("hello"));
var d1 = optimDelta2(seq1);
ok("the call landed exactly one pipeline event", d1.calls === 1 && d1.beforeTokens > 0);
console.log("== the composed-prompt fitter still honors skills ==");
var composed = ["Base identity prompt for the specialist.", "## Bound skills", "### Skill: Search", "Procedure: find sources", "1. search the web", "1. read the top result", "1. cite what you used"].join("\n");
var opt = optimizeComposedPrompt2(composed, estimateTokens2(composed) - 5 > 0 ? 10 : 10);
ok("over budget, it trims; the base prompt survives", opt.optimized === true && opt.prompt.includes("Base identity prompt"));
console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("\nfailures:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failed > 0 ? 1 : 0);
