/* ============================================================================
 * VOUCH-RECEIPT BRIDGE — SelfImpulse 17.6 "Patina"
 * ----------------------------------------------------------------------------
 * The cross-org capability channel's trust anchor.
 *
 * WHAT IT DOES
 *   Patina's agent OS proves its work with vh-proof-receipt/2 receipts
 *   (SHA-256 hash-chained events + published-constant HMAC soft seal +
 *   optional Ed25519 issuer signature over the chain head). The SelfImpulse
 *   protocol (protocol/src) carries trust BETWEEN machines and organizations.
 *   This bridge connects the two: a VERIFIED receipt is anchored into the
 *   vouch chain as a signature-bound agent_action fact, so a receipt produced
 *   on one machine becomes a portable, policy-governed, revocable vouch on
 *   any harbor.
 *
 * ALIGNMENT GUARANTEES
 *   • Receipt verification mirrors tools/verify-receipt.mjs exactly:
 *       prev starts at 64 zeros; hash = sha256hex(canon(event-without-hash));
 *       canon = deep-sorted-key JSON; seal = HMAC-SHA256(head, public secret
 *       for the format); optional Ed25519 over the raw head bytes (SPKI key).
 *   • Envelopes are WIRE-COMPATIBLE with sealSecure/openSecure in
 *     protocol/src/core/vh-crypto.js: same {p, n, ts, sig} shape, same
 *     `${p}|${n}|${ts}` signing payload, ECDSA P-256/SHA-256, IEEE-P1363
 *     (raw r||s) signatures, base64.
 *   • The anchored fact passes protocol policy (action charset, evidence
 *     length) and the centralized signer↔actor BindingValidator.
 *
 * DEPENDENCIES: node builtins only (node:crypto). Zero npm install —
 * in the culture of verify-receipt.mjs: a shipped verifier must run anywhere.
 * ========================================================================== */

import crypto from "node:crypto";

/* ── receipt wire constants (published in tools/verify-receipt.mjs) ──────── */
const SEAL_SECRETS = {
  "vh-proof-receipt/2": "vh-commercial-v1-offline",
  "mj-proof-receipt/2": "mj-commercial-v1-offline",
  "mj-proof-receipt/1": "mj-commercial-v1-offline",
};
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const GENESIS = "0".repeat(64);

/* ── canonicalization (must stay byte-identical to the verifier) ────────── */
function sortDeep(v) {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortDeep(v[k]);
    return out;
  }
  return v;
}
const canon = (o) => JSON.stringify(sortDeep(o));
const sha256hex = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex");
const hmacHex = (s, format) =>
  crypto.createHmac("sha256", SEAL_SECRETS[format]).update(s, "utf8").digest("hex");

/* ── ECDSA P-256 envelope primitives (wire-compatible with vh-crypto.js) ── */
const b64e = (buf) => Buffer.from(buf).toString("base64");
const b64d = (s) => Buffer.from(s, "base64");

export function generateBridgeIdentity(name = "bridge") {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const fp = sha256hex(`${jwk.crv}|${jwk.x}|${jwk.y}`).slice(0, 16).toUpperCase();
  return { name, fp, publicKey, privateKey, publicJwk: jwk };
}

/** Wire-compatible with sealSecure(): signs `${p}|${n}|${ts}` with ECDSA P-256. */
export function sealFact(facts, privateKey) {
  const p = JSON.stringify(facts);
  const n = crypto.randomBytes(16).toString("hex");
  const ts = Date.now();
  const sig = crypto.sign("sha256", Buffer.from(`${p}|${n}|${ts}`, "utf8"),
    { key: privateKey, dsaEncoding: "ieee-p1363" });
  return { p, n, ts, sig: b64e(sig) };
}

/** Wire-compatible with openSecure() (stateless: window check, no replay map). */
export function openFact(env, signerPublicJwk, { windowMs = 5 * 60_000 } = {}) {
  if (!env || typeof env.p !== "string" || typeof env.n !== "string" || typeof env.ts !== "number")
    return { payload: null, verified: false, reason: "malformed-envelope" };
  if (env.n.length < 16 || env.n.length > 64)
    return { payload: null, verified: false, reason: "invalid-nonce-length" };
  if (Math.abs(Date.now() - env.ts) > windowMs)
    return { payload: null, verified: false, reason: "stale-envelope" };
  let ok = false;
  try {
    const key = crypto.createPublicKey({ key: signerPublicJwk, format: "jwk" });
    ok = crypto.verify("sha256", Buffer.from(`${env.p}|${env.n}|${env.ts}`, "utf8"),
      { key, dsaEncoding: "ieee-p1363" }, b64d(env.sig));
  } catch { ok = false; }
  if (!ok) return { payload: null, verified: false, reason: "bad-signature" };
  try { return { payload: JSON.parse(env.p), verified: true }; }
  catch { return { payload: null, verified: false, reason: "unparseable-payload" }; }
}

/* ══════════════════ RECEIPT VERIFICATION (mirror rules) ══════════════════ */

/**
 * Verify a vh-proof-receipt/2 (or legacy mj-*) receipt.
 * Same rules, same order, same verdicts as tools/verify-receipt.mjs.
 * @returns {{ok:boolean, reason?:string, head?:string, events?:number, signed?:boolean}}
 */
export function verifyReceiptChain(rc) {
  if (!rc || typeof rc !== "object") return { ok: false, reason: "not-a-receipt" };
  if (!SEAL_SECRETS[rc.format]) return { ok: false, reason: `unknown format ${rc.format}` };
  if (!Array.isArray(rc.events)) return { ok: false, reason: "missing events" };

  let prev = GENESIS;
  for (const e of rc.events) {
    if (e.prev !== prev) return { ok: false, reason: `chain broken at seq ${e.seq}` };
    const { hash, ...body } = e;
    if (sha256hex(canon(body)) !== hash) return { ok: false, reason: `hash mismatch at seq ${e.seq}` };
    prev = hash;
  }
  if (hmacHex(prev, rc.format) !== rc.seal) return { ok: false, reason: "seal mismatch" };

  if ((rc.format === "vh-proof-receipt/2" || rc.format === "mj-proof-receipt/2") && rc.signature) {
    if (!rc.issuer?.publicKeyHex || !/^[0-9a-fA-F]{64}$/.test(rc.issuer.publicKeyHex))
      return { ok: false, reason: "receipt is signed but carries no issuer public key" };
    const spki = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(rc.issuer.publicKeyHex, "hex")]);
    const okSig = crypto.verify(null, Buffer.from(prev, "hex"),
      crypto.createPublicKey({ key: spki, format: "der", type: "spki" }),
      Buffer.from(rc.signature, "hex"));
    if (!okSig) return { ok: false, reason: `issuer signature verification FAILED for chain head ${prev}` };
  }
  return { ok: true, head: prev, events: rc.events.length, signed: Boolean(rc.signature) };
}

/** Out-of-band issuer fingerprint (same derivation as tools/verify-receipt.mjs). */
export function issuerFingerprint(publicKeyHex) {
  return sha256hex(Buffer.from(publicKeyHex, "hex").toString("latin1")).slice(0, 16);
}

/* ══════════════════════ ANCHORING INTO THE VOUCH CHAIN ═══════════════════ */

/**
 * Canonical, policy-safe evidence string for an anchored receipt.
 * Charset stays inside the protocol's action/evidence allowlist.
 */
export function receiptEvidence(rc, verdict) {
  const issuer = rc.signature && rc.issuer?.publicKeyHex
    ? `issuer:${issuerFingerprint(rc.issuer.publicKeyHex)}` : "issuer:unsigned";
  return `receipt:${rc.format}:head:${verdict.head}:events:${verdict.events}:seal:ok:${issuer}`;
}

/**
 * Build the VH vouch fact that anchors a VERIFIED receipt.
 *   kind   = agent_action          (governed by policy + authorization gate)
 *   action = anchor_receipt        (charset-safe)
 * The caller must be the actor: facts.agent.fp must equal the signer's fp
 * (BindingValidator enforces this on both SDK and harbor sides).
 */
export function buildAnchorFact({ receipt, verdict, agent, purpose = "cross-org-proof-anchoring" }) {
  if (!verdict?.ok) throw new Error("buildAnchorFact: receipt must be verified first");
  if (!agent?.fp || typeof agent.fp !== "string") throw new Error("buildAnchorFact: agent.fp required");
  return {
    v: 2, kind: "agent_action",
    agent: { n: String(agent.name ?? "").trim().slice(0, 60), fp: agent.fp },
    action: "anchor_receipt",
    tool: "vouch-receipt-bridge",
    purpose: String(purpose).trim().slice(0, 200),
    policy: null,
    evidence: receiptEvidence(receipt, verdict).slice(0, 2000),
    result: "success",
    ts: Date.now(),
  };
}

/**
 * End-to-end: verify receipt → build anchor fact → seal envelope.
 * Refuses in words if the receipt does not verify.
 */
export function anchorReceipt(identity, receipt, { purpose } = {}) {
  const verdict = verifyReceiptChain(receipt);
  if (!verdict.ok) return { ok: false, reason: verdict.reason };
  const facts = buildAnchorFact({ receipt, verdict, agent: { name: identity.name, fp: identity.fp }, purpose });
  const env = sealFact(facts, identity.privateKey);
  return { ok: true, env, facts, verdict, evidence: facts.evidence };
}

/**
 * Verify an anchored envelope: signature + window + well-formed evidence.
 * (Harbors additionally run PolicyEngine + assertSignerBinding + the
 *  authorization gate before recording the fact.)
 */
export function verifyAnchor(env, signerPublicJwk) {
  const opened = openFact(env, signerPublicJwk);
  if (!opened.verified) return { ok: false, reason: opened.reason };
  const facts = opened.payload;
  if (facts?.kind !== "agent_action" || facts.action !== "anchor_receipt")
    return { ok: false, reason: "not-an-anchor-fact" };
  if (!/receipt:[a-z0-9/-]+:head:[0-9a-f]{64}:events:\d+:seal:ok:issuer:[0-9a-f]{16}|issuer:unsigned$/.test(facts.evidence ?? ""))
    return { ok: false, reason: "malformed-anchor-evidence" };
  return { ok: true, facts };
}
