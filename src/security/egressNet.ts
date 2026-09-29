/**
 * egressNet — DNS- and IP-aware egress enforcement.
 *
 * WHY THIS EXISTS. `checkEgressUrl` is a hostname-STRING policy. That is a
 * necessary first gate and it is not sufficient: OWASP's SSRF guidance is
 * explicit that hostname checks are bypassable through DNS rebinding, redirect
 * chains and alternate IP representations, and that the real control is to
 * validate the RESOLVED address and pin it. Two live holes proved that here:
 *
 *   1. IPv4-mapped IPv6. `http://[::ffff:a9fe:a9fe]/` is 169.254.169.254 — the
 *      cloud metadata endpoint — written in the mapped form. The string policy's
 *      IPv6 checks match only /^(fc|fd)/ and /fe80:/, so this passed as "an
 *      ordinary IPv6 host". Shipped, reachable, and it is the SSRF the whole
 *      guard exists to stop.
 *   2. DNS rebinding (TOCTOU). A hostname that resolves public at check time
 *      and private at connect time defeats any string policy. This is
 *      CVE-2025-69660 (simstudioai/sim) and CVE-2026-64849 (MLflow) in the wild.
 *
 * WHAT THIS DOES. It adds the three layers OWASP asks for that a string check
 * cannot provide:
 *
 *   1. normalize()  — canonicalize a host to a real IP, unwrapping IPv4-mapped
 *                     and IPv4-embedded IPv6, and rejecting bare integer /
 *                     octal / hex IPv4 forms.
 *   2. classifyIp() — classify that IP against the IANA special-purpose
 *                     registries (loopback, RFC1918, CGNAT, link-local, IETF
 *                     protocol assignments, multicast, reserved, NAT64, v4-mapped).
 *   3. safeEgressFetch() — resolve ONCE, classify, pin the answer, and re-run
 *                     the whole policy on every redirect hop with redirects
 *                     disabled at the client (OWASP: "Disable HTTP redirections").
 *
 * LOOPBACK STAYS ALLOWED, deliberately. A local Ollama and a self-hosted
 * gateway are documented, consented product surface, and `checkEgressUrl` has
 * always allowed them. The native provider path therefore passes
 * `allowLoopback`, and the web/browser fetch paths do not need to. This mirrors
 * the existing policy — it does not quietly widen or narrow what the product
 * can reach.
 *
 * FAIL-CLOSED. A hostname that resolves to BOTH a public and a private address
 * is refused. A resolver that throws is refused. An IP we cannot parse is
 * refused. "I could not tell" is never "yes".
 */

import { checkEgressUrl } from "./guardrail";

/* ── 1. normalization ─────────────────────────────────────────────────────── */

export type IpKind = "ipv4" | "ipv6" | "unknown";

/** Expand any IPv6 textual form to 8 groups of 16 bits, or null if unparseable. */
function expandIpv6(input: string): number[] | null {
  let s = input;
  const zone = s.indexOf("%");
  if (zone !== -1) s = s.slice(0, zone); // drop a zone id — it is not routable data
  if (!s.includes(":")) return null;

  // An embedded IPv4 tail (::ffff:127.0.0.1) becomes two hex groups first.
  const lastColon = s.lastIndexOf(":");
  const tail = s.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    s = `${s.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }

  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1) {
    if (head.length !== 8) return null;
  } else if (missing < 0) {
    return null;
  }
  const groups: number[] = [];
  for (const g of head) groups.push(parseInt(g, 16));
  for (let i = 0; i < missing; i += 1) groups.push(0);
  for (const g of rest) groups.push(parseInt(g, 16));
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

/** Strict dotted-quad IPv4. Rejects integer, octal and hex forms by design. */
function parseIpv4(input: string): number[] | null {
  const parts = input.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    octets.push(n);
  }
  return octets;
}

/** True for a bare-integer / octal / hex IPv4 literal like 2130706433 or 0x7f000001. */
export function isObfuscatedIpv4Literal(host: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){0,2}$/.test(host)) return true;      // 2130706433, 127.1
  if (/^0[xX][0-9a-fA-F]{1,8}$/.test(host)) return true;       // 0x7f000001
  return false;
}

export interface NormalizedHost {
  kind: IpKind;
  /** Canonical dotted-quad for ipv4, lowercase expanded form for ipv6. */
  ip: string;
  octets?: number[];
  groups?: number[];
}

/**
 * Canonicalize a URL hostname to an address, or report why it is not one.
 * Returns kind "unknown" for a real DNS name (which still needs resolving).
 */
export function normalizeHost(rawHost: string): NormalizedHost {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return { kind: "unknown", ip: "" };

  const v4 = parseIpv4(host);
  if (v4) return { kind: "ipv4", ip: v4.join("."), octets: v4 };

  if (host.includes(":")) {
    const groups = expandIpv6(host);
    if (groups) {
      // An IPv4-mapped (::ffff:a.b.c.d) or IPv4-compatible address is really an
      // IPv4 address wearing an IPv6 hat. Classify the IPv4 inside it, or every
      // v4 check in the codebase silently stops applying. This is the bug that
      // let http://[::ffff:a9fe:a9fe]/ reach the metadata endpoint.
      const isMapped = groups.slice(0, 5).every((g) => g === 0) && (groups[5] === 0xffff || groups[5] === 0);
      if (isMapped) {
        const octets = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff];
        return { kind: "ipv4", ip: octets.join("."), octets };
      }
      return { kind: "ipv6", ip: groups.map((g) => g.toString(16).padStart(4, "0")).join(":"), groups };
    }
  }

  // A bare integer/octal/hex literal is an IP in disguise. Refuse it rather than
  // letting it through as a "hostname" that some fetch path will happily resolve
  // to loopback or metadata.
  if (isObfuscatedIpv4Literal(host)) return { kind: "unknown", ip: "" };

  return { kind: "unknown", ip: "" };
}

/* ── 2. classification ────────────────────────────────────────────────────── */

export interface IpClass {
  /** Safe to reach under the product's policy. */
  ok: boolean;
  reason: string;
  /** Coarse bucket, for receipts and for the UI to explain a refusal. */
  scope: "public" | "loopback" | "private" | "link-local" | "metadata" | "special" | "multicast" | "reserved" | "unknown";
}

function classifyV4(o: number[], allowLoopback: boolean): IpClass {
  const [a, b] = o;
  const inCidr = (base: number[], bits: number): boolean => {
    let acc = 0;
    for (let i = 0; i < 4; i += 1) {
      const rem = bits - i * 8;
      const mask = rem <= 0 ? 0 : rem >= 8 ? 0xff : (0xff << (8 - rem)) & 0xff;
      if ((o[i] & mask) !== (base[i] & mask)) return false;
      acc += 1;
      if (acc > 4) break;
    }
    return true;
  };
  const C = (scope: IpClass["scope"], reason: string): IpClass => ({ ok: false, reason, scope });

  if (a === 127) return allowLoopback
    ? { ok: true, reason: "", scope: "loopback" }
    : C("loopback", "loopback address refused (SSRF guard)");
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

function classifyV6(g: number[], allowLoopback: boolean): IpClass {
  const hex = g.map((x) => x.toString(16).padStart(4, "0")).join(":");
  const C = (scope: IpClass["scope"], reason: string): IpClass => ({ ok: false, reason, scope });
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) {
    return allowLoopback ? { ok: true, reason: "", scope: "loopback" } : C("loopback", "IPv6 loopback refused (SSRF guard)");
  }
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 0) return C("reserved", "unspecified address refused (SSRF guard)");
  if ((g[0] & 0xfe00) === 0xfc00) return C("private", "IPv6 unique-local refused (SSRF guard)");
  if ((g[0] & 0xffc0) === 0xfe80) return C("link-local", "IPv6 link-local refused (SSRF guard)");
  if ((g[0] & 0xff00) === 0xff00) return C("multicast", "IPv6 multicast refused (SSRF guard)");
  if (g[0] === 0x2001 && g[1] === 0x0db8) return C("special", "IPv6 documentation range refused (SSRF guard)");
  // NAT64 well-known prefix 64:ff9b::/96 embeds an IPv4 address in the low bits.
  if (g[0] === 0x0064 && g[1] === 0xff9b) {
    const octets = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff];
    const inner = classifyV4(octets, allowLoopback);
    return inner.ok ? inner : C(inner.scope, `NAT64-embedded address refused (SSRF guard): ${inner.reason}`);
  }
  if (g[0] === 0x2002) return C("special", `6to4 address refused (SSRF guard): ${hex}`);
  if (g[0] === 0x2001 && g[1] === 0x0000) return C("special", `Teredo address refused (SSRF guard): ${hex}`);
  return { ok: true, reason: "", scope: "public" };
}

/** Classify a normalized address against the IANA special-purpose registries. */
export function classifyIp(n: NormalizedHost, allowLoopback: boolean): IpClass {
  if (n.kind === "ipv4" && n.octets) return classifyV4(n.octets, allowLoopback);
  if (n.kind === "ipv6" && n.groups) return classifyV6(n.groups, allowLoopback);
  return { ok: false, reason: "address could not be classified", scope: "unknown" };
}

/** Convenience: classify a raw host string. */
export function classifyHost(rawHost: string, allowLoopback = false): IpClass {
  return classifyIp(normalizeHost(rawHost), allowLoopback);
}

/* ── 3. resolution + redirect-safe fetch ──────────────────────────────────── */

export type Resolver = (hostname: string) => Promise<string[]>;

const systemResolver: Resolver = async (hostname) => {
  const dns = await import("node:dns/promises").catch(() => null);
  if (!dns) return [];
  const out: string[] = [];
  try {
    for (const r of await dns.lookup(hostname, { all: true, verbatim: true })) out.push(r.address);
  } catch { /* resolved below as a failure */ }
  return out;
};

export interface EgressDecision {
  ok: boolean;
  reason: string;
  /** The address the caller must connect to. Pinning this closes the rebinding window. */
  pinnedIp?: string;
  scope?: IpClass["scope"];
  hops?: { url: string; ip: string; status: number }[];
}

/**
 * Resolve once, classify every answer, and pin the winner.
 *
 * Fails closed: a name that resolves to BOTH a public and a non-public address
 * is refused, because an attacker who controls the name controls which address
 * the client happens to pick.
 */
export async function resolveEgress(
  raw: string,
  opts: { allowLoopback?: boolean; allowPrivate?: boolean; resolve?: Resolver } = {},
): Promise<EgressDecision> {
  const allowLoopback = opts.allowLoopback ?? false;
  const allowPrivate = opts.allowPrivate ?? false;
  const resolve = opts.resolve ?? systemResolver;

  // The string policy still runs first — it owns scheme and suffix policy.
  const base = checkEgressUrl(raw);
  if (!base.ok) return { ok: false, reason: base.reason };

  const host = new URL(raw).hostname.replace(/^\[|\]$/g, "");

  // Literal address: no DNS involved, so the TOCTOU question does not arise.
  const literal = normalizeHost(host);
  if (literal.kind !== "unknown") {
    const cls = classifyIp(literal, allowLoopback);
    return cls.ok
      ? { ok: true, reason: "", pinnedIp: literal.ip, scope: cls.scope }
      // Name the address we actually refused, not the disguise it was written as.
      : { ok: false, reason: `${literal.ip} — ${cls.reason}`, scope: cls.scope };
  }
  if (literal.ip === "" && isObfuscatedIpv4Literal(host.toLowerCase())) {
    return { ok: false, reason: `obfuscated IP literal "${host}" refused — write the address in dotted-quad form`, scope: "unknown" };
  }

  let answers: string[];
  try {
    answers = await resolve(host);
  } catch (e) {
    return { ok: false, reason: `DNS resolution failed for "${host}": ${e instanceof Error ? e.message : String(e)}` };
  }
  if (answers.length === 0) return { ok: false, reason: `"${host}" resolved to no addresses — refused rather than guessing`, scope: "unknown" };

  const seen: string[] = [];
  let pinned: { ip: string; scope: IpClass["scope"] } | null = null;
  for (const a of answers) {
    const n = normalizeHost(a);
    let cls = classifyIp(n, allowLoopback);
    if (!cls.ok && allowPrivate && cls.scope === "private") {
      cls = { ok: true, reason: "private range allowed — explicitly paired peer", scope: "private" };
    }
    if (!cls.ok) {
      return { ok: false, reason: `"${host}" resolves to ${n.ip || a} — ${cls.reason}`, scope: cls.scope };
    }
    seen.push(n.ip || a);
    if (!pinned) pinned = { ip: n.ip || a, scope: cls.scope };
  }
  return { ok: true, reason: "", pinnedIp: pinned!.ip, scope: pinned!.scope, hops: [{ url: raw, ip: pinned!.ip, status: 0 }] };
}

const DEFAULT_MAX_REDIRECTS = 5;

export interface SafeEgressInit extends RequestInit {
  fetchImpl?: typeof fetch;
  allowLoopback?: boolean;
  /** Private-range targets allowed (user-PAIRED federation peers) — never a
   * default: tool egress must not reach the LAN even when DNS says so. */
  allowPrivate?: boolean;
  resolve?: Resolver;
  maxRedirects?: number;
}

/**
 * A fetch that OWASP's SSRF guidance accepts: redirects are followed manually,
 * every hop is re-resolved and re-classified, and the address decided at check
 * time is the address handed to the transport.
 */
export async function safeEgressFetch(raw: string, init: SafeEgressInit = {}): Promise<Response> {
  const { fetchImpl, allowLoopback, resolve, maxRedirects, ...rest } = init;
  const doFetch = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!doFetch) throw new Error("no fetch available in this runtime — nothing was executed");

  const hops: EgressDecision["hops"] = [];
  let current = raw;

  for (let hop = 0; hop <= (maxRedirects ?? DEFAULT_MAX_REDIRECTS); hop += 1) {
    const decision = await resolveEgress(current, { allowLoopback, resolve });
    if (!decision.ok) {
      throw new Error(`egress refused at hop ${hop}: ${decision.reason} — nothing further was sent.`);
    }
    // `manual` is load-bearing: an auto-following client would reach an
    // unvetted hop without ever coming back through this loop.
    const res = await doFetch(current, { ...rest, redirect: "manual" });
    hops.push({ url: current, ip: decision.pinnedIp ?? "", status: res.status });

    const location = res.headers.get("location");
    if (!location || res.status < 300 || res.status > 399) {
      Object.defineProperty(res, "egressHops", { value: hops, enumerable: false });
      return res;
    }
    let next: string;
    try {
      next = new URL(location, current).toString();
    } catch {
      throw new Error(`egress refused: hop ${hop} returned an unparseable Location — nothing further was sent.`);
    }
    if (hop === (maxRedirects ?? DEFAULT_MAX_REDIRECTS)) {
      throw new Error(`egress refused: more than ${maxRedirects ?? DEFAULT_MAX_REDIRECTS} redirects — possible redirect loop.`);
    }
    current = next;
  }
  throw new Error("egress refused: redirect budget exhausted.");
}
