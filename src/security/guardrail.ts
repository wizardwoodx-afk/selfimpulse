/**
 * SelfImpulse GuardRail — one decision seam in front of every action.
 *
 * The 17.6.2 governance pipeline (risk classification → human gate → signed
 * receipt) decides WHETHER an action may run. The GuardRail decides whether
 * the action's CONTENT is safe to even consider — before schema validation,
 * before the gate, before anything executes. It is the product's content
 * firewall, probe-pinned by probe/guardrail.test.ts:
 *
 *   1. sanitizeText      — control characters and invisible/override Unicode
 *                          are stripped; length is capped. What a human reads
 *                          on an approval card is what executes.
 *   2. detectInjection   — heuristic detectors for prompt-injection payloads
 *                          arriving as DATA (web hits, documents, memory
 *                          facts, tool arguments): role hijack, fake tool-call
 *                          markers, encoded blobs, exfiltration phrasing,
 *                          invisible-character smuggling. Findings are labeled,
 *                          never silently dropped.
 *   3. scanArgs          — recursive argument integrity: prototype-pollution
 *                          keys refused, depth and size capped.
 *   4. RateGate          — sliding-window rate limiting per key, so no caller
 *                          (seat, MCP client, script) can flood the pipeline.
 *   5. checkEgressUrl    — URL policy for anything the engine fetches:
 *                          http(s) only; cloud-metadata and link-local
 *                          targets refused (local-first services on
 *                          localhost stay allowed — that is documented
 *                          product surface, pinned in the desktop CSP).
 *   6. scanToolCall      — the aggregate gate applied to every tool call.
 *
 * Every function is pure and dependency-free: the same module runs in the
 * browser edition, the Tauri shell and the stdio MCP engine bundle.
 */

export interface GuardrailFinding {
  code: string;
  reason: string;
}

export type GuardrailVerdict =
  | { ok: true; warnings: string[] }
  | { ok: false; code: string; reason: string };

/* ── 1. text sanitization ─────────────────────────────────────────────────── */

/** Control characters (newline/tab kept) and invisible/override Unicode. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE_UNICODE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u{E0000}-\u{E007F}]/gu;

export function sanitizeText(text: string, maxLen = 2000): string {
  return text
    .replace(CONTROL_CHARS, "")
    .replace(INVISIBLE_UNICODE, "")
    .slice(0, maxLen)
    .trim();
}

/* ── 2. prompt-injection detection ────────────────────────────────────────── */

const INJECTION_DETECTORS: Array<{ code: string; reason: string; test: (t: string) => boolean }> = [
  {
    code: "role-hijack",
    reason: "content tries to override the agent's role or instructions",
    test: (t) =>
      /ignore\s+(all\s+|any\s+|previous\s+|prior\s+|above\s+)*instructions/i.test(t) ||
      /disregard\s+(all\s+|any\s+|previous\s+|prior\s+)*instructions/i.test(t) ||
      /you\s+are\s+now\s+(a|an|in)\b/i.test(t) ||
      /new\s+system\s+prompt/i.test(t),
  },
  {
    code: "fake-system-marker",
    reason: "content contains forged system/role delimiters",
    test: (t) =>
      /<\/?\s*system\s*>/i.test(t) ||
      /\[\s*(SYSTEM|INST|SYS)\s*\]/i.test(t) ||
      /^system\s*:/im.test(t) && /assistant\s*:/i.test(t),
  },
  {
    code: "fake-tool-call",
    reason: "content embeds forged tool/function-call markup",
    test: (t) =>
      /\[\s*tool(_use|_call|_result)?\s*\]/i.test(t) ||
      /<\s*\/?\s*(antml|function_call|tool_use|invoke)\b/i.test(t) ||
      /\{\s*"name"\s*:\s*"[a-z0-9_.-]{1,64}"\s*,\s*"arguments"/i.test(t),
  },
  {
    code: "encoded-payload",
    reason: "content carries a long encoded blob (base64-class) that hides instructions from review",
    test: (t) => /[A-Za-z0-9+/]{80,}={0,2}/.test(t),
  },
  {
    code: "exfiltration-prompt",
    reason: "content asks for credentials/secrets to be sent somewhere",
    test: (t) =>
      /(api[_ -]?key|secret[_ -]?key|access[_ -]?token|password|credentials?).{0,60}(send|post|upload|fetch|transmit|exfiltrate|to\s+https?:)/i.test(t),
  },
  {
    code: "html-data-uri",
    reason: "content embeds an executable data: URI",
    test: (t) => /data\s*:\s*text\/html/i.test(t) || /javascript\s*:/i.test(t),
  },
  {
    code: "invisible-characters",
    reason: "content contains invisible/zero-width characters (smuggling surface)",
    test: (t) => INVISIBLE_UNICODE.test(t),
  },
];

/**
 * Scan untrusted text for injection payloads. Returns findings — the caller
 * decides the consequence (refuse, flag on the approval card, or both).
 * Detectors are deliberately heuristic and conservative: this is a guardrail
 * that labels, not a model that judges.
 */
export function detectInjection(text: string): GuardrailFinding[] {
  if (!text) return [];
  const findings: GuardrailFinding[] = [];
  for (const d of INJECTION_DETECTORS) {
    if (d.test(text)) findings.push({ code: d.code, reason: d.reason });
  }
  return findings;
}

/* ── 3. argument integrity ────────────────────────────────────────────────── */

const POISON_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const MAX_ARG_DEPTH = 12;
const MAX_ARG_JSON_CHARS = 262_144;
const MAX_ARG_STRING_CHARS = 100_000;

/**
 * Recursively scan tool-call arguments. Refuses prototype-pollution keys at
 * any depth, and caps depth/size so no argument can be a denial-of-service.
 */
export function scanArgs(value: unknown, depth = 0): GuardrailFinding | null {
  if (depth > MAX_ARG_DEPTH) {
    return { code: "args-too-deep", reason: `arguments nested deeper than ${MAX_ARG_DEPTH} levels — refused` };
  }
  if (typeof value === "string") {
    if (value.length > MAX_ARG_STRING_CHARS) {
      return { code: "arg-string-too-large", reason: `a string argument exceeds ${MAX_ARG_STRING_CHARS} chars — refused` };
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000) {
      return { code: "args-too-many", reason: "an array argument exceeds 10,000 entries — refused" };
    }
    for (const item of value) {
      const r = scanArgs(item, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (POISON_KEYS.has(key)) {
        return { code: "prototype-pollution", reason: `argument key "${key}" is a prototype-pollution vector — refused` };
      }
      const r = scanArgs((value as Record<string, unknown>)[key], depth + 1);
      if (r) return r;
    }
    return null;
  }
  return null;
}

/* ── 4. rate limiting ─────────────────────────────────────────────────────── */

/** Sliding-window rate limiter. Pure in-memory state, one instance per face. */
export class RateGate {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number, private readonly now: () => number = () => Date.now()) {}

  /** Returns true when the action is within budget (and records it). */
  check(key: string): boolean {
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
}

/* ── 5. egress URL policy ─────────────────────────────────────────────────── */

const BLOCKED_HOST_SUFFIXES = [".internal", ".local", ".localhost"];

/**
 * URL policy for engine-side fetches. http(s) only; the cloud metadata
 * endpoint and link-local range are refused (SSRF); localhost stays allowed
 * because self-hosted local services (SearXNG, a local LLM) are documented,
 * consented product surface — the desktop CSP pins the same allowance.
 */
import { classifyIp, isObfuscatedIpv4Literal, normalizeHost } from "./egressNet";

export function checkEgressUrl(raw: string): { ok: boolean; reason: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "not a parseable URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `scheme "${u.protocol}" refused — only http(s) egress is allowed` };
  }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  /* LITERAL addresses go through the ONE classifier (egressNet): IPv4-mapped
     IPv6, expanded IPv6 and every other spelling of a private address are
     classified by the implementation the rest of the product trusts, so this
     guard cannot drift from it the way a second hand-written regex always
     eventually does (the audit finding that motivated the delegation).
     metadata.google.internal is a NAME, not an address — kept below. */
  const literal = normalizeHost(host);
  if (literal.kind !== "unknown") {
    const cls = classifyIp(literal, true); // loopback stays allowed: local LLM / SearXNG surface
    if (!cls.ok) return { ok: false, reason: `${literal.ip} — ${cls.reason}` };
    return { ok: true, reason: "" };
  }
  if (isObfuscatedIpv4Literal(host)) {
    return { ok: false, reason: `obfuscated IP literal "${host}" refused — write the address in dotted-quad form (SSRF guard)` };
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
  /* RFC1918 / unique-local — SSRF into the LAN is refused. Loopback stays
     allowed because a local LLM or SearXNG is documented product surface. */
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

/* ── 6. the aggregate gate ────────────────────────────────────────────────── */

const TOOL_NAME_RE = /^[a-z0-9_.]{1,64}$/;

/** Default rate budget per tool: 120 calls per rolling minute per face. */
export const callRateGate = new RateGate(120, 60_000);

/**
 * The GuardRail's verdict on one proposed tool call. Applied BEFORE schema
 * validation and the human gate: a refusal here means the pipeline never
 * even simulates the action, and the refusal is still receipt-selfimpulseed by
 * the caller — the audit trail records guardrail denials like every other.
 */
export function scanToolCall(tool: string, args: Record<string, unknown>): GuardrailVerdict {
  if (!TOOL_NAME_RE.test(tool)) {
    return { ok: false, code: "bad-tool-name", reason: `tool name "${String(tool).slice(0, 40)}" refused — names are [a-z0-9_.] only` };
  }
  const argFinding = scanArgs(args);
  if (argFinding) return { ok: false, code: argFinding.code, reason: argFinding.reason };

  let serialized = "";
  try {
    serialized = JSON.stringify(args ?? {});
  } catch {
    return { ok: false, code: "args-not-serializable", reason: "arguments are not plain JSON — refused" };
  }
  if (serialized.length > MAX_ARG_JSON_CHARS) {
    return { ok: false, code: "args-too-large", reason: `arguments exceed ${MAX_ARG_JSON_CHARS} chars serialized — refused` };
  }

  if (!callRateGate.check(tool)) {
    return { ok: false, code: "rate-limited", reason: `tool "${tool}" exceeded its rate budget — slow down` };
  }

  // Injection scan over string arguments — findings WARN (they flag the
  // approval card and the receipt) rather than deny: content that merely
  // looks like an injection attempt is labeled for the human, and the
  // deny-power stays with the rules above and the human gate.
  const warnings: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "string") {
      for (const f of detectInjection(v)) warnings.push(`${f.code}: ${f.reason}`);
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v !== null && typeof v === "object") {
      for (const x of Object.values(v as Record<string, unknown>)) walk(x);
    }
  };
  walk(args);
  return { ok: true, warnings };
}

/**
 * Cryptographically-strong id — never Math.random for anything
 * security-relevant. Emitted as prefix + 32 lowercase hex chars (128 bits,
 * dash-free): strong AND wire-compatible with the gate's documented id
 * shape (`a[0-9a-z]+`), which external clients and the probe suites parse.
 */
export function secureId(prefix: string): string {
  const c = globalThis.crypto;
  const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (c && typeof c.randomUUID === "function") return `${prefix}${c.randomUUID().replace(/-/g, "")}`;
  if (c && typeof c.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return `${prefix}${hex(bytes)}`;
  }
  throw new Error("no secure random source available — refusing to mint an id");
}
